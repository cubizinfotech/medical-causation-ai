import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { configuration } from './configuration';

const repositoryEnvFile = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../../.env'),
  resolve(__dirname, '../../../.env'),
].find((filePath) => existsSync(filePath));

if (repositoryEnvFile) {
  loadEnv({ path: repositoryEnvFile, override: true });
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '.env',
        ...(repositoryEnvFile ? [repositoryEnvFile] : []),
      ],
      load: [configuration],
    }),
  ],
})
export class AppConfigModule {}
