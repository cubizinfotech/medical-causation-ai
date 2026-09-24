import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/** Shared users and roles. Product modules must not own accounts. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
