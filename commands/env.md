---
description: Manage Vercel environment variables. Commands include list, pull, add, remove. Use to sync environment variables between Vercel and your local development environment.
---

# Vercel Environment Variables

Manage environment variables for the current Vercel project.

## Actions

Based on "$ARGUMENTS":

### "list" or "ls" or no arguments
- Run `vercel env ls` to show all environment variables

### "pull"
- Run `vercel env pull` to download env vars to `.env.local`
- For production: `vercel env pull .env.production.local --environment=production`

### "add <NAME>"
- Run `vercel env add <NAME>` and guide the user through setting the value
- Ask which environments (production, preview, development)

### "rm <NAME>" or "remove <NAME>"
- Run `vercel env rm <NAME>` with confirmation

Always remind the user to add `.env*.local` to `.gitignore` to avoid committing secrets.
