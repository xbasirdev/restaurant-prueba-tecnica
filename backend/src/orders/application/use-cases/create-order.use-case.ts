import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  IDEMPOTENCY_REPOSITORY,
} from '../ports/idempotency.repository';
import type { IdempotencyRepository } from '../ports/idempotency.repository';
import {
  MENU_CATALOG_REPOSITORY,
} from '../ports/menu-catalog.repository';
import type {
  MenuCatalogItem,
  MenuCatalogRepository,
} from '../ports/menu-catalog.repository';
import { ORDER_EVENT_BUS } from '../ports/order-event-bus';
import type { OrderEventBus } from '../ports/order-event-bus';
import { ORDER_REPOSITORY } from '../ports/order.repository';
import type { OrderRepository } from '../ports/order.repository';
import { TIMELINE_REPOSITORY } from '../ports/timeline.repository';
import type { TimelineRepository } from '../ports/timeline.repository';
import { CreateOrderRequest } from '../dto/create-order.request';
import type { ModifierGroup } from '../../../menu/domain/entities/menu.entity';
import type {
  Order,
  OrderItem,
  OrderTotals,
  SelectedModifier,
} from '../../domain/entities/order.entity';
import type { OrderTimelineEvent } from '../../domain/entities/order-timeline-event.entity';

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(IDEMPOTENCY_REPOSITORY)
    private readonly idempotencyRepository: IdempotencyRepository,
    @Inject(MENU_CATALOG_REPOSITORY)
    private readonly menuCatalogRepository: MenuCatalogRepository,
    @Inject(TIMELINE_REPOSITORY)
    private readonly timelineRepository: TimelineRepository,
    @Inject(ORDER_EVENT_BUS)
    private readonly orderEventBus: OrderEventBus,
  ) {}

  async execute(request: CreateOrderRequest, idempotencyKey: string): Promise<{ orderId: string }> {
    const normalizedRequest = this.normalizeRequest(request);
    const requestHash = this.hashRequest(normalizedRequest);

    const existingRecord = await this.idempotencyRepository.findByKey(idempotencyKey);

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new ConflictException('Idempotency-Key already used with different payload');
      }

      return { orderId: existingRecord.orderId };
    }

    const orderId = randomUUID();
    const correlationId = randomUUID();
    const userId = normalizedRequest.userId ?? 'mock-user';

    const orderItems = await this.calculateItems(normalizedRequest.items, orderId, userId, correlationId);
    const totals = this.calculateTotals(orderItems);

    const now = new Date().toISOString();

    const order: Order = {
      orderId,
      userId,
      status: 'RECEIVED',
      items: orderItems,
      totals,
      idempotencyKey,
      correlationId,
      createdAt: now,
      updatedAt: now,
    };

    await this.orderRepository.create(order);

    await this.idempotencyRepository.create({
      key: idempotencyKey,
      requestHash,
      orderId,
      createdAt: now,
    });

    await this.timelineRepository.append([
      this.createTimelineEvent(orderId, userId, 'ORDER_PLACED', 'api', correlationId, {
        itemCount: orderItems.length,
      }),
      this.createTimelineEvent(orderId, userId, 'PRICING_CALCULATED', 'api', correlationId, {
        ...totals,
      }),
    ]);

    this.orderEventBus.emitOrderCreated({
      orderId,
      userId,
      correlationId,
    });

    return { orderId };
  }

  private normalizeRequest(request: CreateOrderRequest): CreateOrderRequest {
    if (!request || !Array.isArray(request.items) || request.items.length === 0) {
      throw new BadRequestException('Order must include at least one item');
    }

    return {
      userId: request.userId,
      items: request.items.map((item) => ({
        sku: String(item.sku ?? '').trim(),
        quantity: Number(item.quantity),
        modifiers: Array.isArray(item.modifiers)
          ? item.modifiers.map((modifier) => ({
              groupId: String(modifier.groupId ?? '').trim(),
              optionIds: Array.isArray(modifier.optionIds)
                ? modifier.optionIds.map((optionId) => String(optionId).trim())
                : [],
            }))
          : [],
      })),
    };
  }

  private hashRequest(request: CreateOrderRequest): string {
    return createHash('sha256')
      .update(this.stableStringify(request))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(object[key])}`)
      .join(',')}}`;
  }

  private async calculateItems(
    items: CreateOrderRequest['items'],
    orderId: string,
    userId: string,
    correlationId: string,
  ): Promise<OrderItem[]> {
    for (const item of items) {
      if (!item.sku) {
        await this.appendValidationFailed(orderId, userId, correlationId, 'Item sku is required');
        throw new BadRequestException('Item sku is required');
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        await this.appendValidationFailed(
          orderId,
          userId,
          correlationId,
          `Item quantity for ${item.sku} must be a positive integer`,
        );
        throw new BadRequestException(`Item quantity for ${item.sku} must be a positive integer`);
      }
    }

    const skus = [...new Set(items.map((item) => item.sku))];
    const menuItems = await this.menuCatalogRepository.findBySkus(skus);
    const menuBySku = new Map(menuItems.map((item) => [item.sku, item]));

    const result: OrderItem[] = [];

    for (const inputItem of items) {
      const menuItem = menuBySku.get(inputItem.sku);

      if (!menuItem) {
        await this.appendValidationFailed(
          orderId,
          userId,
          correlationId,
          `Menu item ${inputItem.sku} does not exist`,
        );
        throw new BadRequestException(`Menu item ${inputItem.sku} does not exist`);
      }

      const itemModifiers = inputItem.modifiers ?? [];

      const modifierTotal = this.calculateModifierTotal(
        itemModifiers,
        menuItem,
        orderId,
        userId,
        correlationId,
      );
      const unitPrice = menuItem.basePriceCents + modifierTotal;

      result.push({
        sku: menuItem.sku,
        name: menuItem.name,
        quantity: inputItem.quantity,
        basePriceCents: menuItem.basePriceCents,
        modifiersTotalCents: modifierTotal,
        lineTotalCents: unitPrice * inputItem.quantity,
        modifiers: itemModifiers,
      });
    }

    return result;
  }

  private calculateModifierTotal(
    selected: SelectedModifier[],
    menuItem: MenuCatalogItem,
    orderId: string,
    userId: string,
    correlationId: string,
  ): number {
    if (!menuItem.isCustomizable) {
      if (selected.length > 0) {
        void this.appendValidationFailed(
          orderId,
          userId,
          correlationId,
          `Menu item ${menuItem.sku} does not allow modifiers`,
        );
        throw new BadRequestException(`Menu item ${menuItem.sku} does not allow modifiers`);
      }
      return 0;
    }

    const byGroup = new Map(selected.map((modifier) => [modifier.groupId, modifier.optionIds]));

    let total = 0;

    for (const group of menuItem.modifierGroups) {
      const optionIds = byGroup.get(group.id) ?? [];
      this.validateGroupSelection(optionIds, group, menuItem.sku, orderId, userId, correlationId);

      const optionPrice = optionIds.reduce((acc, optionId) => {
        const option = group.options.find((groupOption) => groupOption.id === optionId);
        if (!option) {
          void this.appendValidationFailed(
            orderId,
            userId,
            correlationId,
            `Invalid option ${optionId} for group ${group.id}`,
          );
          throw new BadRequestException(`Invalid option ${optionId} for group ${group.id}`);
        }
        return acc + option.priceDeltaCents;
      }, 0);

      total += optionPrice;
    }

    return total;
  }

  private validateGroupSelection(
    optionIds: string[],
    group: ModifierGroup,
    sku: string,
    orderId: string,
    userId: string,
    correlationId: string,
  ): void {
    if (group.required && optionIds.length < group.minSelect) {
      void this.appendValidationFailed(
        orderId,
        userId,
        correlationId,
        `Modifier group ${group.id} for ${sku} requires at least ${group.minSelect} option`,
      );
      throw new BadRequestException(
        `Modifier group ${group.id} for ${sku} requires at least ${group.minSelect} option`,
      );
    }

    if (optionIds.length > group.maxSelect) {
      void this.appendValidationFailed(
        orderId,
        userId,
        correlationId,
        `Modifier group ${group.id} for ${sku} allows up to ${group.maxSelect} options`,
      );
      throw new BadRequestException(
        `Modifier group ${group.id} for ${sku} allows up to ${group.maxSelect} options`,
      );
    }
  }

  private calculateTotals(items: OrderItem[]): OrderTotals {
    const subtotalCents = items.reduce((acc, item) => acc + item.lineTotalCents, 0);
    const serviceFeeCents = Math.max(100, Math.round(subtotalCents * 0.1));

    return {
      subtotalCents,
      serviceFeeCents,
      totalCents: subtotalCents + serviceFeeCents,
      currency: 'USD',
    };
  }

  private async appendValidationFailed(
    orderId: string,
    userId: string,
    correlationId: string,
    reason: string,
  ): Promise<void> {
    await this.timelineRepository.append([
      this.createTimelineEvent(orderId, userId, 'VALIDATION_FAILED', 'api', correlationId, {
        reason,
      }),
    ]);
  }

  private createTimelineEvent(
    orderId: string,
    userId: string,
    type: OrderTimelineEvent['type'],
    source: OrderTimelineEvent['source'],
    correlationId: string,
    payload: Record<string, unknown>,
  ): OrderTimelineEvent {
    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      orderId,
      userId,
      type,
      source,
      correlationId,
      payload,
    };
  }
}
