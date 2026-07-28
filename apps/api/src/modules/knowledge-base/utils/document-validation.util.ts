import type { StorageSettings } from '@config/config.types';
import { SUPPORTED_EXTENSIONS, type KnowledgeBaseFolder } from '../constants';
import type { DocumentValidationResult, KnowledgeDocument } from '../types';
import {
  getFileExtension,
  isSupportedExtension,
  isValidFilename,
} from './document-metadata.util';

/**
 * Validate a discovered document against knowledge base rules.
 */
export function validateDocument(
  document: KnowledgeDocument,
  storage: StorageSettings,
  existingChecksums: Set<string> = new Set(),
): DocumentValidationResult {
  const errors: DocumentValidationResult['errors'] = [];
  const warnings: DocumentValidationResult['warnings'] = [];

  if (!isValidFilename(document.filename)) {
    errors.push({
      code: 'INVALID_FILENAME',
      message: `Filename "${document.filename}" contains invalid characters`,
      field: 'filename',
    });
  }

  if (!isSupportedExtension(document.extension)) {
    errors.push({
      code: 'UNSUPPORTED_EXTENSION',
      message: `Extension ".${document.extension}" is not supported. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      field: 'extension',
    });
  }

  if (document.size > storage.knowledgeBaseMaxFileSizeBytes) {
    errors.push({
      code: 'MAX_SIZE_EXCEEDED',
      message: `File size ${document.size} bytes exceeds maximum ${storage.knowledgeBaseMaxFileSizeBytes} bytes`,
      field: 'size',
    });
  }

  if (document.size === 0) {
    warnings.push({
      code: 'EMPTY_FILE',
      message: 'File is empty',
      field: 'size',
    });
  }

  if (existingChecksums.has(document.checksum)) {
    warnings.push({
      code: 'DUPLICATE_CHECKSUM',
      message: 'Another document with the same checksum already exists',
      field: 'checksum',
    });
  }

  if (!document.checksum || document.checksum.length !== 64) {
    warnings.push({
      code: 'INVALID_CHECKSUM',
      message: 'Checksum is missing or invalid — re-scan recommended',
      field: 'checksum',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a file path before discovery.
 */
export function validateFilePath(
  filePath: string,
  folder: KnowledgeBaseFolder,
  storage: StorageSettings,
): DocumentValidationResult {
  const filename = filePath.split(/[/\\]/).pop() ?? '';
  const extension = getFileExtension(filename);
  const errors: DocumentValidationResult['errors'] = [];
  const warnings: DocumentValidationResult['warnings'] = [];

  if (!isValidFilename(filename)) {
    errors.push({
      code: 'INVALID_FILENAME',
      message: `Invalid filename: ${filename}`,
      field: 'filename',
    });
  }

  if (!isSupportedExtension(extension)) {
    return {
      valid: false,
      errors: [
        {
          code: 'UNSUPPORTED_EXTENSION',
          message: `Unsupported extension: .${extension}`,
          field: 'extension',
        },
      ],
      warnings,
    };
  }

  const expectedPrefix = storage.knowledgeBase[folder];
  if (!filePath.startsWith(expectedPrefix)) {
    warnings.push({
      code: 'UNEXPECTED_PATH',
      message: `File is outside expected folder: ${folder}`,
      field: 'filePath',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Find duplicate documents by checksum.
 */
export function findDuplicatesByChecksum(
  documents: KnowledgeDocument[],
): Map<string, KnowledgeDocument[]> {
  const groups = new Map<string, KnowledgeDocument[]>();

  for (const doc of documents) {
    const existing = groups.get(doc.checksum) ?? [];
    existing.push(doc);
    groups.set(doc.checksum, existing);
  }

  const duplicates = new Map<string, KnowledgeDocument[]>();
  for (const [checksum, docs] of groups) {
    if (docs.length > 1) {
      duplicates.set(checksum, docs);
    }
  }

  return duplicates;
}
