import type { ReportIconName } from '../report-document';
import { wrapText } from './pdf-text';
import {
  BOX,
  CARD,
  COLOR,
  CONTENT_BOTTOM,
  CONTENT_WIDTH,
  PAGE,
  PARAGRAPH_GAP,
  TEXT,
  type TextStyle,
} from './pdf-theme';

/** Measures text in the fonts the document embeds. */
export interface TextMeasurer {
  width(text: string, style: TextStyle): number;
  /** Ascender to descender at the style's size: the box pdfkit places at y. */
  glyphHeight(style: TextStyle): number;
}

/** A rectangle on one page. A card or box sets its height when it closes. */
export interface Frame {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Paint order on a page: lower layers first. */
export const LAYER = {
  coverFill: 0,
  band: 1,
  panel: 2,
  border: 3,
  content: 4,
} as const;

export type PaintOp =
  | {
      kind: 'shape';
      frame: Frame;
      radius: number;
      fill?: string;
      stroke?: string;
      layer: number;
    }
  | {
      /** A fill clipped to a rounded frame (a card's header band). */
      kind: 'band';
      frame: Frame;
      clip: Frame;
      radius: number;
      fill: string;
      layer: number;
    }
  | {
      kind: 'text';
      page: number;
      x: number;
      /** Top of the glyph box, as pdfkit expects. */
      y: number;
      text: string;
      style: TextStyle;
      link?: string;
      goTo?: string;
      layer: number;
    }
  | {
      kind: 'icon';
      page: number;
      x: number;
      y: number;
      size: number;
      name: ReportIconName;
      color: string;
      layer: number;
    }
  | {
      kind: 'rule';
      page: number;
      x: number;
      y: number;
      w: number;
      color: string;
      /** A dotted leader (contents) instead of a solid line. */
      dotted?: boolean;
      layer: number;
    }
  | {
      /** Target of a contents link, and a bookmark when `outline` is set. */
      kind: 'anchor';
      page: number;
      y: number;
      name: string;
      outline?: string;
      layer: number;
    }
  | {
      kind: 'image';
      page: number;
      x: number;
      y: number;
      w: number;
      h: number;
      data: Buffer;
      layer: number;
    };

export type TextOp = Extract<PaintOp, { kind: 'text' }>;

/** A paragraph already split into lines for its width. */
export interface LaidParagraph {
  lines: string[];
  style: TextStyle;
  link?: string;
}

export function paragraphHeight(paragraph: LaidParagraph): number {
  return paragraph.lines.length * paragraph.style.leading;
}

/**
 * Places content on pages top to bottom and records what to paint. Nothing
 * is drawn here: a card's border and header band need the card's height,
 * which is known only after its content is placed, so painting runs after
 * layout, layer by layer (see LAYER).
 */
export class PdfLayout {
  readonly pages: PaintOp[][] = [[]];
  page = 0;
  y: number = PAGE.marginTop;

  constructor(readonly measurer: TextMeasurer) {}

  newPage(): void {
    this.pages.push([]);
    this.page += 1;
    this.y = PAGE.marginTop;
  }

  add<T extends PaintOp>(op: T): T {
    const page = 'frame' in op ? op.frame.page : op.page;
    this.pages[page].push(op);
    return op;
  }

  wrap(text: string, style: TextStyle, width: number): string[] {
    return wrapText(text, width, (value) => this.measurer.width(value, style));
  }

  /** Text whose line box starts at `top`, centered in the line's leading. */
  text(
    x: number,
    top: number,
    text: string,
    style: TextStyle,
    extra: { link?: string; goTo?: string } = {},
  ): TextOp {
    return this.add({
      kind: 'text',
      page: this.page,
      x,
      y: top + (style.leading - this.measurer.glyphHeight(style)) / 2,
      text,
      style,
      ...extra,
      layer: LAYER.content,
    });
  }

  fits(height: number): boolean {
    return this.y + height <= CONTENT_BOTTOM;
  }
}

/** A section card that continues on the next page when it runs out of room. */
export class CardWriter {
  static readonly innerX = PAGE.marginX + CARD.padX;
  static readonly innerWidth = CONTENT_WIDTH - CARD.padX * 2;
  static readonly boxTextX = CardWriter.innerX + BOX.padX;
  static readonly boxTextWidth = CardWriter.innerWidth - BOX.padX * 2;

