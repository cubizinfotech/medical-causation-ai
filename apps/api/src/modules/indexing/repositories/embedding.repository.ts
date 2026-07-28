import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

export interface StoreEmbeddingInput {
  chunkId: string;
  provider: string;
  model: string;
  dimensions: number;
  vector: number[];
}

@Injectable()
export class EmbeddingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async storeEmbeddings(inputs: StoreEmbeddingInput[]): Promise<number> {
    if (inputs.length === 0) return 0;

    let stored = 0;

    for (const input of inputs) {
      await this.prisma.$executeRaw`
        INSERT INTO vectors.chunk_embeddings (id, chunk_id, provider, model, dimensions, embedding, created_at)
        VALUES (
          gen_random_uuid(),
          ${input.chunkId}::uuid,
          ${input.provider},
          ${input.model},
          ${input.dimensions},
          ${this.toVectorLiteral(input.vector)}::vector,
          NOW()
        )
        ON CONFLICT (chunk_id) DO UPDATE SET
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          dimensions = EXCLUDED.dimensions,
          embedding = EXCLUDED.embedding,
          created_at = NOW()
      `;
      stored++;
    }

    return stored;
  }

  countAll(): Promise<number> {
    return this.prisma.chunkEmbedding.count();
  }

  private toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
