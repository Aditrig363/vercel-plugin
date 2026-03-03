---
description: Discover and install Vercel Marketplace integrations. Use to find databases, CMS, auth providers, and other services available on the Vercel Marketplace.
---

# Vercel Marketplace

Discover and install integrations from the Vercel Marketplace.

## Steps

1. Run `vercel integration discover --format=json` to list available integrations
2. Present integrations organized by category (Database, CMS, Auth, Payments, etc.)
3. If "$ARGUMENTS" specifies an integration name, run `vercel integration guide <name>` to show setup instructions
4. Follow the guide to help the user install and configure the integration

The `--format=json` flag provides structured, parseable output. The guide command returns agent-friendly markdown with step-by-step setup instructions.

Common integrations:
- **Neon** — Serverless Postgres (replaces @vercel/postgres)
- **Upstash** — Serverless Redis (replaces @vercel/kv)
- **Clerk** — Authentication
- **Sanity** — Headless CMS
- **Stripe** — Payments
