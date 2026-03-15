import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { CreateOrderRequest } from '../application/dto/create-order.request';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../application/use-cases/get-order.use-case';
import { ListOrdersUseCase } from '../application/use-cases/list-orders.use-case';
import { TIMELINE_REPOSITORY } from '../application/ports/timeline.repository';
import type { TimelineRepository } from '../application/ports/timeline.repository';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    @Inject(TIMELINE_REPOSITORY)
    private readonly timelineRepository: TimelineRepository,
  ) {}

  @Get()
  listOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const rawPage = Number(page ?? '1');
    const rawPageSize = Number(pageSize ?? '20');

    const parsedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const parsedPageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(Math.floor(rawPageSize), 1), 50)
      : 20;

    return this.listOrdersUseCase.execute(parsedPage, parsedPageSize);
  }

  @Post()
  @HttpCode(202)
  createOrder(
    @Body() request: CreateOrderRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<{ orderId: string }> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.createOrderUseCase.execute(request, idempotencyKey);
  }

  @Get(':orderId')
  getOrder(@Param('orderId') orderId: string) {
    return this.getOrderUseCase.execute(orderId);
  }

  @Get(':orderId/timeline')
  getTimeline(
    @Param('orderId') orderId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const rawPage = Number(page ?? '1');
    const rawPageSize = Number(pageSize ?? '20');

    const parsedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const parsedPageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(Math.floor(rawPageSize), 1), 50)
      : 20;

    return this.timelineRepository.findByOrderId(orderId, parsedPage, parsedPageSize);
  }
}
