import { createHash } from 'crypto';
import { basename, extname, sep } from 'path';
import {
  DOCUMENT_STATUS,
  FOLDER_CATEGORY_MAP,
  KNOWLEDGE_BASE_FOLDER_LIST,
  SUPPORTED_EXTENSIONS,
  type KnowledgeBaseFolder,
  type KnowledgeCategory,
  type SupportedExtension,
} from '../constants';
import type { KnowledgeDocument } from '../types';

const INVALID_FILENAME_PATTERN = /[<>:"|?*]/;
const NULL_BYTE = '\u0000';
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Extract lowercase file extension without dot.
 */
export function getFileExtension(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Check if a file extension is supported.
 */
export function isSupportedExtension(
  extension: string,
): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(
    extension.toLowerCase(),
  );
}

/**
 * Derive a human-readable title from a filename.
 */
export function deriveTitleFromFilename(filename: string): string {
  const nameWithoutExt = basename(filename, extname(filename));
  return nameWithoutExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Validate filename for unsafe or reserved characters.
 */
export function isValidFilename(filename: string): boolean {
  if (!filename || filename.trim().length === 0) return false;
  if (filename !== basename(filename)) return false;
  if (INVALID_FILENAME_PATTERN.test(filename)) return false;
  if (filename.includes(NULL_BYTE)) return false;

  const nameWithoutExt = basename(filename, extname(filename));
  if (RESERVED_WINDOWS_NAMES.test(nameWithoutExt)) return false;

  return true;
}

/**
 * Resolve the knowledge base folder from a relative path.
 */
export function resolveFolderFromRelativePath(
  relativePath: string,
): KnowledgeBaseFolder | null {
  const normalized = relativePath.split(sep).join('/');
  const topLevel = normalized.split('/')[0]?.toLowerCase();

  if (
    topLevel &&
    (KNOWLEDGE_BASE_FOLDER_LIST as readonly string[]).includes(topLevel)
  ) {
    return topLevel as KnowledgeBaseFolder;
  }

  return null;
}

/**
 * Resolve sub-category from relative path (parent folder within category).
 */
export function resolveSubCategory(relativePath: string): string | null {
  const normalized = relativePath.split(sep).join('/');
  const parts = normalized.split('/');

  if (parts.length <= 2) return null;

  const subParts = parts.slice(1, -1);
  if (subParts.length === 0) return null;

  return subParts.join('/');
}

/**
 * Map folder to default knowledge category.
 */
export function resolveCategoryFromFolder(
  folder: KnowledgeBaseFolder,
): KnowledgeCategory {
  return FOLDER_CATEGORY_MAP[folder];
}

/**
 * Generate a stable document ID from relative path and checksum.
 */
export function generateDocumentId(
  relativePath: string,
  checksum: string,
): string {
  return createHash('sha256')
    .update(`${relativePath}:${checksum}`)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Compute SHA-256 checksum of a buffer.
 */
export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Build a KnowledgeDocument from file metadata.
 */
export function buildDocumentMetadata(params: {
  filePath: string;
  relativePath: string;
  folder: KnowledgeBaseFolder;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  checksum: string;
  discoveredAt?: Date;
}): KnowledgeDocument {
  const filename = basename(params.filePath);
  const extension = getFileExtension(filename);
  const subCategory = resolveSubCategory(params.relativePath);

  return {
    id: generateDocumentId(params.relativePath, params.checksum),
    title: deriveTitleFromFilename(filename),
    filename,
    filePath: params.filePath,
    relativePath: params.relativePath.split(sep).join('/'),
    extension,
    category: resolveCategoryFromFolder(params.folder),
    subCategory,
    folder: params.folder,
    size: params.size,
    createdAt: params.createdAt,
    modifiedAt: params.modifiedAt,
    checksum: params.checksum,
    status: DOCUMENT_STATUS.PENDING,
    discoveredAt: params.discoveredAt ?? new Date(),
  };
}
