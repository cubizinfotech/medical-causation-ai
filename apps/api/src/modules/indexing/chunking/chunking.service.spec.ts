import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@config/configuration';
import { ChunkingService } from '../chunking/chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      providers: [ChunkingService],
    }).compile();

    service = module.get<ChunkingService>(ChunkingService);
  });

  it('should chunk by page and preserve metadata', () => {
    const chunks = service.chunkDocument({
      documentId: 'kb-doc-1',
      documentTitle: 'AMA Guides',
      category: 'medical_book',
      subCategory: null,
      sourceFile: 'books/ama.pdf',
      relativePath: 'books/ama.pdf',
      normalizedText: 'ignored when pages exist',
      pages: [
        { pageNumber: 1, text: 'Page one discusses causation standards.' },
        { pageNumber: 2, text: 'Page two discusses apportionment.' },
      ],
      sections: [],
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(chunks.length);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].documentTitle).toBe('AMA Guides');
    expect(chunks[0].sourceFile).toBe('books/ama.pdf');
  });
});
