import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { OrderCreatedEvent, OrderEventBus } from '../../application/ports/order-event-bus';

const ORDER_CREATED_EVENT = 'orders.created';

@Injectable()
export class InMemoryOrderEventBus implements OrderEventBus {
  private readonly emitter = new EventEmitter();

  emitOrderCreated(event: OrderCreatedEvent): void {
    setImmediate(() => {
      this.emitter.emit(ORDER_CREATED_EVENT, event);
    });
  }

  onOrderCreated(handler: (event: OrderCreatedEvent) => Promise<void>): void {
    this.emitter.on(ORDER_CREATED_EVENT, (event: OrderCreatedEvent) => {
      void handler(event);
    });
  }
}
