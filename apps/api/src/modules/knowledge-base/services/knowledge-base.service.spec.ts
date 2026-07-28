import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { configuration } from '@config/configuration';
import { KnowledgeBaseModule } from '../knowledge-base.module';
import { DocumentDiscoveryService } from './document-discovery.service';
import { KnowledgeBaseService } from './knowledge-base.service';

function resolveKnowledgeBaseRoot(): string | null {
  const candidates = [
    resolve(process.cwd(), 'knowledge-base'),
    resolve(process.cwd(), '..', '..', 'knowledge-base'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

describe('DocumentDiscoveryService', () => {
  let discoveryService: DocumentDiscoveryService;

  beforeEach(async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (kbRoot) {
      process.env.KNOWLEDGE_BASE_PATH = kbRoot;
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        KnowledgeBaseModule,
      ],
    }).compile();

    discoveryService = module.get<DocumentDiscoveryService>(
      DocumentDiscoveryService,
    );
  });

  it('should be defined', () => {
    expect(discoveryService).toBeDefined();
  });

  it('should discover documents from books folder', async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (!kbRoot) {
      console.warn('Skipping: knowledge-base folder not found');
      return;
    }

    const documents = await discoveryService.scanFolder('books');
    expect(documents.length).toBeGreaterThan(0);

    const first = documents[0];
    expect(first.id).toBeDefined();
    expect(first.filename).toBeDefined();
    expect(first.checksum).toHaveLength(64);
    expect(first.extension).toMatch(/^(pdf|docx|txt|md)$/);
    expect(first.status).toBe('pending');
    expect(first.folder).toBe('books');
  }, 60000);
});

describe('KnowledgeBaseService', () => {
  let knowledgeBaseService: KnowledgeBaseService;

  beforeEach(async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (kbRoot) {
      process.env.KNOWLEDGE_BASE_PATH = kbRoot;
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        KnowledgeBaseModule,
      ],
    }).compile();

    knowledgeBaseService =
      module.get<KnowledgeBaseService>(KnowledgeBaseService);
  });

  it('should refresh books folder and return stats', async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (!kbRoot) {
      console.warn('Skipping: knowledge-base folder not found');
      return;
    }

    const discovered = await knowledgeBaseService.discoverDocuments();
    expect(discovered.length).toBeGreaterThan(0);

    const doc = discovered[0];
    const validation = knowledgeBaseService.validateDocument(doc);
    expect(validation.valid).toBe(true);

    const stats = knowledgeBaseService.getStats();
    expect(stats.byFolder).toBeDefined();

    const sections = knowledgeBaseService.getSectionSummaries();
    expect(sections).toHaveLength(5);
  }, 120000);

  it('should list documents after refresh', async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (!kbRoot) return;

    await knowledgeBaseService.refreshKnowledgeBase();
    const list = await knowledgeBaseService.listDocuments({
      folder: 'books',
      limit: 5,
    });

    expect(list.total).toBeGreaterThan(0);
    expect(list.documents.length).toBeLessThanOrEqual(5);

    const doc = await knowledgeBaseService.getDocument(list.documents[0].id);
    expect(doc).not.toBeNull();
  }, 120000);
});
