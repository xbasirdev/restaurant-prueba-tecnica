import { CreateOrderUseCase } from './create-order.use-case';
import type { IdempotencyRecord, IdempotencyRepository } from '../ports/idempotency.repository';
import type { MenuCatalogItem, MenuCatalogRepository } from '../ports/menu-catalog.repository';
import type { OrderEventBus } from '../ports/order-event-bus';
import type { OrderRepository } from '../ports/order.repository';
import type { TimelineRepository } from '../ports/timeline.repository';

describe('CreateOrderUseCase', () => {
  const sampleMenuItem: MenuCatalogItem = {
    sku: 'BOWL-CLASSIC',
    name: 'Classic Bowl',
    basePriceCents: 900,
    isCustomizable: true,
    modifierGroups: [
      {
        id: 'protein',
        name: 'Protein',
        type: 'protein',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: 'chicken', name: 'Chicken', priceDeltaCents: 0 },
          { id: 'beef', name: 'Beef', priceDeltaCents: 150 },
        ],
      },
      {
        id: 'toppings',
        name: 'Toppings',
        type: 'toppings',
        required: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'corn', name: 'Corn', priceDeltaCents: 30 },
          { id: 'avocado', name: 'Avocado', priceDeltaCents: 120 },
        ],
      },
    ],
  };

  const buildUseCase = () => {
    const idempotencyStore = new Map<string, IdempotencyRecord>();

    const orderRepository: jest.Mocked<OrderRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
      findByOrderId: jest.fn().mockResolvedValue(null),
      findRecent: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    const idempotencyRepository: jest.Mocked<IdempotencyRepository> = {
      findByKey: jest.fn(async (key: string) => idempotencyStore.get(key) ?? null),
      create: jest.fn(async (record: IdempotencyRecord) => {
        idempotencyStore.set(record.key, record);
      }),
    };

    const menuCatalogRepository: jest.Mocked<MenuCatalogRepository> = {
      findBySkus: jest.fn().mockResolvedValue([sampleMenuItem]),
    };

    const timelineRepository: jest.Mocked<TimelineRepository> = {
      append: jest.fn().mockResolvedValue(undefined),
      findByOrderId: jest.fn().mockResolvedValue([]),
    };

    const orderEventBus: jest.Mocked<OrderEventBus> = {
      emitOrderCreated: jest.fn(),
      onOrderCreated: jest.fn(),
    };

    const useCase = new CreateOrderUseCase(
      orderRepository,
      idempotencyRepository,
      menuCatalogRepository,
      timelineRepository,
      orderEventBus,
    );

    return {
      useCase,
      orderRepository,
      idempotencyRepository,
      menuCatalogRepository,
      timelineRepository,
      orderEventBus,
    };
  };

  it('applies server-side pricing and service fee logic', async () => {
    const { useCase, orderRepository } = buildUseCase();

    await useCase.execute(
      {
        userId: 'mock-user-ui',
        items: [
          {
            sku: 'BOWL-CLASSIC',
            quantity: 1,
            modifiers: [
              { groupId: 'protein', optionIds: ['chicken'] },
            ],
          },
        ],
      },
      'idem-pricing-1',
    );

    expect(orderRepository.create).toHaveBeenCalledTimes(1);
    const createdOrder = orderRepository.create.mock.calls[0][0];

    expect(createdOrder.totals).toEqual({
      subtotalCents: 900,
      serviceFeeCents: 100,
      totalCents: 1000,
      currency: 'USD',
    });
  });

  it('is idempotent for repeated POST /orders with same key and same payload', async () => {
    const { useCase, orderRepository, timelineRepository, orderEventBus } = buildUseCase();

    const request = {
      userId: 'mock-user-ui',
      items: [
        {
          sku: 'BOWL-CLASSIC',
          quantity: 1,
          modifiers: [{ groupId: 'protein', optionIds: ['beef'] }],
        },
      ],
    };

    const first = await useCase.execute(request, 'idem-same-key');
    const second = await useCase.execute(request, 'idem-same-key');

    expect(second.orderId).toBe(first.orderId);
    expect(orderRepository.create).toHaveBeenCalledTimes(1);
    expect(timelineRepository.append).toHaveBeenCalledTimes(1);
    expect(orderEventBus.emitOrderCreated).toHaveBeenCalledTimes(1);
  });

  it('rejects modifier selections above maxSelect', async () => {
    const { useCase, orderRepository } = buildUseCase();

    await expect(
      useCase.execute(
        {
          userId: 'mock-user-ui',
          items: [
            {
              sku: 'BOWL-CLASSIC',
              quantity: 1,
              modifiers: [
                { groupId: 'protein', optionIds: ['chicken'] },
                { groupId: 'toppings', optionIds: ['corn', 'avocado'] },
              ],
            },
          ],
        },
        'idem-invalid-modifiers',
      ),
    ).rejects.toThrow('allows up to 1 options');

    expect(orderRepository.create).not.toHaveBeenCalled();
  });
});
