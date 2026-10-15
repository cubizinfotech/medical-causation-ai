/**
 * Look of the PDF report, taken from the web app's report export
 * (globals.css, `.pdf-export-mode`), so EWI reports match the MCA PDF: a
 * tinted cover card, section cards with a grey header band and a teal icon,
 * and boxed records. Sizes are PDF points (1/72 inch).
 */

/** A4 portrait. */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 34,
  marginTop: 34,
  /** Leaves room for the running footer. */
  marginBottom: 50,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
export const CONTENT_BOTTOM = PAGE.height - PAGE.marginBottom;

export const COLOR = {
  text: '#0f172a',
  body: '#1e293b',
  muted: '#475569',
  faint: '#64748b',
  primary: '#0f766e',
  primaryText: '#f0fdfa',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  band: '#f1f5f9',
  iconBox: '#ccfbf1',
  coverFill: '#ecfdf5',
  coverBorder: '#5eead4',
  secondary: '#e2e8f0',
  white: '#ffffff',
} as const;

export type FontKey = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface TextStyle {
  font: FontKey;
  size: number;
  color: string;
  /** Height of one line, in points. */
  leading: number;
  underline?: boolean;
  /** Extra space between characters, in points. */
  characterSpacing?: number;
}

export const TEXT = {
  body: { font: 'regular', size: 9.5, color: COLOR.body, leading: 14 },
  item: { font: 'regular', size: 9.5, color: COLOR.text, leading: 14 },
  recordTitle: { font: 'bold', size: 9.5, color: COLOR.text, leading: 14 },
  heading: { font: 'bold', size: 10, color: COLOR.primary, leading: 15 },
  note: { font: 'regular', size: 8.8, color: COLOR.muted, leading: 13 },
  citation: { font: 'regular', size: 8.2, color: COLOR.muted, leading: 12 },
  link: {
    font: 'regular',
    size: 8.2,
    color: COLOR.primary,
    leading: 12,
    underline: true,
  },
  sectionTitle: { font: 'bold', size: 11.5, color: COLOR.text, leading: 14 },
  continuedTitle: { font: 'bold', size: 9, color: COLOR.muted, leading: 12 },
  eyebrow: {
    font: 'bold',
    size: 7.8,
    color: COLOR.primary,
    leading: 11,
    // Under 0.1 em, so PDF readers do not read the letters as separate words.
    characterSpacing: 0.7,
  },
  coverMeta: { font: 'regular', size: 9, color: COLOR.muted, leading: 13 },
  coverName: { font: 'bold', size: 19, color: COLOR.text, leading: 23 },
  coverSubtitle: {
    font: 'regular',
    size: 10.5,
    color: COLOR.muted,
    leading: 15,
  },
  factLabel: {
    font: 'bold',
    size: 7,
    color: COLOR.muted,
    leading: 10,
    characterSpacing: 0.5,
  },
  factValue: { font: 'regular', size: 9.5, color: COLOR.text, leading: 13 },
  summary: { font: 'regular', size: 10.5, color: COLOR.text, leading: 16 },
  badge: { font: 'regular', size: 7.6, color: COLOR.text, leading: 10 },
  badgeStrong: {
    font: 'bold',
    size: 7.6,
    color: COLOR.primaryText,
    leading: 10,
  },
  contents: { font: 'regular', size: 8.8, color: COLOR.body, leading: 13.5 },
  contentsPage: {
    font: 'regular',
    size: 8.8,
    color: COLOR.faint,
    leading: 13.5,
  },
  closing: { font: 'regular', size: 7.6, color: COLOR.muted, leading: 11 },
  footer: { font: 'regular', size: 7.2, color: COLOR.faint, leading: 10 },
} as const satisfies Record<string, TextStyle>;

/** Section card: header band, body padding, and the gap between cards. */
export const CARD = {
  radius: 5.5,
  headerHeight: 37,
  continuedHeaderHeight: 24,
  iconBox: 21,
  iconSize: 11,
  padX: 13,
  padTop: 10,
  padBottom: 11,
  gap: 9,
} as const;

/** Boxed record or entry inside a card. */
export const BOX = {
  radius: 4,
  padX: 10,
  padY: 7,
  gap: 6,
  /** A box up to this tall moves to the next page whole instead of splitting. */
  keepTogether: 220,
} as const;

export const COVER = {
  radius: 7,
  pad: 20,
} as const;

/** Space between paragraphs. */
export const PARAGRAPH_GAP = 3;
