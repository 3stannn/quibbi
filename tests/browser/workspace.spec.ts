import { expect, test } from '@playwright/test';

test('unconfigured login stays honest and sample card is keyboard usable', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: null, configured: false } }),
  );
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }).first(),
  ).toBeDisabled();
  await expect(page.getByText('Sign-in is being set up')).toBeVisible();
  const card = page.getByRole('button', { name: /Sample card/ });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute(
    'aria-label',
    /Answer: The mitochondrion\./,
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
  }
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px Geist');
    }),
  ).toBe(true);
});

test('deck draft survives failed save, saves after CSRF refresh, reloads and warns before leaving', async ({
  page,
}) => {
  const stamp = new Date().toISOString();
  let deck = {
    id: '507f1f77bcf86cd799439011',
    title: 'Biology: the cell',
    description: '',
    revision: 1,
    cards: [] as Record<string, unknown>[],
    createdAt: stamp,
    updatedAt: stamp,
  };
  let failSave = true;
  let csrfExpired = true;
  let sessionReads = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/session') {
      sessionReads++;
      return route.fulfill({
        json: {
          user: { id: 'student', name: 'Mika', email: null, image: null },
          configured: true,
          csrfToken: sessionReads > 1 ? 'fresh' : 'old',
        },
      });
    }
    if (path === '/api/decks' && request.method() === 'GET')
      return route.fulfill({ json: { decks: [deck], nextCursor: null } });
    if (path.endsWith(deck.id) && request.method() === 'GET')
      return route.fulfill({ json: { deck } });
    if (request.method() === 'PATCH') {
      if (failSave) {
        failSave = false;
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'UNAVAILABLE',
              message: 'Connection interrupted. Try again.',
            },
          },
        });
      }
      if (csrfExpired) {
        csrfExpired = false;
        return route.fulfill({
          status: 403,
          json: {
            error: {
              code: 'CSRF_REJECTED',
              message: 'Refresh your session and try again.',
            },
          },
        });
      }
      const input = request.postDataJSON();
      expect(request.headers()['x-csrf-token']).toBe('fresh');
      expect(input.cards[0].back).toBe('The mitochondrion.');
      deck = { ...deck, ...input, revision: deck.revision + 1 };
      return route.fulfill({ json: { deck } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND', message: 'Unknown test endpoint' } },
    });
  });
  await page.goto(`/decks/${deck.id}`);
  await page.getByRole('button', { name: 'Add your first card' }).click();
  await page.getByLabel('Front', { exact: true }).fill('What powers a cell?');
  await page.getByLabel('Back', { exact: true }).fill('The mitochondrion.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('Connection interrupted. Try again.'),
  ).toBeVisible();
  await expect(page.getByLabel('Back', { exact: true })).toHaveValue(
    'The mitochondrion.',
  );
  await page.screenshot({
    path: 'test-results/editor-save-error.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();
  expect(sessionReads).toBeGreaterThan(1);
  await page.reload();
  await expect(page.getByLabel('Back', { exact: true })).toHaveValue(
    'The mitochondrion.',
  );
  await page.getByLabel('Front', { exact: true }).fill('Changed question');
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Leave your unsaved changes?',
  );
  await page.screenshot({
    path: 'test-results/unsaved-dialog.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByLabel('Front', { exact: true })).toHaveValue(
    'Changed question',
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/editor-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test('create a private deck from an empty library and delete it', async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/session')
      return route.fulfill({
        json: {
          user: { id: 'student', name: 'Mika', email: null, image: null },
          configured: true,
          csrfToken: 'csrf',
        },
      });
    if (req.method() === 'POST') {
      saved = {
        ...req.postDataJSON(),
        id: '507f1f77bcf86cd799439012',
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill({ status: 201, json: { deck: saved } });
    }
    if (req.method() === 'DELETE') {
      saved = null;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/decks')
      return route.fulfill({
        json: { decks: saved ? [saved] : [], nextCursor: null },
      });
    return route.fulfill({ json: { deck: saved } });
  });
  await page.goto('/library');
  await expect(
    page.getByText('Something to learn? Make it a deck.'),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/library-empty.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'New deck' }).click();
  await page.screenshot({
    path: 'test-results/new-deck-dialog.png',
    fullPage: true,
  });
  await page.getByLabel('Deck name').fill('Biology: the cell');
  await page.getByRole('button', { name: 'Create deck', exact: true }).click();
  await expect(page.getByLabel('Deck name')).toHaveValue('Biology: the cell');
  await page.getByRole('button', { name: 'Delete deck', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete deck', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'My library' })).toBeVisible();
  await expect(
    page.getByText('Something to learn? Make it a deck.'),
  ).toBeVisible();
});
