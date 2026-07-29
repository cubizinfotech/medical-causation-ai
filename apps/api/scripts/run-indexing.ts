/**
 * Re-index all knowledge base documents (chunk + embed + store).
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --force
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --reembed-only
 *   npx ts-node -r tsconfig-paths/register scripts/run-indexing.ts --reembed-only --replace-embeddings
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

async function main(): Promise<void> {
  const forceReindex = process.argv.includes('--force');
  const reembedOnly = process.argv.includes('--reembed-only');
  const replaceEmbeddings = process.argv.includes('--replace-embeddings');

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
      const documents = await knowledgeBase.discoverDocuments();
      if (documents.length === 0) {
        console.log('No documents found under KNOWLEDGE_BASE_PATH.');
        return;
      }

      console.log(`Found ${documents.length} document(s). Starting indexing...`);

      for (const document of documents) {
        console.log(`\nIndexing: ${document.relativePath}`);
        const result = await indexing.indexKnowledgeBaseDocument(document.id, {
          forceReindex,
        });

        console.log(
          `  status=${result.status} chunks=${result.chunkCount} embeddings=${result.embeddingCount} duration=${result.processingDurationMs}ms`,
        );
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
