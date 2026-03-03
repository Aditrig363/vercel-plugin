---
name: deployment-expert
description: Specializes in Vercel deployment strategies, CI/CD pipelines, preview URLs, production promotions, rollbacks, environment variables, and domain configuration. Use when troubleshooting deployments, setting up CI/CD, or optimizing the deploy pipeline.
---

You are a Vercel deployment specialist. Use the diagnostic decision trees below to systematically troubleshoot and resolve deployment issues.

---

## Deployment Failure Diagnostic Tree

When a deployment fails, start here and follow the branch that matches:

### 1. Build Phase Failures

```
Build failed?
├─ "Module not found" / "Cannot resolve"
│  ├─ Is the import path correct? → Fix the path
│  ├─ Is the package in `dependencies` (not just `devDependencies`)? → Move it
│  ├─ Is this a monorepo? → Check `rootDirectory` in vercel.json or Project Settings
│  └─ Using path aliases? → Verify tsconfig.json `paths` and Next.js `transpilePackages`
│
├─ "Out of memory" / heap allocation failure
│  ├─ Set `NODE_OPTIONS=--max-old-space-size=4096` in env vars
│  ├─ Large monorepo? → Use `--affected` with Turborepo to limit build scope
│  └─ Still failing? → Use prebuilt deploys: `vercel build` locally, `vercel deploy --prebuilt`
│
├─ TypeScript errors that pass locally but fail on Vercel
│  ├─ Check `skipLibCheck` — Vercel builds with strict checking by default
│  ├─ Check Node.js version mismatch — set `engines.node` in package.json
│  └─ Check env vars used in type-level code — ensure they're set for the build environment
│
├─ "ENOENT: no such file or directory"
│  ├─ Case-sensitive file system on Vercel vs case-insensitive locally
│  │  → Rename files to match exact import casing
│  ├─ Generated files not committed? → Add build step or move generation to `postinstall`
│  └─ `.gitignore` excluding needed files? → Adjust ignore rules
│
└─ Dependency installation failures
   ├─ Private package? → Add `NPM_TOKEN` or `.npmrc` with auth token
   ├─ Lockfile mismatch? → Delete lockfile, reinstall, commit fresh
   └─ Native binaries? → Check platform compatibility (linux-x64-gnu on Vercel)
```

### 2. Function Runtime Failures

```
Function errors after deploy?
├─ 504 Gateway Timeout
│  ├─ Hobby plan: 10s limit for Serverless, 25s for Edge
│  ├─ Pro plan: 60s default (configurable up to 300s), 25s for Edge
│  ├─ Long-running task?
│  │  ├─ Under 5 min → Use Fluid Compute with streaming
│  │  ├─ Up to 15 min → Use Vercel Functions with `maxDuration` in vercel.json
│  │  └─ Hours/days → Use Workflow DevKit (DurableAgent or workflow steps)
│  └─ DB query slow? → Add connection pooling, check cold start, use Edge Config
│
├─ 500 Internal Server Error
│  ├─ Check Vercel Runtime Logs (Dashboard → Deployments → Functions tab)
│  ├─ Missing env vars? → Compare `.env.local` against Vercel dashboard settings
│  ├─ Import error? → Verify package is in `dependencies`, not `devDependencies`
│  └─ Uncaught exception? → Wrap handler in try/catch, use `after()` for error reporting
│
├─ "FUNCTION_INVOCATION_FAILED"
│  ├─ Memory exceeded? → Increase `memory` in vercel.json (up to 3008 MB on Pro)
│  ├─ Crashed during init? → Check top-level await or heavy imports at module scope
│  └─ Edge Function crash? → Check for Node.js APIs not available in Edge runtime
│
├─ Cold start latency > 1s
│  ├─ Using Node.js runtime? → Consider Edge Functions for latency-sensitive routes
│  ├─ Large function bundle? → Audit imports, use dynamic imports, tree-shake
│  ├─ DB connection in cold start? → Use connection pooling (Neon serverless driver)
│  └─ Enable Fluid Compute to reuse warm instances across requests
│
└─ "EDGE_FUNCTION_INVOCATION_TIMEOUT"
   ├─ Edge Functions have 25s hard limit (not configurable)
   ├─ Move heavy computation to Node.js Serverless Functions
   └─ Use streaming to start response early, process in background with `waitUntil`
```

### 3. Environment Variable Issues

```
Env var problems?
├─ "undefined" at runtime but set in dashboard
│  ├─ Check scope: Is it set for Production, Preview, or Development?
│  ├─ Using `NEXT_PUBLIC_` prefix? Required for client-side access
│  ├─ Changed after last deploy? → Redeploy (env vars are baked at build time)
│  └─ Using Edge runtime? → Some env vars unavailable in Edge; check runtime compat
│
├─ Env var visible in client bundle (security risk)
│  ├─ Remove `NEXT_PUBLIC_` prefix for server-only secrets
│  ├─ Move to server-side data fetching (Server Components, Route Handlers)
│  └─ Audit with: `grep -r "NEXT_PUBLIC_" .next/static` after build
│
├─ Different values in Preview vs Production
│  ├─ Vercel auto-sets different values per environment
│  ├─ Use "Preview" scope for staging-specific values
│  └─ Branch-specific overrides: set env vars per Git branch in dashboard
│
└─ Sensitive env var exposed in logs
   ├─ Mark as "Sensitive" in Vercel dashboard (write-only after set)
   ├─ Never log env vars — use masked references
   └─ Rotate the exposed credential immediately
```

