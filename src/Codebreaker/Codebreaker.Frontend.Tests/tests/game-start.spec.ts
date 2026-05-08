import { test, expect } from '@playwright/test';

/** Mock response for POST /api/games/ */
const MOCK_GAME_RESPONSE = {
  id: 'test-game-id-001',
  gameType: 'Game6x4',
  playerName: 'TestPlayer',
  numberCodes: 4,
  maxMoves: 12,
  fieldValues: {
    colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
  },
};

test.describe('Game Start', () => {
  test('shows the setup form on page load', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#game-setup')).toBeVisible();
    await expect(page.locator('#player-name')).toBeVisible();
    await expect(page.locator('#game-type')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Game playground must be hidden until a game is started
    await expect(page.locator('#game-playground')).toBeHidden();
  });

  test('form fields have required attributes to prevent empty submission', async ({ page }) => {
    await page.goto('/');

    // HTML5 required validation prevents submission, but the button itself should be enabled —
    // the browser blocks the submit rather than the button click.
    // Assert the form itself is present and requires player name.
    await expect(page.locator('#player-name')).toHaveAttribute('required');
    await expect(page.locator('#game-type')).toHaveAttribute('required');
  });

  test('starts a game and transitions to the game playground', async ({ page }) => {
    // Intercept the create-game API call and return a mocked response
    await page.route('**/api/games/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GAME_RESPONSE),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Fill in player name
    await page.fill('#player-name', 'TestPlayer');

    // Select game type Game6x4
    await page.selectOption('#game-type', 'Game6x4');

    // Click the Start Game button
    await page.click('button[type="submit"]');

    // The game playground should become visible
    await expect(page.locator('#game-playground')).toBeVisible({ timeout: 5000 });

    // The setup section should be hidden
    await expect(page.locator('#game-setup')).toBeHidden();
  });

  test('displays correct game info after starting', async ({ page }) => {
    await page.route('**/api/games/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GAME_RESPONSE),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.fill('#player-name', 'TestPlayer');
    await page.selectOption('#game-type', 'Game6x4');
    await page.click('button[type="submit"]');
    await expect(page.locator('#game-playground')).toBeVisible({ timeout: 5000 });

    // Player name, game type and moves left should reflect the mocked response
    await expect(page.locator('#current-player')).toHaveText('TestPlayer');
    await expect(page.locator('#current-game-type')).toHaveText('Game6x4');
    await expect(page.locator('#moves-left')).toHaveText('12');
  });

  test('shows the color selector and initial game row after starting', async ({ page }) => {
    await page.route('**/api/games/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GAME_RESPONSE),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.fill('#player-name', 'TestPlayer');
    await page.selectOption('#game-type', 'Game6x4');
    await page.click('button[type="submit"]');
    await expect(page.locator('#game-playground')).toBeVisible({ timeout: 5000 });

    // Color palette should contain a color-selector component
    await expect(page.locator('#color-palette color-selector')).toBeVisible();

    // An active game row should exist in the current-move area
    await expect(page.locator('#current-move-row game-row')).toBeVisible();

    // Submit button should exist (and be disabled because no pegs are placed yet)
    await expect(page.locator('#submit-move')).toBeDisabled();
  });

  test('returns to setup screen when New Game is clicked', async ({ page }) => {
    await page.route('**/api/games/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GAME_RESPONSE),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.fill('#player-name', 'TestPlayer');
    await page.selectOption('#game-type', 'Game6x4');
    await page.click('button[type="submit"]');
    await expect(page.locator('#game-playground')).toBeVisible({ timeout: 5000 });

    // Click the New Game button
    await page.click('#new-game');

    // Setup section should reappear
    await expect(page.locator('#game-setup')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#game-playground')).toBeHidden();
  });
});
