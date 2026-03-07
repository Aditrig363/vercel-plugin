---
name: benchmark-agents
description: Advanced AI agent benchmark scenarios that push Vercel's cutting-edge platform features — Workflow DevKit, AI Gateway, MCP, Chat SDK, Queues, Flags, Sandbox, and multi-agent orchestration. Designed to stress-test skill injection for complex, multi-system builds.
---

# Benchmark Agents — Advanced AI Systems

Benchmark scenarios that go beyond CRUD apps to exercise the full depth of Vercel's AI and platform primitives. Every scenario involves durable agents, streaming, multi-model routing, cross-platform messaging, or event-driven pipelines.

## Workflow

Same as `benchmark-testing` — create directories, install the plugin, launch via WezTerm. See that skill for mechanical details. This skill defines the **scenarios only**.

## Prompt Guidelines

- **Never name specific technologies** — describe the product and capabilities
- Describe behaviors that *require* advanced features (durability, fan-out, streaming, webhooks, multi-model)
- Prompts should be ambitious enough that a naive implementation would miss critical platform features
- Always append: "Link the project to my vercel-labs team so we can deploy it later."

## Scenario Table

| # | Slug | Prompt | Expected Skills |
|---|------|--------|----------------|
| 01 | doc-qa-agent | Build an AI document Q&A system where users upload PDFs and ask questions. The system should chunk documents, generate embeddings, store them for retrieval, and use a multi-step reasoning agent that cites specific page numbers. The agent should use tool calls to search the document store, re-rank results, and synthesize answers with streaming output. Include a chat UI with message history, tool invocation display, and source citations. | ai-sdk, nextjs, vercel-storage, ai-elements |
| 02 | customer-support-agent | Build a customer support agent that connects to a company's help docs via a standardized tool protocol. The agent should handle multi-turn conversations, escalate to humans when confidence is low, and log every interaction for review. It needs a dashboard showing active conversations, resolution rates, and average response time. The agent must survive server restarts mid-conversation without losing context. | ai-sdk, workflow, nextjs, ai-elements |
| 03 | deploy-monitor | Build a deployment monitoring system with an AI incident responder. It should ping endpoints on a schedule, detect anomalies in response times, and when an incident is detected, spawn an AI agent that investigates build logs, function logs, and recent deploys to suggest a root cause. The investigation must be durable — if the function times out mid-analysis, it picks up where it left off. Show a real-time dashboard with uptime charts and incident timelines. | workflow, cron-jobs, observability, ai-sdk, vercel-api |
| 04 | multi-model-router | Build an AI playground that lets users compare responses from multiple models side-by-side. Users type a prompt and select 2-4 models to race. Responses stream in parallel with token-per-second metrics. Include cost tracking per query, a history of past comparisons, and the ability to vote on which response was best. Route all model calls through a unified gateway for failover and observability. | ai-gateway, ai-sdk, nextjs, ai-elements |
| 05 | slack-pr-reviewer | Build a bot that lives in team chat and automatically reviews pull requests. When a PR webhook fires, the bot posts a summary in the relevant channel, runs an AI analysis of the diff for bugs and security issues, and lets team members ask follow-up questions in-thread. The bot should work across at least two chat platforms with a single codebase. Include a web dashboard showing review stats. | chat-sdk, ai-sdk, nextjs |
| 06 | content-pipeline | Build a content production pipeline where editors submit article briefs through a web form. Each brief triggers a durable multi-step workflow: research agent gathers sources, writer agent drafts the article, editor agent reviews for quality and suggests revisions, and a final step generates social media posts and an OG image. Each step should be independently retryable and observable. Show workflow progress in a dashboard with step-level status. | workflow, ai-sdk, satori, nextjs, vercel-queues |
| 07 | feature-rollout | Build an internal tool for gradual feature rollouts. Product managers define feature flags with percentage-based rollout rules, user segment targeting, and A/B test variants. The system should read flag state at the edge with near-zero latency. Include an analytics dashboard that tracks conversion rates per variant, and an AI assistant that analyzes experiment results and recommends whether to ship or kill each feature. | vercel-flags, ai-sdk, nextjs, observability |
| 08 | event-driven-crm | Build an event-driven CRM where customer actions (signup, purchase, support ticket, churn signal) flow into a durable event stream. Consumer functions process events to update customer profiles, trigger re-engagement emails, calculate health scores, and feed an AI agent that predicts churn risk. Events must survive infrastructure failures with at-least-once delivery. Show a customer timeline view and health dashboard. | vercel-queues, workflow, ai-sdk, email, nextjs |
| 09 | code-sandbox-tutor | Build an interactive coding tutor where students describe what they want to build in natural language, and an AI agent generates code, executes it in an isolated sandbox environment, shows the output, and iterates based on student feedback. The agent should support multi-file projects, detect runtime errors, and auto-fix them. Include a lesson progress tracker and a gallery of completed projects. | vercel-sandbox, ai-sdk, nextjs, ai-elements |
| 10 | multi-agent-research | Build a research assistant that takes a complex question and spawns multiple specialized sub-agents in parallel — one searches the web, one analyzes uploaded documents, one queries a knowledge base via tool protocol, and an orchestrator agent synthesizes their findings into a structured report with citations. The orchestration must be durable so long-running research survives timeouts. Stream intermediate findings to the UI as each sub-agent reports back. | workflow, ai-sdk, ai-elements, nextjs |
| 11 | discord-game-master | Build an AI game master bot for tabletop RPGs that runs in a chat platform. It maintains persistent game state (character sheets, inventory, world map) across sessions, rolls dice, narrates combat with streaming text, generates scene illustrations on demand, and tracks initiative order. Players interact via chat commands and the bot responds in-thread. Include a web companion app showing the current game state and maps. | chat-sdk, ai-sdk, vercel-storage, nextjs |
| 12 | compliance-auditor | Build a compliance auditing system for a SaaS platform. On a schedule, an AI agent reviews recent code deployments, checks infrastructure configuration against security policies, scans for credential exposure, and generates a compliance report. Findings are routed through a durable approval workflow — critical issues block deploys until resolved, warnings go to a review queue. The web dashboard shows audit history, open findings, and compliance score trends. | workflow, cron-jobs, ai-sdk, vercel-firewall, nextjs |