  private segment!: Frame;
  private box: Frame | null = null;
  /** Where content starts in the current segment (no gap above it). */
  private bodyTop = 0;
  private last: 'none' | 'paragraph' | 'box' = 'none';

  constructor(
    private readonly layout: PdfLayout,
    private readonly title: string,
    private readonly options: {
      icon?: ReportIconName;
      anchor?: string;
      /** Bookmark title; defaults to the card title. */
      outline?: string;
    } = {},
  ) {}

  /**
   * Starts the card on this page when its header and `firstContent` points
   * of content fit, otherwise on the next page.
   */
  open(firstContent: number): void {
    const layout = this.layout;
    const need =
      CARD.headerHeight + CARD.padTop + firstContent + CARD.padBottom;
    if (!layout.fits(need) && layout.y > PAGE.marginTop) layout.newPage();
    this.startSegment(CARD.headerHeight);

    const { x, y } = this.segment;
    const iconTop = y + (CARD.headerHeight - CARD.iconBox) / 2;
    layout.add({
      kind: 'shape',
      frame: {
        page: layout.page,
        x: x + CARD.padX,
        y: iconTop,
        w: CARD.iconBox,
        h: CARD.iconBox,
      },
      radius: 5,
      fill: COLOR.iconBox,
      layer: LAYER.panel,
    });
    layout.add({
      kind: 'icon',
      page: layout.page,
      x: x + CARD.padX + (CARD.iconBox - CARD.iconSize) / 2,
      y: iconTop + (CARD.iconBox - CARD.iconSize) / 2,
      size: CARD.iconSize,
      name: this.options.icon ?? 'file-text',
      color: COLOR.primary,
      layer: LAYER.content,
    });
    const titleX = x + CARD.padX + CARD.iconBox + 9;
    const titleWidth = x + this.segment.w - CARD.padX - titleX;
    const titleLines = layout.wrap(this.title, TEXT.sectionTitle, titleWidth);
    const titleTop =
      y +
      (CARD.headerHeight - titleLines.length * TEXT.sectionTitle.leading) / 2;
    titleLines.forEach((line, index) =>
      layout.text(
        titleX,
        titleTop + index * TEXT.sectionTitle.leading,
        line,
        TEXT.sectionTitle,
      ),
    );
    if (this.options.anchor) {
      layout.add({
        kind: 'anchor',
        page: layout.page,
        y,
        name: this.options.anchor,
        outline: this.options.outline ?? this.title,
        layer: LAYER.content,
      });
    }
  }

  /** A run of text in the card body. */
  paragraph(paragraph: LaidParagraph): void {
    this.gap(PARAGRAPH_GAP);
    this.placeLines(paragraph, CardWriter.innerX);
    this.last = 'paragraph';
  }

  /** A heading inside the card, kept with the start of what follows. */
  heading(paragraph: LaidParagraph, next = 2 * TEXT.body.leading): void {
    this.gap(BOX.gap);
    this.ensureRoom(paragraphHeight(paragraph) + next);
    this.placeLines(paragraph, CardWriter.innerX);
    this.last = 'paragraph';
  }

  /**
   * A bordered box of paragraphs (a record, a question). A short box moves
   * to the next page whole; a long one splits, keeping its first lines
   * together.
   */
  boxed(paragraphs: LaidParagraph[]): void {
    this.gap(BOX.gap);
    const content = paragraphs.reduce(
      (sum, paragraph, index) =>
        sum + paragraphHeight(paragraph) + (index > 0 ? PARAGRAPH_GAP : 0),
      0,
    );
    const whole = content + BOX.padY * 2;
    const start = BOX.padY * 2 + firstLines(paragraphs, 2);
    const need = whole <= BOX.keepTogether ? whole : start;
    if (
      !this.layout.fits(need + CARD.padBottom) &&
      this.layout.y > this.bodyTop
    ) {
      this.breakPage();
    }
    this.openBox();
    paragraphs.forEach((paragraph, index) => {
      if (index > 0) this.layout.y += PARAGRAPH_GAP;
      this.placeLines(paragraph, CardWriter.boxTextX);
    });
    this.layout.y += BOX.padY;
    if (this.box) this.box.h = this.layout.y - this.box.y;
    this.box = null;
    this.last = 'box';
  }

