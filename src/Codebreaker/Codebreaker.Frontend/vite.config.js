import { defineConfig } from 'vite';
import fs from 'node:fs';
import http from 'node:http';

// When running under Aspire, service URLs are injected as environment variables.
// The format is: services__{resourceName}__{scheme}__{index}
const gameApisUrl =
  process.env['services__codebreaker-gameapis__https__0'] ||
  process.env['services__codebreaker-gameapis__http__0'] ||
  'https://localhost:9401';

// Aspire injects OTEL_EXPORTER_OTLP_ENDPOINT pointing to the plain HTTP OTLP/HTTP
// endpoint (overridden in AppHost.cs to avoid the default HTTPS gRPC endpoint).
const otlpEndpoint =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ||
  'http://localhost:4318';

// Service name injected by Aspire, forwarded to the browser via Vite's define.
const otelServiceName =
  process.env['OTEL_SERVICE_NAME'] || 'codebreaker-frontend';

// Aspire injects OTEL_EXPORTER_OTLP_HEADERS as "key=value,..." pairs containing the
// dashboard API key. Parsed here in the Vite server process so it is never
// exposed to the browser.
function parseOtlpHeaders() {
  const headers = {};
  const raw = process.env['OTEL_EXPORTER_OTLP_HEADERS'] || '';
  for (const pair of raw.split(',')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      try {
        headers[decodeURIComponent(pair.slice(0, eq).trim())] =
          decodeURIComponent(pair.slice(eq + 1).trim());
      } catch { /* malformed encoding — skip */ }
    }
  }
  return headers;
}

const otlpAuthHeaders = parseOtlpHeaders();

// Slim OTLP proxy plugin: intercepts /otlp/* requests from the browser and
// forwards them to the Aspire dashboard over plain HTTP/1.1, injecting the
// API key from the server-side environment. The browser never sees the key.
function createOtlpProxyPlugin(target, authHeaders) {
  const targetUrl = new URL(target);
  return {
    name: 'otlp-proxy',
    configureServer(server) {
      server.middlewares.use('/otlp', (req, res) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('error', () => { res.writeHead(204); res.end(); });
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          const upstreamReq = http.request(
            {
              hostname: targetUrl.hostname,
              port: Number(targetUrl.port) || 80,
              path: req.url || '/',
              method: 'POST',
              headers: {
                'content-type': req.headers['content-type'] || 'application/x-protobuf',
                'content-length': body.length,
                ...authHeaders,
              },
            },
            upstreamRes => {
              res.writeHead(upstreamRes.statusCode ?? 204);
              upstreamRes.resume();
              upstreamRes.on('end', () => res.end());
            },
          );
          upstreamReq.on('error', () => { res.writeHead(204); res.end(); });
          upstreamReq.end(body);
        });
      });
    },
  };
}

// Optional HTTPS for the Vite dev server.
// Enable with VITE_DEV_HTTPS=true and set VITE_DEV_HTTPS_CERT_FILE / VITE_DEV_HTTPS_KEY_FILE.
const viteDevHttpsEnabled = (process.env['VITE_DEV_HTTPS'] || '').toLowerCase() === 'true';
const viteDevHttpsCertFile = process.env['VITE_DEV_HTTPS_CERT_FILE'];
const viteDevHttpsKeyFile  = process.env['VITE_DEV_HTTPS_KEY_FILE'];

const viteHttpsOptions =
  viteDevHttpsEnabled && viteDevHttpsCertFile && viteDevHttpsKeyFile
    ? { cert: fs.readFileSync(viteDevHttpsCertFile), key: fs.readFileSync(viteDevHttpsKeyFile) }
    : false;

if (viteDevHttpsEnabled && !viteHttpsOptions) {
  console.warn('[vite] VITE_DEV_HTTPS=true but cert/key paths are missing — falling back to HTTP.');
}

export default defineConfig({
  plugins: [createOtlpProxyPlugin(otlpEndpoint, otlpAuthHeaders)],
  define: {
    // Injected by Aspire; used in telemetry.js to set the OTel service name.
    __OTEL_SERVICE_NAME__: JSON.stringify(otelServiceName),
  },
  server: {
    // Aspire injects the PORT environment variable for the Vite dev server.
    port: parseInt(process.env.PORT ?? '5173'),
    strictPort: true,
    https: viteHttpsOptions,
    proxy: {
      // Proxy API calls to the Codebreaker Games API backend.
      '/api': {
        target: gameApisUrl,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Note: /otlp/* is handled by the otlp-proxy plugin above, which
      // injects the Aspire API key server-side before forwarding.
    },
  },
});
