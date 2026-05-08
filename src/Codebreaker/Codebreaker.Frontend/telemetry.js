import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// Service name is injected by Vite's define plugin from the OTEL_SERVICE_NAME env var.
// Falls back to 'codebreaker-frontend' if not running under Aspire.
const serviceName =
  typeof __OTEL_SERVICE_NAME__ !== 'undefined'
    ? __OTEL_SERVICE_NAME__
    : 'codebreaker-frontend';

const serviceResource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: '1.0.0',
});

// ── Tracing ──────────────────────────────────────────────────────────────────
// All signals are routed through the Vite dev-server proxy (/otlp → Aspire
// dashboard OTLP collector). See vite.config.js for proxy configuration.

const traceExporter = new OTLPTraceExporter({ url: '/otlp/v1/traces' });

const tracerProvider = new WebTracerProvider({
  resource: serviceResource,
  spanProcessors: [new BatchSpanProcessor(traceExporter)],
});

tracerProvider.register();

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Restrict W3C trace-context header injection to same-origin requests only
      // (i.e. the /api and /otlp proxy paths). Injecting into third-party URLs
      // triggers unnecessary CORS preflights and leaks trace identifiers off-origin.
      propagateTraceHeaderCorsUrls: [new RegExp(`^${location.origin}`)],
      clearTimingResources: true,
    }),
  ],
});

export const tracer = tracerProvider.getTracer(serviceName);

// ── Structured Logging ───────────────────────────────────────────────────────
// Sends structured log records (with key-value attributes) to the Aspire
// dashboard OTLP endpoint so they appear alongside backend logs and are
// distinguishable from raw console output.

const logExporter = new OTLPLogExporter({ url: '/otlp/v1/logs' });

// In @opentelemetry/sdk-logs@0.216.0 the LoggerProvider constructor accepts a
// 'processors' array directly; there is no addLogRecordProcessor() method.
const loggerProvider = new LoggerProvider({
  resource: serviceResource,
  processors: [new BatchLogRecordProcessor(logExporter)],
});

const _logger = loggerProvider.getLogger(serviceName);

/**
 * Emit a structured log record to the Aspire dashboard.
 *
 * @param {string} message   Human-readable message body.
 * @param {object} [attrs]   Key-value attributes (e.g. game.id, player.name).
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} [level]  Log severity (default: INFO).
 */
export function log(message, attrs = {}, level = 'INFO') {
  const severityMap = {
    DEBUG: SeverityNumber.DEBUG,
    INFO:  SeverityNumber.INFO,
    WARN:  SeverityNumber.WARN,
    ERROR: SeverityNumber.ERROR,
  };
  _logger.emit({
    body: message,
    severityNumber: severityMap[level] ?? SeverityNumber.INFO,
    severityText: level,
    attributes: attrs,
  });
}

// ── Metrics ───────────────────────────────────────────────────────────────────
// Custom counters and histograms report user-interaction rates, error rates,
// and performance timings in the Aspire metrics view.

const metricExporter = new OTLPMetricExporter({ url: '/otlp/v1/metrics' });

const meterProvider = new MeterProvider({
  resource: serviceResource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      // Export every 10 seconds so near-real-time data appears in Aspire.
      exportIntervalMillis: 10_000,
    }),
  ],
});

const meter = meterProvider.getMeter(serviceName);

/** Number of games started, broken down by `game.type`. */
export const gamesStartedCounter = meter.createCounter('codebreaker.games.started', {
  description: 'Total number of Codebreaker games started by the frontend.',
  unit: '{games}',
});

/** Number of moves submitted to the backend. */
export const movesSubmittedCounter = meter.createCounter('codebreaker.moves.submitted', {
  description: 'Total number of moves submitted during a Codebreaker game.',
  unit: '{moves}',
});

/** Number of games won by the player. */
export const gamesWonCounter = meter.createCounter('codebreaker.games.won', {
  description: 'Total number of Codebreaker games won.',
  unit: '{games}',
});

/** Number of games lost (all moves exhausted without a win). */
export const gamesLostCounter = meter.createCounter('codebreaker.games.lost', {
  description: 'Total number of Codebreaker games lost.',
  unit: '{games}',
});

/** Number of frontend errors (API failures, unexpected exceptions). */
export const errorsCounter = meter.createCounter('codebreaker.frontend.errors', {
  description: 'Total number of errors encountered in the Codebreaker frontend.',
  unit: '{errors}',
});

/**
 * Histogram of move-submission round-trip durations (ms).
 * Enables P50/P95/P99 latency analysis in the Aspire dashboard.
 */
export const moveLatencyHistogram = meter.createHistogram('codebreaker.move.duration', {
  description: 'Round-trip duration of a move submission from the Codebreaker frontend.',
  unit: 'ms',
});

// ── Page lifecycle flush ──────────────────────────────────────────────────────
// The BatchLogRecordProcessor and BatchSpanProcessor in the browser SDK
// automatically flush on 'pagehide'. The MeterProvider does not, so we
// explicitly force-flush the metric exporter when the page is hidden to
// avoid dropping the final metric batch when the user navigates away.
window.addEventListener('pagehide', () => {
  meterProvider.forceFlush().catch(() => { /* best-effort, ignore errors */ });
});
