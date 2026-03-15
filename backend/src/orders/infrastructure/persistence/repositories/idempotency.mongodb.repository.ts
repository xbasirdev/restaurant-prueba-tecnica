import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  IdempotencyRecord,
  IdempotencyRepository,
} from '../../../application/ports/idempotency.repository';
import {
  IdempotencyDocument,
  IdempotencyHydratedDocument,
} from '../schemas/idempotency.schema';

@Injectable()
export class IdempotencyMongoDbRepository implements IdempotencyRepository {
  constructor(
    @InjectModel(IdempotencyDocument.name)
    private readonly idempotencyModel: Model<IdempotencyHydratedDocument>,
  ) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const document = await this.idempotencyModel.findOne({ key }).lean().exec();

    if (!document) {
      return null;
    }

    const typedDocument = document as typeof document & {
      createdAt?: Date;
    };

    return {
      key: document.key,
      requestHash: document.requestHash,
      orderId: document.orderId,
      createdAt:
        typedDocument.createdAt instanceof Date
          ? typedDocument.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }

  async create(record: IdempotencyRecord): Promise<void> {
    await this.idempotencyModel.create(record);
  }
}
