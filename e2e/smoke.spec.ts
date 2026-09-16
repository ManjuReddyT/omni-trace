import { expect, test } from '@playwright/test';

test('sample logs open the dashboard with golden signals', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('sample-Nginx Access Logs')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('sample-Nginx Access Logs').click();
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('golden-signals')).toBeVisible();
  await expect(page.getByText('Latency (P95)')).toBeVisible();
  await expect(page.getByText('SRE Command Center')).toBeVisible();
});
