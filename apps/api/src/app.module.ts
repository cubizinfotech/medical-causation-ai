import { Module } from '@nestjs/common';
import { AppConfigModule } from '@config/config.module';
import { AiModule } from '@ai/ai.module';
import { DatabaseModule } from '@database/database.module';
import { PlatformModule } from '@platform/platform.module';
import { CommonModule } from '@modules/common/common.module';
import { McaModule } from '@modules/mca/mca.module';
import { EwiModule } from '@modules/ewi/ewi.module';

/**
 * Application composition root.
 *
 * Layering:
 * - PlatformModule — shared auth/email/audit/report/storage/search scaffolds + cross-cutting contracts
 * - DatabaseModule / AppConfigModule / AiModule — shared runtime infrastructure
 * - CommonModule — shared KB / document / indexing / RAG Nest modules
 * - McaModule / EwiModule — product boundaries (no cross-imports)
 */
@Module({
  imports: [
    AppConfigModule,
    PlatformModule,
    DatabaseModule,
    AiModule,
    CommonModule,
    McaModule,
    EwiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
