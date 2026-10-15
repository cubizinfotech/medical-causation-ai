/**
 * Re-index all knowledge base documents (chunk + embed + store).
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --force
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --reembed-only
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --reembed-only --replace-embeddings
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --only "mild tbi" --only stroke
 *
 * --reembed-only also replaces vectors made by another provider or model, one
 * batch at a time, so search keeps working while it runs. --only indexes the
 * files whose path contains any of the given texts (case-insensitive).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IndexingService } from '../src/modules/indexing';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/services/knowledge-base.service';

const apiDir = resolve(__dirname, '..');
config({ path: resolve(apiDir, '../../.env') });
config({ path: resolve(apiDir, '.env'), override: false });

function optionValues(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, index) => {
    const next = process.argv[index + 1];
    if (arg === name && next && !next.startsWith('--')) values.push(next);
  });
  return values;
}

async function main(): Promise<void> {
  const forceReindex = process.argv.includes('--force');
  const reembedOnly = process.argv.includes('--reembed-only');
  const replaceEmbeddings = process.argv.includes('--replace-embeddings');
  const only = optionValues('--only').map((text) => text.toLowerCase());

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const indexing = app.get(IndexingService);

    if (reembedOnly) {
      if (replaceEmbeddings) {
        console.log('Clearing all existing embeddings before re-embed…');
        await indexing.clearAllEmbeddings();
      }

      const results = await indexing.reembedAllMissingEmbeddings();
      console.log(`Re-embedded ${results.length} document(s).`);
      for (const result of results) {
        console.log(
          `  ${result.knowledgeDocumentId}: embeddings=${result.embeddingCount} duration=${result.processingDurationMs}ms`,
        );
      }
    } else {
      const knowledgeBase = app.get(KnowledgeBaseService);
      const discovered = await knowledgeBase.discoverDocuments();
      const documents =
        only.length === 0
          ? discovered
          : discovered.filter((document) =>
              only.some((text) =>
                document.relativePath.toLowerCase().includes(text),
              ),
            );
      if (documents.length === 0) {
        console.log(
          only.length === 0
            ? 'No documents found under KNOWLEDGE_BASE_PATH.'
            : `No documents under KNOWLEDGE_BASE_PATH match --only ${only.join(', ')}.`,
        );
        return;
      }

      console.log(
        `Found ${documents.length} document(s). Starting indexing...`,
      );

      let failed = 0;
      for (const document of documents) {
        console.log(`\nIndexing: ${document.relativePath}`);
        try {
          const result = await indexing.indexKnowledgeBaseDocument(
            document.id,
            { forceReindex },
          );
          console.log(
            `  status=${result.status} chunks=${result.chunkCount} embeddings=${result.embeddingCount} duration=${result.processingDurationMs}ms`,
          );
        } catch (error) {
          // One unreadable or oversized file must not stop the whole library.
          failed += 1;
          console.log(
            `  failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (failed > 0) {
        console.log(`\n${failed} document(s) failed; the rest were indexed.`);
      }
    }

    const stats = await indexing.getStats();
    console.log('\nIndexing complete:', stats);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
