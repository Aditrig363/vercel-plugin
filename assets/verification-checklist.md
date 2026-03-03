# Verification Checklist — Version-Sensitive Claims

> Every version-sensitive claim in this plugin is listed below with its source URL and a
> last-verified date. Re-verify periodically (monthly or after major Vercel releases).
> When verifying, update the **Last Verified** date and note any discrepancies.

---

## How to Re-Verify

1. Open each **Source URL** and confirm the claim still matches official documentation.
2. Update the **Last Verified** column with today's date.
3. If a claim has changed, update both the relevant file(s) and this checklist.
4. Run `grep -c '⤳ skill:' assets/vercel-ecosystem-graph.md` and `ls skills/*/SKILL.md | wc -l` to confirm structural integrity.

---

## Next.js 16

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 1 | Next.js 16 uses React 19.2 and App Router as default | `skills/nextjs/SKILL.md`, `assets/vercel-ecosystem-graph.md` | https://nextjs.org/blog | 2026-03-03 |
| 2 | `middleware.ts` renamed to `proxy.ts` in v16; runs on Node.js runtime (not Edge) | `skills/nextjs/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 64, Migration table) | https://nextjs.org/docs/app/api-reference/file-conventions/proxy | 2026-03-03 |
| 3 | Cache Components (`'use cache'`) replace PPR from Next.js 15 canaries | `skills/nextjs/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 65, 74, 491, 594) | https://nextjs.org/docs/app/api-reference/directives/use-cache | 2026-03-03 |
| 4 | Turbopack is the default bundler in Next.js 16 | `skills/nextjs/SKILL.md`, `skills/turbopack/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 78, 259) | https://nextjs.org/blog | 2026-03-03 |
| 5 | Async Request APIs: `cookies()`, `headers()`, `params`, `searchParams` are all async | `skills/nextjs/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 593) | https://nextjs.org/docs/messages/sync-dynamic-apis | 2026-03-03 |
| 6 | Turbopack config is top-level (moved from `experimental.turbopack`) | `skills/turbopack/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 592) | https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack | 2026-03-03 |

## AI SDK v6

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 7 | AI SDK v6 is current major version | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 107) | https://sdk.vercel.ai/docs | 2026-03-03 |
| 8 | `Agent` class with `stopWhen`, `prepareStep` for agentic loops | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 117) | https://sdk.vercel.ai/docs/ai-sdk-core/agents | 2026-03-03 |
| 9 | Tools use `inputSchema` (not `parameters`) and `output`/`outputSchema` (not `result`), aligned with MCP | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 115, 596–597) | https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling | 2026-03-03 |
| 10 | DevTools available via `npx @ai-sdk/devtools` | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 120) | https://sdk.vercel.ai/docs/ai-sdk-core/devtools | 2026-03-03 |
| 11 | MCP Integration via `@ai-sdk/mcp` with OAuth, Resources, Prompts, Elicitation | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 128–132) | https://sdk.vercel.ai/docs/ai-sdk-core/mcp | 2026-03-03 |
| 12 | `mcp-to-ai-sdk` CLI for static tool generation | `assets/vercel-ecosystem-graph.md` (line 132) | https://sdk.vercel.ai/docs/ai-sdk-core/mcp | 2026-03-03 |
| 13 | Global Provider System: `"provider/model"` format in v6 | `skills/ai-sdk/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 134) | https://sdk.vercel.ai/docs/ai-sdk-core/settings | 2026-03-03 |
| 14 | Migration codemod: `npx @ai-sdk/codemod v6` | `assets/vercel-ecosystem-graph.md` (line 595) | https://sdk.vercel.ai/docs/migration | 2026-03-03 |
| 15 | Model identifiers: `gpt-5-mini`, `claude-sonnet-4-6`, `gemini-2.5-flash` | `skills/ai-sdk/SKILL.md` | Provider docs (OpenAI, Anthropic, Google) | 2026-03-03 |

## Workflow DevKit (WDK)

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 16 | `'use workflow'` and `'use step'` directives | `skills/workflow/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 182–183) | https://vercel.com/docs/workflow | 2026-03-03 |
| 17 | `DurableAgent` at `@workflow/ai/agent` wraps AI SDK Agent with durability | `skills/workflow/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 194–195) | https://vercel.com/docs/workflow | 2026-03-03 |
| 18 | Worlds: Local (JSON), Vercel (managed), Self-hosted (Postgres, Redis) | `skills/workflow/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 188–191) | https://vercel.com/docs/workflow | 2026-03-03 |
| 19 | Open source, no vendor lock-in | `assets/vercel-ecosystem-graph.md` (line 199) | https://github.com/vercel/workflow | 2026-03-03 |

## AI Gateway

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 20 | `@ai-sdk/gateway` package for AI Gateway routing | `skills/ai-gateway/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 144, 160) | https://vercel.com/docs/ai-gateway | 2026-03-03 |
| 21 | <20ms routing latency | `assets/vercel-ecosystem-graph.md` (line 167) | https://vercel.com/docs/ai-gateway | 2026-03-03 |
| 22 | Available since AI SDK 5.0.36+ | `skills/ai-gateway/SKILL.md` | https://vercel.com/docs/ai-gateway | 2026-03-03 |

