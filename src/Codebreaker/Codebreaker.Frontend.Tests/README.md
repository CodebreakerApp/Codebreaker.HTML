# Codebreaker.Frontend.Tests

Playwright end-to-end UI tests for the **Codebreaker.Frontend** Vite application.

## Overview

The test suite covers two key scenarios:

| Spec | What it tests |
|---|---|
| `tests/game-start.spec.ts` | Setup form renders correctly; starting a game transitions to the game playground; correct game info is shown; returning to setup via *New Game* works. |
| `tests/game-play.spec.ts` | Placing pegs enables the submit button; submitting a move adds a row to history and decrements moves left; winning/losing triggers the appropriate alert; a three-move playthrough works end-to-end. |

All API calls (`POST /api/games/`, `PATCH /api/games/:id`) are intercepted with `page.route()` so **no backend needs to be running** during tests.

## Prerequisites

- [Node.js LTS](https://nodejs.org/) ≥ 18
- The `Codebreaker.Frontend` project's dependencies must be installed (the Playwright config starts that dev server automatically):

```bash
cd Codebreaker/Codebreaker.Frontend
npm install
```

## Installing test dependencies

```bash
cd Codebreaker/Codebreaker.Frontend.Tests
npm install
```

### Installing Playwright browsers

On first use (or in CI), install the Chromium browser:

```bash
npm run install:browsers
# or equivalently:
npx playwright install --with-deps chromium
```

## Running the tests

```bash
# Headless (default) — starts Vite automatically, then runs all tests
npm test

# Headed mode — open a real browser window
npm run test:headed

# Interactive Playwright UI mode
npm run test:ui
```

### Viewing the HTML report

After a test run the report is written to `playwright-report/`:

```bash
npm run test:report
```

## Running against an existing Vite server

If you already have the Vite dev server running (e.g. `npm run dev` inside `Codebreaker.Frontend`), set `PLAYWRIGHT_BASE_URL` to skip starting a second instance:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm test
```

In this mode `reuseExistingServer` is honoured automatically because `CI` is not set.

## Running in CI

Set the `CI` environment variable (GitHub Actions does this by default) to:

- disable `reuseExistingServer` (always start a fresh Vite server)
- enable 2 retries per failing test
- limit workers to 1 to avoid port conflicts

```bash
CI=true npm test
```
