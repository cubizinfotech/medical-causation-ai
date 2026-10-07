import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UsersService } from './users.service';

/** Shared users and roles. Product modules must not own accounts. */
@Module({
  providers: [UsersService, ProfileService],
  exports: [UsersService, ProfileService],
})
export class UsersModule {}
