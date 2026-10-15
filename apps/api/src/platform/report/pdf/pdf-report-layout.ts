import type {
  ReportBlock,
  ReportDocumentModel,
  ReportSectionModel,
} from '../report-document';
import {
  CardWriter,
  LAYER,
  PdfLayout,
  firstLines,
  paragraphHeight,
  type LaidParagraph,
  type TextMeasurer,
  type TextOp,
} from './pdf-layout';
import { truncateText } from './pdf-text';
import {
  BOX,
  CARD,
  COLOR,
  CONTENT_BOTTOM,
  CONTENT_WIDTH,
  COVER,
  PAGE,
  PARAGRAPH_GAP,
  TEXT,
  type TextStyle,
} from './pdf-theme';

type Unit =
  | { kind: 'paragraph'; paragraph: LaidParagraph }
  | { kind: 'heading'; paragraph: LaidParagraph }
  | { kind: 'box'; paragraphs: LaidParagraph[] };

/** A contents entry whose page number is filled in after layout. */
interface PendingPageNumber {
  op: TextOp;
  target: string;
  /** The number is right-aligned to this x. */
  right: number;
}

/** Named destination of a section, the target of its contents entry. */
export function sectionAnchor(id: string): string {
  return `section-${id}`;
}

/**
 * Lays out a report: a cover card (title, details, summary, highlights),
 * an optional contents card, one card per section, the disclaimer, and a
 * closing line, like the web app's MCA report.
 */
export function layoutReport(
  model: ReportDocumentModel,
  measurer: TextMeasurer,
): PdfLayout {
  const layout = new PdfLayout(measurer);
  // A summary too long for the cover becomes the first card instead.
  const summaryOnCover = layoutCover(layout, model, true);
  if (!summaryOnCover) layoutCover(layout, model, false);

  const pending = model.includeTableOfContents
    ? layoutContents(layout, model.sections)
    : [];

  for (const section of model.sections) {
    const placement = section.placement ?? 'card';
    if (placement === 'cover-fact') continue;
    if (placement === 'cover-summary' && summaryOnCover) continue;
    layoutSection(layout, section);
  }

  const disclaimer = model.metadata?.disclaimer?.trim();
  if (disclaimer) {
    layoutSection(layout, {
      id: 'disclaimer',
      title: 'Disclaimer',
      icon: 'file-text',
      blocks: [{ text: disclaimer, style: 'note' }],
    });
  }
  layoutClosingLine(layout, model);
  fillPageNumbers(layout, pending);
  return layout;
}

/**
 * The cover card. Returns false, and places nothing, when it would not fit
 * on one page with the summary.
 */
