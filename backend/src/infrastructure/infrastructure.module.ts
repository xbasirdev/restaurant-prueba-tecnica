import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: process.env.NODE_ENV === 'test' ? [] : [DatabaseModule, RedisModule],
})
export class InfrastructureModule {}
