import { Module } from '@nestjs/common';
import { EmailProviderFactory } from './email-provider.factory';
import { EmailService } from './email.service';

@Module({
  providers: [EmailProviderFactory, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