function layoutCover(
  layout: PdfLayout,
  model: ReportDocumentModel,
  withSummary: boolean,
): boolean {
  const measurer = layout.measurer;
  const x = PAGE.marginX + COVER.pad;
  const width = CONTENT_WIDTH - COVER.pad * 2;
  const rows: Array<{ height: number; draw: (top: number) => void }> = [];
  const gap = (height: number) => rows.push({ height, draw: () => undefined });

  // Eyebrow and report version, as in the MCA report's header row.
  const version = `Report ${model.metadata?.reportVersion ?? model.templateVersion}`;
  const versionWidth = badgeWidth(measurer, version, TEXT.badge);
  const eyebrow = truncateText(
    model.title.toUpperCase(),
    width - versionWidth - 12,
    (text) => measurer.width(text, TEXT.eyebrow),
  );
  rows.push({
    height: BADGE_HEIGHT,
    draw: (top) => {
      layout.text(
        x,
        top + (BADGE_HEIGHT - TEXT.eyebrow.leading) / 2,
        eyebrow,
        TEXT.eyebrow,
      );
      badge(layout, x + width - versionWidth, top, version, 'outline');
    },
  });
  rows.push(
    textRow(layout, x, [`Generated ${formatGeneratedAt(model.generatedAt)}`], {
      style: TEXT.coverMeta,
      width,
    }),
  );

  gap(12);
  const name =
    model.metadata?.expertName?.trim() || model.subtitle || model.title;
  rows.push(textRow(layout, x, [name], { style: TEXT.coverName, width }));
  const subline = [model.metadata?.specialty, model.metadata?.city]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ');
  if (subline) {
    rows.push(
      textRow(layout, x, [subline], { style: TEXT.coverSubtitle, width }),
    );
  }

  const facts = model.sections.filter(
    (section) => section.placement === 'cover-fact',
  );
  if (facts.length > 0) {
    gap(12);
    rows.push(factsPanel(layout, x, width, facts));
  }

  const summary = model.sections.find(
    (section) => section.placement === 'cover-summary',
  );
  const summaryText = summary ? blockTexts(summary.blocks) : [];
  if (withSummary && summary && summaryText.length > 0) {
    gap(16);
    rows.push({
      height: BADGE_HEIGHT,
      draw: (top) => badge(layout, x, top, summary.title, 'default'),
    });
    gap(8);
    rows.push(
      textRow(layout, x, summaryText, {
        style: TEXT.summary,
        width,
        gap: 5,
      }),
    );
  }

  const highlights = (model.highlights ?? []).filter((item) => item.trim());
  if (highlights.length > 0) {
    gap(16);
    rows.push(badgeRow(layout, x, width, highlights));
  }

  const height = COVER.pad * 2 + rows.reduce((sum, row) => sum + row.height, 0);
  if (withSummary && height > CONTENT_BOTTOM - PAGE.marginTop) return false;

  const top = layout.y;
  layout.add({
    kind: 'shape',
    frame: {
      page: layout.page,
      x: PAGE.marginX,
      y: top,
      w: CONTENT_WIDTH,
      h: height,
    },
    radius: COVER.radius,
    fill: COLOR.coverFill,
    stroke: COLOR.coverBorder,
    layer: LAYER.coverFill,
  });
  let rowTop = top + COVER.pad;
  for (const row of rows) {
    row.draw(rowTop);
    rowTop += row.height;
  }
  // Sections shown on the cover link here from the contents.
  for (const section of model.sections) {
    const placement = section.placement ?? 'card';
    if (
      placement === 'cover-fact' ||
      (placement === 'cover-summary' && withSummary)
    ) {
      layout.add({
        kind: 'anchor',
        page: layout.page,
        y: top,
        name: sectionAnchor(section.id),
        outline: section.title,
        layer: LAYER.content,
      });
    }
  }
  layout.y = top + height + CARD.gap;
  return true;
}

/** The cover's details: one cell per fact section, up to four per row. */
function factsPanel(
  layout: PdfLayout,
  x: number,
  width: number,
  facts: ReportSectionModel[],
): { height: number; draw: (top: number) => void } {
  const pad = 10;
  const columnGap = 14;
  const rowGap = 8;
  const columns = Math.min(4, facts.length);
  const cellWidth = (width - pad * 2 - columnGap * (columns - 1)) / columns;
  const cells = facts.map((fact) => {
    const label = layout.wrap(
      fact.title.toUpperCase(),
      TEXT.factLabel,
      cellWidth,
    );
    const value = layout.wrap(
      blockTexts(fact.blocks).join(' ') || '—',
      TEXT.factValue,
      cellWidth,
    );
    return {
      label,
      value,
      height:
        label.length * TEXT.factLabel.leading +
        2 +
        value.length * TEXT.factValue.leading,
    };
  });
  const rowHeights: number[] = [];
  for (let start = 0; start < cells.length; start += columns) {
    rowHeights.push(
      Math.max(
        ...cells.slice(start, start + columns).map((cell) => cell.height),
      ),
    );
  }
  const height =
    pad * 2 +
    rowHeights.reduce((sum, value) => sum + value, 0) +
    rowGap * (rowHeights.length - 1);
  return {
    height,
    draw: (top) => {
      layout.add({
        kind: 'shape',
        frame: { page: layout.page, x, y: top, w: width, h: height },
        radius: 6,
        fill: COLOR.white,
        stroke: COLOR.borderLight,
        layer: LAYER.panel,
      });
      let rowTop = top + pad;
      rowHeights.forEach((rowHeight, row) => {
        cells
          .slice(row * columns, row * columns + columns)
          .forEach((cell, column) => {
            const cellX = x + pad + column * (cellWidth + columnGap);
            let lineTop = rowTop;
            for (const line of cell.label) {
              layout.text(cellX, lineTop, line, TEXT.factLabel);
              lineTop += TEXT.factLabel.leading;
            }
            lineTop += 2;
            for (const line of cell.value) {
              layout.text(cellX, lineTop, line, TEXT.factValue);
              lineTop += TEXT.factValue.leading;
            }
          });
        rowTop += rowHeight + rowGap;
      });
    },
  };
}

