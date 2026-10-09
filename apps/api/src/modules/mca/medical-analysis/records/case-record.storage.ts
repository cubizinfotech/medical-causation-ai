import { LocalFileStorage } from '@platform/storage/local-file-storage';

/**
 * Stores uploaded records on the local disk under one root folder.
 * Files are named by record id, never by the uploaded file name.
 */
export class CaseRecordStorage extends LocalFileStorage {}
