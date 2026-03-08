# vercel-plugin Development Guide

## Quick Reference

- **Build hooks**: `bun run build:hooks` (compiles `hooks/src/*.mts` → `hooks/*.mjs`)
- **Build all**: `bun run build` (hooks + manifest)
- **Test**: `bun test` (runs all tests across 20 files)
- **Single test file**: `bun test tests/<file>.test.ts`
- **Validate skills**: `bun run scripts/validate.ts`

## Architecture

### Skill Injection Pipeline

Hook source lives in `hooks/src/*.mts` (TypeScript) and compiles to `hooks/*.mjs` (ESM, committed).
Run `bun run build:hooks` after editing any `.mts` file. A pre-commit hook auto-compiles when `.mts` files are staged.

1. `session-start-seen-skills.mjs` — runs on SessionStart, exports `VERCEL_PLUGIN_SEEN_SKILLS=""` into `CLAUDE_ENV_FILE`
2. `session-start-profiler.mts` → `.mjs` — runs on SessionStart, scans config files and package deps to pre-prime `VERCEL_PLUGIN_LIKELY_SKILLS`
3. `inject-claude-md.mts` → `.mjs` — injects `vercel.md` ecosystem graph into session context
4. `pretooluse-skill-inject.mts` → `.mjs` — PreToolUse hook, matches tool calls to skills and injects SKILL.md content
5. `skill-map-frontmatter.mts` → `.mjs` — parses SKILL.md frontmatter into the skill map
6. `patterns.mts` → `.mjs` — glob-to-regex conversion and seen-skills env var helpers
7. `vercel-config.mts` → `.mjs` — vercel.json key-aware skill routing
8. `logger.mts` → `.mjs` — structured log levels (off/summary/debug/trace)

Hook output is type-checked against `SyncHookJSONOutput` from `@anthropic-ai/claude-agent-sdk` to prevent schema violations (Claude Code rejects unknown fields in `hookSpecificOutput`).

### Dedup Contract (Canonical)

Deduplication prevents the same skill from being injected twice in a session.

**Mechanism**: Atomic per-skill claim files + session file snapshot + env var fallback

- **Claim dir**: `<tmpdir>/vercel-plugin-<sessionId>-seen-skills.d/` — one empty file per claimed skill, created atomically with `openSync(path, "wx")` (O_EXCL). First process wins; concurrent processes get `EEXIST` and skip.
- **Session file**: `<tmpdir>/vercel-plugin-<sessionId>-seen-skills.txt` — derived comma-delimited snapshot, synced from claim dir after each successful claim. Used for debug and fast reads.
- **Initialization**: `session-start-seen-skills.mjs` appends `export VERCEL_PLUGIN_SEEN_SKILLS=""` to `CLAUDE_ENV_FILE`
- **State merge**: `mergeSeenSkillStates(envValue, fileValue, claimValue)` in `patterns.mjs` unions all sources
- **Cleanup**: `session-end-cleanup.mjs` (SessionEnd hook) deletes temp files AND claim directories
- **Shared across hooks**: Both `pretooluse-skill-inject.mjs` and `user-prompt-submit-skill-inject.mjs` use the same claim backend
- **Strategy detection** (debug mode):
  - `"file"` — `session_id` is present; atomic claims prevent parallel race conditions
  - `"env-var"` — no `session_id` but `VERCEL_PLUGIN_SEEN_SKILLS` is set (fallback)
  - `"memory-only"` — neither available; dedup only works within a single invocation
  - `"disabled"` — `VERCEL_PLUGIN_HOOK_DEDUP=off`

### YAML Parser

The project uses an inline YAML parser (`parseSimpleYaml` in `skill-map-frontmatter.mjs`), not js-yaml. Key differences from js-yaml:

- Bare `null` is parsed as the string `"null"`, not JavaScript `null`
- Bare `true`/`false` are parsed as strings `"true"`/`"false"`, not booleans
- Unclosed brackets `[` are treated as scalar strings, not parse errors
- Tab indentation triggers an explicit error

### Temp Dir Tests

Tests that create temporary plugin directories must copy all hook modules:
- `pretooluse-skill-inject.mjs`
- `skill-map-frontmatter.mjs`
- `patterns.mjs`
- `vercel-config.mjs`
- `logger.mjs`
- `session-start-profiler.mjs`
- `inject-claude-md.mjs`

### Log Levels

Set `VERCEL_PLUGIN_LOG_LEVEL` to control hook output verbosity (default: `off`):

- **off** — no output (preserves existing behavior for users)
- **summary** — outcome + latency + issues only
- **debug** — adds match reasons, dedup info, skill map stats
- **trace** — adds per-pattern evaluation details

Legacy: `VERCEL_PLUGIN_DEBUG=1` or `VERCEL_PLUGIN_HOOK_DEBUG=1` maps to `debug` level. Explicit `LOG_LEVEL` takes precedence over legacy flags.
