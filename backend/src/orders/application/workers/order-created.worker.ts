import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ORDER_EVENT_BUS } from '../ports/order-event-bus';
import type { OrderCreatedEvent, OrderEventBus } from '../ports/order-event-bus';
import { ORDER_REPOSITORY } from '../ports/order.repository';
import type { OrderRepository } from '../ports/order.repository';
import { TIMELINE_REPOSITORY } from '../ports/timeline.repository';
import type { TimelineRepository } from '../ports/timeline.repository';
import type { OrderTimelineEvent } from '../../domain/entities/order-timeline-event.entity';

@Injectable()
export class OrderCreatedWorker implements OnModuleInit {
  constructor(
    @Inject(ORDER_EVENT_BUS)
    private readonly orderEventBus: OrderEventBus,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(TIMELINE_REPOSITORY)
    private readonly timelineRepository: TimelineRepository,
  ) {}

  onModuleInit(): void {
    this.orderEventBus.onOrderCreated(async (event) => {
      await this.processOrder(event);
    });
  }

  private async processOrder(event: OrderCreatedEvent): Promise<void> {
    await this.orderRepository.updateStatus(event.orderId, 'PROCESSING');
    await this.timelineRepository.append([
      this.createEvent(event, 'ORDER_STATUS_CHANGED', {
        from: 'RECEIVED',
        to: 'PROCESSING',
      }),
    ]);

    await this.delay(300);

    await this.orderRepository.updateStatus(event.orderId, 'COMPLETED');
    await this.timelineRepository.append([
      this.createEvent(event, 'ORDER_STATUS_CHANGED', {
        from: 'PROCESSING',
        to: 'COMPLETED',
      }),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private createEvent(
    event: OrderCreatedEvent,
    type: OrderTimelineEvent['type'],
    payload: Record<string, unknown>,
  ): OrderTimelineEvent {
    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      orderId: event.orderId,
      userId: event.userId,
      type,
      source: 'worker',
      correlationId: event.correlationId,
      payload,
    };
  }
}
