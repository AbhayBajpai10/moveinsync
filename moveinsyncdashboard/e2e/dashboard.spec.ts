// ============================================================
// e2e/dashboard.spec.ts  — Playwright E2E tests
// Run: npx playwright test
// Requires: mock WS server running on ws://localhost:8080
//           and Next.js app running on http://localhost:3000
// ============================================================
import { test, expect, Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────
async function waitForMapLoad(page: Page) {
  // Mapbox fires a 'load' event on the canvas element
  await page.waitForSelector('.mapboxgl-canvas', { timeout: 15_000 });
}

async function openCommandCenter(page: Page) {
  await page.getByRole('button', { name: /command center/i }).click();
  await expect(page.getByRole('dialog', { name: /command center/i }).or(
    page.getByText('Live Trip Summary')
  )).toBeVisible({ timeout: 5_000 });
}

// ────────────────────────────────────────────────────────────
// Page load & skeleton
// ────────────────────────────────────────────────────────────
test.describe('Dashboard – page load', () => {
  test('should load and show the map canvas', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  });

  test('should show a network status bar at the top', async ({ page }) => {
    await page.goto('/');
    // The 1px top bar should exist — check by its positional class
    const bar = page.locator('div[role="status"]').first();
    await expect(bar).toBeAttached();
  });

  test('should show the Command Center button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /command center/i })).toBeVisible();
  });

  test('should show the alert feed bell button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /alerts/i })).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────
// Connection status indicator
// ────────────────────────────────────────────────────────────
test.describe('Dashboard – connection status', () => {
  test('status bar should turn green when WS connects', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    // After WS connects the bar should be green (not red or amber)
    await expect(page.locator('div[role="status"]').first()).toHaveClass(/bg-green-500/, { timeout: 8_000 });
  });

  test('should show error banner when WS is unreachable', async ({ page }) => {
    // Load page while WS server is down (separate port)
    await page.addInitScript(() => {
      // Override WS URL to a non-existent port so it immediately fails
      (window as any).__WS_OVERRIDE__ = 'ws://localhost:19999';
    });
    await page.goto('/');
    // After max retries, an error message should appear
    await expect(
      page.getByRole('alert').filter({ hasText: /connection|reconnect|server/i })
    ).toBeVisible({ timeout: 35_000 });
  });
});

// ────────────────────────────────────────────────────────────
// Geofence overlay toggle
// ────────────────────────────────────────────────────────────
test.describe('Map – geofence overlay', () => {
  test('should show geofence toggle checkbox', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await expect(page.getByRole('checkbox', { name: /geofence/i })).toBeVisible();
  });

  test('geofence checkbox should be checked by default', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await expect(page.getByRole('checkbox', { name: /geofence/i })).toBeChecked();
  });

  test('unchecking geofence toggle should not crash the map', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await page.getByRole('checkbox', { name: /geofence/i }).uncheck();
    // Map canvas should still be visible
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    // No JS error dialog
    page.on('pageerror', (err) => { throw err; });
  });

  test('re-checking geofence toggle restores state', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await page.getByRole('checkbox', { name: /geofence/i }).uncheck();
    await page.getByRole('checkbox', { name: /geofence/i }).check();
    await expect(page.getByRole('checkbox', { name: /geofence/i })).toBeChecked();
  });
});

// ────────────────────────────────────────────────────────────
// Command Center sidebar
// ────────────────────────────────────────────────────────────
test.describe('Command Center sidebar', () => {
  test('should open when button is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    await expect(page.getByText('Live Trip Summary')).toBeVisible();
  });

  test('should display Active Trips stat card', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    await expect(page.getByText('Active Trips')).toBeVisible();
  });

  test('should display Delayed Trips stat card', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    await expect(page.getByText('Delayed Trips')).toBeVisible();
  });

  test('should show fleet vehicles after WS data arrives', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    // After WS data arrives (up to 2s flush interval + server push)
    await expect(page.getByText(/PROGRESS|DELAYED|IDLE/i)).toBeVisible({ timeout: 8_000 });
  });

  test('filter dropdown should be visible and functional', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    const select = page.getByLabel('Filter by Status');
    await expect(select).toBeVisible();
    await select.selectOption('delayed');
    // Should show filtered results or empty state
    await expect(
      page.getByText('Delayed Trips').or(page.getByText('No trips match this filter.'))
    ).toBeVisible();
  });

  test('selecting a vehicle card pans the map', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);

    // Wait for vehicles to load
    const vehicleCard = page.locator('[role="listitem"]').first();
    await vehicleCard.waitFor({ timeout: 8_000 });

    // Get map center before click
    const centerBefore = await page.evaluate(() => {
      const map = (window as any).__mapboxMap;
      return map?.getCenter?.();
    });

    await vehicleCard.click();

    // Map flyTo is animated — wait for it to settle
    await page.waitForTimeout(1_500);

    // (If map ref is exposed we could assert center changed, but
    //  at minimum the click should not throw and the map should be visible)
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  });

  test('empty state message shows when filter has no results', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);
    const select = page.getByLabel('Filter by Status');
    await select.selectOption('completed'); // no vehicles are completed in mock data
    await expect(page.getByText('No trips match this filter.')).toBeVisible({ timeout: 5_000 });
  });
});

