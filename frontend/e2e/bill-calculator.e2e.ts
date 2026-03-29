import { test, expect } from '@playwright/test';
import { setupApiMocks } from './helpers/mocks';

test('complete flow: login, add products, verify totals, clear bill', async ({ page }) => {
  await setupApiMocks(page);
  await page.goto('/');

  // Login
  await page.locator('[data-testid="username-input"]').fill('admin');
  await page.locator('[data-testid="password-input"]').fill('password');
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('**/bill');

  // Menu is rendered
  await expect(page.getByText('Mariscos')).toBeVisible();
  await expect(page.getByText('Bebidas')).toBeVisible();

  // Add Camarón ($100 inherited from basePrice)
  await page.locator('#product-1').click();
  await expect(page.locator('[data-testid="bill-total"]')).toContainText('100.00');

  // Increment Camarón to qty 2 via + button (collapse opens after first click)
  const incrementCamaron = page.locator('#product-1 button.btn-success');
  await expect(incrementCamaron).toBeVisible();
  await incrementCamaron.click();
  await expect(page.locator('[data-testid="bill-total"]')).toContainText('200.00');

  // Add Pulpo ($120)
  await page.locator('#product-2').click();
  await expect(page.locator('[data-testid="bill-total"]')).toContainText('320.00');

  // Expand footer to access clear button
  await page.locator('[data-testid="footer-toggle"]').click();

  // Clear bill via confirmation dialog
  await page.locator('[aria-label="Limpiar cuenta"]').click();
  await page.locator('[aria-label="Limpiar"]').click();

  await expect(page.locator('[data-testid="bill-total"]')).toContainText('0.00');
});
