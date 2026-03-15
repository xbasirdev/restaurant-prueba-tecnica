import { useEffect, useMemo, useState } from 'react'
import './App.css'

type ModifierGroupType = 'protein' | 'toppings' | 'sauces'

interface ModifierOption {
  id: string
  name: string
  priceDeltaCents: number
}

interface ModifierGroup {
  id: string
  name: string
  type: ModifierGroupType
  required: boolean
  minSelect: number
  maxSelect: number
  options: ModifierOption[]
}

interface MenuItem {
  id: string
  sku: string
  name: string
  description: string
  category: string
  basePriceCents: number
  isCustomizable: boolean
  modifierGroups: ModifierGroup[]
}

interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
}

interface MenuView {
  categories: MenuCategory[]
}

type OrderStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface SelectedModifier {
  groupId: string
  optionIds: string[]
}

interface OrderItem {
  sku: string
  name: string
  quantity: number
  basePriceCents: number
  modifiersTotalCents: number
  lineTotalCents: number
  modifiers: SelectedModifier[]
}

interface OrderTotals {
  subtotalCents: number
  serviceFeeCents: number
  totalCents: number
  currency: 'USD'
}

interface OrderResponse {
  orderId: string
  userId: string
  status: OrderStatus
  totals: OrderTotals
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

interface OrdersListItem {
  orderId: string
  userId: string
  status: OrderStatus
  totals: OrderTotals
  createdAt: string
  updatedAt: string
}

type OrderTimelineEventType =
  | 'CART_ITEM_ADDED'
  | 'CART_ITEM_UPDATED'
  | 'CART_ITEM_REMOVED'
  | 'PRICING_CALCULATED'
  | 'ORDER_PLACED'
  | 'ORDER_STATUS_CHANGED'
  | 'VALIDATION_FAILED'

interface OrderTimelineEvent {
  eventId: string
  timestamp: string
  orderId: string
  userId: string
  type: OrderTimelineEventType
  source: 'api' | 'worker' | 'ui'
  correlationId: string
  payload: Record<string, unknown>
}

interface CartItem {
  id: string
  sku: string
  name: string
  quantity: number
  basePriceCents: number
  modifiers: SelectedModifier[]
}

interface BuilderState {
  quantity: number
  selections: Record<string, string[]>
}

interface TimelineValidationResult {
  events: OrderTimelineEvent[]
  droppedCount: number
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const DEFAULT_TIMELINE_PAGE_SIZE = 20
const DEFAULT_ORDERS_PAGE_SIZE = 10
const MAX_TIMELINE_PAGE_SIZE = 50
const MAX_TIMELINE_PAYLOAD_BYTES = 16 * 1024
const REQUIRED_TIMELINE_EVENT_TYPES: OrderTimelineEventType[] = [
  'CART_ITEM_ADDED',
  'CART_ITEM_UPDATED',
  'CART_ITEM_REMOVED',
  'PRICING_CALCULATED',
  'ORDER_PLACED',
  'ORDER_STATUS_CHANGED',
  'VALIDATION_FAILED',
]

const formatMoney = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

const createClientUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ui-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

const normalizeModifiers = (modifiers: SelectedModifier[]): SelectedModifier[] => {
  return modifiers
    .map((modifier) => ({
      groupId: modifier.groupId,
      optionIds: [...modifier.optionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
}

const buildCartSignature = (item: CartItem): string => {
  return `${item.sku}::${JSON.stringify(normalizeModifiers(item.modifiers))}`
}

const makeBuilderState = (): BuilderState => ({
  quantity: 1,
  selections: {},
})

const isValidTimelineType = (value: unknown): value is OrderTimelineEventType => {
  return REQUIRED_TIMELINE_EVENT_TYPES.includes(value as OrderTimelineEventType)
}

const isValidSource = (value: unknown): value is OrderTimelineEvent['source'] => {
  return value === 'api' || value === 'worker' || value === 'ui'
}

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }

  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

const payloadSizeBytes = (payload: Record<string, unknown>): number => {
  return new TextEncoder().encode(JSON.stringify(payload)).length
}

const normalizeTimeline = (items: unknown[]): TimelineValidationResult => {
  const byId = new Map<string, OrderTimelineEvent>()
  let droppedCount = 0

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      droppedCount += 1
      continue
    }

    const event = raw as Record<string, unknown>

    const hasValidShape =
      typeof event.eventId === 'string' &&
      event.eventId.length > 0 &&
      isIsoTimestamp(event.timestamp) &&
      typeof event.orderId === 'string' &&
      event.orderId.length > 0 &&
      typeof event.userId === 'string' &&
      event.userId.length > 0 &&
      isValidTimelineType(event.type) &&
      isValidSource(event.source) &&
      typeof event.correlationId === 'string' &&
      event.correlationId.length > 0 &&
      !!event.payload &&
      typeof event.payload === 'object' &&
      !Array.isArray(event.payload)

    if (!hasValidShape) {
      droppedCount += 1
      continue
    }

    const eventId = event.eventId as string
    const timestamp = event.timestamp as string
    const orderId = event.orderId as string
    const userId = event.userId as string
    const type = event.type as OrderTimelineEventType
    const source = event.source as OrderTimelineEvent['source']
    const correlationId = event.correlationId as string
    const payload = event.payload as Record<string, unknown>

    const normalizedEvent: OrderTimelineEvent = {
      eventId,
      timestamp,
      orderId,
      userId,
      type,
      source,
      correlationId,
      payload,
    }

    if (payloadSizeBytes(normalizedEvent.payload) > MAX_TIMELINE_PAYLOAD_BYTES) {
      droppedCount += 1
      continue
    }

    byId.set(normalizedEvent.eventId, normalizedEvent)
  }

  const events = Array.from(byId.values())
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return {
    events,
    droppedCount,
  }
}

function App() {
  const [menu, setMenu] = useState<MenuView | null>(null)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)

  const [builders, setBuilders] = useState<Record<string, BuilderState>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartMessage, setCartMessage] = useState<string | null>(null)

