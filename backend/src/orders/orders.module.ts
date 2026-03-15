import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { MenuItemDocument, MenuItemSchema } from '../menu/infrastructure/persistence/menu.schema';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { OrderCreatedWorker } from './application/workers/order-created.worker';
import { IDEMPOTENCY_REPOSITORY } from './application/ports/idempotency.repository';
import { MENU_CATALOG_REPOSITORY } from './application/ports/menu-catalog.repository';
import { ORDER_EVENT_BUS } from './application/ports/order-event-bus';
import { ORDER_REPOSITORY } from './application/ports/order.repository';
import { TIMELINE_REPOSITORY } from './application/ports/timeline.repository';
import { InMemoryOrderEventBus } from './infrastructure/events/in-memory-order-event-bus';
import { IdempotencyMongoDbRepository } from './infrastructure/persistence/repositories/idempotency.mongodb.repository';
import { IdempotencyRedisRepository } from './infrastructure/persistence/repositories/idempotency.redis.repository';
import { MenuCatalogMongoDbRepository } from './infrastructure/persistence/repositories/menu-catalog.mongodb.repository';
import { OrderMongoDbRepository } from './infrastructure/persistence/repositories/order.mongodb.repository';
import { TimelineMongoDbRepository } from './infrastructure/persistence/repositories/timeline.mongodb.repository';
import {
  IdempotencyDocument,
  IdempotencySchema,
} from './infrastructure/persistence/schemas/idempotency.schema';
import { OrderDocument, OrderSchema } from './infrastructure/persistence/schemas/order.schema';
import {
  OrderTimelineDocument,
  OrderTimelineSchema,
} from './infrastructure/persistence/schemas/order-timeline.schema';
import { OrdersController } from './presentation/orders.controller';

@Module({
  imports: [
    RedisModule,
    MongooseModule.forFeature([
      { name: OrderDocument.name, schema: OrderSchema },
      { name: IdempotencyDocument.name, schema: IdempotencySchema },
      { name: OrderTimelineDocument.name, schema: OrderTimelineSchema },
      { name: MenuItemDocument.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    CreateOrderUseCase,
    GetOrderUseCase,
    OrderCreatedWorker,
    IdempotencyMongoDbRepository,
    IdempotencyRedisRepository,
    {
      provide: ORDER_REPOSITORY,
      useClass: OrderMongoDbRepository,
    },
    {
      provide: IDEMPOTENCY_REPOSITORY,
      inject: [
        ConfigService,
        IdempotencyMongoDbRepository,
        IdempotencyRedisRepository,
      ],
      useFactory: (
        configService: ConfigService,
        mongoRepository: IdempotencyMongoDbRepository,
        redisRepository: IdempotencyRedisRepository,
      ) => {
        const enableRedis = configService.get<boolean>('ENABLE_REDIS', false);
        return enableRedis ? redisRepository : mongoRepository;
      },
    },
    {
      provide: MENU_CATALOG_REPOSITORY,
      useClass: MenuCatalogMongoDbRepository,
    },
    {
      provide: TIMELINE_REPOSITORY,
      useClass: TimelineMongoDbRepository,
    },
    {
      provide: ORDER_EVENT_BUS,
      useClass: InMemoryOrderEventBus,
    },
  ],
})
export class OrdersModule {}