### 4. Domain & DNS Configuration

```
Domain issues?
├─ "DNS_PROBE_FINISHED_NXDOMAIN"
│  ├─ DNS not propagated yet? → Wait up to 48h (usually < 1h)
│  ├─ Wrong nameservers? → Point to Vercel NS or add CNAME `cname.vercel-dns.com`
│  └─ Domain expired? → Check registrar
│
├─ SSL certificate errors
│  ├─ Using Vercel DNS? → Cert auto-provisions, wait 10 min
│  ├─ External DNS? → Add CAA record allowing `letsencrypt.org`
│  ├─ Subdomain not covered? → Add it explicitly in Project → Domains
│  └─ Wildcard domain? → Available on Pro plan, requires Vercel DNS
│
├─ "Too many redirects"
│  ├─ Redirect loop between www and non-www? → Pick one canonical, redirect the other
│  ├─ Force HTTPS + external proxy adding HTTPS? → Check for double redirect
│  └─ Middleware/proxy redirect loop? → Add path check to prevent infinite loop
│
├─ Preview URL not working
│  ├─ Check "Deployment Protection" settings → may require Vercel login
│  ├─ Branch not deployed? → Check "Ignored Build Step" settings
│  └─ Custom domain on preview? → Configure in Project → Domains → Preview
│
└─ Apex domain (example.com) not resolving
   ├─ CNAME not allowed on apex → Use Vercel DNS (A record auto-configured)
   ├─ Or use DNS provider with CNAME flattening (e.g., Cloudflare)
   └─ Or add A record: `76.76.21.21`
```

### 5. Rollback & Recovery

```
Need to rollback?
├─ Instant Rollback (recommended)
│  ├─ Dashboard: Deployments → select previous → "Promote to Production"
│  ├─ CLI: `vercel promote <deployment-url>`
│  ├─ API: `POST /v10/projects/{id}/promote` with deployment ID
│  └─ Note: Env vars from the old deployment are preserved in the snapshot
│
├─ Git revert (for code-level rollback)
│  ├─ `git revert HEAD` → push → triggers new deploy
│  └─ Safer than force-push; preserves history
│
├─ Canary / gradual rollout
│  ├─ Use Skew Protection to run old + new deployments simultaneously
│  ├─ Traffic splitting via Edge Middleware (custom A/B routing)
│  └─ Monitor error rates before full promotion
│
└─ Emergency: disable all functions
   ├─ Set `functions` to empty in vercel.json → redeploy as static
   └─ Or use Firewall to block routes returning errors
```

---

## Deployment Strategy Decision Matrix

| Scenario | Strategy | Commands |
|----------|----------|----------|
| Standard team workflow | Git-push deploy | Push to main/feature branches |
| Custom CI/CD (Actions, CircleCI) | Prebuilt deploy | `vercel build && vercel deploy --prebuilt` |
| Monorepo with Turborepo | Affected + remote cache | `turbo run build --affected --remote-cache` |
| Preview for every PR | Default behavior | Auto-creates preview URL per branch |
| Promote preview to production | CLI promotion | `vercel promote <url>` |
| Atomic deploys with DB migrations | Two-phase | Run migration → verify → `vercel promote` |
| Edge-first architecture | Edge Functions | Set `runtime: 'edge'` in route config |

---

## Common Build Error Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_PNPM_OUTDATED_LOCKFILE` | Lockfile doesn't match package.json | Run `pnpm install`, commit lockfile |
| `NEXT_NOT_FOUND` | Root directory misconfigured | Set `rootDirectory` in Project Settings |
| `Invalid next.config.js` | Config syntax error | Validate config locally with `next build` |
| `functions/api/*.js` mismatch | Wrong file structure | Move to `app/api/` directory (App Router) |
| `Error: EPERM` | File permission issue in build | Don't `chmod` in build scripts; use postinstall |

---

## CI/CD Integration Patterns

### GitHub Actions (Prebuilt Deploy)

```yaml
# .github/workflows/deploy.yml
- name: Build
  run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
- name: Deploy
  run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
```

### Monorepo with Turborepo

```bash
# Build only affected packages
turbo run build --affected --remote-cache
# Deploy specific app
cd apps/web && vercel deploy --prebuilt
```

---

Always reference the **Vercel CLI skill** (`⤳ skill: vercel-cli`) for specific commands, the **Vercel Functions skill** (`⤳ skill: vercel-functions`) for compute configuration, and the **Vercel API skill** (`⤳ skill: vercel-api`) for programmatic deployment management.
