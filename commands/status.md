---
description: Show the status of the current Vercel project — recent deployments, linked project info, and environment overview.
---

# Vercel Project Status

Show a comprehensive status overview of the current Vercel project.

## Steps

1. Run `vercel ls` to show recent deployments (last 5)
2. Run `vercel inspect` on the latest deployment to show details
3. Run `vercel env ls` to show environment variable overview
4. Check for `vercel.json` configuration and summarize key settings

Present the information in a clean, readable format:
- Latest deployment URL and status
- Environment variable count per environment
- Any configured cron jobs
- Function configuration (if custom)