/** Paragraphs at a fixed width; `gap` is the space between them. */
function textRow(
  layout: PdfLayout,
  x: number,
  texts: string[],
  options: { style: TextStyle; width: number; gap?: number },
): { height: number; draw: (top: number) => void } {
  const paragraphs = texts.map((text) =>
    layout.wrap(text, options.style, options.width),
  );
  const gap = options.gap ?? 0;
  const height =
    paragraphs.reduce(
      (sum, lines) => sum + lines.length * options.style.leading,
      0,
    ) +
    gap * Math.max(0, paragraphs.length - 1);
  return {
    height,
    draw: (top) => {
      let lineTop = top;
      paragraphs.forEach((lines, index) => {
        if (index > 0) lineTop += gap;
        for (const line of lines) {
          layout.text(x, lineTop, line, options.style);
          lineTop += options.style.leading;
        }
      });
    },
  };
}

const BADGE_HEIGHT = 15;
const BADGE_PAD_X = 7;

function badgeWidth(
  measurer: TextMeasurer,
  text: string,
  style: TextStyle,
): number {
  return measurer.width(text, style) + BADGE_PAD_X * 2;
}

/** A pill like the web app's Badge component. */
function badge(
  layout: PdfLayout,
  x: number,
  top: number,
  text: string,
  variant: 'default' | 'secondary' | 'outline',
): number {
  const style = variant === 'default' ? TEXT.badgeStrong : TEXT.badge;
  const width = badgeWidth(layout.measurer, text, style);
  layout.add({
    kind: 'shape',
    frame: { page: layout.page, x, y: top, w: width, h: BADGE_HEIGHT },
    radius: BADGE_HEIGHT / 2,
    fill:
      variant === 'default'
        ? COLOR.primary
        : variant === 'secondary'
          ? COLOR.secondary
          : COLOR.white,
    stroke: variant === 'outline' ? COLOR.border : undefined,
    layer: LAYER.panel,
  });
  layout.text(
    x + BADGE_PAD_X,
    top + (BADGE_HEIGHT - style.leading) / 2,
    text,
    variant === 'secondary' ? { ...style, color: COLOR.body } : style,
  );
  return width;
}

/** Highlight badges, wrapped onto more rows when they do not fit. */
function badgeRow(
  layout: PdfLayout,
  x: number,
  width: number,
  texts: string[],
): { height: number; draw: (top: number) => void } {
  const gap = 6;
  const placed: Array<{ text: string; dx: number; row: number }> = [];
  let dx = 0;
  let row = 0;
  for (const text of texts) {
    const textWidth = badgeWidth(layout.measurer, text, TEXT.badge);
    if (dx > 0 && dx + textWidth > width) {
      row += 1;
      dx = 0;
    }
    placed.push({ text, dx, row });
    dx += textWidth + gap;
  }
  return {
    height: (row + 1) * BADGE_HEIGHT + row * gap,
    draw: (top) => {
      placed.forEach((item, index) =>
        badge(
          layout,
          x + item.dx,
          top + item.row * (BADGE_HEIGHT + gap),
          item.text,
          index === 0 ? 'secondary' : 'outline',
        ),
      );
    },
  };
}

