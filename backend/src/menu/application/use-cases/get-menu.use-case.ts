import { Inject, Injectable } from '@nestjs/common';
import { MENU_REPOSITORY } from '../ports/menu.repository';
import type { MenuRepository } from '../ports/menu.repository';
import { MenuCategory, MenuItem, MenuView } from '../../domain/entities/menu.entity';

@Injectable()
export class GetMenuUseCase {
  constructor(
    @Inject(MENU_REPOSITORY)
    private readonly menuRepository: MenuRepository,
  ) {}

  async execute(): Promise<MenuView> {
    const items = await this.menuRepository.findAll();

    const categoryMap = new Map<string, MenuItem[]>();

    for (const item of items) {
      const categoryItems = categoryMap.get(item.category) ?? [];
      categoryItems.push(item);
      categoryMap.set(item.category, categoryItems);
    }

    const categories: MenuCategory[] = Array.from(categoryMap.entries()).map(
      ([categoryName, categoryItems]) => ({
        id: categoryName.toLowerCase().replace(/\s+/g, '-'),
        name: categoryName,
        items: categoryItems,
      }),
    );

    return {
      categories,
    };
  }
}
