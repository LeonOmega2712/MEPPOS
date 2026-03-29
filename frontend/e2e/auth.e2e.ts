import { test, expect } from '@playwright/test';
import { setupApiMocks, setupLoginFailMocks } from './helpers/mocks';

test.describe('Authentication', () => {
  test('login page renders form fields', async ({ page }) => {
    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({ status: 401, json: { success: false } }),
    );
    await page.goto('/');

    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('shows error message on invalid credentials', async ({ page }) => {
    await setupLoginFailMocks(page);
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('wrong');
    await page.locator('[data-testid="password-input"]').fill('wrong');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText(
      'Usuario o contraseña incorrectos',
    );
  });

  test('redirects to /bill on valid credentials', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page).toHaveURL(/\/bill/);
  });
});
