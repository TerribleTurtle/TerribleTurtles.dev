import { test, expect } from '@playwright/test';

test.describe('Bit-Rot Policy', () => {
  test('displays BitRotBanner for deprecated tools', async ({ page }) => {
    await page.goto('/tools/deprecated-tool');
    const banner = page.locator('.bit-rot-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Deprecated: Requires Update');
  });

  test('does not display BitRotBanner for active tools', async ({ page }) => {
    await page.goto('/tools/test-utility');
    await expect(page.locator('.bit-rot-banner')).not.toBeVisible();
  });
});
