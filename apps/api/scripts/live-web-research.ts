/**
 * Runs the global web research layer for one person against the real search
 * providers and prints what it found, what it could not read, and why.
 * Nothing is written to the database. Keys are read from .env and never printed.
 *
 *   npm run research:web -- --name "Jason A. Demery" --specialty "Physical medicine and rehabilitation" --city "Ocala, FL"
 *   npm run research:web -- --name "Jason A. Demery" --specialty "..." --url "https://www.courttv.com/..."
 *
 * Options: --name --specialty --city --npi --context --url --out <file.json>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGeminiClient } from '../src/ai/utils/gemini-client.util';
import { researchConfig } from '../src/config/research.config';
import { classifyPages, mergeMatch } from '../src/integrations/web-research/classifier';
import {
  assessIdentity,
  subjectFromQuery,
} from '../src/integrations/web-research/identity-assess';
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import { WebResearchEngine } from '../src/integrations/web-research/web-research-engine';
import type { WebResearchLlm } from '../src/integrations/web-research/web-research.types';
import { loadEnv } from './user-accounts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function makeLlm(apiKey: string | undefined, model: string): WebResearchLlm | undefined {
  if (!apiKey) return undefined;
  return async ({ system, user, maxTokens }) => {
    const ai = createGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      config: {
        systemInstruction: system,
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    });
    return response.text ?? '';
  };
}

async function main() {
  loadEnv();
  const settings = researchConfig().web;
  const query = {
    expertName: arg('name') ?? 'Jason A. Demery',
    specialty: arg('specialty') ?? 'Physical medicine and rehabilitation',
    city: arg('city') ?? '',
    npi: arg('npi'),
    context: arg('context'),
  };
  const model = process.env.GEMINI_LLM_MODEL?.trim() || 'gemini-2.5-flash';
  const llm = makeLlm(settings.geminiApiKey, model);
  console.log('Configured providers:', {
    gemini_grounding: Boolean(settings.geminiApiKey),
    serper: Boolean(settings.serperApiKey),
    brave: Boolean(settings.braveApiKey),
    tavily: Boolean(settings.tavilyApiKey),
    classifierModel: llm ? model : 'none',
    groundingModel: settings.geminiModel,
  });

  const url = arg('url');
  if (url) {
    await checkUrl(url, query, llm);
    return;
  }

  const engine = new WebResearchEngine({ settings, llm });
  const dossier = await engine.research(query);
  console.log(`\nWeb research for ${query.expertName} (${query.specialty}${query.city ? `, ${query.city}` : ''})`);
  console.log(`Duration ${Math.round(dossier.durationMs / 1000)}s, queries ${dossier.queriesRun}/${dossier.queriesPlanned}, pages read ${dossier.pagesRead}, partial=${dossier.partial}`);
  for (const provider of dossier.providers) {
    console.log(
      `  provider ${provider.providerId}: configured=${provider.configured} requests=${provider.requests} hits=${provider.hits} failures=${provider.failures.length}`,
    );
    for (const failure of provider.failures.slice(0, 2)) {
      console.log(`     - [${failure.kind}] ${failure.message}`);
    }
  }
  for (const registry of dossier.registries) {
    console.log(`  registry ${registry.id}: ${registry.status} - ${registry.message}`);
  }
  console.log('\nCandidates:');
  for (const candidate of dossier.candidates) {
    console.log(`  [${candidate.role}/${candidate.confidence}] ${candidate.label} (${candidate.recordIds.length} pages)`);
  }
  console.log('\nRecords:');
  for (const record of dossier.records.slice(0, 60)) {
    console.log(
      `  ${record.match.level.padEnd(12)} ${record.kind.padEnd(12)} read=${record.read.padEnd(12)} ${record.publishedAt ?? '----------'} ${record.url}`,
    );
    console.log(`      ${record.title.slice(0, 110)}`);
    if (record.summary) console.log(`      > ${record.summary.slice(0, 200)}`);
  }
  console.log('\nBlocked pages:');
  for (const page of dossier.pagesBlocked.slice(0, 15)) {
    console.log(`  ${page.url}\n      ${page.reason}`);
  }
  console.log('\nLimitations:');
  for (const line of dossier.limitations) console.log(`  - ${line}`);

  const out = arg('out') ?? join(tmpdir(), 'ewi-web-research', `${query.expertName.replace(/\W+/g, '-')}.json`);
  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify(dossier, null, 2));
  console.log(`\nFull dossier written to ${out}`);
}

async function checkUrl(
  url: string,
  query: { expertName: string; specialty: string; city: string; npi?: string; context?: string },
  llm: WebResearchLlm | undefined,
) {
  const subject = subjectFromQuery(query);
  if (!subject) throw new Error('Name needs a first and last name.');
  const fetcher = new SafeFetcher({ timeoutMs: 20000 });
  const page = await fetcher.fetchPage(url);
  console.log(`\nFetch ${url}\n  status=${page.status} http=${page.httpStatus ?? '-'} type=${page.contentType ?? '-'}\n  note=${page.note ?? '-'}\n  title=${page.title ?? '-'}\n  published=${page.publishedAt ?? '-'}\n  text chars=${page.text?.length ?? 0}`);
  if (page.status !== 'read' || !page.text) return;
  const assessment = assessIdentity({ title: page.title, text: page.text }, subject);
  console.log('\nRule-based identity assessment:', JSON.stringify(assessment, null, 2));
  if (!llm) return;
  const classified = await classifyPages(llm, subject, [
    {
      id: 'page',
      url,
      title: page.title ?? url,
      text: page.text.slice(0, 9000),
      fullPage: true,
    },
  ]);
  const model = classified.get('page');
  console.log('\nModel reading:', JSON.stringify(model, null, 2));
  console.log('\nMerged match:', JSON.stringify(mergeMatch(assessment, model, subject.name.last), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
