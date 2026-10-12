import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
});

test('animates a moon/sun change and a circular reveal from the actual button position', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Modo escuro', exact: true });
  const bounds = (await button.boundingBox())!;
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme-motion', 'reveal');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement ===
              '::view-transition-new(root)',
          ),
      ),
    )
    .toBe(true);
  const keyframes = await page.evaluate(() => {
    const reveal = document
      .getAnimations()
      .find(
        (animation) =>
          (animation.effect as KeyframeEffect | null)?.pseudoElement ===
          '::view-transition-new(root)',
      );
    return (reveal?.effect as KeyframeEffect | undefined)
      ?.getKeyframes()
      .map((frame) => frame['clipPath']);
  });
  expect(keyframes).toHaveLength(2);
  expect(keyframes![0]).toContain(
    `${bounds.x + bounds.width / 2}px ${bounds.y + bounds.height / 2}px`,
  );
  await expect
    .poll(() => page.locator('.theme-moon').evaluate((node) => getComputedStyle(node).opacity))
    .toBe('1');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() => page.locator('.theme-sun').evaluate((node) => getComputedStyle(node).opacity))
    .toBe('1');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
  expect(errors).toEqual([]);
});

test('keeps the last choice after rapid clicks without leaking snapshots or changing scroll/map', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() => {
    const app = (window as any).ng.getComponent(document.querySelector('app-root'));
    (window as any).__motionMap = app.fallbackMap;
    scrollTo(0, 180);
  });
  const scroll = await page.evaluate(() => scrollY);
  const button = page.getByRole('button', { name: 'Modo escuro', exact: true });
  await button.evaluate((node) => {
    for (let i = 0; i < 9; i++) (node as HTMLElement).click();
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
  expect(await page.evaluate(() => localStorage.getItem('vu2.theme'))).toBe('dark');
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(
    await page.evaluate(
      () =>
        (window as any).__motionMap ===
        (window as any).ng.getComponent(document.querySelector('app-root')).fallbackMap,
    ),
  ).toBe(true);
  await expect(page.locator('.result-list > li')).toHaveCount(25);
  expect(errors).toEqual([]);
});

test('accepts real pointer clicks while a snapshot is animating and keeps focus on the toggle', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Modo escuro', exact: true });
  const bounds = (await button.boundingBox())!;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  // Pause the real snapshot to guarantee subsequent mouse clicks hit it, rather
  // than allowing Playwright's actionability checks to wait out the transition.
  await page.mouse.click(x, y);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reveal = document
          .getAnimations()
          .find(
            (animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement ===
              '::view-transition-new(root)',
          );
        reveal?.pause();
        return Boolean(reveal);
      }),
    )
    .toBe(true);
  await page.mouse.click(x, y);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('vu2.theme'))).toBe('light');
  expect(errors).toEqual([]);
});

test('uses a palette fade when snapshots are unavailable', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-motion', 'fade');
  expect(
    await page
      .locator('.overview-metric')
      .first()
      .evaluate((node) =>
        node
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === 'background-color',
          ),
      ),
  ).toBe(true);
  expect(
    await page
      .locator('.overview-metric')
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe('0.42s');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
});

test('skips animation for reduced motion and finishes safely when that preference changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Modo escuro', exact: true });
  await button.focus();
  await page.keyboard.press('Space');
  await expect(button).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
  expect(
    await page.locator('.theme-moon').evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe('0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-motion', 'reveal');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-motion');
});
