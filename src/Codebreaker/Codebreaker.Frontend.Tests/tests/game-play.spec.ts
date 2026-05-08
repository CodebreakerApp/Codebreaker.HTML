import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_GAME = {
  id: 'play-game-id-001',
  gameType: 'Game6x4',
  playerName: 'PlayTester',
  numberCodes: 4,
  maxMoves: 12,
  fieldValues: {
    colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
  },
};

/** A non-winning move response */
const MOCK_MOVE_ONGOING = {
  id: MOCK_GAME.id,
  results: ['Black', 'White', 'None', 'None'],
  ended: false,
  isVictory: false,
};

/** A winning move response */
const MOCK_MOVE_WIN = {
  id: MOCK_GAME.id,
  results: ['Black', 'Black', 'Black', 'Black'],
  ended: true,
  isVictory: true,
};

/** A losing move response (game over, not a win) */
const MOCK_MOVE_LOSE = {
  id: MOCK_GAME.id,
  results: ['None', 'None', 'None', 'None'],
  ended: true,
  isVictory: false,
};

// ---------------------------------------------------------------------------
// Helper: start a game with API mocks already in place
// ---------------------------------------------------------------------------

async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.fill('#player-name', 'PlayTester');
  await page.selectOption('#game-type', 'Game6x4');
  await page.click('button[type="submit"]');
  await expect(page.locator('#game-playground')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Helper: place four pegs programmatically by dispatching the same custom
// events that the real color-selector / game-row components fire.
// This is the most reliable approach when components use Shadow DOM.
// ---------------------------------------------------------------------------

async function placeFourPegs(
  page: Page,
  colors: [string, string, string, string]
): Promise<void> {
  await page.evaluate((colorList) => {
    for (let i = 0; i < colorList.length; i++) {
      // Simulate the color-selected event (sets selectedColor in main.js)
      const colorPalette = document.getElementById('color-palette')!;
      colorPalette.dispatchEvent(
        new CustomEvent('color-selected', {
          bubbles: true,
          composed: true,
          detail: { color: colorList[i] },
        })
      );

      // Simulate a peg-clicked event from the active game-row
      const gameRow = document.getElementById('active-row')!;
      gameRow.dispatchEvent(
        new CustomEvent('peg-clicked', {
          bubbles: true,
          composed: true,
          detail: { index: i },
        })
      );
    }
  }, colors);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Game Play', () => {
  test.beforeEach(async ({ page }) => {
    // Mock create-game
    await page.route('**/api/games/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_GAME),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('submit button is enabled only when all slots are filled', async ({ page }) => {
    await startGame(page);

    // Initially disabled
    await expect(page.locator('#submit-move')).toBeDisabled();

    // Place all 4 pegs
    await placeFourPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);

    // Should now be enabled
    await expect(page.locator('#submit-move')).toBeEnabled();
  });

  test('submitting a move shows feedback and a new game row', async ({ page }) => {
    // Mock submit-move with an ongoing response.
    // Use route.fallback() for non-PATCH requests so they fall through to the
    // beforeEach handler that mocks POST /api/games/.
    await page.route('**/api/games/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_MOVE_ONGOING),
        });
      } else {
        await route.fallback();
      }
    });

    await startGame(page);
    await placeFourPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);

    // Submit the move
    await page.click('#submit-move');

    // A new active-row should appear in the current-move area (move 2)
    await expect(
      page.locator('#current-move-row game-row[move-number="2"]')
    ).toBeVisible({ timeout: 5000 });

    // The previous row should have moved into the moves history container
    const movedRow = page.locator('#moves-container game-row[move-number="1"]');
    await expect(movedRow).toBeVisible();

    // Moves left counter should decrease
    await expect(page.locator('#moves-left')).toHaveText('11');
  });

  test('winning a game shows a congratulations alert', async ({ page }) => {
    // Mock submit-move with a winning response.
    // Use route.fallback() for non-PATCH requests so they fall through to the
    // beforeEach handler that mocks POST /api/games/.
    await page.route('**/api/games/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_MOVE_WIN),
        });
      } else {
        await route.fallback();
      }
    });

    await startGame(page);
    await placeFourPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);

    // Listen for the dialog triggered by handleGameEnd
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#submit-move');

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Congratulations');
    await dialog.accept();

    // Submit button should be disabled after the game ends
    await expect(page.locator('#submit-move')).toBeDisabled();
  });

  test('losing a game shows a game over alert', async ({ page }) => {
    // Mock submit-move with a losing response.
    // Use route.fallback() for non-PATCH requests so they fall through to the
    // beforeEach handler that mocks POST /api/games/.
    await page.route('**/api/games/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_MOVE_LOSE),
        });
      } else {
        await route.fallback();
      }
    });

    await startGame(page);
    await placeFourPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);

    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#submit-move');

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Game over');
    await dialog.accept();

    await expect(page.locator('#submit-move')).toBeDisabled();
  });

  test('typical game play: submit two moves and win on the third', async ({ page }) => {
    let callCount = 0;

    // Use route.fallback() for non-PATCH requests so they fall through to the
    // beforeEach handler that mocks POST /api/games/.
    await page.route('**/api/games/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        callCount++;
        const body = callCount < 3 ? MOCK_MOVE_ONGOING : MOCK_MOVE_WIN;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      } else {
        await route.fallback();
      }
    });

    await startGame(page);

    // Move 1
    await placeFourPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);
    await page.click('#submit-move');
    await expect(page.locator('#current-move-row game-row[move-number="2"]')).toBeVisible({
      timeout: 5000,
    });

    // Move 2
    await placeFourPegs(page, ['Purple', 'Orange', 'Red', 'Blue']);
    await page.click('#submit-move');
    await expect(page.locator('#current-move-row game-row[move-number="3"]')).toBeVisible({
      timeout: 5000,
    });

    // Move 3 — winning move
    await placeFourPegs(page, ['Red', 'Green', 'Blue', 'Yellow']);

    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#submit-move');

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Congratulations');
    await dialog.accept();

    // Three completed rows should appear in the history (including the winning move)
    await expect(page.locator('#moves-container game-row')).toHaveCount(3);
  });
});
