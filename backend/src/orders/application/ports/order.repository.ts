import type { Order, OrderStatus } from '../../domain/entities/order.entity';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  create(order: Order): Promise<void>;
  findByOrderId(orderId: string): Promise<Order | null>;
  findRecent(page: number, pageSize: number): Promise<Order[]>;
  updateStatus(orderId: string, status: OrderStatus): Promise<void>;
}
