import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const nodeRequire = createRequire(__filename);

const BUILDS = [
  'legacy/build/pdf.mjs',
  'build/pdf.mjs',
  'legacy/build/pdf.js',
];

export type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

/** Loads the installed pdf.js build by file path, not by a package subpath. */
export async function loadPdfjs(): Promise<PdfjsModule> {
  const root = dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  for (const relative of BUILDS) {
    const file = join(root, relative);
    if (!existsSync(file)) continue;
    return import(pathToFileURL(file).href) as Promise<PdfjsModule>;
  }
  throw new Error(
    `pdfjs-dist at ${root} has no PDF build. From the repository root run: npm ci --include=dev`,
  );
}
