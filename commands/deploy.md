---
description: Deploy the current project to Vercel. Pass "prod" or "production" as argument to deploy to production. Default is preview deployment.
---

# Deploy to Vercel

Deploy the current project to Vercel using the CLI.

## Steps

1. Check if the project is linked to Vercel (`vercel link` status)
2. If not linked, run `vercel link` first
3. Check for uncommitted changes and warn the user

If "$ARGUMENTS" contains "prod" or "production":
- Run `vercel --prod` for a production deployment
- Confirm with the user before deploying to production

Otherwise:
- Run `vercel` for a preview deployment
- Return the preview URL to the user

After deployment, show the deployment URL and suggest checking logs with `vercel logs <url>` if needed.
