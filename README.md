# vercel-plugin

A comprehensive [Open Plugin](https://github.com/anthropics/open-plugin) that turns any AI agent into a Vercel expert.

## What It Does

This plugin pre-loads AI agents with a **relational knowledge graph** of the entire Vercel ecosystem — every product, library, CLI, API, and service — showing how they relate, when to use each, and providing deep guidance through bundled skills.

## Components

### Ecosystem Graph (`assets/vercel-ecosystem-graph.md`)

A text-form relational graph covering:
- All Vercel products and their relationships
- Decision matrices for choosing the right tool
- Common cross-product workflows
- Migration awareness for sunset products

### Skills (11 skills)

| Skill | Covers |
|-------|--------|
| `nextjs` | App Router, Server Components, Server Actions, Cache Components, routing, rendering strategies |
| `ai-sdk` | AI SDK v6 — text/object generation, streaming, tool calling, agents, MCP, providers, embeddings |
| `workflow` | Workflow DevKit — durable execution, DurableAgent, steps, Worlds, pause/resume |
| `vercel-functions` | Serverless, Edge, Fluid Compute, streaming, Cron Jobs, configuration |
| `vercel-storage` | Blob, Edge Config, Neon Postgres, Upstash Redis, migration from sunset packages |
| `ai-gateway` | Unified model API, provider routing, failover, cost tracking, 100+ models |
| `vercel-cli` | All CLI commands — deploy, env, dev, domains, marketplace discovery |
| `turborepo` | Monorepo orchestration, caching, remote caching, --affected, pruned subsets |
| `turbopack` | Next.js bundler, HMR, configuration, Turbopack vs Webpack |
| `v0-dev` | AI code generation, agentic intelligence, GitHub integration |
| `vercel-firewall` | DDoS, WAF, rate limiting, bot filter, custom rules |

### Agents (3 specialists)

| Agent | Expertise |
|-------|-----------|
| `deployment-expert` | CI/CD pipelines, deploy strategies, troubleshooting, environment variables |
| `performance-optimizer` | Core Web Vitals, rendering strategies, caching, asset optimization |
| `ai-architect` | AI application design, model selection, streaming architecture, MCP integration |

### Commands (4 commands)

| Command | Purpose |
|---------|---------|
| `/vercel-plugin:deploy` | Deploy to Vercel (preview or production) |
| `/vercel-plugin:env` | Manage environment variables |
| `/vercel-plugin:status` | Project status overview |
| `/vercel-plugin:marketplace` | Discover and install marketplace integrations |

### Rules (3 always-on conventions)

- **Next.js 16 conventions** — Server Components by default, async APIs, proxy.ts, Cache Components
- **AI SDK v6 conventions** — inputSchema/outputSchema, streaming, DurableAgent
- **Vercel best practices** — env vars, Fluid Compute, CI/CD patterns

### Hooks

- **Pre-write/edit validation** — Catches deprecated patterns before they're written (sunset packages, old API names, renamed files)

## Usage

```bash
# Load directly for development
claude --plugin-dir ./vercel-plugin

# Invoke skills
/vercel-plugin:nextjs
/vercel-plugin:ai-sdk
/vercel-plugin:deploy prod

# The ecosystem graph and rules load automatically,
# giving the agent full Vercel context from the start.
```

## Architecture

```
vercel-plugin/
├── .plugin/plugin.json              # Plugin manifest
├── assets/
│   └── vercel-ecosystem-graph.md    # Master relational knowledge graph
├── skills/                          # 11 deep-dive skills
│   ├── nextjs/
│   ├── ai-sdk/
│   ├── workflow/
│   ├── vercel-functions/
│   ├── vercel-storage/
│   ├── ai-gateway/
│   ├── vercel-cli/
│   ├── turborepo/
│   ├── turbopack/
│   ├── v0-dev/
│   └── vercel-firewall/
├── agents/                          # 3 specialist agents
├── commands/                        # 4 slash commands
├── rules/                           # 3 convention rules
└── hooks/                           # Deprecation guard
```

## Ecosystem Coverage (March 2026)

- Next.js 16 (App Router, Cache Components, Proxy, View Transitions)
- AI SDK v6 (Agents, MCP, DevTools, Reranking, Image Editing)
- Workflow DevKit (DurableAgent, Worlds, open source)
- AI Gateway (100+ models, provider routing, cost tracking)
- Vercel Functions (Fluid Compute, streaming, Cron Jobs)
- Storage (Blob, Edge Config, Neon Postgres, Upstash Redis)
- Turborepo (--affected, remote caching, Rust core)
- Turbopack (default bundler in Next.js 16)
- v0 (agentic intelligence, GitHub integration)
- Vercel Firewall (DDoS, WAF, Bot Filter)
- Vercel CLI (Marketplace discovery, agent-friendly output)
- Vercel Observability (Analytics, Speed Insights, Drains)
- Vercel Marketplace (one-click integrations, unified billing)
