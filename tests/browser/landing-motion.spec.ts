import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: null, configured: false } }),
  );
});

test('card rotates in 3D, reverses safely, and exposes only its active face', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  const card = page.getByRole('button', { name: /Sample card/ });
  const inner = card.locator('.flip-card-inner');
  await card.scrollIntoViewIfNeeded();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.flip-card-front')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect
    .poll(async () => inner.evaluate((el) => getComputedStyle(el).transform))
    .toContain('matrix3d');
  await expect
    .poll(async () =>
      inner.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m11),
    )
    .toBeLessThan(-0.99);
  // Interrupt and reverse a rotation before it finishes.
  await card.click();
  await card.click();
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(async () =>
      inner.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m11),
    )
    .toBeGreaterThan(0.99);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(card).toHaveAttribute('data-reduced', 'true');
  await card.press('Space');
  await expect(card).toHaveAttribute(
    'aria-label',
    /Answer: The mitochondrion\./,
  );
  await expect(card.locator('.flip-card-back')).toHaveAttribute(
    'aria-hidden',
    'false',
  );
  expect(
    await inner.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m11,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});

test('Paytone branding, Geist body, Q favicon and responsive sections load', async ({
  page,
}) => {
  await page.goto('/login');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.brand')).toHaveCSS('font-family', /Paytone One/);
  await expect(page.locator('body')).toHaveCSS('font-family', /Geist/);
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (f) =>
          f.family.replaceAll('"', '') === 'Paytone One' &&
          f.status === 'loaded',
      ),
    ),
  ).toBe(true);
  const favicon = await page.request.get('/favicon.svg');
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  expect(await favicon.text()).toMatch(
    /<svg\b[^>]*\bviewBox=["']0 0 64 64["']/,
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#get-started')).toBeAttached();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/landing-${width}.png`,
      fullPage: true,
    });
  }
});

test('JavaScript-disabled visitors get a readable fallback', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/login');
  await expect(page.getByRole('heading', { name: /Quibbi/ })).toBeVisible();
  await expect(page.getByText(/Enable JavaScript to sign in/)).toBeVisible();
  await context.close();
});
