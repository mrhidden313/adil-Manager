# General AI Guidelines for AK FLOW

Always read the `ai_brain.txt` file located in the root of the project workspace before starting any work. 

The `ai_brain.txt` file contains critical context, including:
- Tech stack and architectural decisions (e.g., SvelteKit SSR must remain disabled).
- Past security flaws and their patches (e.g., JWT stateless authentication patch).
- Server configuration details (VPS, Nginx, Supabase).

Never revert the critical fixes outlined in `ai_brain.txt`. Always align your implementation plans with the system's documented architecture.

# Deployment & Server Access Constraints

- NEVER use the `ssh` command to access the VPS server directly via the terminal.
- Do NOT attempt to run deployment scripts on the remote server automatically.
- When backend changes are made, provide the user with the exact commands they need to run manually (e.g., `git pull`, `npm install`, `npm run build`, `npx prisma db push`, `pm2 restart backend`).
- The frontend is hosted on Vercel with auto-build enabled, so no frontend deployment commands are necessary.
