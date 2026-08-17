---
name: worktree-dev
description: Set up and run the dev server, Storybook, or the browser preview from inside a git worktree under .claude/worktrees/. Use when a worktree has no node_modules or no .env, when the dev server won't boot from a worktree, or when :5173 seems to belong to someone else.
---

# Running a dev server from a worktree

A fresh worktree under `.claude/worktrees/` has **no `node_modules`, no `.env`, and no
`.dev.vars`** — `git worktree add` copies tracked files only. Set those up before anything will
boot.

## Setup

1. **Dependencies.** Symlink rather than reinstalling:

   ```bash
   ln -s ../../../node_modules node_modules
   ```

   Vite already tolerates this: `vite.config.ts` passes
   `fs.realpathSync(path.resolve(dirname, 'node_modules'))` to `server.fs.allow`. Without that
   entry a symlinked `node_modules` 403s, which breaks hydration and the `client` vitest project
   in ways that look like application bugs.

2. **Secrets.** Copy `.env` and `.dev.vars` from the main checkout — **copy, don't symlink**.
   Editing through a symlink writes into the main checkout and leaks into every other worktree.
   Restore the original if you replaced one.

3. **Port.** `:5173` may already belong to a different worktree's server. Check first:

   ```bash
   ps aux | grep '[v]ite'
   ```

   Give yours its own port and a matching `ORIGIN` — a mismatched `ORIGIN` fails auth and Sentry
   gating rather than erroring cleanly.

4. **Launch.** Use `preview_start` with a name from `.claude/launch.json` (`dev`, `preview`, or
   `storybook`). Never run a dev server through Bash.

## Live Stripe key

The shared `.env` carries a live `rk_live` key. Do not exercise Stripe-touching flows in local QA:
checkout, cash-received, full-credit settle, refunds.

## Browser pane auth

The Browser pane keeps its own cookie jar — it is not your Chrome, and restarting the preview
discards its session. Anything that needs a logged-in user belongs in a Playwright e2e test, not
in a manual pane click-through.