## Vercel MCP Server

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 23 | Official MCP Server at `https://mcp.vercel.com` | `assets/vercel-ecosystem-graph.md` (line 411) | https://vercel.com/docs/mcp | 2026-03-03 |
| 24 | Streamable HTTP transport, OAuth 2.1, read-only (Beta) | `assets/vercel-ecosystem-graph.md` (lines 412–414) | https://vercel.com/docs/mcp | 2026-03-03 |
| 25 | Claude Code integration: `claude mcp add --transport http vercel https://mcp.vercel.com` | `assets/vercel-ecosystem-graph.md` (line 424) | https://vercel.com/docs/mcp | 2026-03-03 |

## Turbopack

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 26 | Instant HMR that doesn't degrade with app size | `skills/turbopack/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 254) | https://turbo.build/pack/docs | 2026-03-03 |
| 27 | Multi-environment builds (Browser, Server, Edge, SSR, RSC) | `assets/vercel-ecosystem-graph.md` (line 255) | https://turbo.build/pack/docs | 2026-03-03 |

## Storage — Sunset Packages

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 28 | `@vercel/postgres` is sunset → use `@neondatabase/serverless` | `skills/vercel-storage/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 292–293, 589) | https://vercel.com/docs/storage | 2026-03-03 |
| 29 | `@vercel/kv` is sunset → use `@upstash/redis` | `skills/vercel-storage/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 297–298, 590) | https://vercel.com/docs/storage | 2026-03-03 |
| 30 | `@neondatabase/vercel-postgres-compat` available as drop-in replacement | `assets/vercel-ecosystem-graph.md` (line 589) | https://neon.tech/docs | 2026-03-03 |

## Edge Config

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 31 | `@vercel/edge-config` supports Next.js 16 cacheComponents | `assets/vercel-ecosystem-graph.md` (line 287) | https://vercel.com/docs/storage/edge-config | 2026-03-03 |

## Vercel Functions

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 32 | Serverless timeout: Hobby 10s, Pro 15s | `skills/vercel-functions/SKILL.md` | https://vercel.com/docs/functions/runtimes | 2026-03-03 |
| 33 | Fluid Compute timeout: Hobby 60s, Pro/Enterprise 800s | `skills/vercel-functions/SKILL.md` | https://vercel.com/docs/functions/fluid-compute | 2026-03-03 |
| 34 | Edge Functions cold start <1ms | `skills/vercel-functions/SKILL.md` | https://vercel.com/docs/functions/edge-functions | 2026-03-03 |

## Vercel Firewall

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 35 | 40x faster DDoS mitigation with stream processing | `assets/vercel-ecosystem-graph.md` (line 317) | https://vercel.com/docs/security/vercel-firewall | 2026-03-03 |
| 36 | Bot Filter in public beta, all plans | `assets/vercel-ecosystem-graph.md` (line 324) | https://vercel.com/docs/security/vercel-firewall | 2026-03-03 |
| 37 | 300ms global WAF propagation | `assets/vercel-ecosystem-graph.md` (line 328) | https://vercel.com/docs/security/vercel-firewall | 2026-03-03 |

## Vercel CLI

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 38 | `vercel integration discover` and `vercel integration guide` (new in 2026) | `skills/vercel-cli/SKILL.md`, `assets/vercel-ecosystem-graph.md` (lines 393–396) | https://vercel.com/docs/cli | 2026-03-03 |
| 39 | `--format=json` for agent-friendly output | `skills/vercel-cli/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 396) | https://vercel.com/docs/cli | 2026-03-03 |

## v0

| # | Claim | Files | Source URL | Last Verified |
|---|-------|-------|------------|---------------|
| 40 | Agentic features (research, plan, debug, iterate) in 2026 | `skills/v0-dev/SKILL.md`, `assets/vercel-ecosystem-graph.md` (line 214) | https://v0.dev/docs | 2026-03-03 |
| 41 | Multi-framework output (React, Vue, Svelte, HTML) | `assets/vercel-ecosystem-graph.md` (line 213) | https://v0.dev/docs | 2026-03-03 |

---

## Structural Integrity Checks

Run these commands to verify the plugin's internal consistency:

```bash
# Count skill references in the graph (should be 17 as of 2026-03-03)
grep -c '⤳ skill:' assets/vercel-ecosystem-graph.md

# Count skill files (should be 12 as of 2026-03-03)
ls skills/*/SKILL.md | wc -l

# List unique skill names referenced in graph
grep -o '⤳ skill: [a-z0-9-]*' assets/vercel-ecosystem-graph.md | sort -u

# List skill directory names
ls skills/

# Orphan check: every skill dir should appear in a ⤳ skill: reference
for skill in skills/*/; do
  name=$(basename "$skill")
  if ! grep -q "⤳ skill: $name" assets/vercel-ecosystem-graph.md; then
    echo "ORPHAN: $name has no graph reference"
  fi
done

# Broken link check: every ⤳ skill: reference should have a matching directory
grep -o '⤳ skill: [a-z0-9-]*' assets/vercel-ecosystem-graph.md | \
  sed 's/⤳ skill: //' | sort -u | while read name; do
  if [ ! -f "skills/$name/SKILL.md" ]; then
    echo "BROKEN: ⤳ skill: $name has no SKILL.md"
  fi
done
```

---

## Cross-Reference Audit Results (2026-03-03)

| Check | Result |
|-------|--------|
| Total `⤳ skill:` references in graph | 17 |
| Unique skill names referenced | 12 |
| Total `skills/*/SKILL.md` files | 12 |
| Broken references (graph → missing skill) | **0** |
| Orphaned skills (skill → no graph reference) | **0** |
| Graph sections without skill links | 2 (Observability §7, Marketplace §9 — noted gaps, not errors) |
