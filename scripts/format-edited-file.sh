#!/usr/bin/env bash
# Claude Code PostToolUse hook: auto-format and lint-fix the single file just edited.
# Reads the hook payload as JSON on stdin and acts on .tool_input.file_path.
# Warn-only: prettier/eslint --fix run on the one file; remaining lint issues are
# printed but never fail the tool call (always exit 0). svelte-check is intentionally
# NOT run here — it is whole-project and too slow for per-edit feedback.

PAYLOAD=$(cat)
FILE=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty')

# Nothing to do if no path or the file no longer exists.
[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

# Only handle the source types eslint/prettier are configured for (mirrors scripts/lint-changed.sh).
case "$FILE" in
	*.ts | *.js | *.svelte) ;;
	*) exit 0 ;;
esac

# Format first, then lint-fix. Surface output so the model sees remaining warnings.
pnpm exec prettier --write "$FILE" 2>&1 || true
pnpm exec eslint --fix "$FILE" 2>&1 || true

exit 0
