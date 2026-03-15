export type OrderStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SelectedModifier {
  groupId: string;
  optionIds: string[];
}

export interface OrderItemInput {
  sku: string;
  quantity: number;
  modifiers: SelectedModifier[];
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  basePriceCents: number;
  modifiersTotalCents: number;
  lineTotalCents: number;
  modifiers: SelectedModifier[];
}

export interface OrderTotals {
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  currency: 'USD';
}

export interface Order {
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  totals: OrderTotals;
  idempotencyKey: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}
