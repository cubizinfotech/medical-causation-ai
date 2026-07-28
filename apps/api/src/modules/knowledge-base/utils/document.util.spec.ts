import {
  deriveTitleFromFilename,
  generateDocumentId,
  getFileExtension,
  isSupportedExtension,
  isValidFilename,
  resolveSubCategory,
} from './document-metadata.util';
import { validateDocument } from './document-validation.util';
import { DOCUMENT_STATUS, KNOWLEDGE_BASE_FOLDERS } from '../constants';
import type { KnowledgeDocument } from '../types';
import type { StorageSettings } from '@config/config.types';

const mockStorage: StorageSettings = {
  knowledgeBasePath: '/kb',
  knowledgeBase: {
    root: '/kb',
    books: '/kb/books',
    articles: '/kb/articles',
    reports: '/kb/reports',
    templates: '/kb/templates',
    uploads: '/kb/uploads',
  },
  uploadMaxSizeMb: 50,
  uploadMaxSizeBytes: 50 * 1024 * 1024,
  knowledgeBaseMaxFileSizeMb: 500,
  knowledgeBaseMaxFileSizeBytes: 500 * 1024 * 1024,
  uploadDir: '/kb/uploads',
};

function createMockDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    id: 'abc123',
    title: 'Test Document',
    filename: 'test.pdf',
    filePath: '/kb/articles/test.pdf',
    relativePath: 'articles/test.pdf',
    extension: 'pdf',
    category: 'research_article',
    subCategory: null,
    folder: KNOWLEDGE_BASE_FOLDERS.ARTICLES,
    size: 1024,
    createdAt: new Date(),
    modifiedAt: new Date(),
    checksum: 'a'.repeat(64),
    status: DOCUMENT_STATUS.PENDING,
    discoveredAt: new Date(),
    ...overrides,
  };
}

describe('document-metadata.util', () => {
  it('should extract file extension', () => {
    expect(getFileExtension('report.PDF')).toBe('pdf');
    expect(getFileExtension('notes.md')).toBe('md');
  });

  it('should identify supported extensions', () => {
    expect(isSupportedExtension('pdf')).toBe(true);
    expect(isSupportedExtension('docx')).toBe(true);
    expect(isSupportedExtension('exe')).toBe(false);
  });

  it('should derive title from filename', () => {
    expect(deriveTitleFromFilename('mild-tbi-study.pdf')).toBe(
      'mild tbi study',
    );
  });

  it('should validate filenames', () => {
    expect(isValidFilename('valid-file.pdf')).toBe(true);
    expect(isValidFilename('invalid<file.pdf')).toBe(false);
    expect(isValidFilename('')).toBe(false);
  });

  it('should resolve sub-category from path', () => {
    expect(resolveSubCategory('articles/mild tbi/study.pdf')).toBe('mild tbi');
    expect(resolveSubCategory('books/textbook.pdf')).toBeNull();
  });

  it('should generate stable document IDs', () => {
    const id1 = generateDocumentId('articles/a.pdf', 'checksum1');
    const id2 = generateDocumentId('articles/a.pdf', 'checksum1');
    const id3 = generateDocumentId('articles/b.pdf', 'checksum1');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });
});

describe('document-validation.util', () => {
  it('should validate a valid document', () => {
    const doc = createMockDocument();
    const result = validateDocument(doc, mockStorage);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject unsupported extensions', () => {
    const doc = createMockDocument({ extension: 'exe', filename: 'bad.exe' });
    const result = validateDocument(doc, mockStorage);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNSUPPORTED_EXTENSION')).toBe(
      true,
    );
  });

  it('should reject files exceeding max size', () => {
    const doc = createMockDocument({
      size: mockStorage.knowledgeBaseMaxFileSizeBytes + 1,
    });
    const result = validateDocument(doc, mockStorage);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MAX_SIZE_EXCEEDED')).toBe(
      true,
    );
  });

  it('should warn on duplicate checksums', () => {
    const doc = createMockDocument();
    const checksums = new Set([doc.checksum]);
    const result = validateDocument(doc, mockStorage, checksums);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_CHECKSUM')).toBe(
      true,
    );
  });
});
