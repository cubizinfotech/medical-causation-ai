/**
 * Runs library searches and prints how well the library covers each one:
 * search mode, relevant passages, and the top matches with their scores.
 * Use it after indexing, re-embedding, or changing RAG_* settings.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/check-retrieval.ts
 *   npx ts-node -r tsconfig-paths/register scripts/check-retrieval.ts "Does whiplash cause cervical disc herniation?"
 *
 * Prints passage titles and scores only, never passage text.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RetrievalService } from '../src/modules/rag/services';

const SAMPLE_QUESTIONS = [
  {
    label: 'relevant: TBI and later ischemic stroke',
    question:
      'Did the motor vehicle collision and mild traumatic brain injury cause or contribute to the ischemic stroke five months later?',
    injury:
      'Motor Vehicle Collision: driver in a collision; mild traumatic brain injury',
    diagnosis: 'Mild traumatic brain injury; ischemic stroke',
  },
  {
    label: 'irrelevant: benzene and leukemia',
    question:
      'Did occupational benzene exposure cause acute myeloid leukemia in this worker?',
    injury: 'Occupational exposure: benzene solvent at a refinery',
    diagnosis: 'Acute myeloid leukemia',
  },
];

async function main(): Promise<void> {
  const custom = process.argv.slice(2).join(' ').trim();
  const questions = custom
    ? [{ label: 'custom', question: custom, injury: '', diagnosis: '' }]
    : SAMPLE_QUESTIONS;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const retrieval = app.get(RetrievalService);
    for (const sample of questions) {
      const result = await retrieval.retrieve({
        question: sample.question,
        injury: sample.injury || undefined,
        diagnosis: sample.diagnosis || undefined,
      });
      console.log(`\n=== ${sample.label}`);
      console.log(
        `coverage: ${JSON.stringify(result.coverage)} time=${result.executionTimeMs}ms model=${result.embeddingProvider}/${result.embeddingModel}`,
      );
      for (const chunk of result.chunks) {
        console.log(
          `  ${chunk.relevant ? '*' : ' '} vector=${chunk.vectorScore.toFixed(3)} keyword=${chunk.keywordScore.toFixed(3)} ${chunk.documentTitle.slice(0, 70)} p.${chunk.pageNumber ?? '-'}`,
        );
      }
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
