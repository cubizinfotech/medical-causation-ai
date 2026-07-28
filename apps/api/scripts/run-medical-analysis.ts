/**
 * Manual integration script for medical analysis.
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/run-medical-analysis.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MedicalAnalysisService } from '../src/modules/medical-analysis';

async function main(): Promise<void> {
  const question =
    process.argv[2] ??
    'Can mild traumatic brain injury increase the risk of stroke?';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(MedicalAnalysisService);
    const result = await service.analyze({
      medicalQuestion: question,
      injury: 'Mild traumatic brain injury',
      diagnosis: 'Stroke',
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
