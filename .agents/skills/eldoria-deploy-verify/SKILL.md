---
name: eldoria-deploy-verify
description: >-
  Use this skill prior to committing and pushing code changes to main. Runs complete monorepo
  build verification (shared, client, server) to prevent broken deployments on the live VPS.
---

# Eldoria Deploy & Verification Procedure

Pushing to `origin/main` automatically triggers GitHub Actions (`.github/workflows/deploy.yml`), which pulls the repository to `/var/www/eldoria-idle` on the live VPS and executes `pm2 reload eldoria`.

A failed build breaks the live game immediately with a **502 Bad Gateway**.

## Verification Checklist

1. **Clean Workspace Audit**:
   - Check `git status` to ensure only intended changes are staged.
   - Verify that temporary scratch files or database files in `data/` are NOT staged.

2. **Monorepo Build**:
   - Run the full build command across all three workspaces:
     ```bash
     npm run build
     ```
   - Must pass with `exit code 0` across:
     - `@eldoria/shared` (`tsc -b`)
     - `@eldoria/client` (`tsc && vite build`)
     - `@eldoria/server` (`tsc`)

3. **Changelog & Documentation**:
   - If user-facing features or balance tweaks were added, ensure:
     - [AGENTS.md](file:///home/gar/share/browsermmo/AGENTS.md) is updated with new systems/architectural conventions.
     - Changelog entries adhere to clean BBCode specifications per [AGENTS.md Section 3.5](file:///home/gar/share/browsermmo/AGENTS.md#L45-L53).

4. **Git Commit & Push**:
   - Use conventional commit messages: `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`.
   - Push to `origin/main` to trigger the deployment pipeline.
