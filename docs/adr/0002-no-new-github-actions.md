# 2. Local-gate-first; no new GitHub Actions, Dependabot, or CodeQL

## Status

Accepted

## Context

Issues #1 and #2 ask for several GitHub-side automations: a CI workflow, a
scheduled security workflow (CodeQL, OWASP Dependency-Check, license checks), and
a Dependabot configuration.

However, the maintainer recently and deliberately removed these from this
repository. The `develop` history includes the commits "Disable CodeQL and
Dependabot" and "chore(ci): disable CodeQL, Dependabot, scheduled actions; add PR
check workflow". A lightweight `.github/workflows/pr-check.yml` was kept in their
place.

Issue #2 also explicitly states a preference: "Prefer local gates (Husky hooks)
over GitHub Actions where possible to shorten the feedback loop and reduce Actions
minutes."

## Decision

Honor the maintainer's decision and issue #2's stated preference:

- Do **not** add new GitHub Actions workflows, and do **not** re-enable CodeQL,
  scheduled OWASP/ZAP scans, or Dependabot.
- Move enforcement to local Husky gates instead (`pre-commit`, `commit-msg`,
  `pre-push`, `post-merge`). Linting, type-checking, duplication detection, commit
  message validation, and secret scanning all run locally.
- Keep the existing `.github/workflows/pr-check.yml` untouched as the safety net.

## Consequences

- Quality enforcement depends on contributors having hooks installed
  (`npm install` runs `prepare` → `husky`).
- The acceptance-criteria items in #1/#2 that name specific workflows are satisfied
  via local equivalents rather than Actions. Re-adding Dependabot/CodeQL later is a
  one-file change if the maintainer reverses the earlier decision.
