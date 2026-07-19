# 3. Frontend-only tooling is out of scope for this backend

## Status

Accepted

## Context

Issues #1 and #2 describe a tooling stack aimed at full-stack / React projects.
This repository is a Node/Express/Sequelize REST API written in TypeScript. It
renders no UI, ships no React components, and contains no CSS/SCSS files.

## Decision

Adopt only the backend-relevant portions of the standardization. The following
items from #1/#2 are intentionally **not applicable** and are omitted:

- React plugins: `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh`.
- Accessibility: `eslint-plugin-jsx-a11y`, `@afix/a11y-assert` (component, E2E,
  and preview levels), Stylelint a11y rules.
- CSS quality: Stylelint and `@double-great/stylelint-a11y` (no CSS files exist).
- Performance/SEO: Lighthouse CI, `size-limit`, `web-vitals`, React Compiler,
  `react-helmet-async`, `schema-dts`, sitemap/`robots.txt`/`llms.txt`.
- Playwright E2E (no browser surface to drive).

## Consequences

- The ESLint config (`eslint.config.mjs`) carries the backend plugin set only:
  `security`, `sonarjs`, `unicorn`, `import-x`, `promise`, `n`, `jsdoc`,
  `no-secrets`, plus `typescript-eslint`.
- If a web frontend is added to this repo later, revisit and layer in the frontend
  tooling at that time.
