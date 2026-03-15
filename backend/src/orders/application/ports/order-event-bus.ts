export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  correlationId: string;
}

export const ORDER_EVENT_BUS = Symbol('ORDER_EVENT_BUS');

export interface OrderEventBus {
  emitOrderCreated(event: OrderCreatedEvent): void;
  onOrderCreated(handler: (event: OrderCreatedEvent) => Promise<void>): void;
}
