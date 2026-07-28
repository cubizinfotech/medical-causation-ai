import type { RootConfig } from './config.types';
import { aiConfig } from './ai.config';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { embeddingConfig } from './embedding.config';
import { featureFlagsConfig } from './feature-flags.config';
import { loggingConfig } from './logging.config';
import { promptConfig } from './prompt.config';
import { redisConfig } from './redis.config';
import { storageConfig } from './storage.config';
import { tokenConfig } from './token.config';
import { indexingConfig } from './indexing.config';
import { ragConfig } from './rag.config';

export const configuration = (): RootConfig => ({
  app: appConfig(),
  database: databaseConfig(),
  redis: redisConfig(),
  ai: aiConfig(),
  embedding: embeddingConfig(),
  prompt: promptConfig(),
  token: tokenConfig(),
  storage: storageConfig(),
  logging: loggingConfig(),
  features: featureFlagsConfig(),
  indexing: indexingConfig(),
  rag: ragConfig(),
});
