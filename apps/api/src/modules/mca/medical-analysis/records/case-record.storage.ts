import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Stores uploaded records on the local disk under one root folder.
 * Files are named by record id, never by the uploaded file name.
 */
export class CaseRecordStorage {
  constructor(private readonly root: string) {}

  keyFor(ownerUserId: string, recordId: string): string {
    return `${ownerUserId}/${recordId}.pdf`;
  }

  async write(key: string, data: Buffer): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    // Owner read/write only; these files hold patient information.
    await writeFile(path, data, { mode: 0o600 });
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  /** Rejects keys that would escape the storage root. */
  private resolveKey(key: string): string {
    const root = resolve(this.root);
    const path = resolve(root, key);
    const rel = relative(root, path);
    // isAbsolute catches another drive on Windows (relative() returns it as-is).
    if (
      !rel ||
      isAbsolute(rel) ||
      rel.startsWith('..') ||
      rel.includes(`..${sep}`)
    ) {
      throw new Error('Invalid record storage key');
    }
    return path;
  }
}
