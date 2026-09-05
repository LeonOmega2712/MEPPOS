import { test, expect } from '@playwright/test';
import { setupApiMocks, setupOrdersMocks, type MockOrder } from './helpers/mocks';

const LOCATIONS = [
  {
    id: 1,
    name: 'Mesa 1',
    type: 'table' as const,
    active: true,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
  {
    id: 2,
    name: 'Mesa 2',
    type: 'table' as const,
    active: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
];

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="username-input"]').fill('admin');
  await page.locator('[data-testid="password-input"]').fill('password');
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('**/bill');
}

test('assigns a table to a new cart and shows it as a chip', async ({ page }) => {
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS);
  await login(page);

  // Add a product to the unassigned cart.
  await page.locator('#product-1').click();
  await expect(page.locator('[data-testid="bill-total"]')).toContainText('100.00');

  // The confirm action lives in the footer's expandable detail panel.
  await page.locator('[data-testid="footer-toggle"]').click();

  // Confirming the bill opens the location picker.
  await page.locator('[data-testid="confirm-bill"]').click();
  await expect(page.locator('[data-testid="location-option"]').first()).toBeVisible();

  // Assign Mesa 1 and confirm.
  await page.locator('[data-testid="location-option"]', { hasText: 'Mesa 1' }).click();
  await page.locator('[data-testid="confirm-location"]').click();

  // Back on the bill page, a chip for Mesa 1 now exists and is active.
  await expect(page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' })).toBeVisible();
  await expect(page.locator('[data-testid="cancel-order"]')).toBeVisible();
});

test('occupied tables cannot be selected in the location picker', async ({ page }) => {
  const occupied = [
    { ...LOCATIONS[0], occupied: true },
    LOCATIONS[1],
  ];
  await setupApiMocks(page);
  await setupOrdersMocks(page, occupied);
  await login(page);

  await page.locator('#product-1').click();
  await page.locator('[data-testid="footer-toggle"]').click();
  await page.locator('[data-testid="confirm-bill"]').click();

  const mesa1 = page.locator('[data-testid="location-option"]', { hasText: 'Mesa 1' });
  await expect(mesa1).toBeDisabled();
});

// The logged-in user in these mocks is always `mockUser` (id 1, "Administrador").
const OTHER_WAITER = { id: 2, displayName: 'Luis' };

function seedOrder(overrides: Partial<MockOrder>): MockOrder {
  return {
    id: 100,
    locationId: null,
    barPosition: null,
    takeoutNumber: null,
    status: 'open',
    ownerUserId: 1,
    openedAt: new Date().toISOString(),
    closedAt: null,
    notes: null,
    location: null,
    owner: { id: 1, displayName: 'Administrador' },
    rounds: [],
    discounts: [],
    ...overrides,
  };
}

