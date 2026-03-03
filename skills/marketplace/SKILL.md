---
name: marketplace
description: Vercel Marketplace expert guidance — discovering, installing, and building integrations, auto-provisioned environment variables, unified billing, and the vercel integration CLI. Use when consuming third-party services, building custom integrations, or managing marketplace resources on Vercel.
---

# Vercel Marketplace

You are an expert in the Vercel Marketplace — the integration platform that connects third-party services to Vercel projects with unified billing, auto-provisioned environment variables, and one-click setup.

## Consuming Integrations

### Discovering Integrations

```bash
# Browse available integrations
vercel integration discover

# Get guided setup for a category
vercel integration guide database

# Search for a specific integration
vercel integration discover --search "redis"
```

### Installing an Integration

```bash
# Install from CLI
vercel integration add <integration-name>

# Examples
vercel integration add neon          # Postgres database
vercel integration add upstash       # Redis / Kafka
vercel integration add clerk         # Authentication
vercel integration add sentry        # Error monitoring
vercel integration add sanity        # CMS
```

### Auto-Provisioned Environment Variables

When you install a Marketplace integration, Vercel automatically provisions the required environment variables for all linked projects.

```bash
# View environment variables added by integrations
vercel env ls

# Example: after installing Neon, these are auto-provisioned:
# POSTGRES_URL          — connection string
# POSTGRES_URL_NON_POOLING — direct connection
# POSTGRES_USER         — database user
# POSTGRES_PASSWORD     — database password
# POSTGRES_DATABASE     — database name
# POSTGRES_HOST         — database host
```

No manual `.env` file management is needed — the variables are injected into all environments (Development, Preview, Production) automatically.

### Using Provisioned Resources

```ts
// app/api/users/route.ts — using Neon auto-provisioned env vars
import { neon } from '@neondatabase/serverless'

// POSTGRES_URL is auto-injected by the Neon integration
const sql = neon(process.env.POSTGRES_URL!)

export async function GET() {
  const users = await sql`SELECT * FROM users LIMIT 10`
  return Response.json(users)
}
```

```ts
// app/api/cache/route.ts — using Upstash auto-provisioned env vars
import { Redis } from '@upstash/redis'

// KV_REST_API_URL and KV_REST_API_TOKEN are auto-injected
const redis = Redis.fromEnv()

export async function GET() {
  const cached = await redis.get('featured-products')
  return Response.json(cached)
}
```

### Managing Integrations

```bash
# List installed integrations
vercel integration ls

# Remove an integration
vercel integration remove <integration-name>
```

## Unified Billing

Marketplace integrations use Vercel's unified billing system:

- **Single invoice**: All integration charges appear on your Vercel bill
- **Usage-based**: Pay for what you use, scaled per integration's pricing model
- **Team-level billing**: Charges roll up to the Vercel team account
- **No separate accounts**: No need to manage billing with each provider individually

## Building Integrations

### Integration Architecture

Vercel integrations consist of:

1. **Integration manifest** — declares capabilities, required scopes, and UI surfaces
2. **Webhook handlers** — respond to Vercel lifecycle events
3. **UI components** — optional dashboard panels rendered within Vercel
4. **Resource provisioning** — create and manage resources for users

### Scaffold an Integration

```bash
# Create a new integration project
npx create-vercel-integration my-integration

# Or start from the template
npx create-next-app my-integration --example vercel-integration
```

### Integration Manifest

```json
// vercel-integration.json
{
  "name": "my-integration",
  "slug": "my-integration",
  "description": "Provides X for Vercel projects",
  "logo": "public/logo.svg",
  "website": "https://my-service.com",
  "categories": ["databases"],
  "scopes": {
    "project": ["env-vars:read-write"],
    "team": ["integrations:read-write"]
  },
  "installationType": "marketplace",
  "resourceTypes": [
    {
      "name": "database",
      "displayName": "Database",
      "description": "A managed database instance"
    }
  ]
}
```

### Handling Lifecycle Webhooks

```ts
// app/api/webhook/route.ts
import { verifyVercelSignature } from '@vercel/integration-utils'

export async function POST(req: Request) {
  const body = await req.json()

  // Verify the webhook is from Vercel
  const isValid = await verifyVercelSignature(req, body)
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  switch (body.type) {
    case 'integration.installed':
      // Provision resources for the new installation
      await provisionDatabase(body.payload)
      break

    case 'integration.uninstalled':
      // Clean up resources
      await deprovisionDatabase(body.payload)
      break

    case 'integration.configuration-updated':
      // Handle config changes
      await updateConfiguration(body.payload)
      break
  }

  return Response.json({ received: true })
}
```

### Provisioning Environment Variables

```ts
// lib/provision.ts
async function provisionEnvVars(
  installationId: string,
  projectId: string,
  credentials: { url: string; token: string }
) {
  const response = await fetch(
    `https://api.vercel.com/v1/integrations/installations/${installationId}/env`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_INTEGRATION_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        envVars: [
          {
            key: 'MY_SERVICE_URL',
            value: credentials.url,
            target: ['production', 'preview', 'development'],
            type: 'encrypted',
          },
          {
            key: 'MY_SERVICE_TOKEN',
            value: credentials.token,
            target: ['production', 'preview', 'development'],
            type: 'secret',
          },
        ],
      }),
    }
  )

  return response.json()
}
```

### Integration CLI Commands

```bash
# Develop integration locally
vercel integration dev

# Deploy integration
vercel integration deploy

# Publish to marketplace (requires review)
vercel integration publish

# Check integration status
vercel integration status
```

## Common Integration Categories

| Category | Popular Integrations | Auto-Provisioned Env Vars |
|----------|---------------------|---------------------------|
| Databases | Neon, Supabase, PlanetScale, MongoDB | `POSTGRES_URL`, `DATABASE_URL` |
| Cache/KV | Upstash Redis | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| Auth | Clerk, Auth0 | `CLERK_SECRET_KEY`, `AUTH0_SECRET` |
| CMS | Sanity, Contentful, Storyblok | `SANITY_PROJECT_ID`, `CONTENTFUL_TOKEN` |
| Monitoring | Datadog, Sentry | `SENTRY_DSN`, `DD_API_KEY` |
| Payments | Stripe | `STRIPE_SECRET_KEY` |
| Feature Flags | LaunchDarkly, Statsig | `LAUNCHDARKLY_SDK_KEY` |

## Decision Matrix

| Need | Use | Why |
|------|-----|-----|
| Add a database to your project | `vercel integration add neon` | Auto-provisioned, unified billing |
| Browse available services | `vercel integration discover` | CLI-native discovery |
| Build a SaaS integration | Integration SDK + manifest | Full lifecycle management |
| Centralize billing | Marketplace integrations | Single Vercel invoice |
| Auto-inject credentials | Marketplace auto-provisioning | No manual env var management |
| Manage integrations programmatically | Vercel REST API | `/v1/integrations` endpoints |
| Test integration locally | `vercel integration dev` | Local development server |

## Official Documentation

- [Vercel Marketplace](https://vercel.com/marketplace)
- [Building Integrations](https://vercel.com/docs/integrations)
- [Integration CLI](https://vercel.com/docs/cli/integration)
- [Integration Webhooks](https://vercel.com/docs/integrations#webhooks)
- [Environment Variables](https://vercel.com/docs/environment-variables)
