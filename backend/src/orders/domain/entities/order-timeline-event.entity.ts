export type OrderTimelineEventType =
  | 'CART_ITEM_ADDED'
  | 'CART_ITEM_UPDATED'
  | 'CART_ITEM_REMOVED'
  | 'PRICING_CALCULATED'
  | 'ORDER_PLACED'
  | 'ORDER_STATUS_CHANGED'
  | 'VALIDATION_FAILED';

export type EventSource = 'api' | 'worker' | 'ui';

export interface OrderTimelineEvent {
  eventId: string;
  timestamp: string;
  orderId: string;
  userId: string;
  type: OrderTimelineEventType;
  source: EventSource;
  correlationId: string;
  payload: Record<string, unknown>;
}
