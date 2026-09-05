// Frontend E2E tests do NOT run against a real backend. The CI Frontend E2E
// job only boots the Angular dev server; there is no Postgres and no API.
// Every `/api/*` request exercised in an E2E test MUST be stubbed here with
// `page.route(...)`. When adding a new endpoint, extend this file with a
// setup helper and call it from the test's `beforeEach` (see
// `settings.e2e.ts` for the compose-with-`setupApiMocks` pattern).
import type { Page } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';

const mockUser = {
  id: 1,
  username: 'admin',
  displayName: 'Administrador',
  role: 'ADMIN',
};

export const mockMenu = [
  {
    id: 1,
    name: 'Mariscos',
    description: null,
    basePrice: 100,
    image: null,
    displayOrder: 1,
    products: [
      {
        id: 1,
        name: 'Camarón',
        description: null,
        price: null, // inherits basePrice: 100
        image: null,
        displayOrder: 1,
        customizable: false,
      },
      {
        id: 2,
        name: 'Pulpo',
        description: null,
        price: 120,
        image: null,
        displayOrder: 2,
        customizable: false,
      },
    ],
  },
  {
    id: 2,
    name: 'Bebidas',
    description: null,
    basePrice: null,
    image: null,
    displayOrder: 2,
    products: [
      {
        id: 3,
        name: 'Agua',
        description: null,
        price: 20,
        image: null,
        displayOrder: 1,
        customizable: false,
      },
    ],
  },
];

export async function setupAuthenticatedMocks(page: Page): Promise<void> {
  await page.route(`${API_BASE}/auth/refresh`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: { accessToken: 'test-access-token', user: mockUser },
      },
    }),
  );
}

async function mockRefreshFail(page: Page): Promise<void> {
  await page.route(`${API_BASE}/auth/refresh`, (route) =>
    route.fulfill({ status: 401, json: { success: false, error: 'Unauthorized' } }),
  );
}

export async function setupApiMocks(page: Page): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, (route) =>
    route.fulfill({
      status: 200,
      json: { success: true, data: { accessToken: 'test-access-token', user: mockUser } },
    }),
  );

  await page.route(`${API_BASE}/auth/logout`, (route) =>
    route.fulfill({ status: 200, json: { success: true } }),
  );

  await page.route(`${API_BASE}/menu`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: mockMenu } }),
  );

  // The bill page loads locations + open orders on init. Default to empty so
  // pages that don't exercise the orders flow (e.g. bill-calculator.e2e.ts)
  // still load cleanly; setupOrdersMocks/setupSettingsMocks override these.
  await page.route(`${API_BASE}/locations`, (route) =>
    route.fulfill({ status: 200, json: { success: true, data: [], count: 0 } }),
  );
  await page.route(`${API_BASE}/orders`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: { success: true, data: [], count: 0 } });
    }
    return route.fallback();
  });
}

export async function setupLoginFailMocks(page: Page): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, (route) =>
    route.fulfill({ status: 401, json: { success: false, error: 'Credenciales inválidas' } }),
  );
}

export async function setupLoginRateLimitMocks(page: Page, retryAfterSeconds = 5): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, (route) =>
    route.fulfill({
      status: 429,
      json: {
        success: false,
        error: 'Too many failed login attempts, please try again later',
        retryAfterSeconds,
      },
    }),
  );
}

export async function setupNetworkErrorMocks(page: Page): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, (route) => route.abort());
}

// Simulates a Koyeb cold start: returns 200 OK with HTML for the first N attempts,
// then fulfills with the provided response on subsequent requests.
export async function setupColdStartMocks(
  page: Page,
  htmlAttempts: number,
  finalResponse: { status: number; json: object },
): Promise<void> {
  await mockRefreshFail(page);

  let attempts = 0;
  await page.route(`${API_BASE}/auth/login`, (route) => {
    attempts++;
    if (attempts <= htmlAttempts) {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html>Your service is almost ready! We are deploying your application.</html>',
      });
    } else {
      route.fulfill(finalResponse);
    }
  });
}