/** Section titles in two columns, each with its page number. */
function layoutContents(
  layout: PdfLayout,
  sections: ReportSectionModel[],
): PendingPageNumber[] {
  const measurer = layout.measurer;
  const rowHeight = TEXT.contents.leading;
  const columnGap = 20;
  const numberWidth = 24;
  const twoColumns =
    CARD.headerHeight +
      CARD.padTop +
      Math.ceil(sections.length / 2) * rowHeight +
      CARD.padBottom <=
    CONTENT_BOTTOM - PAGE.marginTop;
  const columns = twoColumns ? 2 : 1;
  const columnWidth =
    (CardWriter.innerWidth - columnGap * (columns - 1)) / columns;
  const rows = Math.ceil(sections.length / columns);

  const card = new CardWriter(layout, 'Contents', {
    icon: 'list',
    anchor: 'contents',
  });
  card.open(twoColumns ? rows * rowHeight : rowHeight * 2);
  const pending: PendingPageNumber[] = [];
  for (let row = 0; row < rows; row++) {
    card.row(rowHeight, (top) => {
      for (let column = 0; column < columns; column++) {
        const section = sections[column * rows + row];
        if (!section) continue;
        const target = sectionAnchor(section.id);
        const left = CardWriter.innerX + column * (columnWidth + columnGap);
        const right = left + columnWidth;
        const title = truncateText(
          section.title,
          columnWidth - numberWidth - 8,
          (text) => measurer.width(text, TEXT.contents),
        );
        layout.text(left, top, title, TEXT.contents, { goTo: target });
        const leaderStart = left + measurer.width(title, TEXT.contents) + 4;
        const leaderEnd = right - numberWidth;
        if (leaderEnd - leaderStart > 6) {
          layout.add({
            kind: 'rule',
            page: layout.page,
            x: leaderStart,
            y: top + rowHeight * 0.68,
            w: leaderEnd - leaderStart,
            color: COLOR.border,
            dotted: true,
            layer: LAYER.content,
          });
        }
        const op = layout.text(right, top, '', TEXT.contentsPage, {
          goTo: target,
        });
        pending.push({ op, target, right });
      }
    });
  }
  card.close();
  return pending;
}

function fillPageNumbers(
  layout: PdfLayout,
  pending: PendingPageNumber[],
): void {
  if (pending.length === 0) return;
  const pages = new Map<string, number>();
  layout.pages.forEach((ops, page) => {
    for (const op of ops) {
      if (op.kind === 'anchor' && !pages.has(op.name)) pages.set(op.name, page);
    }
  });
  for (const entry of pending) {
    const page = pages.get(entry.target);
    if (page === undefined) continue;
    entry.op.text = String(page + 1);
    entry.op.x =
      entry.right - layout.measurer.width(entry.op.text, entry.op.style);
  }
}

/** One section card: its blocks as paragraphs and boxed records. */
function layoutSection(layout: PdfLayout, section: ReportSectionModel): void {
  const units = sectionUnits(layout, section.blocks);
  const card = new CardWriter(layout, section.title, {
    icon: section.icon,
    anchor: sectionAnchor(section.id),
  });
  card.open(firstContentHeight(units[0]));
  for (const unit of units) {
    if (unit.kind === 'box') card.boxed(unit.paragraphs);
    else if (unit.kind === 'heading') card.heading(unit.paragraph);
    else card.paragraph(unit.paragraph);
  }
  card.close();
}

