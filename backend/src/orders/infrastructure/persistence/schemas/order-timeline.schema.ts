import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'order_timeline_events', timestamps: false })
export class OrderTimelineDocument {
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true })
  timestamp!: string;

  @Prop({ required: true, index: true })
  orderId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  type!:
    | 'CART_ITEM_ADDED'
    | 'CART_ITEM_UPDATED'
    | 'CART_ITEM_REMOVED'
    | 'PRICING_CALCULATED'
    | 'ORDER_PLACED'
    | 'ORDER_STATUS_CHANGED'
    | 'VALIDATION_FAILED';

  @Prop({ required: true, enum: ['api', 'worker', 'ui'] })
  source!: 'api' | 'worker' | 'ui';

  @Prop({ required: true })
  correlationId!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;
}

export type OrderTimelineHydratedDocument = HydratedDocument<OrderTimelineDocument>;
export const OrderTimelineSchema = SchemaFactory.createForClass(OrderTimelineDocument);
