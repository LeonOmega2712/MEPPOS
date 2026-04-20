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
}

export async function setupLoginFailMocks(page: Page): Promise<void> {
  await mockRefreshFail(page);

  await page.route(`${API_BASE}/auth/login`, (route) =>
    route.fulfill({ status: 401, json: { success: false, error: 'Credenciales inválidas' } }),
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