function firstContentHeight(unit: Unit | undefined): number {
  if (!unit) return 0;
  if (unit.kind === 'box') {
    const whole =
      BOX.padY * 2 +
      unit.paragraphs.reduce(
        (sum, paragraph, index) =>
          sum + paragraphHeight(paragraph) + (index > 0 ? PARAGRAPH_GAP : 0),
        0,
      );
    return whole <= BOX.keepTogether
      ? whole
      : BOX.padY * 2 + firstLines(unit.paragraphs, 2);
  }
  const lines = Math.min(2, unit.paragraph.lines.length);
  return (
    lines * unit.paragraph.style.leading +
    (unit.kind === 'heading' ? 2 * TEXT.body.leading : 0)
  );
}

/**
 * Blocks to layout units. A 'subheading' (record title) or 'item' opens a
 * box that holds the blocks after it until the next box opens; a heading
 * closes it.
 */
function sectionUnits(layout: PdfLayout, blocks: ReportBlock[]): Unit[] {
  const units: Unit[] = [];
  let box: LaidParagraph[] | null = null;
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    const kind = block.style ?? 'body';
    if (kind === 'subheading' || kind === 'item') {
      box = [
        laid(
          layout,
          text,
          kind === 'subheading' ? TEXT.recordTitle : TEXT.item,
          CardWriter.boxTextWidth,
        ),
      ];
      units.push({ kind: 'box', paragraphs: box });
      continue;
    }
    if (kind === 'heading' || kind === 'title' || kind === 'subtitle') {
      box = null;
      units.push({
        kind: 'heading',
        paragraph: laid(layout, text, TEXT.heading, CardWriter.innerWidth),
      });
      continue;
    }
    const link = safeLink(block.link);
    const style = link
      ? TEXT.link
      : kind === 'note'
        ? TEXT.note
        : kind === 'citation'
          ? TEXT.citation
          : TEXT.body;
    if (box) {
      box.push(laid(layout, text, style, CardWriter.boxTextWidth, link));
    } else {
      units.push({
        kind: 'paragraph',
        paragraph: laid(layout, text, style, CardWriter.innerWidth, link),
      });
    }
  }
  return units;
}

function laid(
  layout: PdfLayout,
  text: string,
  style: TextStyle,
  width: number,
  link?: string,
): LaidParagraph {
  return { lines: layout.wrap(text, style, width), style, link };
}

/**
 * Only web and mail links become clickable. Source URLs come from outside
 * services; any other scheme is printed as plain text.
 */
export function safeLink(link: string | undefined): string | undefined {
  const value = link?.trim();
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' ||
      protocol === 'https:' ||
      protocol === 'mailto:'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function blockTexts(blocks: ReportBlock[]): string[] {
  return blocks.map((block) => block.text.trim()).filter(Boolean);
}

/** The line under the last card, like the MCA report's footer. */
function layoutClosingLine(
  layout: PdfLayout,
  model: ReportDocumentModel,
): void {
  const text = [
    model.headerLabel,
    `Report generated ${formatGeneratedAt(model.generatedAt)}`,
    `${model.templateId} ${model.templateVersion}`,
  ].join(' · ');
  const lines = layout.wrap(text, TEXT.closing, CONTENT_WIDTH);
  const height = 8 + lines.length * TEXT.closing.leading;
  if (!layout.fits(height)) layout.newPage();
  layout.add({
    kind: 'rule',
    page: layout.page,
    x: PAGE.marginX,
    y: layout.y,
    w: CONTENT_WIDTH,
    color: COLOR.border,
    layer: LAYER.content,
  });
  let top = layout.y + 8;
  for (const line of lines) {
    const width = layout.measurer.width(line, TEXT.closing);
    layout.text(
      PAGE.marginX + (CONTENT_WIDTH - width) / 2,
      top,
      line,
      TEXT.closing,
    );
    top += TEXT.closing.leading;
  }
  layout.y = top;
}

/** "Oct 15, 2026, 9:10 AM UTC". The server's time zone is not the reader's. */
export function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`;
}
