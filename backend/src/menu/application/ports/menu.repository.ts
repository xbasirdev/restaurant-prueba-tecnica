import { MenuItem } from '../../domain/entities/menu.entity';

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');

export interface MenuRepository {
  findAll(): Promise<MenuItem[]>;
}
