import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { OrderTimelineEvent } from '../../../domain/entities/order-timeline-event.entity';
import type { TimelineRepository } from '../../../application/ports/timeline.repository';
import {
  OrderTimelineDocument,
  OrderTimelineHydratedDocument,
} from '../schemas/order-timeline.schema';

const MAX_TIMELINE_PAYLOAD_BYTES = 16 * 1024;

@Injectable()
export class TimelineMongoDbRepository implements TimelineRepository {
  constructor(
    @InjectModel(OrderTimelineDocument.name)
    private readonly timelineModel: Model<OrderTimelineHydratedDocument>,
  ) {}

  async append(events: OrderTimelineEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      const payloadSizeBytes = Buffer.byteLength(JSON.stringify(event.payload), 'utf8');

      if (payloadSizeBytes > MAX_TIMELINE_PAYLOAD_BYTES) {
        throw new PayloadTooLargeException(
          `Timeline event payload exceeds 16KB for event ${event.eventId}`,
        );
      }
    }

    await this.timelineModel.insertMany(events, { ordered: false });
  }

  async findByOrderId(orderId: string, page: number, pageSize: number): Promise<OrderTimelineEvent[]> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.min(Math.max(Math.floor(pageSize), 1), 50)
      : 20;

    const documents = await this.timelineModel
      .find({ orderId })
      .sort({ timestamp: 1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .lean()
      .exec();

    return documents.map((document) => ({
      eventId: document.eventId,
      timestamp: document.timestamp,
      orderId: document.orderId,
      userId: document.userId,
      type: document.type,
      source: document.source,
      correlationId: document.correlationId,
      payload: document.payload,
    }));
  }
}
