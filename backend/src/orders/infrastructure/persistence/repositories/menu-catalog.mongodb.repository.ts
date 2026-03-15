import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MENU_CATALOG_REPOSITORY,
  MenuCatalogItem,
  MenuCatalogRepository,
} from '../../../application/ports/menu-catalog.repository';
import {
  MenuItemDocument,
  MenuItemHydratedDocument,
} from '../../../../menu/infrastructure/persistence/menu.schema';

@Injectable()
export class MenuCatalogMongoDbRepository implements MenuCatalogRepository {
  constructor(
    @InjectModel(MenuItemDocument.name)
    private readonly menuModel: Model<MenuItemHydratedDocument>,
  ) {}

  async findBySkus(skus: string[]): Promise<MenuCatalogItem[]> {
    const documents = await this.menuModel
      .find({ sku: { $in: skus } })
      .lean()
      .exec();

    return documents.map((document) => ({
      sku: document.sku,
      name: document.name,
      basePriceCents: document.basePriceCents,
      isCustomizable: document.isCustomizable,
      modifierGroups: document.modifierGroups,
    }));
  }
}

export { MENU_CATALOG_REPOSITORY };
