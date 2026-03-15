import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ModifierOptionDocument {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, min: 0 })
  priceDeltaCents!: number;
}

const ModifierOptionSchema = SchemaFactory.createForClass(ModifierOptionDocument);

@Schema({ _id: false })
export class ModifierGroupDocument {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['protein', 'toppings', 'sauces'] })
  type!: 'protein' | 'toppings' | 'sauces';

  @Prop({ required: true })
  required!: boolean;

  @Prop({ required: true, min: 0 })
  minSelect!: number;

  @Prop({ required: true, min: 0 })
  maxSelect!: number;

  @Prop({ type: [ModifierOptionSchema], default: [] })
  options!: ModifierOptionDocument[];
}

const ModifierGroupSchema = SchemaFactory.createForClass(ModifierGroupDocument);

@Schema({ collection: 'menu_items', timestamps: true })
export class MenuItemDocument {
  @Prop({ required: true, unique: true })
  sku!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, min: 0 })
  basePriceCents!: number;

  @Prop({ required: true, default: false })
  isCustomizable!: boolean;

  @Prop({ type: [ModifierGroupSchema], default: [] })
  modifierGroups!: ModifierGroupDocument[];
}

export type MenuItemHydratedDocument = HydratedDocument<MenuItemDocument>;
export const MenuItemSchema = SchemaFactory.createForClass(MenuItemDocument);
