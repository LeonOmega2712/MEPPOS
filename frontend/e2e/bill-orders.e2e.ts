import { test, expect } from '@playwright/test';
import { setupApiMocks, setupOrdersMocks } from './helpers/mocks';

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
  await page.locator('[data-testid="confirm-bill"]').click();

  const mesa1 = page.locator('[data-testid="location-option"]', { hasText: 'Mesa 1' });
  await expect(mesa1).toBeDisabled();
});
