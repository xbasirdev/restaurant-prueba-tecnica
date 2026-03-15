import { Controller, Get } from '@nestjs/common';
import { GetMenuUseCase } from '../application/use-cases/get-menu.use-case';
import { MenuView } from '../domain/entities/menu.entity';

@Controller('menu')
export class MenuController {
  constructor(private readonly getMenuUseCase: GetMenuUseCase) {}

  @Get()
  getMenu(): Promise<MenuView> {
    return this.getMenuUseCase.execute();
  }
}
