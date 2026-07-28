/**
 * Base class for document processing exceptions.
 */
export class DocumentProcessingException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnsupportedFileTypeException extends DocumentProcessingException {
  constructor(extension: string) {
    super(`Unsupported file type: ".${extension}"`, 'UNSUPPORTED_FILE_TYPE');
  }
}

export class DocumentCorruptedException extends DocumentProcessingException {
  constructor(filename: string, reason?: string) {
    super(
      `Document "${filename}" is corrupted or unreadable${reason ? `: ${reason}` : ''}`,
      'DOCUMENT_CORRUPTED',
    );
  }
}

export class DocumentTooLargeException extends DocumentProcessingException {
  constructor(filename: string, size: number, maxSize: number) {
    super(
      `Document "${filename}" (${size} bytes) exceeds maximum size (${maxSize} bytes)`,
      'DOCUMENT_TOO_LARGE',
    );
  }
}

export class ParsingFailedException extends DocumentProcessingException {
  constructor(filename: string, reason: string) {
    super(`Failed to parse "${filename}": ${reason}`, 'PARSING_FAILED');
  }
}

export class EmptyDocumentException extends DocumentProcessingException {
  constructor(filename: string) {
    super(
      `Document "${filename}" contains no extractable text`,
      'EMPTY_DOCUMENT',
    );
  }
}