// Simulates a request that hangs indefinitely (used to test the cold start hint).
export async function setupHangingRequestMocks(page: Page): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, () => {
    // Intentionally never fulfilled — request hangs until page navigation or timeout
  });
}

// ─── Settings page mocks ─────────────────────────────────────────────────────

type MockExtra = {
  id: number;
  name: string;
  defaultPrice: number | null;
  active: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string | null;
};

type MockLocation = {
  id: number;
  name: string;
  type: 'table' | 'bar';
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
  occupied?: boolean;
};

// Stubs every `/api/*` endpoint reachable from the settings page.
// Compose on top of `setupApiMocks` (which handles login + menu). Note: the
// test must call `setupAuthenticatedMocks(page)` AFTER logging in — doing it
// before would make refresh succeed on the initial load and redirect the user
// off the login page before the form renders.
// State is held per-page and resets on each test's fresh context.
export async function setupSettingsMocks(page: Page): Promise<void> {
  // Empty collections for tabs the settings.e2e.ts suite does not exercise.
  // Required because `app-category-manager` mounts by default on /settings
  // and would otherwise hit an unmocked endpoint.
  const emptyList = { success: true, data: [], count: 0 };
  await page.route(`${API_BASE}/categories`, (route) =>
    route.fulfill({ status: 200, json: emptyList }),
  );
  await page.route(`${API_BASE}/products`, (route) =>
    route.fulfill({ status: 200, json: emptyList }),
  );
  await page.route(`${API_BASE}/users`, (route) =>
    route.fulfill({ status: 200, json: emptyList }),
  );

  // Stateful custom extras — GET reflects prior POSTs; duplicates return 409.
  const extras: MockExtra[] = [];
  let nextExtraId = 1;
  await page.route(`${API_BASE}/extras`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        json: { success: true, data: extras, count: extras.length },
      });
    }
    if (method === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as {
        name: string;
        defaultPrice?: number | null;
      };
      if (extras.some((e) => e.name === body.name && e.active)) {
        return route.fulfill({
          status: 409,
          json: { success: false, error: 'An extra with that name already exists' },
        });
      }
      const created: MockExtra = {
        id: nextExtraId++,
        name: body.name,
        defaultPrice: body.defaultPrice ?? null,
        active: true,
        createdBy: 1,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      extras.push(created);
      return route.fulfill({
        status: 201,
        json: { success: true, data: created, message: 'Extra created successfully' },
      });
    }
    return route.fallback();
  });

  // Stateful locations — pre-seeded so the "seeded data exists" test passes;
  // POST appends and GET reflects the updated list.
  const locations: MockLocation[] = [
    {
      id: 1,
      name: 'Mesa 1',
      type: 'table',
      active: true,
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 2,
      name: 'La Barra',
      type: 'bar',
      active: true,
      displayOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
  ];
  let nextLocationId = 3;
  await page.route(`${API_BASE}/locations`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        json: { success: true, data: locations, count: locations.length },
      });
    }
    if (method === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as {
        name: string;
        type: 'table' | 'bar';
      };
      const created: MockLocation = {
        id: nextLocationId++,
        name: body.name,
        type: body.type,
        active: true,
        displayOrder: locations.length,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      locations.push(created);
      return route.fulfill({
        status: 201,
        json: { success: true, data: created, message: 'Location created successfully' },
      });
    }
    return route.fallback();
  });
}

// ─── Orders (Cuenta / bill page) mocks ───────────────────────────────────────

export type MockOrderItem = {
  id: number;
  roundId: number;
  productId: number | null;
  customName: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string | null;
};

export type MockOrderRound = {
  id: number;
  orderId: number;
  roundNumber: number;
  userId: number;
  createdAt: string;
  items: MockOrderItem[];
};

export type MockOrderDiscount = {
  id: number;
  orderId: number;
  description: string;
  type: 'fixed' | 'percentage';
  value: number;
  amount: number;
  createdAt: string;
};

