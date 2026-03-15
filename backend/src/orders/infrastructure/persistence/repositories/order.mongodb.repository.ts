import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Order, OrderStatus } from '../../../domain/entities/order.entity';
import type { OrderRepository } from '../../../application/ports/order.repository';
import { OrderDocument, OrderHydratedDocument } from '../schemas/order.schema';

@Injectable()
export class OrderMongoDbRepository implements OrderRepository {
  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderHydratedDocument>,
  ) {}

  async create(order: Order): Promise<void> {
    await this.orderModel.create({
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      items: order.items,
      totals: order.totals,
      idempotencyKey: order.idempotencyKey,
      correlationId: order.correlationId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    const document = await this.orderModel.findOne({ orderId }).lean().exec();

    if (!document) {
      return null;
    }

    const typedDocument = document as typeof document & {
      createdAt?: Date;
      updatedAt?: Date;
    };

    const createdAt =
      typedDocument.createdAt instanceof Date
        ? typedDocument.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      typedDocument.updatedAt instanceof Date
        ? typedDocument.updatedAt.toISOString()
        : createdAt;

    return {
      orderId: document.orderId,
      userId: document.userId,
      status: document.status,
      items: document.items,
      totals: document.totals,
      idempotencyKey: document.idempotencyKey,
      correlationId: document.correlationId,
      createdAt,
      updatedAt,
    };
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderModel
      .updateOne({ orderId }, { $set: { status, updatedAt: new Date() } })
      .exec();
  }
}
