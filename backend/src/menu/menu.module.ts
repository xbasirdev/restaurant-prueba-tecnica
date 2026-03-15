import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GetMenuUseCase } from './application/use-cases/get-menu.use-case';
import { MENU_REPOSITORY } from './application/ports/menu.repository';
import { MenuMongoDbRepository } from './infrastructure/persistence/menu.mongodb.repository';
import {
  MenuItemDocument,
  MenuItemSchema,
} from './infrastructure/persistence/menu.schema';
import { MenuController } from './presentation/menu.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MenuItemDocument.name,
        schema: MenuItemSchema,
      },
    ]),
  ],
  controllers: [MenuController],
  providers: [
    GetMenuUseCase,
    {
      provide: MENU_REPOSITORY,
      useClass: MenuMongoDbRepository,
    },
  ],
})
export class MenuModule {}