## UI Design References

| # | Slug | Design Mockup |
|---|------|---------------|
| 01 | doc-qa-agent | ![doc-qa-agent](img-doc-qa-agent-2026-03-07T15-13-35-1.png) |
| 02 | customer-support-agent | ![customer-support-agent](img-customer-support-agent-2026-03-07T15-13-35-1.png) |
| 03 | deploy-monitor | ![deploy-monitor](img-deploy-monitor-2026-03-07T15-13-35-1.png) |
| 04 | multi-model-router | ![multi-model-router](img-multi-model-router-2026-03-07T15-13-35-1.png) |
| 05 | slack-pr-reviewer | ![slack-pr-reviewer](img-slack-pr-reviewer-2026-03-07T15-13-35-1.png) |
| 06 | content-pipeline | ![content-pipeline](img-content-pipeline-2026-03-07T15-13-35-1.png) |
| 07 | feature-rollout | ![feature-rollout](img-feature-rollout-2026-03-07T15-13-35-1.png) |
| 08 | event-driven-crm | ![event-driven-crm](img-event-driven-crm-2026-03-07T15-13-35-1.png) |
| 09 | code-sandbox-tutor | ![code-sandbox-tutor](img-code-sandbox-tutor-2026-03-07T15-13-35-1.png) |
| 10 | multi-agent-research | ![multi-agent-research](img-multi-agent-research-2026-03-07T15-13-35-1.png) |
| 11 | discord-game-master | ![discord-game-master](img-discord-game-master-2026-03-07T15-13-35-1.png) |
| 12 | compliance-auditor | ![compliance-auditor](img-compliance-auditor-2026-03-07T15-13-35-1.png) |

## Complexity Tiers

Use these tiers to select subsets for quick vs. comprehensive runs.

### Tier 1 — Core AI (30-45 min, `--quick`)
Scenarios 01, 04, 09 — exercise AI SDK, Gateway, Sandbox, and AI Elements without durable workflows.

### Tier 2 — Durable Agents (45-60 min)
Scenarios 02, 03, 06, 10 — exercise Workflow DevKit, multi-step durability, and agent orchestration.

### Tier 3 — Platform Integration (45-60 min)
Scenarios 05, 07, 08, 11, 12 — exercise Chat SDK, Queues, Flags, Firewall, and cross-platform messaging.

### Full Suite
All 12 scenarios, ~3-4 hours.

## What This Exercises vs. benchmark-testing

| Capability | benchmark-testing | benchmark-agents |
|-----------|------------------|-----------------|
| Basic CRUD + auth | Heavy | Light |
| AI streaming + chat UI | 1 scenario | 8 scenarios |
| Workflow DevKit (durability) | None | 5 scenarios |
| AI Gateway (multi-model) | None | 3 scenarios |
| Chat SDK (multi-platform bots) | None | 3 scenarios |
| Vercel Queues (event streams) | None | 2 scenarios |
| Vercel Flags (feature flags) | None | 1 scenario |
| Vercel Sandbox (code execution) | None | 1 scenario |
| MCP integration | None | 2 scenarios |
| Multi-agent orchestration | None | 3 scenarios |
| Satori (OG images) | None | 1 scenario |
| Vercel API (programmatic) | None | 1 scenario |

## Cleanup

```bash
rm -rf ~/dev/vercel-plugin-testing
```