test('toggle mías/todas filters chips to the current user orders', async ({ page }) => {
  const mine = seedOrder({ id: 101, locationId: 1, location: LOCATIONS[0] });
  const other = seedOrder({
    id: 102,
    locationId: 2,
    location: LOCATIONS[1],
    ownerUserId: OTHER_WAITER.id,
    owner: OTHER_WAITER,
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [mine, other]);
  await login(page);

  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(2);

  await page.locator('[data-testid="toggle-mine"]').click();
  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' })).toBeVisible();

  await page.locator('[data-testid="toggle-mine"]').click();
  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(2);
});

test('shows a warning-colored owner badge when the active order is not owned by the current user', async ({ page }) => {
  const other = seedOrder({
    id: 103,
    locationId: 2,
    location: LOCATIONS[1],
    ownerUserId: OTHER_WAITER.id,
    owner: OTHER_WAITER,
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [other]);
  await login(page);

  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 2' }).click();

  const ownerBadge = page.locator('[data-testid="order-owner-badge"]');
  await expect(ownerBadge).toContainText('Luis');
  await expect(ownerBadge).toHaveClass(/badge-warning/);
});

test('groups sent items by round with per-round subtotals', async ({ page }) => {
  const order = seedOrder({
    id: 104,
    locationId: 1,
    location: LOCATIONS[0],
    rounds: [
      {
        id: 1,
        orderId: 104,
        roundNumber: 1,
        userId: 1,
        createdAt: new Date().toISOString(),
        items: [
          { id: 1, roundId: 1, productId: 1, customName: null, unitPrice: 100, quantity: 1, subtotal: 100, notes: null },
        ],
      },
      {
        id: 2,
        orderId: 104,
        roundNumber: 2,
        userId: 1,
        createdAt: new Date().toISOString(),
        items: [
          { id: 2, roundId: 2, productId: 3, customName: null, unitPrice: 20, quantity: 2, subtotal: 40, notes: null },
        ],
      },
    ],
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [order]);
  await login(page);

  // Selecting an order chip for the first time auto-expands the footer.
  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' }).click();

  const rounds = page.locator('[data-testid="round-group"]');
  await expect(rounds).toHaveCount(2);
  await expect(rounds.nth(0).locator('[data-testid="round-subtotal"]')).toHaveText('$100.00');
  await expect(rounds.nth(1).locator('[data-testid="round-subtotal"]')).toHaveText('$40.00');
});

test('manual refresh button reloads open orders', async ({ page }) => {
  const mine = seedOrder({ id: 105, locationId: 1, location: LOCATIONS[0] });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [mine]);
  await login(page);

  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(1);
  await page.locator('[data-testid="refresh-orders"]').click();
  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(1);
});

test('checkout button appears in the empty-cart slot and is disabled', async ({ page }) => {
  const mine = seedOrder({ id: 106, locationId: 1, location: LOCATIONS[0] });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [mine]);
  await login(page);

  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' }).click();

  // No draft items yet: the checkout slot shows "Cobrar", disabled.
  await expect(page.locator('[data-testid="checkout-order"]')).toBeVisible();
  await expect(page.locator('[data-testid="checkout-order"]')).toBeDisabled();
  await expect(page.locator('[data-testid="confirm-bill"]')).toHaveCount(0);

  // Adding a draft item swaps the slot back to "Confirmar ronda nueva".
  await page.locator('#product-1').click();
  await expect(page.locator('[data-testid="confirm-bill"]')).toBeVisible();
  await expect(page.locator('[data-testid="checkout-order"]')).toHaveCount(0);
});

test('checkout button is enabled once the order has a sent round, and disabled while a round edit is pending', async ({ page }) => {
  const order = seedOrder({
    id: 107,
    locationId: 1,
    location: LOCATIONS[0],
    rounds: [
      {
        id: 1,
        orderId: 107,
        roundNumber: 1,
        userId: 1,
        createdAt: new Date().toISOString(),
        items: [
          { id: 1, roundId: 1, productId: 1, customName: null, unitPrice: 100, quantity: 1, subtotal: 100, notes: null },
        ],
      },
    ],
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [order]);
  await login(page);

  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' }).click();
  await expect(page.locator('[data-testid="checkout-order"]')).toBeEnabled();

  // Opening the round editor alone doesn't disable checkout — only an actual unsaved quantity change does,
  // since that's when the on-screen total would stop matching what the backend would charge.
  await page.getByRole('button', { name: 'Editar cantidades de la ronda' }).click();
  await expect(page.locator('[data-testid="checkout-order"]')).toBeEnabled();

  await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await expect(page.locator('[data-testid="checkout-order"]')).toBeDisabled();

  await page.getByRole('button', { name: 'Cancelar edición de la ronda' }).click();
  await page.locator('.modal-box').getByRole('button', { name: 'Descartar cambios' }).click();
  await expect(page.locator('[data-testid="checkout-order"]')).toBeEnabled();
});

test('completes a checkout with a percentage discount and removes the order from the chips', async ({ page }) => {
  const order = seedOrder({
    id: 108,
    locationId: 1,
    location: LOCATIONS[0],
    rounds: [
      {
        id: 1,
        orderId: 108,
        roundNumber: 1,
        userId: 1,
        createdAt: new Date().toISOString(),
        items: [
          { id: 1, roundId: 1, productId: 1, customName: null, unitPrice: 100, quantity: 1, subtotal: 100, notes: null },
        ],
      },
    ],
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [order]);
  await login(page);

  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' }).click();
  await page.locator('[data-testid="checkout-order"]').click();
  await expect(page.locator('[data-testid="checkout-total"]')).toContainText('100.00');

  await page.locator('input.toggle').click();
  await page.getByPlaceholder('Ej. Promoción del día').fill('Promo');
  await page.getByRole('button', { name: 'Porcentaje' }).click();
  const valueInput = page.locator('[data-testid="discount-value"]');
  // Cents-first entry, like the settings price inputs: the digits "1000" become 10.00.
  await valueInput.fill('1000');

  await expect(page.locator('[data-testid="checkout-discount-amount"]')).toContainText('-$10.00');
  await expect(page.locator('[data-testid="checkout-total"]')).toContainText('90.00');

  await page.locator('[data-testid="confirm-checkout"]').click();
  const dialog = page.locator('.modal-box');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="text"]').fill('90.00');
  await dialog.getByRole('button', { name: 'Cobrar cuenta' }).click();

  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(0);
});

test('converts the discount value automatically when switching between percentage and fixed', async ({ page }) => {
  const order = seedOrder({
    id: 109,
    locationId: 1,
    location: LOCATIONS[0],
    rounds: [
      {
        id: 1,
        orderId: 109,
        roundNumber: 1,
        userId: 1,
        createdAt: new Date().toISOString(),
        items: [
          { id: 1, roundId: 1, productId: 1, customName: null, unitPrice: 500, quantity: 1, subtotal: 500, notes: null },
        ],
      },
    ],
  });
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS, [order]);
  await login(page);

  await page.locator('[data-testid="order-chip"]', { hasText: 'Mesa 1' }).click();
  await page.locator('[data-testid="checkout-order"]').click();

  await page.locator('input.toggle').click();
  await page.getByRole('button', { name: 'Porcentaje' }).click();
  const valueInput = page.locator('[data-testid="discount-value"]');
  // Cents-first entry, like the settings price inputs: the digits "1000" become 10.00.
  await valueInput.fill('1000');
  await expect(page.locator('[data-testid="checkout-discount-amount"]')).toContainText('-$50.00');

  // Switching to fixed converts 10% of 500 into the equivalent amount, 50.
  await page.getByRole('button', { name: 'Fijo' }).click();
  await expect(valueInput).toHaveValue('50.00');
  await expect(page.locator('[data-testid="checkout-discount-amount"]')).toContainText('-$50.00');

  // Switching back to percentage restores 10%.
  await page.getByRole('button', { name: 'Porcentaje' }).click();
  await expect(valueInput).toHaveValue('10.00');
  await expect(page.locator('[data-testid="checkout-discount-amount"]')).toContainText('-$50.00');
});

test('detects an order assigned to the current user after 30s of polling', async ({ page }) => {
  await setupApiMocks(page);
  await setupOrdersMocks(page, LOCATIONS);
  await page.clock.install();
  await login(page);

  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(0);

  const assigned = seedOrder({ id: 200, locationId: 1, location: LOCATIONS[0] });
  await page.route('http://localhost:3000/api/orders', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      json: { success: true, data: [{ ...assigned, subtotal: 0, discountTotal: 0, total: 0 }], count: 1 },
    });
  });

  await page.clock.fastForward('00:30');

  await expect(page.locator('[data-testid="order-chip"]')).toHaveCount(1);
});
