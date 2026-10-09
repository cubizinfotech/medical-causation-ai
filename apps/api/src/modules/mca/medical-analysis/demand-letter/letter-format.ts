const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2024-08-14" -> "August 14, 2024"; partial dates stay partial. */
export function formatEventDateLong(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year) return date;
  if (!month) return String(year);
  const name = MONTH_NAMES[month - 1] ?? '';
  return day ? `${name} ${day}, ${year}` : `${name} ${year}`;
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** The date the offer stays open until, as YYYY-MM-DD (UTC calendar days). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Jane Q. Doe" -> "jane-q-doe" for file names. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'client'
  );
}

/** Short forms kept in capitals when a name is converted from all capitals. */
const KEEP_CAPITALS = new Set(
  'PC PA LLC PLLC LLP PLC LP MD DO DC DPM PT OT NP ER ED MRI CT EMS USA II III IV'.split(
    ' ',
  ),
);

/** "ST. MARY HOSPITAL" -> "St. Mary Hospital"; mixed-case names stay as written. */
export function displayName(name: string): string {
  if (/[a-z]/.test(name)) return name;
  return name.toLowerCase().replace(/[a-z0-9'’]+/g, (word) => {
    if (KEEP_CAPITALS.has(word.toUpperCase())) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** Ends a note the attorney typed as a sentence. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/** Splits text the attorney typed into paragraphs (blank-line separated). */
export function paragraphsOf(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/** Lines of an address the attorney typed. */
export function linesOf(text: string | undefined): string[] {
  return (text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
