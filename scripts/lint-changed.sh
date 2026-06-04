#!/usr/bin/env bash
# Lint only the files changed relative to origin/main — fast feedback on feature branches.
# The full `pnpm lint` still runs on merge to main to catch errors in untouched files.
set -euo pipefail

BASE=$(git merge-base origin/main HEAD)
FILES=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.ts' '*.js' '*.svelte')

if [ -z "$FILES" ]; then
	echo "No changed files to lint"
	exit 0
fi

echo "Linting changed files:"
echo "$FILES" | sed 's/^/  /'

# shellcheck disable=SC2086
eslint $FILES
# shellcheck disable=SC2086
prettier --check $FILES
