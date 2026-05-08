# Codebreaker Backend – Aspire + Vite Integration

This folder contains the .NET Aspire solution for the Codebreaker game, extended with a
Vite-powered frontend that runs alongside the backend services in a single Aspire developer
experience.

## Solution Structure

```
Codebreaker/
├── Codebreaker.Backend.AppHost/   ← Aspire AppHost (orchestrator)
├── Codebreaker.Backend.ServiceDefaults/
├── Codebreaker.Frontend/          ← Vite frontend (HTML/CSS/JS)
│   ├── components/
│   │   ├── color-peg.js
│   │   ├── color-selector.js
│   │   ├── feedback-peg.js
│   │   └── game-row.js
│   ├── services/
│   │   └── gameService.js
│   ├── index.html
│   ├── main.js
│   ├── telemetry.js              ← OTel tracing, logging, and metrics setup
│   ├── style.css
│   ├── vite.config.js
│   └── package.json
├── Codebreaker.Frontend.Tests/    ← Playwright UI tests for the frontend
│   ├── tests/
│   │   ├── game-start.spec.ts
│   │   └── game-play.spec.ts
│   ├── playwright.config.ts
│   ├── package.json
│   └── README.md
├── Codebreaker.GameAPIs/          ← Games REST API
├── CodeBreaker.Bot/               ← Automated bot client
└── Directory.Packages.props
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js LTS](https://nodejs.org/) (for the Vite frontend)
- [Aspire workload](https://learn.microsoft.com/dotnet/aspire/fundamentals/setup-tooling)

Install the Aspire workload if you haven't already:

```bash
dotnet workload install aspire
```

## Running the Full Solution

### 1. Install frontend dependencies

```bash
cd Codebreaker/Codebreaker.Frontend
npm install
```

### 2. Start the Aspire AppHost

From the solution root:

```bash
cd Codebreaker/Codebreaker.Backend.AppHost
dotnet run
```

Or use the Aspire CLI:

```bash
cd Codebreaker
aspire run
```

Aspire will start all resources in parallel:

| Resource                  | Description                              |
|---------------------------|------------------------------------------|
| `codebreaker-gameapis`    | .NET REST API for game logic             |
| `codebreaker-bot`         | Automated bot that plays games           |
| `codebreaker-frontend`    | Vite dev server serving the web client   |

The **Aspire dashboard** opens automatically and shows the URLs for every resource.
Open the `codebreaker-frontend` URL to play the game in your browser.

## How Vite is Integrated with Aspire

### AppHost registration (`AppHost.cs`)

```csharp
builder.AddNpmApp("codebreaker-frontend", "../Codebreaker.Frontend")
    .WithHttpEndpoint(env: "PORT")   // Aspire assigns a free port and sets PORT
    .WithExternalHttpEndpoints()      // Expose to the browser
    .WithReference(gameapis)          // Inject service-discovery env vars
    .WaitFor(gameapis);               // Start after the Games API is ready
```

`WithReference(gameapis)` injects environment variables into the Vite process so it can
discover the Games API URL at runtime:

| Environment variable                          | Example value                  |
|-----------------------------------------------|--------------------------------|
| `services__codebreaker-gameapis__https__0`    | `https://localhost:XXXXX`      |
| `services__codebreaker-gameapis__http__0`     | `http://localhost:YYYYY`       |

### Vite proxy (`vite.config.js`)

```js
proxy: {
  '/api': {
    target: process.env['services__codebreaker-gameapis__https__0']
         || process.env['services__codebreaker-gameapis__http__0']
         || 'https://localhost:9401',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

All frontend API calls use the `/api` prefix (e.g. `fetch('/api/games/')`), which Vite
proxies to the Games API. This avoids CORS issues and makes the backend URL configurable
via Aspire service discovery.

## Running the Frontend Standalone (without full Aspire stack)

> **Note:** Since the frontend is now registered in the AppHost, running `dotnet run`
> (or `aspire run`) already starts the Vite dev server automatically. The instructions
> below are for situations where you want to run *only* the Vite dev server in isolation
> (e.g. rapid UI iteration while an already-running Aspire session serves the backend).

```bash
# Ensure the Games API is already running (e.g. from an existing Aspire session)
# then start Vite — it will fall back to https://localhost:9401
cd Codebreaker/Codebreaker.Frontend
npm install
npm run dev
```

Vite falls back to `https://localhost:9401` when the Aspire service-discovery
environment variables are not present.

## Hot Reload

Because the frontend is registered with `AddNpmApp`, changes to files in
`Codebreaker.Frontend/` are picked up instantly by Vite's HMR (Hot Module Replacement).
No restart of the Aspire AppHost is required for frontend edits.

## Running the UI Tests (Playwright)

Automated end-to-end UI tests for `Codebreaker.Frontend` live in `Codebreaker.Frontend.Tests/`.
All backend API calls are mocked, so no running backend is required.

