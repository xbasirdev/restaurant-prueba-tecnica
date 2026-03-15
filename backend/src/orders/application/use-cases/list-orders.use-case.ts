import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY } from '../ports/order.repository';
import type { OrderRepository } from '../ports/order.repository';

@Injectable()
export class ListOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  execute(page: number, pageSize: number) {
    return this.orderRepository.findRecent(page, pageSize);
  }
}