  const [idempotencyKey, setIdempotencyKey] = useState(createClientUuid())
  const [orderSubmitLoading, setOrderSubmitLoading] = useState(false)
  const [orderSubmitError, setOrderSubmitError] = useState<string | null>(null)

  const [orderLookupId, setOrderLookupId] = useState('')
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<OrderResponse | null>(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timelinePage, setTimelinePage] = useState(1)
  const [timelinePageSize, setTimelinePageSize] = useState(DEFAULT_TIMELINE_PAGE_SIZE)
  const [timelineDroppedCount, setTimelineDroppedCount] = useState(0)

  const [ordersList, setOrdersList] = useState<OrdersListItem[]>([])
  const [ordersListLoading, setOrdersListLoading] = useState(false)
  const [ordersListError, setOrdersListError] = useState<string | null>(null)
  const [ordersListPage, setOrdersListPage] = useState(1)

  const categories = menu?.categories ?? []
  const safeTimelinePageSize = Math.min(Math.max(Math.floor(timelinePageSize || 1), 1), MAX_TIMELINE_PAGE_SIZE)
  const missingTimelineEventTypes = REQUIRED_TIMELINE_EVENT_TYPES.filter(
    (requiredType) => !timeline.some((event) => event.type === requiredType),
  )

  const cartSubtotalCents = useMemo(() => {
    const bySku = new Map<string, MenuItem>()

    for (const category of categories) {
      for (const item of category.items) {
        bySku.set(item.sku, item)
      }
    }

    return cart.reduce((acc, item) => {
      const menuItem = bySku.get(item.sku)
      const modifiersTotal = item.modifiers.reduce((modifierAcc, modifier) => {
        const group = menuItem?.modifierGroups.find((value) => value.id === modifier.groupId)
        if (!group) {
          return modifierAcc
        }

        const groupTotal = modifier.optionIds.reduce((optionAcc, optionId) => {
          const option = group.options.find((value) => value.id === optionId)
          return optionAcc + (option?.priceDeltaCents ?? 0)
        }, 0)

        return modifierAcc + groupTotal
      }, 0)

      return acc + (item.basePriceCents + modifiersTotal) * item.quantity
    }, 0)
  }, [cart, categories])

