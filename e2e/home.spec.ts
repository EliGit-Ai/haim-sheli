import { test, expect } from '@playwright/test';

test('has title and loads home page', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // בדיקת כותרת העמוד
  await expect(page).toHaveTitle(/חיים שלי/);
});