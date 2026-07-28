export class IndexingException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DocumentNotFoundForIndexingException extends IndexingException {
  constructor(documentId: string) {
    super(
      `Knowledge base document "${documentId}" was not found`,
      'DOCUMENT_NOT_FOUND',
    );
  }
}

export class IndexingFailedException extends IndexingException {
  constructor(documentId: string, reason: string) {
    super(
      `Failed to index document "${documentId}": ${reason}`,
      'INDEXING_FAILED',
    );
  }
}

export class DuplicateIndexSkippedException extends IndexingException {
  constructor(documentId: string) {
    super(
      `Document "${documentId}" is already indexed and unchanged`,
      'DUPLICATE_SKIPPED',
    );
  }
}
