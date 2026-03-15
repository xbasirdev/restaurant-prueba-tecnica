export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  orderId: string;
  createdAt: string;
}

export interface IdempotencyRepository {
  findByKey(key: string): Promise<IdempotencyRecord | null>;
  create(record: IdempotencyRecord): Promise<void>;
}
