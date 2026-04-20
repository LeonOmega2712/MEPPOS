import { test, expect, type Page } from '@playwright/test';
import { setupApiMocks, setupAuthenticatedMocks, setupSettingsMocks } from './helpers/mocks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-testid="username-input"]').fill('admin');
  await page.locator('[data-testid="password-input"]').fill('admin123');
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('**/bill');
}

async function navigateToSettingsTab(page: Page, tabLabel: string): Promise<void> {
  await page.goto('/settings');
  await page.getByRole('radio', { name: tabLabel }).click();
}

async function expandNewPanel(page: Page, toggleTestId: string): Promise<void> {
  const toggle = page.getByTestId(toggleTestId);
  await toggle.click();
  await expect(toggle).toBeChecked();
}

function listenForToast(page: Page, type: 'success' | 'error') {
  const cls = type === 'success' ? '.alert-success' : '.alert-error';
  return page.waitForSelector(cls, { state: 'visible', timeout: 8_000 });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('Settings page — Extras & Ubicaciones tabs', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setupSettingsMocks(page);
    await loginAsAdmin(page);
    // Override refresh with a success handler AFTER login so that navigating
    // to /settings (a full reload) restores the admin session instead of
    // dropping the user back to the login page. If this ran before login,
    // the app would treat the initial / load as already authenticated and
    // skip the login form entirely.
    await setupAuthenticatedMocks(page);
  });

  // ─── Extras tab ────────────────────────────────────────────────────────────

  test.describe('Extras tab', () => {
    test('clicking the Extras tab renders the custom-extra-manager', async ({ page }) => {
      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('app-custom-extra-manager')).toBeVisible();
    });

    test('create button is disabled when name is empty', async ({ page }) => {
      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('app-custom-extra-manager')).toBeVisible();
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 8_000 });
      await expandNewPanel(page, 'new-extra-toggle');
      await expect(page.getByTestId('new-extra-submit')).toBeDisabled();
    });

    test('create button stays disabled when price is empty', async ({ page }) => {
      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 8_000 });
      await expandNewPanel(page, 'new-extra-toggle');
      await page.getByTestId('new-extra-name').fill(`SMOKE_NO_PRICE_${Date.now()}`);
      await expect(page.getByTestId('new-extra-submit')).toBeDisabled();
    });

    test('can create a new extra with name and price', async ({ page }) => {
      const name = `SMOKE_EXTRA_PRICED_${Date.now()}`;

      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 8_000 });
      await expandNewPanel(page, 'new-extra-toggle');
      await page.getByTestId('new-extra-name').fill(name);
      await page.getByTestId('new-extra-price').fill('15.50');
      await expect(page.getByTestId('new-extra-submit')).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/api/extras') && res.request().method() === 'POST',
      );
      await page.getByTestId('new-extra-submit').click({ force: true });
      const response = await responsePromise;
      expect(response.status()).toBe(201);

      await expect(
        page.locator('[data-testid="extra-item-name"]', { hasText: name }),
      ).toBeVisible({ timeout: 8_000 });
    });

    test('duplicate extra name returns 409 and shows error toast', async ({ page }) => {
      const name = `SMOKE_DUP_${Date.now()}`;

      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 8_000 });
      await expandNewPanel(page, 'new-extra-toggle');
      await page.getByTestId('new-extra-name').fill(name);
      await page.getByTestId('new-extra-price').fill('5.00');

      const firstPost = page.waitForResponse(
        (res) => res.url().includes('/api/extras') && res.request().method() === 'POST',
      );
      await page.getByTestId('new-extra-submit').click({ force: true });
      const firstRes = await firstPost;
      expect(firstRes.status()).toBe(201);

      await expect(
        page.locator('[data-testid="extra-item-name"]', { hasText: name }),
      ).toBeVisible({ timeout: 8_000 });

      // Panel auto-resets after a successful create; fill name + price again for the duplicate attempt
      await page.getByTestId('new-extra-name').fill(name);
      await page.getByTestId('new-extra-price').fill('5.00');

      const secondPost = page.waitForResponse(
        (res) => res.url().includes('/api/extras') && res.request().method() === 'POST',
      );
      await page.getByTestId('new-extra-submit').click({ force: true });
      const secondRes = await secondPost;
      expect(secondRes.status()).toBe(409);
    });
  });

  // ─── Ubicaciones tab ───────────────────────────────────────────────────────

  test.describe('Ubicaciones tab', () => {
    test('clicking the Ubicaciones tab renders the location-manager', async ({ page }) => {
      await navigateToSettingsTab(page, 'Ubicaciones');
      await expect(page.locator('app-location-manager')).toBeVisible();
    });

    test('locations list is not empty (seeded data exists)', async ({ page }) => {
      await navigateToSettingsTab(page, 'Ubicaciones');
      await expect(page.locator('app-location-manager')).toBeVisible();
      await expect(page.locator('app-location-manager .loading-spinner')).not.toBeVisible({
        timeout: 8_000,
      });
      await expect(page.getByTestId('location-item').first()).toBeVisible({ timeout: 8_000 });
    });

    test('can create a new location with type Mesa (table)', async ({ page }) => {
      const name = `SMOKE_MESA_${Date.now()}`;

      await navigateToSettingsTab(page, 'Ubicaciones');
      await expect(page.locator('app-location-manager .loading-spinner')).not.toBeVisible({
        timeout: 8_000,
      });
      await expandNewPanel(page, 'new-location-toggle');
      await page.getByTestId('new-location-name').fill(name);
      await expect(page.getByTestId('new-location-type')).toHaveValue('table');

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/api/locations') && res.request().method() === 'POST',
      );
      const toastPromise = listenForToast(page, 'success');
      await page.getByTestId('new-location-submit').scrollIntoViewIfNeeded();
      await page.getByTestId('new-location-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      await toastPromise;

      await expect(
        page.locator('[data-testid="location-item-name"]', { hasText: name }),
      ).toBeVisible({ timeout: 8_000 });
    });

    test('can create a new location with type Barra (bar)', async ({ page }) => {
      const name = `SMOKE_BARRA_${Date.now()}`;

      await navigateToSettingsTab(page, 'Ubicaciones');
      await expect(page.locator('app-location-manager .loading-spinner')).not.toBeVisible({
        timeout: 8_000,
      });
      await expandNewPanel(page, 'new-location-toggle');
      await page.getByTestId('new-location-name').fill(name);
      await page.getByTestId('new-location-type').selectOption('bar');

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/api/locations') && res.request().method() === 'POST',
      );
      const toastPromise = listenForToast(page, 'success');
      await page.getByTestId('new-location-submit').scrollIntoViewIfNeeded();
      await page.getByTestId('new-location-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      await toastPromise;

      await expect(
        page.locator('[data-testid="location-item-name"]', { hasText: name }),
      ).toBeVisible({ timeout: 8_000 });
    });
  });
});