```bash
# 1. Install frontend dependencies (the test runner starts the Vite server automatically)
cd Codebreaker/Codebreaker.Frontend
npm install

# 2. Install test dependencies and Playwright browsers
cd ../Codebreaker.Frontend.Tests
npm install
npm run install:browsers

# 3. Run all tests (headless)
npm test
```

See [`Codebreaker.Frontend.Tests/README.md`](./Codebreaker.Frontend.Tests/README.md) for full details, including headed mode, the interactive Playwright UI, and CI configuration.

## Building for Production

```bash
cd Codebreaker/Codebreaker.Frontend
npm run build
```

The optimised output is written to `Codebreaker.Frontend/dist/` and can be served by any
static file host or embedded into the .NET backend using `app.UseStaticFiles()`.

## References

- [Aspire Frontend Hosting Guide](https://docs.aspire.dev/preview/hosting/frontend/)
- [Aspire.dev](https://aspire.dev)
- [Vite Documentation](https://vitejs.dev/)

## Frontend Telemetry

The `Codebreaker.Frontend` integrates [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
to send structured telemetry directly to the Aspire dashboard, providing end-to-end visibility
across the frontend and backend services.

### How it works

All three OTel signals (traces, logs, metrics) are exported via HTTP to the Aspire dashboard's
OTLP collector. The Vite dev server proxies every `/otlp/*` request to avoid CORS issues:

```
Browser → /otlp/v1/traces   → Aspire OTLP collector
         /otlp/v1/logs     → Aspire OTLP collector
         /otlp/v1/metrics  → Aspire OTLP collector
```

The signal pipeline is initialised once in `telemetry.js` and imported by `main.js` before
any other module.

### Libraries used

| Library | Version | Purpose |
|---|---|---|
| `@opentelemetry/sdk-trace-web` | `^2.7.1` | Distributed tracing (WebTracerProvider, BatchSpanProcessor) |
| `@opentelemetry/exporter-trace-otlp-http` | `^0.216.0` | Export spans to Aspire via HTTP |
| `@opentelemetry/instrumentation-fetch` | `^0.216.0` | Auto-instrument `fetch` calls; inject W3C trace-context headers |
| `@opentelemetry/sdk-logs` | `^0.216.0` | Structured log records (LoggerProvider, BatchLogRecordProcessor) |
| `@opentelemetry/api-logs` | `^0.216.0` | `SeverityNumber` constants and logger API |
| `@opentelemetry/exporter-logs-otlp-http` | `^0.216.0` | Export log records to Aspire via HTTP |
| `@opentelemetry/sdk-metrics` | `^2.7.1` | Custom counters and histograms (MeterProvider) |
| `@opentelemetry/exporter-metrics-otlp-http` | `^0.216.0` | Export metrics to Aspire via HTTP |

### Distributed Tracing

Every game operation is wrapped in a named span that carries `game.id`, `game.type`, and
`player.name` attributes:

| Span name | Triggered when |
|---|---|
| `game.start` | Player submits the new-game form |
| `game.move.submit` | Player submits a colour guess |

Fetch instrumentation automatically propagates the W3C `traceparent` header to backend API
calls so the Aspire dashboard can display frontend → backend traces as a single end-to-end
waterfall.

### Structured Logs

The `log(message, attrs, level)` helper emits an OTLP log record with structured key-value
attributes. Records appear in the Aspire **Structured Logs** tab and are searchable by field.
Raw `console.log` output remains separate.

Common attributes emitted:

| Attribute | Example | Description |
|---|---|---|
| `event.name` | `game.started` | Machine-readable event identifier |
| `player.name` | `Alice` | Player display name |
| `game.id` | `3fa85f64-…` | Game UUID from the backend |
| `game.type` | `Game6x4` | Game variant |
| `game.max_moves` | `12` | Total allowed moves |
| `game.move_number` | `3` | Current move number |
| `game.total_moves` | `7` | Moves used when the game ended |
| `move.duration_ms` | `142` | Move submission round-trip time (ms) |
| `move.ended` | `false` | Whether this move ended the game |
| `move.victory` | `true` | Whether the player won |
| `error.message` | `HTTP error! status: 503` | Error text on failure events |
| `error.context` | `game.move.submit` | Operation that failed |

Severity levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.

### Custom Metrics

Metrics are exported every 10 s and appear in the Aspire **Metrics** view. All counters accept
a `game.type` dimension for filtering by game variant.

| Metric name | Type | Description |
|---|---|---|
| `codebreaker.games.started` | Counter | New games started |
| `codebreaker.moves.submitted` | Counter | Moves submitted |
| `codebreaker.games.won` | Counter | Games won |
| `codebreaker.games.lost` | Counter | Games lost |
| `codebreaker.frontend.errors` | Counter | Frontend errors (API failures, exceptions) |
| `codebreaker.move.duration` | Histogram (ms) | Move submission round-trip latency |

