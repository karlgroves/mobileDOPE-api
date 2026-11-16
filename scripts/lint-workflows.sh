#!/usr/bin/env bash
#
# Lint the GitHub Actions workflows locally (npm run lint:workflows).
#
# The `validate-workflows` job in .github/workflows/pr-check.yml checks the same
# files, but only on GitHub: it YAML-parses each workflow and greps for `on:` and
# `jobs:`. actionlint is strictly stronger -- it parses the YAML, rejects a
# workflow with no trigger or no jobs, type-checks expressions, `needs:` and
# action inputs, and runs shellcheck over every `run:` block when shellcheck is
# installed. See issue #35.
#
# Exit codes:
#   0  every workflow passed
#   1  actionlint reported findings
#   2  the check could not run (actionlint not installed) -- NOT a clean result
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

if ! command -v actionlint >/dev/null 2>&1; then
  echo "actionlint is not installed, so NO workflow was checked." >&2
  echo "Install it with 'bash scripts/bootstrap.sh' or 'brew install actionlint'." >&2
  exit 2
fi

shopt -s nullglob
workflows=(.github/workflows/*.yml .github/workflows/*.yaml)
shopt -u nullglob

if [ "${#workflows[@]}" -eq 0 ]; then
  echo "No workflow files under .github/workflows -- nothing to lint."
  exit 0
fi

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "note: shellcheck is not installed; run: blocks are not being linted." >&2
fi

actionlint "$@" "${workflows[@]}"
status=$?
if [ "$status" -eq 1 ]; then
  exit 1
elif [ "$status" -ne 0 ]; then
  # actionlint exits 2 for bad arguments and 3 for a fatal error.
  echo "actionlint could not run (exit ${status}) -- this is NOT a clean result." >&2
  exit 2
fi
echo "actionlint: ${#workflows[@]} workflow file(s) passed."
