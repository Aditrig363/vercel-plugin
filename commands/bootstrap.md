---
description: Bootstrap a repository with Vercel-linked resources by running preflight checks, provisioning integrations, verifying env keys, and then executing db/dev startup commands safely.
---

# Vercel Project Bootstrap

Run a deterministic bootstrap flow for new or partially configured repositories.

## Preflight

1. Confirm `vercel` CLI is installed and authenticated.

```bash
vercel --version
vercel whoami
```

2. Confirm the repository is linked by checking `.vercel/project.json`.
3. If unlinked, inspect teams and projects before asking the user which target to use, then link non-interactively.

```bash
vercel teams ls
vercel projects ls --scope <team>
vercel link --yes --scope <team> --project <project>
```

4. Detect env template source in this order: `.env.example`, `.env.sample`, `.env.template`.
5. Detect package manager and available scripts (`db:push`, `db:seed`, `db:migrate`, `db:generate`, `dev`) from `package.json`.
6. Inspect auth/database signals (`prisma/schema.prisma`, `drizzle.config.*`, `auth.*`, `src/**/auth.*`) to scope bootstrap details.

Stop with clear guidance if CLI auth or linkage fails.

## Plan

Execute in this order:

1. Preflight validation and project linking.
2. Resource provisioning (prefer Vercel-managed Neon integration).
3. Secret/bootstrap env setup (`AUTH_SECRET`, env pull, key verification).
4. Application bootstrap (`db:*` then `dev`) only after env checks pass.

Prefer MCP reads + Vercel CLI writes. Never print secret values. If fallback provider CLI provisioning is needed, state why and request user confirmation first.

## Commands

### 1. Link + local env template

Copy the first matching template file only if `.env.local` does not exist:

```bash
cp .env.example .env.local
```

If `.env.example` is absent, use `.env.sample` or `.env.template`.

### 2. Provision Postgres (preferred)

```bash
vercel integration guide neon
vercel integration add neon --scope <team>
vercel env ls
vercel env pull .env.local --yes
```

Fallbacks:

1. Vercel dashboard integration flow, then `vercel env pull .env.local --yes`.
2. Neon CLI provisioning (last resort), then add env vars to Vercel and pull locally.

### 3. Generate and store `AUTH_SECRET`

```bash
AUTH_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"
printf "%s" "$AUTH_SECRET" | vercel env add AUTH_SECRET development preview production
unset AUTH_SECRET
vercel env pull .env.local --yes
```

Never echo the secret value.

### 4. Verify required env keys

Compare required keys from template against `.env.local` key names:

```bash
template_file=""
for candidate in .env.example .env.sample .env.template; do
  if [ -f "$candidate" ]; then
    template_file="$candidate"
    break
  fi
done

comm -23 \
  <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$template_file" | cut -d '=' -f 1 | sort -u) \
  <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local | cut -d '=' -f 1 | sort -u)
```

Do not continue if any required keys are missing.

### 5. Run app bootstrap commands (after verification)

Use the repository package manager and only scripts that exist:

```bash
npm run db:push
npm run db:seed
npm run dev
```

Equivalent `pnpm`, `bun`, or `yarn` commands are valid.

## Verification

Confirm each checkpoint:

- `vercel whoami` succeeds.
- `.vercel/project.json` exists and matches chosen project.
- Postgres integration path completed (Vercel integration, dashboard, or provider CLI fallback).
- `vercel env pull .env.local --yes` succeeds.
- Required env key diff is empty.
- Database command status is recorded (`db:push`, `db:seed`, `db:migrate`, `db:generate` as applicable).
- `dev` command starts without immediate config/auth/env failure.

If verification fails, stop and report exact failing step plus remediation.

## Summary

Report results in this format:

```md
## Bootstrap Result
- **Linked Project**: <team>/<project>
- **Resource Path**: vercel-integration-neon | dashboard-neon | neon-cli
- **Env Keys**: <count> required, <count> present, <count> missing
- **Secrets**: AUTH_SECRET set in Vercel (value never shown)
- **Migration Status**: not-run | success | failed (<step>)
- **Dev Result**: not-run | started | failed
```

## Next Steps

- If env keys are still missing, add the missing keys in Vercel and re-run `vercel env pull .env.local --yes`.
- If DB commands fail, fix connectivity/schema issues and re-run only the failed db step.
- If `dev` fails, resolve runtime errors, then restart with your package manager's `run dev`.
