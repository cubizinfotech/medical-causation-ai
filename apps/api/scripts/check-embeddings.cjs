require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const [chunks, embeds, docs] = await Promise.all([
    prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS c FROM documents.document_chunks',
    ),
    prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS c FROM vectors.chunk_embeddings',
    ),
    prisma.$queryRawUnsafe(
      'SELECT status, COUNT(*)::int AS c FROM documents.indexed_documents GROUP BY status',
    ),
  ]);
  console.log('chunks:', chunks);
  console.log('embeddings:', embeds);
  console.log('documents:', docs);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
