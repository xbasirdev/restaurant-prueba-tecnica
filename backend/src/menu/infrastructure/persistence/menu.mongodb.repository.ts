import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuRepository } from '../../application/ports/menu.repository';
import { MenuItem } from '../../domain/entities/menu.entity';
import {
  MenuItemDocument,
  MenuItemHydratedDocument,
} from './menu.schema';

@Injectable()
export class MenuMongoDbRepository implements MenuRepository {
  constructor(
    @InjectModel(MenuItemDocument.name)
    private readonly menuModel: Model<MenuItemHydratedDocument>,
  ) {}

  async findAll(): Promise<MenuItem[]> {
    const documents = await this.menuModel
      .find({}, { __v: 0 })
      .sort({ category: 1, name: 1 })
      .lean()
      .exec();

    return documents.map((document) => ({
      id: String(document._id),
      sku: document.sku,
      name: document.name,
      description: document.description,
      category: document.category,
      basePriceCents: document.basePriceCents,
      isCustomizable: document.isCustomizable,
      modifierGroups: (document.modifierGroups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: (group.options ?? []).map((option) => ({
          id: option.id,
          name: option.name,
          priceDeltaCents: option.priceDeltaCents,
        })),
      })),
    }));
  }
}
