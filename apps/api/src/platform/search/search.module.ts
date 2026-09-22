import { Module } from '@nestjs/common';

/**
 * Shared research/search adapter registry scaffold.
 * Concrete adapters live under integrations/ and are registered by product modules.
 */
@Module({})
export class SearchModule {}
