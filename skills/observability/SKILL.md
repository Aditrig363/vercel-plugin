---
name: observability
description: Vercel Observability expert guidance — Web Analytics, Speed Insights, runtime logs, custom events, Log Drains, OpenTelemetry integration, and monitoring dashboards. Use when instrumenting, debugging, or optimizing application performance and user experience on Vercel.
---

# Vercel Observability

You are an expert in Vercel's observability stack — Web Analytics, Speed Insights, runtime logs, Log Drains, and monitoring integrations.

## Web Analytics

Privacy-friendly, first-party analytics with no cookie banners required.

### Installation

```bash
npm install @vercel/analytics
```

### Setup (Next.js App Router)

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Custom Events (Pro/Enterprise)

Track business-specific events beyond pageviews.

```ts
import { track } from '@vercel/analytics'

// Track a conversion
track('purchase', {
  product: 'pro-plan',
  value: 20,
  currency: 'USD',
})

// Track a feature usage
track('feature_used', {
  name: 'ai-chat',
  duration_ms: 3200,
})
```

### Server-Side Tracking

```ts
import { track } from '@vercel/analytics/server'

export async function POST(req: Request) {
  const data = await req.json()
  await processOrder(data)

  track('order_completed', {
    order_id: data.id,
    total: data.total,
  })

  return Response.json({ success: true })
}
```

## Speed Insights

Real-user performance monitoring built on Core Web Vitals.

### Installation

```bash
npm install @vercel/speed-insights
```

### Setup (Next.js App Router)

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Metrics Tracked

| Metric | What It Measures | Good Threshold |
|--------|-----------------|----------------|
| LCP | Largest Contentful Paint | < 2.5s |
| INP | Interaction to Next Paint | < 200ms |
| CLS | Cumulative Layout Shift | < 0.1 |
| FCP | First Contentful Paint | < 1.8s |
| TTFB | Time to First Byte | < 800ms |

### Performance Attribution

Speed Insights attributes metrics to specific routes and pages, letting you identify which pages are slow and why.

## Runtime Logs

Vercel provides real-time logs for all function invocations.

### Structured Logging

```ts
// app/api/process/route.ts
export async function POST(req: Request) {
  const start = Date.now()
  const data = await req.json()

  // Structured logs appear in Vercel's log viewer
  console.log(JSON.stringify({
    level: 'info',
    message: 'Processing request',
    requestId: req.headers.get('x-vercel-id'),
    payload_size: JSON.stringify(data).length,
  }))

  try {
    const result = await processData(data)
    console.log(JSON.stringify({
      level: 'info',
      message: 'Request completed',
      duration_ms: Date.now() - start,
    }))
    return Response.json(result)
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Processing failed',
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    }))
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Next.js Instrumentation

```ts
// instrumentation.ts (Next.js 16)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize monitoring on server startup
    const { initMonitoring } = await import('./lib/monitoring')
    initMonitoring()
  }
}
```

## Log Drains

Export logs and telemetry data to external observability platforms.

### Supported Drain Types

| Drain Type | Protocol | Best For |
|-----------|----------|----------|
| JSON | HTTPS POST | Custom backends, generic log collectors |
| NDJSON | HTTPS POST | Streaming-friendly consumers |
| Syslog | TLS syslog | Traditional log management |

### Setting Up via CLI

```bash
# List existing drains
vercel logs drain ls

# Add a JSON drain
vercel logs drain add <endpoint-url> --type json

# Add a drain with filtering
vercel logs drain add <endpoint-url> --type json --environment production
```

### OpenTelemetry Integration

Vercel exports traces in OpenTelemetry-compatible format via Log Drains.

```bash
# Configure OTel-compatible drain
vercel logs drain add <otel-collector-url> --type json
```

### Datadog Integration

```bash
# Install via Marketplace (recommended)
vercel integration add datadog

# Or configure manually via drain
vercel logs drain add https://http-intake.logs.datadoghq.com/api/v2/logs \
  --type json \
  --headers "DD-API-KEY:<your-key>"
```

### Honeycomb Integration

```bash
# Install via Marketplace
vercel integration add honeycomb

# Or manual drain setup
vercel logs drain add https://api.honeycomb.io/1/batch/<dataset> \
  --type json \
  --headers "X-Honeycomb-Team:<your-key>"
```

## Monitoring Dashboard Patterns

### Full-Stack Observability Setup

Combine all Vercel observability tools for comprehensive coverage.

```tsx
// app/layout.tsx — complete observability setup
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Custom Monitoring with `waitUntil`

Fire-and-forget telemetry that doesn't block responses.

```ts
import { waitUntil } from '@vercel/functions'

export async function GET(req: Request) {
  const start = Date.now()
  const result = await fetchData()

  // Send response immediately
  const response = Response.json(result)

  // Report metrics in background
  waitUntil(async () => {
    await reportMetric('api_latency', Date.now() - start, {
      route: '/api/data',
      status: 200,
    })
  })

  return response
}
```

### Error Tracking Pattern

```ts
// lib/error-reporting.ts
export async function reportError(error: unknown, context: Record<string, unknown>) {
  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    ...context,
  }

  // Log for Vercel's runtime logs
  console.error(JSON.stringify(payload))

  // Also send to external service if configured
  if (process.env.ERROR_WEBHOOK_URL) {
    await fetch(process.env.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }
}
```

## Decision Matrix

| Need | Use | Why |
|------|-----|-----|
| Page views, traffic sources | Web Analytics | First-party, privacy-friendly |
| Business event tracking | Web Analytics custom events | Track conversions, feature usage |
| Core Web Vitals monitoring | Speed Insights | Real user data per route |
| Function debugging | Runtime Logs | Real-time, per-invocation logs |
| Export to Datadog/Honeycomb | Log Drains | Centralize observability |
| OpenTelemetry traces | Log Drains (OTel) | Standards-based export |
| Post-response telemetry | `waitUntil` + custom reporting | Non-blocking metrics |
| Server-side event tracking | `@vercel/analytics/server` | Track API-triggered events |

## Official Documentation

- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Speed Insights](https://vercel.com/docs/speed-insights)
- [Runtime Logs](https://vercel.com/docs/observability/runtime-logs)
- [Log Drains](https://vercel.com/docs/observability/log-drains)
- [Monitoring](https://vercel.com/docs/observability/monitoring)
- [@vercel/analytics npm](https://www.npmjs.com/package/@vercel/analytics)
- [@vercel/speed-insights npm](https://www.npmjs.com/package/@vercel/speed-insights)
