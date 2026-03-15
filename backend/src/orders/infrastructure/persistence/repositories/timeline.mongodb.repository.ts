import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { OrderTimelineEvent } from '../../../domain/entities/order-timeline-event.entity';
import type { TimelineRepository } from '../../../application/ports/timeline.repository';
import {
  OrderTimelineDocument,
  OrderTimelineHydratedDocument,
} from '../schemas/order-timeline.schema';

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

    await this.timelineModel.insertMany(events, { ordered: false });
  }

  async findByOrderId(orderId: string, page: number, pageSize: number): Promise<OrderTimelineEvent[]> {
    const safePage = page > 0 ? page : 1;
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);

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
