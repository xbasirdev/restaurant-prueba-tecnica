import type { SelectedModifier } from '../../domain/entities/order.entity';

export interface CreateOrderItemRequest {
  sku: string;
  quantity: number;
  modifiers?: SelectedModifier[];
}

export interface CreateOrderRequest {
  userId?: string;
  items: CreateOrderItemRequest[];
}
