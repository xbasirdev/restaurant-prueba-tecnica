import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.constants';
import type {
  IdempotencyRecord,
  IdempotencyRepository,
} from '../../../application/ports/idempotency.repository';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class IdempotencyRedisRepository implements IdempotencyRepository {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    if (!this.redisClient) {
      return null;
    }

    const rawValue = await this.redisClient.get(this.buildKey(key));

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as IdempotencyRecord;
  }

  async create(record: IdempotencyRecord): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    await this.redisClient.set(
      this.buildKey(record.key),
      JSON.stringify(record),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
      'NX',
    );
  }

  private buildKey(key: string): string {
    return `idempotency:${key}`;
  }
}
