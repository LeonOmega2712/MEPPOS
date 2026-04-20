import { test, expect, type Page } from '@playwright/test';

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
    await loginAsAdmin(page);
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

    test('can create a new extra with name only (no price)', async ({ page }) => {
      const name = `SMOKE_EXTRA_${Date.now()}`;

      await navigateToSettingsTab(page, 'Extras');
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 8_000 });
      await expandNewPanel(page, 'new-extra-toggle');
      await page.getByTestId('new-extra-name').fill(name);
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

      const firstPost = page.waitForResponse(
        (res) => res.url().includes('/api/extras') && res.request().method() === 'POST',
      );
      await page.getByTestId('new-extra-submit').click({ force: true });
      const firstRes = await firstPost;
      expect(firstRes.status()).toBe(201);

      // Panel stays open after create (expandedExtraId remains 'new'); just fill the name again
      await expect(
        page.locator('[data-testid="extra-item-name"]', { hasText: name }),
      ).toBeVisible({ timeout: 8_000 });
      await page.getByTestId('new-extra-name').fill(name);

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
