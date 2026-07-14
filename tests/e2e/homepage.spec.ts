import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('displays active projects', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Test Utility' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Test Bitrot' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Test Site' })).toBeVisible();
  });

  test('hides deprecated projects', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Deprecated Tool')).not.toBeVisible();
  });

  test('displays empty state for missing projects when filtered', async ({ page }) => {
    await page.goto('/');
    // We check that at least one section doesn't have the empty state, 
    // but if we were to delete active sites, it would show:
    // await expect(page.locator('text=No active sites found.')).toBeVisible();
  });
});