  useEffect(() => {
    const fetchMenu = async (): Promise<void> => {
      setMenuLoading(true)
      setMenuError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/menu`)
        if (!response.ok) {
          throw new Error(`Menu request failed with status ${response.status}`)
        }

        const data = (await response.json()) as MenuView
        setMenu(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load menu'
        setMenuError(message)
      } finally {
        setMenuLoading(false)
      }
    }

    void fetchMenu()
  }, [])

  useEffect(() => {
    void loadOrdersList(ordersListPage)
  }, [ordersListPage])

  useEffect(() => {
    if (!activeOrderId) {
      return
    }

    if (orderData?.status === 'COMPLETED' || orderData?.status === 'FAILED') {
      return
    }

    const intervalId = setInterval(() => {
      void loadOrder(activeOrderId)
      void loadTimeline(activeOrderId, timelinePage)
    }, 1500)

    return () => {
      clearInterval(intervalId)
    }
  }, [activeOrderId, orderData?.status, timelinePage, safeTimelinePageSize])

  const getBuilder = (sku: string): BuilderState => {
    return builders[sku] ?? makeBuilderState()
  }

  const updateBuilderQuantity = (sku: string, quantity: number): void => {
    setBuilders((previous) => ({
      ...previous,
      [sku]: {
        ...getBuilder(sku),
        quantity: Math.max(1, Number.isFinite(quantity) ? quantity : 1),
      },
    }))
  }

  const resetBuilder = (sku: string): void => {
    setBuilders((previous) => ({
      ...previous,
      [sku]: makeBuilderState(),
    }))
  }

  const toggleOption = (
    sku: string,
    groupId: string,
    optionId: string,
    singleChoice: boolean,
    maxSelect: number,
  ): void => {
    setBuilders((previous) => {
      const current = previous[sku] ?? makeBuilderState()
      const currentSelection = current.selections[groupId] ?? []

      let nextSelection: string[] = []

      if (singleChoice) {
        nextSelection = [optionId]
      } else if (currentSelection.includes(optionId)) {
        nextSelection = currentSelection.filter((value) => value !== optionId)
      } else if (currentSelection.length < maxSelect) {
        nextSelection = [...currentSelection, optionId]
      } else {
        nextSelection = currentSelection
      }

      return {
        ...previous,
        [sku]: {
          ...current,
          selections: {
            ...current.selections,
            [groupId]: nextSelection,
          },
        },
      }
    })
  }

  const validateSelections = (item: MenuItem, selections: Record<string, string[]>): string | null => {
    if (!item.isCustomizable) {
      return null
    }

    for (const group of item.modifierGroups) {
      const selected = selections[group.id] ?? []

      if (selected.length < group.minSelect) {
        return `${item.name}: group ${group.name} requires at least ${group.minSelect} option(s).`
      }

      if (selected.length > group.maxSelect) {
        return `${item.name}: group ${group.name} allows up to ${group.maxSelect} option(s).`
      }
    }

    return null
  }

  const addItemToCart = (item: MenuItem): void => {
    const builder = getBuilder(item.sku)
    const validationError = validateSelections(item, builder.selections)

    if (validationError) {
      setCartMessage(validationError)
      return
    }

    const normalizedModifiers: SelectedModifier[] = item.modifierGroups
      .map((group) => ({
        groupId: group.id,
        optionIds: [...(builder.selections[group.id] ?? [])].sort(),
      }))
      .filter((modifier) => modifier.optionIds.length > 0)

    const nextItem: CartItem = {
      id: createClientUuid(),
      sku: item.sku,
      name: item.name,
      quantity: Math.max(1, builder.quantity),
      basePriceCents: item.basePriceCents,
      modifiers: normalizedModifiers,
    }

    setCart((previous) => {
      const nextSignature = buildCartSignature(nextItem)
      const existingIndex = previous.findIndex(
        (cartItem) => buildCartSignature(cartItem) === nextSignature,
      )

      if (existingIndex === -1) {
        return [...previous, nextItem]
      }

      return previous.map((cartItem, index) => {
        if (index !== existingIndex) {
          return cartItem
        }

        return {
          ...cartItem,
          quantity: cartItem.quantity + nextItem.quantity,
        }
      })
    })

    setCartMessage(`${item.name} was added to cart.`)
  }

  const updateCartQuantity = (itemId: string, nextQuantity: number): void => {
    if (nextQuantity <= 0) {
      setCart((previous) => previous.filter((item) => item.id !== itemId))
      return
    }

    setCart((previous) =>
      previous.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, nextQuantity) } : item,
      ),
    )
  }

  const loadOrder = async (orderId: string): Promise<void> => {
    setOrderLoading(true)
    setOrderError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`)
      if (!response.ok) {
        const body = (await response.json()) as { message?: string }
        throw new Error(body.message ?? `Order request failed with status ${response.status}`)
      }

      const data = (await response.json()) as OrderResponse
      setOrderData(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load order'
      setOrderError(message)
    } finally {
      setOrderLoading(false)
    }
  }

  const loadTimeline = async (orderId: string, page: number): Promise<void> => {
    setTimelineLoading(true)
    setTimelineError(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/orders/${orderId}/timeline?page=${page}&pageSize=${safeTimelinePageSize}`,
      )

      if (!response.ok) {
        const body = (await response.json()) as { message?: string }
        throw new Error(body.message ?? `Timeline request failed with status ${response.status}`)
      }

      const data = (await response.json()) as unknown
      const timelineInput = Array.isArray(data) ? data : []
      const normalized = normalizeTimeline(timelineInput)
      setTimeline(normalized.events)
      setTimelineDroppedCount(normalized.droppedCount)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load timeline'
      setTimelineError(message)
      setTimelineDroppedCount(0)
    } finally {
      setTimelineLoading(false)
    }
  }

  const loadOrdersList = async (page: number): Promise<void> => {
    setOrdersListLoading(true)
    setOrdersListError(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/orders?page=${page}&pageSize=${DEFAULT_ORDERS_PAGE_SIZE}`,
      )

      if (!response.ok) {
        const body = (await response.json()) as { message?: string }
        throw new Error(body.message ?? `Orders list request failed with status ${response.status}`)
      }

      const data = (await response.json()) as unknown
      const normalized = Array.isArray(data) ? data : []

      const safeOrders = normalized
        .filter((raw): raw is OrdersListItem => {
          if (!raw || typeof raw !== 'object') {
            return false
          }

          const item = raw as Record<string, unknown>
          const status = item.status

          return (
            typeof item.orderId === 'string' &&
            typeof item.userId === 'string' &&
            (status === 'RECEIVED' || status === 'PROCESSING' || status === 'COMPLETED' || status === 'FAILED') &&
            typeof item.createdAt === 'string' &&
            typeof item.updatedAt === 'string' &&
            !!item.totals &&
            typeof item.totals === 'object'
          )
        })

      setOrdersList(safeOrders)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load orders list'
      setOrdersListError(message)
    } finally {
      setOrdersListLoading(false)
    }
  }

