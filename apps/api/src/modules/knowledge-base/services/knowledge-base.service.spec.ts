import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { configuration } from '@config/configuration';
import { KnowledgeBaseModule } from '../knowledge-base.module';
import { DocumentDiscoveryService } from './document-discovery.service';
import { KnowledgeBaseService } from './knowledge-base.service';

const FOLDERS = ['books', 'articles', 'reports', 'templates', 'uploads'];

/**
 * A small knowledge base in a temp folder. The real library is not in Git,
 * so tests must not depend on it (CI has an empty knowledge-base folder).
 */
function createKnowledgeBase(): string {
  const root = mkdtempSync(join(tmpdir(), 'kb-spec-'));
  for (const folder of FOLDERS) mkdirSync(join(root, folder));
  writeFileSync(
    join(root, 'books', 'concussion-textbook.md'),
    '# Concussion\n\nMild traumatic brain injury after rear-end collisions.\n',
  );
  writeFileSync(
    join(root, 'books', 'spine-handbook.txt'),
    'Cervical strain and whiplash-associated disorders.\n',
  );
  writeFileSync(
    join(root, 'articles', 'stroke-risk.md'),
    '# Stroke risk after TBI\n\nCohort study summary.\n',
  );
  return root;
}

async function compile(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ load: [configuration] }),
      KnowledgeBaseModule,
    ],
  }).compile();
}

describe('knowledge base', () => {
  const originalPath = process.env.KNOWLEDGE_BASE_PATH;
  let root: string;

  beforeEach(() => {
    root = createKnowledgeBase();
    process.env.KNOWLEDGE_BASE_PATH = root;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalPath === undefined) delete process.env.KNOWLEDGE_BASE_PATH;
    else process.env.KNOWLEDGE_BASE_PATH = originalPath;
  });

  describe('DocumentDiscoveryService', () => {
    it('discovers documents from the books folder', async () => {
      const module = await compile();
      const discovery = module.get(DocumentDiscoveryService);

      const documents = await discovery.scanFolder('books');
      expect(documents).toHaveLength(2);

      const first = documents[0];
      expect(first.id).toBeDefined();
      expect(first.filename).toBeDefined();
      expect(first.checksum).toHaveLength(64);
      expect(first.extension).toMatch(/^(pdf|docx|txt|md)$/);
      expect(first.status).toBe('pending');
      expect(first.folder).toBe('books');
    });
  });

  describe('KnowledgeBaseService', () => {
    it('discovers documents and returns stats', async () => {
      const module = await compile();
      const knowledgeBase = module.get(KnowledgeBaseService);

      const discovered = await knowledgeBase.discoverDocuments();
      expect(discovered.length).toBeGreaterThanOrEqual(3);

      const validation = knowledgeBase.validateDocument(discovered[0]);
      expect(validation.valid).toBe(true);

      expect(knowledgeBase.getStats().byFolder).toBeDefined();
      expect(knowledgeBase.getSectionSummaries()).toHaveLength(5);
    });

    it('lists documents after a refresh', async () => {
      const module = await compile();
      const knowledgeBase = module.get(KnowledgeBaseService);

      await knowledgeBase.refreshKnowledgeBase();
      const list = await knowledgeBase.listDocuments({
        folder: 'books',
        limit: 1,
      });

      expect(list.total).toBe(2);
      expect(list.documents).toHaveLength(1);
      expect(
        await knowledgeBase.getDocument(list.documents[0].id),
      ).not.toBeNull();
    });
  });
});
