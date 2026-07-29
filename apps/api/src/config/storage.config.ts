import { join, resolve, isAbsolute } from 'path';
import { existsSync } from 'fs';
import type { KnowledgeBasePaths, StorageSettings } from './config.types';

function resolveKnowledgeBaseRoot(): string {
  const envPath = process.env.KNOWLEDGE_BASE_PATH;

  const candidates: string[] = [];

  if (envPath) {
    if (isAbsolute(envPath)) {
      candidates.push(envPath);
    } else {
      candidates.push(resolve(process.cwd(), envPath));
      candidates.push(resolve(process.cwd(), '..', '..', envPath));
      candidates.push(
        resolve(process.cwd(), '..', '..', envPath.replace(/^\.\//, '')),
      );
    }
  } else {
    candidates.push(
      resolve(process.cwd(), 'knowledge-base'),
      resolve(process.cwd(), '..', '..', 'knowledge-base'),
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function buildKnowledgeBasePaths(root: string): KnowledgeBasePaths {
  return {
    root,
    books: process.env.KNOWLEDGE_BASE_BOOKS_PATH ?? join(root, 'books'),
    articles:
      process.env.KNOWLEDGE_BASE_ARTICLES_PATH ?? join(root, 'articles'),
    reports: process.env.KNOWLEDGE_BASE_REPORTS_PATH ?? join(root, 'reports'),
    templates:
      process.env.KNOWLEDGE_BASE_TEMPLATES_PATH ?? join(root, 'templates'),
    uploads: process.env.KNOWLEDGE_BASE_UPLOADS_PATH ?? join(root, 'uploads'),
  };
}

export const storageConfig = (): StorageSettings => {
  const root = resolveKnowledgeBaseRoot();
  const knowledgeBase = buildKnowledgeBasePaths(root);
  const uploadMaxSizeMb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 50);
  const knowledgeBaseMaxFileSizeMb = Number(
    process.env.KNOWLEDGE_BASE_MAX_FILE_SIZE_MB ?? 500,
  );

  return {
    knowledgeBasePath: root,
    knowledgeBase,
    uploadMaxSizeMb,
    uploadMaxSizeBytes: uploadMaxSizeMb * 1024 * 1024,
    knowledgeBaseMaxFileSizeMb,
    knowledgeBaseMaxFileSizeBytes: knowledgeBaseMaxFileSizeMb * 1024 * 1024,
    uploadDir: process.env.UPLOAD_DIR ?? knowledgeBase.uploads,
  };
};