  const submitOrder = async (): Promise<void> => {
    if (cart.length === 0) {
      setOrderSubmitError('Add at least one item to the cart before placing the order.')
      return
    }

    setOrderSubmitLoading(true)
    setOrderSubmitError(null)

    try {
      const payload = {
        userId: 'mock-user-ui',
        items: cart.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          modifiers: item.modifiers,
        })),
      }

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = (await response.json()) as { message?: string }
        throw new Error(body.message ?? `Order creation failed with status ${response.status}`)
      }

      const data = (await response.json()) as { orderId: string }
      setOrderLookupId(data.orderId)
      setActiveOrderId(data.orderId)
      setTimelinePage(1)
      await Promise.all([loadOrder(data.orderId), loadTimeline(data.orderId, 1)])
      await loadOrdersList(ordersListPage)
      setIdempotencyKey(createClientUuid())
      setCart([])
      setBuilders({})
      setCartMessage('Order submitted. Menu selections were reset for a new order.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order submission failed'
      setOrderSubmitError(message)
    } finally {
      setOrderSubmitLoading(false)
    }
  }

  const handleLookupOrder = async (): Promise<void> => {
    if (!orderLookupId.trim()) {
      setOrderError('Type an orderId first.')
      return
    }

    const normalizedOrderId = orderLookupId.trim()
    setActiveOrderId(normalizedOrderId)
    setTimelinePage(1)
    await Promise.all([loadOrder(normalizedOrderId), loadTimeline(normalizedOrderId, 1)])
  }

  const nextTimelinePage = async (): Promise<void> => {
    if (!activeOrderId) {
      return
    }

    const nextPage = timelinePage + 1
    setTimelinePage(nextPage)
    await loadTimeline(activeOrderId, nextPage)
  }

  const previousTimelinePage = async (): Promise<void> => {
    if (!activeOrderId || timelinePage <= 1) {
      return
    }

    const previousPage = timelinePage - 1
    setTimelinePage(previousPage)
    await loadTimeline(activeOrderId, previousPage)
  }

  const handleTimelinePageSizeChange = async (nextValue: number): Promise<void> => {
    const clamped = Math.min(Math.max(Math.floor(nextValue || 1), 1), MAX_TIMELINE_PAGE_SIZE)
    setTimelinePageSize(clamped)

    if (!activeOrderId) {
      return
    }

    setTimelinePage(1)
    await loadTimeline(activeOrderId, 1)
  }

  const nextOrdersListPage = async (): Promise<void> => {
    if (ordersList.length < DEFAULT_ORDERS_PAGE_SIZE) {
      return
    }

    setOrdersListPage((previous) => previous + 1)
  }

  const previousOrdersListPage = async (): Promise<void> => {
    setOrdersListPage((previous) => (previous > 1 ? previous - 1 : 1))
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <header className="hero-panel reveal">
        <p className="eyebrow">Prueba Tecnica - Xavier Basir</p>
        <h1>Build Your Plate at Restaurant</h1>
      </header>

      <section className="grid-layout">
        <article className="card reveal card-menu">
          <div className="section-title-row">
            <h2>Menu</h2>
            {menuLoading && <span className="chip">Loading...</span>}
          </div>
          <p className="section-subtitle">Select your favorites and customize each dish.</p>

          {menuError && <p className="error-text">{menuError}</p>}

          {!menuError && categories.length === 0 && !menuLoading && (
            <p className="muted-text">No menu items available.</p>
          )}

          <div className="menu-categories">
            {categories.map((category) => (
              <section key={category.id} className="category-block">
                <h3>{category.name}</h3>
                <div className="item-grid">
                  {category.items.map((item) => {
                    const builder = getBuilder(item.sku)

                    return (
                      <article key={item.id} className="menu-item-card">
                        <div className="item-head">
                          <div className="item-title-wrap">
                            <strong>{item.name}</strong>
                            {item.isCustomizable && <span className="item-badge">Customizable</span>}
                          </div>
                          <span>{formatMoney(item.basePriceCents)}</span>
                        </div>

                        <p>{item.description}</p>
                        <p className="sku">SKU: {item.sku}</p>

                        {item.isCustomizable && (
                          <div className="modifier-groups">
                            {item.modifierGroups.map((group) => {
                              const selected = builder.selections[group.id] ?? []
                              const singleChoice = group.maxSelect === 1

                              return (
                                <fieldset key={group.id}>
                                  <legend>
                                    {group.name}
                                    {group.required ? ' *' : ''}
                                    {' '}
                                    ({group.minSelect}-{group.maxSelect})
                                    {' '}
                                    <span className="legend-counter">{selected.length} selected</span>
                                  </legend>

                                  <div className="option-list">
                                    {group.options.map((option) => {
                                      const checked = selected.includes(option.id)

                                      return (
                                        <label
                                          key={option.id}
                                          className={`option-pill ${checked ? 'checked' : ''}`}
                                        >
                                          <input
                                            type={singleChoice ? 'radio' : 'checkbox'}
                                            name={`${item.sku}-${group.id}`}
                                            checked={checked}
                                            onChange={() =>
                                              toggleOption(
                                                item.sku,
                                                group.id,
                                                option.id,
                                                singleChoice,
                                                group.maxSelect,
                                              )
                                            }
                                          />
                                          <span>
                                            {option.name}
                                            {option.priceDeltaCents > 0
                                              ? ` (+${formatMoney(option.priceDeltaCents)})`
                                              : ''}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </fieldset>
                              )
                            })}
                          </div>
                        )}

                        <div className="item-actions">
                          <label>
                            Qty
                            <input
                              type="number"
                              min={1}
                              value={builder.quantity}
                              onChange={(event) =>
                                updateBuilderQuantity(item.sku, Number(event.target.value))
                              }
                            />
                          </label>
                          <button type="button" onClick={() => addItemToCart(item)}>
                            Add to cart
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => resetBuilder(item.sku)}
                          >
                            Reset
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>

        <aside className="card reveal card-checkout">
          <h2>Checkout</h2>

          <div className="idempotency-row">
            <label htmlFor="idemKey">Idempotency-Key</label>
            <div className="inline-actions">
              <input
                id="idemKey"
                type="text"
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.target.value)}
              />
              <button type="button" onClick={() => setIdempotencyKey(createClientUuid())}>
                New key
              </button>
            </div>
          </div>

          <div className="cart-list">
            {cart.length === 0 && <p className="muted-text">Your cart is empty.</p>}

            {cart.map((item) => (
              <article key={item.id} className="cart-item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.sku}</p>
                  {item.modifiers.length > 0 && (
                    <ul>
                      {item.modifiers.map((modifier) => (
                        <li key={`${item.id}-${modifier.groupId}`}>
                          {modifier.groupId}: {modifier.optionIds.join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="cart-item-actions">
                  <label>
                    Qty
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) =>
                        updateCartQuantity(item.id, Number(event.target.value))
                      }
                    />
                  </label>
                  <button type="button" onClick={() => updateCartQuantity(item.id, 0)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="checkout-footer">
            <p>
              Estimated cart subtotal: <strong>{formatMoney(cartSubtotalCents)}</strong>
            </p>
            <button type="button" onClick={() => void submitOrder()} disabled={orderSubmitLoading}>
              {orderSubmitLoading ? 'Placing order...' : 'Place order'}
            </button>
          </div>

          {cartMessage && <p className="success-text">{cartMessage}</p>}
          {orderSubmitError && <p className="error-text">{orderSubmitError}</p>}
        </aside>
      </section>

      <section className="card reveal card-tracking">
        <h2>Order Status + Timeline</h2>

        <div className="lookup-row">
          <input
            type="text"
            placeholder="Type orderId"
            value={orderLookupId}
            onChange={(event) => setOrderLookupId(event.target.value)}
          />
          <button type="button" onClick={() => void handleLookupOrder()}>
            Load order
          </button>
        </div>

        <div className="tracking-grid">
          <article>
            <h3>Order</h3>
            {orderLoading && <p className="muted-text">Loading order...</p>}
            {orderError && <p className="error-text">{orderError}</p>}

            {orderData && (
              <div className="order-view">
                <p>
                  <strong>Order ID:</strong> {orderData.orderId}
                </p>
                <p>
                  <strong>Status:</strong> <span className={`status ${orderData.status.toLowerCase()}`}>{orderData.status}</span>
                </p>
                <p>
                  <strong>User:</strong> {orderData.userId}
                </p>
                <p>
                  <strong>Subtotal:</strong> {formatMoney(orderData.totals.subtotalCents)}
                </p>
                <p>
                  <strong>Service fee:</strong> {formatMoney(orderData.totals.serviceFeeCents)}
                </p>
                <p>
                  <strong>Total:</strong> {formatMoney(orderData.totals.totalCents)}
                </p>
              </div>
            )}
          </article>

          <article>
            <h3>Timeline</h3>
            {timelineLoading && <p className="muted-text">Loading timeline...</p>}
            {timelineError && <p className="error-text">{timelineError}</p>}

            <div className="timeline-controls">
              <button type="button" onClick={() => void previousTimelinePage()} disabled={timelinePage <= 1 || timelineLoading}>
                Prev
              </button>
              <span>Page {timelinePage}</span>
              <label>
                Page size
                <input
                  type="number"
                  min={1}
                  max={MAX_TIMELINE_PAGE_SIZE}
                  value={safeTimelinePageSize}
                  onChange={(event) => void handleTimelinePageSizeChange(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={() => void nextTimelinePage()}
                disabled={timeline.length < safeTimelinePageSize || timelineLoading}
              >
                Next
              </button>
            </div>

            {timelineDroppedCount > 0 && (
              <p className="error-text">
                {timelineDroppedCount} invalid event(s) were ignored (schema/size check).
              </p>
            )}

            {missingTimelineEventTypes.length > 0 && (
              <p className="muted-text">
                Missing event types in this order timeline: {missingTimelineEventTypes.join(', ')}
              </p>
            )}

            <ol className="timeline-list">
              {timeline.length === 0 && <li className="muted-text">No timeline events yet.</li>}

              {timeline.map((event) => (
                <li key={event.eventId}>
                  <div className="timeline-head">
                    <strong>{event.type}</strong>
                    <span>{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <p>
                    eventId: {event.eventId}
                  </p>
                  <p>
                    orderId: {event.orderId} | userId: {event.userId}
                  </p>
                  <p>
                    source: {event.source} | correlationId: {event.correlationId}
                  </p>
                  <p>
                    timestamp: {event.timestamp} | payloadBytes: {payloadSizeBytes(event.payload)}
                  </p>
                  <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="card reveal card-orders-list">
        <div className="section-title-row">
          <h2>Orders List</h2>
          {ordersListLoading && <span className="chip">Loading...</span>}
        </div>

        {ordersListError && <p className="error-text">{ordersListError}</p>}

        <div className="timeline-controls">
          <button
            type="button"
            onClick={() => void previousOrdersListPage()}
            disabled={ordersListPage <= 1 || ordersListLoading}
          >
            Prev
          </button>
          <span>Page {ordersListPage}</span>
          <button
            type="button"
            onClick={() => void nextOrdersListPage()}
            disabled={ordersList.length < DEFAULT_ORDERS_PAGE_SIZE || ordersListLoading}
          >
            Next
          </button>
        </div>

        {ordersList.length === 0 && !ordersListLoading && (
          <p className="muted-text">No orders found.</p>
        )}

        <ol className="timeline-list">
          {ordersList.map((order) => (
            <li key={order.orderId}>
              <div className="timeline-head">
                <strong>{order.orderId}</strong>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <p>
                userId: {order.userId}
              </p>
              <p>
                status: <span className={`status ${order.status.toLowerCase()}`}>{order.status}</span>
              </p>
              <p>
                total: {formatMoney(order.totals.totalCents)}
              </p>
              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() => {
                    setOrderLookupId(order.orderId)
                    setActiveOrderId(order.orderId)
                    setTimelinePage(1)
                    void Promise.all([loadOrder(order.orderId), loadTimeline(order.orderId, 1)])
                  }}
                >
                  Open in Timeline
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default App
