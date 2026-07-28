-- CreateEnum
CREATE TYPE "documents"."IndexStatus" AS ENUM ('pending', 'processing', 'indexed', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "documents"."indexed_documents" (
    "id" UUID NOT NULL,
    "knowledge_document_id" TEXT NOT NULL,
    "document_title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "extension" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_modified_at" TIMESTAMP(3) NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" "documents"."IndexStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."document_chunks" (
    "id" UUID NOT NULL,
    "external_chunk_id" TEXT NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "page_number" INTEGER,
    "section" TEXT,
    "text" TEXT NOT NULL,
    "estimated_tokens" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vectors"."chunk_embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_embeddings_pkey" PRIMARY KEY ("id")
);

-- pgvector column (dimensions configured via EMBEDDING_DIMENSIONS, default 1536)
ALTER TABLE "vectors"."chunk_embeddings"
ADD COLUMN "embedding" vector(1536) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "indexed_documents_knowledge_document_id_key" ON "documents"."indexed_documents"("knowledge_document_id");

-- CreateIndex
CREATE INDEX "indexed_documents_status_idx" ON "documents"."indexed_documents"("status");

-- CreateIndex
CREATE INDEX "indexed_documents_checksum_idx" ON "documents"."indexed_documents"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_external_chunk_id_key" ON "documents"."document_chunks"("external_chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "documents"."document_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_document_id_content_hash_key" ON "documents"."document_chunks"("document_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "chunk_embeddings_chunk_id_key" ON "vectors"."chunk_embeddings"("chunk_id");

-- AddForeignKey
ALTER TABLE "documents"."document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"."indexed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vectors"."chunk_embeddings" ADD CONSTRAINT "chunk_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "documents"."document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector similarity index for future RAG retrieval
CREATE INDEX "chunk_embeddings_embedding_idx" ON "vectors"."chunk_embeddings"
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
