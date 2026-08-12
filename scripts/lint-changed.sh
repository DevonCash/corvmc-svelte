#!/usr/bin/env bash
# Lint only the files changed relative to origin/main — fast feedback on feature branches.
# The full `pnpm lint` still runs on merge to main to catch errors in untouched files.
set -euo pipefail

BASE=$(git merge-base origin/main HEAD)

# ESLint only understands the code globs.
CODE=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.ts' '*.js' '*.svelte')

# Prettier formats far more than that. Checking only the code globs here let an
# unformatted .md through a green PR and turned `Lint (full)` red on main right
# after the merge, which is the one place nobody is watching for it.
FORMATTABLE=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- \
	'*.ts' '*.js' '*.svelte' '*.md' '*.json' '*.css' '*.html' '*.yml' '*.yaml')

if [ -z "$CODE" ] && [ -z "$FORMATTABLE" ]; then
	echo "No changed files to lint"
	exit 0
fi

if [ -n "$CODE" ]; then
	echo "Linting changed files:"
	echo "$CODE" | sed 's/^/  /'
	# shellcheck disable=SC2086
	eslint $CODE
fi

if [ -n "$FORMATTABLE" ]; then
	echo "Checking formatting:"
	echo "$FORMATTABLE" | sed 's/^/  /'
	# Deleted-then-recreated paths and files ignored by .prettierignore are fine;
	# --no-error-on-unmatched-pattern keeps those from failing the run.
	# shellcheck disable=SC2086
	prettier --check --no-error-on-unmatched-pattern $FORMATTABLE
fi
