import { join, resolve, isAbsolute } from 'path';
import { existsSync } from 'fs';
import type {
  KnowledgeBasePaths,
  ProductKnowledgeBaseSettings,
  StorageSettings,
} from './config.types';

function resolvePathCandidates(
  envPath: string | undefined,
  fallbackRelative: string,
): string[] {
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
      resolve(process.cwd(), fallbackRelative),
      resolve(process.cwd(), '..', '..', fallbackRelative),
    );
  }

  return candidates;
}

function resolveExistingOrFirst(candidates: string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function resolveKnowledgeBaseRoot(): string {
  return resolveExistingOrFirst(
    resolvePathCandidates(process.env.KNOWLEDGE_BASE_PATH, 'knowledge-base'),
  );
}

function resolveMcaKnowledgeBaseRoot(sharedRoot: string): string {
  const envPath =
    process.env.KNOWLEDGE_BASE_MCA_PATH ?? process.env.KNOWLEDGE_BASE_PATH;
  if (envPath || !process.env.KNOWLEDGE_BASE_MCA_PATH) {
    // Prefer explicit MCA path; otherwise keep flat knowledge-base as MCA default.
    if (process.env.KNOWLEDGE_BASE_MCA_PATH) {
      return resolveExistingOrFirst(
        resolvePathCandidates(
          process.env.KNOWLEDGE_BASE_MCA_PATH,
          'knowledge-base/mca',
        ),
      );
    }
  }
  return sharedRoot;
}

function resolveEwiKnowledgeBaseRoot(sharedRoot: string): string {
  if (process.env.KNOWLEDGE_BASE_EWI_PATH) {
    return resolveExistingOrFirst(
      resolvePathCandidates(
        process.env.KNOWLEDGE_BASE_EWI_PATH,
        'knowledge-base/ewi',
      ),
    );
  }
  return resolveExistingOrFirst([
    join(sharedRoot, 'ewi'),
    resolve(process.cwd(), 'knowledge-base', 'ewi'),
    resolve(process.cwd(), '..', '..', 'knowledge-base', 'ewi'),
  ]);
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

function buildProductPaths(
  mcaRoot: string,
  ewiRoot: string,
): ProductKnowledgeBaseSettings {
  return {
    mca: buildKnowledgeBasePaths(mcaRoot),
    ewi: {
      root: ewiRoot,
      books: join(ewiRoot, 'books'),
      articles: join(ewiRoot, 'articles'),
      reports: join(ewiRoot, 'reports'),
      templates: join(ewiRoot, 'templates'),
      uploads: join(ewiRoot, 'uploads'),
    },
  };
}

export const storageConfig = (): StorageSettings => {
  const sharedRoot = resolveKnowledgeBaseRoot();
  const mcaRoot = resolveMcaKnowledgeBaseRoot(sharedRoot);
  const ewiRoot = resolveEwiKnowledgeBaseRoot(sharedRoot);
  const products = buildProductPaths(mcaRoot, ewiRoot);
  const knowledgeBase = products.mca;
  const uploadMaxSizeMb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 50);
  const knowledgeBaseMaxFileSizeMb = Number(
    process.env.KNOWLEDGE_BASE_MAX_FILE_SIZE_MB ?? 500,
  );

  return {
    knowledgeBasePath: mcaRoot,
    knowledgeBase,
    products,
    uploadMaxSizeMb,
    uploadMaxSizeBytes: uploadMaxSizeMb * 1024 * 1024,
    knowledgeBaseMaxFileSizeMb,
    knowledgeBaseMaxFileSizeBytes: knowledgeBaseMaxFileSizeMb * 1024 * 1024,
    uploadDir: process.env.UPLOAD_DIR ?? knowledgeBase.uploads,
  };
};
