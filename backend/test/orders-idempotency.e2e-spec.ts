import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CreateOrderUseCase } from '../src/orders/application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../src/orders/application/use-cases/get-order.use-case';
import { ListOrdersUseCase } from '../src/orders/application/use-cases/list-orders.use-case';
import { OrdersController } from '../src/orders/presentation/orders.controller';
import {
  IDEMPOTENCY_REPOSITORY,
  IdempotencyRecord,
  IdempotencyRepository,
} from '../src/orders/application/ports/idempotency.repository';
import {
  MENU_CATALOG_REPOSITORY,
  MenuCatalogItem,
  MenuCatalogRepository,
} from '../src/orders/application/ports/menu-catalog.repository';
import {
  ORDER_EVENT_BUS,
  OrderEventBus,
} from '../src/orders/application/ports/order-event-bus';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from '../src/orders/application/ports/order.repository';
import {
  TIMELINE_REPOSITORY,
  TimelineRepository,
} from '../src/orders/application/ports/timeline.repository';
import { Order } from '../src/orders/domain/entities/order.entity';
import { OrderTimelineEvent } from '../src/orders/domain/entities/order-timeline-event.entity';

class InMemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, Order>();

  async create(order: Order): Promise<void> {
    this.byId.set(order.orderId, order);
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    return this.byId.get(orderId) ?? null;
  }

  async findRecent(page: number, pageSize: number): Promise<Order[]> {
    const all = Array.from(this.byId.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const safePage = page > 0 ? page : 1;
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const start = (safePage - 1) * safePageSize;
    return all.slice(start, start + safePageSize);
  }

  async updateStatus(orderId: string, status: Order['status']): Promise<void> {
    const current = this.byId.get(orderId);
    if (!current) {
      return;
    }

    this.byId.set(orderId, {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly byKey = new Map<string, IdempotencyRecord>();

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    return this.byKey.get(key) ?? null;
  }

  async create(record: IdempotencyRecord): Promise<void> {
    this.byKey.set(record.key, record);
  }
}

class InMemoryMenuCatalogRepository implements MenuCatalogRepository {
  private readonly menu: MenuCatalogItem[] = [
    {
      sku: 'BOWL-CLASSIC',
      name: 'Classic Bowl',
      basePriceCents: 900,
      isCustomizable: false,
      modifierGroups: [],
    },
  ];

  async findBySkus(skus: string[]): Promise<MenuCatalogItem[]> {
    const set = new Set(skus);
    return this.menu.filter((item) => set.has(item.sku));
  }
}

class InMemoryTimelineRepository implements TimelineRepository {
  private readonly events: OrderTimelineEvent[] = [];

  async append(events: OrderTimelineEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async findByOrderId(orderId: string, page: number, pageSize: number): Promise<OrderTimelineEvent[]> {
    const safePage = page > 0 ? page : 1;
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const filtered = this.events
      .filter((event) => event.orderId === orderId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const start = (safePage - 1) * safePageSize;
    return filtered.slice(start, start + safePageSize);
  }
}

class InMemoryOrderEventBus implements OrderEventBus {
  emitOrderCreated(): void {
    // No-op for this e2e scope; endpoint behavior is validated at API boundary.
  }

  onOrderCreated(): void {
    // No-op
  }
}

describe('Orders Idempotency (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        CreateOrderUseCase,
        GetOrderUseCase,
        ListOrdersUseCase,
        { provide: ORDER_REPOSITORY, useClass: InMemoryOrderRepository },
        { provide: IDEMPOTENCY_REPOSITORY, useClass: InMemoryIdempotencyRepository },
        { provide: MENU_CATALOG_REPOSITORY, useClass: InMemoryMenuCatalogRepository },
        { provide: TIMELINE_REPOSITORY, useClass: InMemoryTimelineRepository },
        { provide: ORDER_EVENT_BUS, useClass: InMemoryOrderEventBus },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns same orderId for repeated POST /orders with same idempotency key and payload', async () => {
    const idempotencyKey = 'e2e-idem-001';
    const payload = {
      userId: 'mock-user-e2e',
      items: [{ sku: 'BOWL-CLASSIC', quantity: 1, modifiers: [] }],
    };

    const firstResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(202);

    const secondResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(202);

    expect(firstResponse.body.orderId).toBeDefined();
    expect(secondResponse.body.orderId).toBe(firstResponse.body.orderId);

    const ordersResponse = await request(app.getHttpServer())
      .get('/orders?page=1&pageSize=20')
      .expect(200);

    expect(Array.isArray(ordersResponse.body)).toBe(true);
    expect(ordersResponse.body).toHaveLength(1);
    expect(ordersResponse.body[0].orderId).toBe(firstResponse.body.orderId);
  });
});
