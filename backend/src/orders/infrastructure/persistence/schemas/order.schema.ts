import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class SelectedModifierDocument {
  @Prop({ required: true })
  groupId!: string;

  @Prop({ type: [String], default: [] })
  optionIds!: string[];
}

const SelectedModifierSchema = SchemaFactory.createForClass(SelectedModifierDocument);

@Schema({ _id: false })
export class OrderItemDocument {
  @Prop({ required: true })
  sku!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  basePriceCents!: number;

  @Prop({ required: true, min: 0 })
  modifiersTotalCents!: number;

  @Prop({ required: true, min: 0 })
  lineTotalCents!: number;

  @Prop({ type: [SelectedModifierSchema], default: [] })
  modifiers!: SelectedModifierDocument[];
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItemDocument);

@Schema({ _id: false })
export class OrderTotalsDocument {
  @Prop({ required: true, min: 0 })
  subtotalCents!: number;

  @Prop({ required: true, min: 0 })
  serviceFeeCents!: number;

  @Prop({ required: true, min: 0 })
  totalCents!: number;

  @Prop({ required: true, enum: ['USD'] })
  currency!: 'USD';
}

const OrderTotalsSchema = SchemaFactory.createForClass(OrderTotalsDocument);

@Schema({ collection: 'orders', timestamps: true })
export class OrderDocument {
  @Prop({ required: true, unique: true })
  orderId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true, enum: ['RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  status!: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItemDocument[];

  @Prop({ type: OrderTotalsSchema, required: true })
  totals!: OrderTotalsDocument;

  @Prop({ required: true })
  idempotencyKey!: string;

  @Prop({ required: true })
  correlationId!: string;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export type OrderHydratedDocument = HydratedDocument<OrderDocument>;
export const OrderSchema = SchemaFactory.createForClass(OrderDocument);
