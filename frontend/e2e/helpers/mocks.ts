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