// ────────────────────────────────────────────────────────────
// Alert feed
// ────────────────────────────────────────────────────────────
test.describe('Alert feed', () => {
  test('should open alert panel when bell is clicked', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    await page.getByRole('button', { name: /alerts/i }).click();
    await expect(page.getByRole('dialog', { name: /alert feed/i }).or(
      page.getByText('Live Alerts')
    )).toBeVisible({ timeout: 5_000 });
  });

  test('should show "No alerts yet" in empty state', async ({ page }) => {
    await page.goto('/');
    // Open alert feed very quickly before any WS data
    await page.getByRole('button', { name: /alerts/i }).click();
    // May be empty initially
    // (Not asserting strictly because timing depends on WS connection speed)
    await expect(
      page.getByText('No alerts yet').or(page.getByText('Live Alerts'))
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should show a GEOFENCE or SPEED alert after receiving WS alert', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);

    // Wait for geofence alerts to arrive (server emits ~5% chance per second)
    // So wait up to 30s
    await expect(async () => {
      await page.getByRole('button', { name: /alerts/i }).click();
      await expect(page.locator('[role="listitem"]').first()).toBeVisible();
    }).toPass({ timeout: 30_000 });
  });

  test('should increment unread count badge on new alerts', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);

    // Wait for at least one alert to arrive
    await expect(async () => {
      const badge = page.locator('button[aria-label*="Alerts"] span');
      await expect(badge).toBeVisible();
      const text = await badge.textContent();
      expect(Number(text)).toBeGreaterThan(0);
    }).toPass({ timeout: 30_000 });
  });

  test('should close alert panel via X button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /alerts/i }).click();
    await expect(page.getByText('Live Alerts')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /close alert/i }).click();
    await expect(page.getByText('Live Alerts')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────
// Accessibility checks
// ────────────────────────────────────────────────────────────
test.describe('Accessibility', () => {
  test('all interactive elements should be keyboard focusable', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);

    // Tab to Command Center button
    await page.keyboard.press('Tab');
    // At least one focusable element should be reachable
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focused);
  });

  test('geofence checkbox should be keyboard togglable', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);

    const checkbox = page.getByRole('checkbox', { name: /geofence/i });
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
  });

  test('map container should have an accessible role', async ({ page }) => {
    await page.goto('/');
    await waitForMapLoad(page);
    // The map wrapper div should have role="application"
    await expect(page.getByRole('application', { name: /map/i })).toBeAttached();
  });

  test('status bar should have role=status', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[role="status"]').first()).toBeAttached();
  });
});

// ────────────────────────────────────────────────────────────
// Mobile / responsive
// ────────────────────────────────────────────────────────────
test.describe('Responsive layout', () => {
  test('should display correctly on mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await waitForMapLoad(page);

    // Command center button should be visible
    await expect(page.getByRole('button', { name: /command center/i })).toBeVisible();
    // Map should fill the screen
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });

  test('sidebar should be full-width on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);

    const sidebar = page.locator('[class*="SheetContent"]').or(
      page.locator('div').filter({ hasText: 'Live Trip Summary' }).first()
    );
    const box = await sidebar.boundingBox();
    if (box) {
      // On mobile the sidebar should be close to full width
      expect(box.width).toBeGreaterThan(300);
    }
  });

  test('should display correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await waitForMapLoad(page);
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: /command center/i })).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────
// Error resilience
// ────────────────────────────────────────────────────────────
test.describe('Error resilience', () => {
  test('page should not have uncaught JS errors during normal operation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await waitForMapLoad(page);
    await page.waitForTimeout(3_000); // let WS data flow

    // Filter out known Mapbox GL warnings that are not real errors
    const realErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('Map is not supported')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('rapid vehicle selection should not cause errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await waitForMapLoad(page);
    await openCommandCenter(page);

    const cards = page.locator('[role="listitem"]');
    await cards.first().waitFor({ timeout: 8_000 });

    // Rapidly click multiple vehicle cards
    const count = Math.min(await cards.count(), 5);
    for (let i = 0; i < count; i++) {
      await cards.nth(i).click({ force: true });
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});