import type { ModifierGroup } from '../../../menu/domain/entities/menu.entity';

export interface MenuCatalogItem {
  sku: string;
  name: string;
  basePriceCents: number;
  isCustomizable: boolean;
  modifierGroups: ModifierGroup[];
}

export const MENU_CATALOG_REPOSITORY = Symbol('MENU_CATALOG_REPOSITORY');

export interface MenuCatalogRepository {
  findBySkus(skus: string[]): Promise<MenuCatalogItem[]>;
}
