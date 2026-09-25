import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MEDICAL_ANALYSIS_PROMPTS } from '../constants';

function resolvePromptsDir(): string {
  if (process.env.MEDICAL_PROMPTS_DIR) {
    return process.env.MEDICAL_PROMPTS_DIR;
  }

  const candidates = [
    __dirname,
    join(process.cwd(), 'dist', 'modules', 'mca', 'medical-analysis', 'prompts'),
    join(process.cwd(), 'src', 'modules', 'mca', 'medical-analysis', 'prompts'),
  ];

  return (
    candidates.find((dir) =>
      existsSync(join(dir, MEDICAL_ANALYSIS_PROMPTS.SYSTEM)),
    ) ?? candidates[0]
  );
}

@Injectable()
export class MedicalPromptService {
  private readonly logger = new Logger(MedicalPromptService.name);
  private readonly cache = new Map<string, string>();
  private readonly promptsDir = resolvePromptsDir();

  async load(filename: string): Promise<string> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename)!;
    }

    const content = await readFile(join(this.promptsDir, filename), 'utf-8');
    this.cache.set(filename, content);
    return content;
  }

  async loadAll(): Promise<{
    system: string;
    medicalAnalysis: string;
    evidenceEvaluation: string;
    jsonOutput: string;
  }> {
    const [system, medicalAnalysis, evidenceEvaluation, jsonOutput] =
      await Promise.all([
        this.load(MEDICAL_ANALYSIS_PROMPTS.SYSTEM),
        this.load(MEDICAL_ANALYSIS_PROMPTS.MEDICAL_ANALYSIS),
        this.load(MEDICAL_ANALYSIS_PROMPTS.EVIDENCE_EVALUATION),
        this.load(MEDICAL_ANALYSIS_PROMPTS.JSON_OUTPUT),
      ]);

    return { system, medicalAnalysis, evidenceEvaluation, jsonOutput };
  }

  render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      return variables[key] ?? '';
    });
  }
}
