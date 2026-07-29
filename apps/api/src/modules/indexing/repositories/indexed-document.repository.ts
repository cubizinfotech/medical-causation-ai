import { Injectable } from '@nestjs/common';
import { Prisma, type IndexedDocument, type IndexStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';

export interface CreateIndexedDocumentInput {
  knowledgeDocumentId: string;
  documentTitle: string;
  filename: string;
  relativePath: string;
  sourceFile: string;
  category: string;
  subCategory: string | null;
  extension: string;
  checksum: string;
  fileSize: bigint;
  fileModifiedAt: Date;
  pageCount: number;
  status?: IndexStatus;
}

@Injectable()
export class IndexedDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKnowledgeDocumentId(
    knowledgeDocumentId: string,
  ): Promise<IndexedDocument | null> {
    return this.prisma.indexedDocument.findUnique({
      where: { knowledgeDocumentId },
    });
  }

  create(data: CreateIndexedDocumentInput): Promise<IndexedDocument> {
    return this.prisma.indexedDocument.create({ data });
  }

  update(
    id: string,
    data: Prisma.IndexedDocumentUpdateInput,
  ): Promise<IndexedDocument> {
    return this.prisma.indexedDocument.update({ where: { id }, data });
  }

  updateStatus(
    id: string,
    status: IndexStatus,
    errorMessage?: string | null,
  ): Promise<IndexedDocument> {
    return this.prisma.indexedDocument.update({
      where: { id },
      data: {
        status,
        errorMessage: errorMessage ?? null,
        indexedAt: status === 'indexed' ? new Date() : undefined,
      },
    });
  }

  countByStatus(): Promise<Record<string, number>> {
    return this.prisma.indexedDocument
      .groupBy({
        by: ['status'],
        _count: { _all: true },
      })
      .then((rows) =>
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = row._count._all;
          return acc;
        }, {}),
      );
  }

  getLastIndexedAt(): Promise<Date | null> {
    return this.prisma.indexedDocument
      .findFirst({
        where: { indexedAt: { not: null } },
        orderBy: { indexedAt: 'desc' },
        select: { indexedAt: true },
      })
      .then((row) => row?.indexedAt ?? null);
  }

  findAllIndexed(): Promise<IndexedDocument[]> {
    return this.prisma.indexedDocument.findMany({
      where: { status: 'indexed' },
      orderBy: { filename: 'asc' },
    });
  }
}