  /** Lines in a fixed layout (a contents row): `draw` places one row. */
  row(height: number, draw: (top: number) => void): void {
    this.ensureRoom(height);
    draw(this.layout.y);
    this.layout.y += height;
    this.last = 'paragraph';
  }

  close(): void {
    this.layout.y += CARD.padBottom;
    this.segment.h = this.layout.y - this.segment.y;
    this.layout.y += CARD.gap;
  }

  private gap(size: number): void {
    if (this.last === 'none' || this.layout.y <= this.bodyTop) return;
    this.layout.y += this.last === 'box' ? BOX.gap : size;
  }

  private placeLines(paragraph: LaidParagraph, x: number): void {
    const { lines, style } = paragraph;
    lines.forEach((line, index) => {
      // No paragraph starts with a single line at the foot of a page.
      this.ensureRoom(
        index === 0 ? Math.min(2, lines.length) * style.leading : style.leading,
      );
      this.layout.text(x, this.layout.y, line, style, {
        link: paragraph.link,
      });
      this.layout.y += style.leading;
    });
  }

  private ensureRoom(height: number): void {
    const reserve = (this.box ? BOX.padY : 0) + CARD.padBottom;
    if (this.layout.fits(height + reserve)) return;
    if (this.layout.y <= this.bodyTop + (this.box ? BOX.padY : 0)) return;
    this.breakPage();
  }

  /** Ends the card (and an open box) on this page; continues on the next. */
  private breakPage(): void {
    const layout = this.layout;
    let bottom = layout.y;
    if (this.box) {
      this.box.h = layout.y + BOX.padY - this.box.y;
      bottom = this.box.y + this.box.h;
    }
    this.segment.h = bottom + CARD.padBottom - this.segment.y;
    layout.newPage();
    this.startSegment(CARD.continuedHeaderHeight);
    const titleTop =
      this.segment.y +
      (CARD.continuedHeaderHeight - TEXT.continuedTitle.leading) / 2;
    const label = `${this.title} (continued)`;
    layout.text(
      PAGE.marginX + CARD.padX,
      titleTop,
      layout.measurer.width(label, TEXT.continuedTitle) <=
        CONTENT_WIDTH - CARD.padX * 2
        ? label
        : this.title,
      TEXT.continuedTitle,
    );
    if (this.box) this.openBox();
  }

  /** A new card segment from the cursor: header band, rule, and border. */
  private startSegment(headerHeight: number): void {
    const layout = this.layout;
    this.segment = {
      page: layout.page,
      x: PAGE.marginX,
      y: layout.y,
      w: CONTENT_WIDTH,
      h: 0,
    };
    layout.add({
      kind: 'band',
      frame: { ...this.segment, h: headerHeight },
      clip: this.segment,
      radius: CARD.radius,
      fill: COLOR.band,
      layer: LAYER.band,
    });
    layout.add({
      kind: 'rule',
      page: layout.page,
      x: this.segment.x,
      y: this.segment.y + headerHeight,
      w: this.segment.w,
      color: COLOR.border,
      layer: LAYER.border,
    });
    layout.add({
      kind: 'shape',
      frame: this.segment,
      radius: CARD.radius,
      stroke: COLOR.border,
      layer: LAYER.border,
    });
    layout.y += headerHeight + CARD.padTop;
    this.bodyTop = layout.y;
  }

  private openBox(): void {
    const layout = this.layout;
    this.box = {
      page: layout.page,
      x: CardWriter.innerX,
      y: layout.y,
      w: CardWriter.innerWidth,
      h: 0,
    };
    layout.add({
      kind: 'shape',
      frame: this.box,
      radius: BOX.radius,
      fill: COLOR.white,
      stroke: COLOR.borderLight,
      layer: LAYER.panel,
    });
    layout.y += BOX.padY;
  }
}

/** Height of the first `count` lines of a run of paragraphs. */
export function firstLines(paragraphs: LaidParagraph[], count: number): number {
  let height = 0;
  let left = count;
  for (const paragraph of paragraphs) {
    const take = Math.min(left, paragraph.lines.length);
    height += take * paragraph.style.leading;
    left -= take;
    if (left === 0) break;
  }
  return height;
}