export type MockOrder = {
  id: number;
  locationId: number | null;
  barPosition: number | null;
  takeoutNumber: number | null;
  status: 'open' | 'charged' | 'cancelled';
  ownerUserId: number;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  location: MockLocation | null;
  owner: { id: number; displayName: string };
  rounds: MockOrderRound[];
  discounts: MockOrderDiscount[];
};

function orderTotals(order: MockOrder) {
  const subtotal = order.rounds.reduce(
    (sum, round) => sum + round.items.reduce((s, item) => s + item.subtotal, 0),
    0,
  );
  const discountTotal = order.discounts.reduce((sum, discount) => sum + discount.amount, 0);
  return { subtotal, discountTotal, total: subtotal - discountTotal };
}

function serializeOrder(order: MockOrder) {
  return { ...order, ...orderTotals(order) };
}

// Stubs the orders API used by the bill page (chips, create/assign, rounds,
// item edit/delete, cancel). Optionally pre-seeds `locations` so the location
// picker has tables/bars to assign — pass the same array used for
// `/api/locations` mocking (see `setupSettingsMocks`) when composing both.
// `seedOrders` pre-populates already-open orders (e.g. owned by a different
// waiter) so tests can exercise the mine/all toggle and the non-owner banner
// without a second login.
export async function setupOrdersMocks(
  page: Page,
  locations: MockLocation[] = [],
  seedOrders: MockOrder[] = [],
): Promise<void> {
  const orders: MockOrder[] = [...seedOrders];
  let nextOrderId = (seedOrders.reduce((max, o) => Math.max(max, o.id), 0) || 0) + 1;
  let nextRoundId = 1;
  let nextItemId = 1;
  let nextDiscountId = 1;

  await page.route(`${API_BASE}/locations`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: locations.map((l) => ({
          ...l,
          occupied:
            l.type === 'table' &&
            ((l.occupied ?? false) || orders.some((o) => o.locationId === l.id && o.status === 'open')),
        })),
        count: locations.length,
      },
    }),
  );

  await page.route(`${API_BASE}/orders`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const open = orders.filter((o) => o.status === 'open').map(serializeOrder);
      return route.fulfill({ status: 200, json: { success: true, data: open, count: open.length } });
    }
    if (method === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as { locationId?: number; notes?: string };
      const location = body.locationId ? locations.find((l) => l.id === body.locationId) ?? null : null;
      const order: MockOrder = {
        id: nextOrderId++,
        locationId: body.locationId ?? null,
        barPosition: location?.type === 'bar' ? orders.length + 1 : null,
        takeoutNumber: !body.locationId ? orders.length + 1 : null,
        status: 'open',
        ownerUserId: mockUser.id,
        openedAt: new Date().toISOString(),
        closedAt: null,
        notes: body.notes ?? null,
        location,
        owner: { id: mockUser.id, displayName: mockUser.displayName },
        rounds: [],
        discounts: [],
      };
      orders.push(order);
      return route.fulfill({
        status: 201,
        json: { success: true, data: serializeOrder(order), message: 'Order created successfully' },
      });
    }
    return route.fallback();
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)$`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const id = Number(route.request().url().split('/').pop());
    const order = orders.find((o) => o.id === id);
    if (!order) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Order not found' } });
    }
    return route.fulfill({ status: 200, json: { success: true, data: serializeOrder(order) } });
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)/rounds$`), async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const orderId = Number(route.request().url().match(/orders\/(\d+)\/rounds/)?.[1]);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Order not found' } });
    }
    const body = JSON.parse(route.request().postData() ?? '{}') as {
      items: { productId?: number; customName?: string; unitPrice: number; quantity: number }[];
    };
    const round: MockOrderRound = {
      id: nextRoundId++,
      orderId,
      roundNumber: order.rounds.length + 1,
      userId: 1,
      createdAt: new Date().toISOString(),
      items: body.items.map((item) => ({
        id: nextItemId++,
        roundId: -1, // set below, once round.id is known
        productId: item.productId ?? null,
        customName: item.customName ?? null,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.unitPrice * item.quantity,
        notes: null,
      })),
    };
    round.items.forEach((item) => (item.roundId = round.id));
    order.rounds.push(round);
    return route.fulfill({ status: 201, json: { success: true, data: round, message: 'Round added successfully' } });
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)/rounds/(\\d+)/items/(\\d+)$`), async (route) => {
    const method = route.request().method();
    const match = route.request().url().match(/orders\/(\d+)\/rounds\/(\d+)\/items\/(\d+)/);
    const [, orderIdStr, roundIdStr, itemIdStr] = match ?? [];
    const order = orders.find((o) => o.id === Number(orderIdStr));
    const round = order?.rounds.find((r) => r.id === Number(roundIdStr));
    const item = round?.items.find((i) => i.id === Number(itemIdStr));
    if (!order || !round || !item) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Item not found in this round' } });
    }
    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}') as { unitPrice?: number; quantity?: number };
      if (body.unitPrice != null) item.unitPrice = body.unitPrice;
      if (body.quantity != null) item.quantity = body.quantity;
      item.subtotal = item.unitPrice * item.quantity;
      return route.fulfill({ status: 200, json: { success: true, data: item, message: 'Item updated successfully' } });
    }
    if (method === 'DELETE') {
      round.items = round.items.filter((i) => i.id !== item.id);
      return route.fulfill({ status: 200, json: { success: true, message: 'Item deleted successfully' } });
    }
    return route.fallback();
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)/rounds/(\\d+)$`), async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const match = route.request().url().match(/orders\/(\d+)\/rounds\/(\d+)$/);
    const [, orderIdStr, roundIdStr] = match ?? [];
    const order = orders.find((o) => o.id === Number(orderIdStr));
    const round = order?.rounds.find((r) => r.id === Number(roundIdStr));
    if (!order || !round) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Round not found for this order' } });
    }
    order.rounds = order.rounds.filter((r) => r.id !== round.id);
    return route.fulfill({ status: 200, json: { success: true, message: 'Round deleted successfully' } });
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)/cancel$`), async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const id = Number(route.request().url().match(/orders\/(\d+)\/cancel/)?.[1]);
    const order = orders.find((o) => o.id === id);
    if (!order) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Order not found' } });
    }
    order.status = 'cancelled';
    order.closedAt = new Date().toISOString();
    return route.fulfill({ status: 200, json: { success: true, data: serializeOrder(order), message: 'Order cancelled successfully' } });
  });

  await page.route(new RegExp(`${API_BASE}/orders/(\\d+)/charge$`), async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const id = Number(route.request().url().match(/orders\/(\d+)\/charge/)?.[1]);
    const order = orders.find((o) => o.id === id);
    if (!order) {
      return route.fulfill({ status: 404, json: { success: false, error: 'Order not found' } });
    }
    if (order.status !== 'open') {
      return route.fulfill({ status: 409, json: { success: false, error: 'Order is not open' } });
    }
    const hasItems = order.rounds.some((round) => round.items.length > 0);
    if (!hasItems) {
      return route.fulfill({ status: 409, json: { success: false, error: 'Order has no items' } });
    }

    const body = JSON.parse(route.request().postData() ?? '{}') as {
      discount?: { description: string; type: 'fixed' | 'percentage'; value: number };
    };
    if (body.discount) {
      const { subtotal } = orderTotals(order);
      const amount =
        body.discount.type === 'fixed'
          ? body.discount.value
          : Math.round(subtotal * body.discount.value) / 100;
      if (amount > subtotal) {
        return route.fulfill({ status: 409, json: { success: false, error: 'Discount exceeds order subtotal' } });
      }
      order.discounts.push({
        id: nextDiscountId++,
        orderId: order.id,
        description: body.discount.description,
        type: body.discount.type,
        value: body.discount.value,
        amount,
        createdAt: new Date().toISOString(),
      });
    }

    order.status = 'charged';
    order.closedAt = new Date().toISOString();
    return route.fulfill({ status: 200, json: { success: true, data: serializeOrder(order), message: 'Order charged successfully' } });
  });
}
