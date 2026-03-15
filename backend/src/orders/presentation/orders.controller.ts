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
import { TIMELINE_REPOSITORY } from '../application/ports/timeline.repository';
import type { TimelineRepository } from '../application/ports/timeline.repository';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    @Inject(TIMELINE_REPOSITORY)
    private readonly timelineRepository: TimelineRepository,
  ) {}

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
    const parsedPage = Number(page ?? '1');
    const parsedPageSize = Number(pageSize ?? '20');

    return this.timelineRepository.findByOrderId(orderId, parsedPage, parsedPageSize);
  }
}
