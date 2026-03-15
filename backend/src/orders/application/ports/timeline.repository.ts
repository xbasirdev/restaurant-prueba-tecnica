import type { OrderTimelineEvent } from '../../domain/entities/order-timeline-event.entity';

export const TIMELINE_REPOSITORY = Symbol('TIMELINE_REPOSITORY');

export interface TimelineRepository {
  append(events: OrderTimelineEvent[]): Promise<void>;
  findByOrderId(orderId: string, page: number, pageSize: number): Promise<OrderTimelineEvent[]>;
}
