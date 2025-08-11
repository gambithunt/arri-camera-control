import { expect, test } from '@playwright/test';

test('app loads successfully', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});

test('app is responsive on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/');
	await expect(page.locator('body')).toBeVisible();
});

test('app works on iPad', async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 768 });
	await page.goto('/');
	await expect(page.locator('body')).toBeVisible();
});