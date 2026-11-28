import { expect, test } from '@playwright/test';

test('picker lists the demo-swap fixture under ?fixtures', async ({
  page,
}, testInfo) => {
  await page.goto('/?fixtures');
  const picker = page.getByRole('navigation', { name: 'Algorithm picker' });
  await expect(picker.getByRole('listitem')).toHaveText(['Demo: swap']);
  await page.screenshot({ path: testInfo.outputPath('picker.png') });
});

test('picker hides the fixtures without ?fixtures', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByRole('navigation', { name: 'Algorithm picker' });
  await expect(picker.getByRole('heading', { level: 2 })).toHaveText([
    'Algorithms',
  ]);
});
