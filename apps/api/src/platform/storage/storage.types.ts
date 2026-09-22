import type { ProductId } from '../products';

/**
 * Storage abstractions for product-scoped knowledge bases and uploads.
 * Concrete paths remain in AppConfigModule / storage.config.ts.
 */
export interface StorageLocation {
  product: ProductId;
  rootPath: string;
}

export interface IObjectStorage {
  /**
   * Persist a binary artifact (reports, uploads). Local FS first; S3 later.
   * Not implemented yet — scaffold only.
   */
  putObject(key: string, data: Buffer, contentType: string): Promise<string>;
  getObject(key: string): Promise<Buffer | null>;
}
