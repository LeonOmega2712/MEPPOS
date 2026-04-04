import { test, expect } from '@playwright/test';
import {
  setupApiMocks,
  setupLoginFailMocks,
  setupNetworkErrorMocks,
  setupColdStartMocks,
  setupHangingRequestMocks,
} from './helpers/mocks';

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

  test('does not show retry button on invalid credentials', async ({ page }) => {
    await setupLoginFailMocks(page);
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('wrong');
    await page.locator('[data-testid="password-input"]').fill('wrong');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-retry"]')).not.toBeVisible();
  });

  test('shows network error message and retry button when request fails', async ({ page }) => {
    await setupNetworkErrorMocks(page);
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText('No se pudo conectar');
    await expect(page.locator('[data-testid="login-retry"]')).toBeVisible();
  });

  test('retries after cold start and succeeds', async ({ page }) => {
    // First request returns Koyeb HTML holding page, second returns success.
    // The interceptor should retry after 3s and navigate to /bill.
    test.setTimeout(15_000);
    await setupColdStartMocks(page, 1, {
      status: 200,
      json: { success: true, data: { accessToken: 'test-token', user: { id: 1, username: 'admin', displayName: 'Admin', role: 'ADMIN' } } },
    });
    await page.route('**/api/menu', (route) =>
      route.fulfill({ status: 200, json: { success: true, data: [] } }),
    );
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page).toHaveURL(/\/bill/, { timeout: 12_000 });
  });

  test('shows cold start error and retry button after all retries fail', async ({ page }) => {
    // Two HTML responses trigger two retries (3s + 5s = ~8s total), then a 401.
    test.setTimeout(20_000);
    await setupColdStartMocks(page, 2, {
      status: 401,
      json: { success: false, error: 'Invalid credentials' },
    });
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="login-error"]')).toContainText('Usuario o contraseña incorrectos');
    await expect(page.locator('[data-testid="login-retry"]')).not.toBeVisible();
  });

  test('shows cold start hint after extended loading', async ({ page }) => {
    // Request hangs indefinitely; hint must appear after 4 seconds.
    test.setTimeout(12_000);
    await setupHangingRequestMocks(page);
    await page.goto('/');

    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('text=El servidor está iniciando, aguarda')).toBeVisible({
      timeout: 6_000,
    });
  });
});
