export type ModifierGroupType = 'protein' | 'toppings' | 'sauces';

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: ModifierGroupType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  basePriceCents: number;
  isCustomizable: boolean;
  modifierGroups: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuView {
  categories: MenuCategory[];
}
