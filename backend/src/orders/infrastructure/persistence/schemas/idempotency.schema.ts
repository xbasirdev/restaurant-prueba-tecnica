import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'idempotency_keys', timestamps: true })
export class IdempotencyDocument {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  requestHash!: string;

  @Prop({ required: true })
  orderId!: string;

  @Prop()
  createdAt!: Date;
}

export type IdempotencyHydratedDocument = HydratedDocument<IdempotencyDocument>;
export const IdempotencySchema = SchemaFactory.createForClass(IdempotencyDocument);
