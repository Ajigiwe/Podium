import { test, expect } from '@playwright/test';

test('landing page loads and shows the hero section', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Podium/i);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(0);
});

test('landing page has navigation', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav').first();
  await expect(nav).toBeVisible();
});

test('redirects work correctly', async ({ page }) => {
  await page.goto('/login');
  await page.waitForURL('**/auth/login.html');
  expect(page.url()).toContain('/auth/login.html');
});

test('dashboard redirect works', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard.html');
  expect(page.url()).toContain('/dashboard.html');
});
