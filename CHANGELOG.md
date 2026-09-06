# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-06

The first release since `v1.0.0`. It is almost entirely repair work: three separate defects meant
this API had never run end-to-end against a working database, and four of its five quality gates were
reporting success while checking nothing.

### Fixed

- **The database schema could not be loaded by any MySQL.** `database/init/001-schema.sql` aborted at
  its first table, so `docker compose up db` — step one of the README — never produced a running
  database. Three defects had accumulated behind that, each visible only once the one ahead of it was
  fixed:
  - `users.uuid` was a `STORED` generated column derived from the `AUTO_INCREMENT` `id`, which MySQL
    forbids (`ERROR 3109`). It could not have worked regardless: `HEX()` of a 64-bit integer yields at
    most 16 hex digits where a UUID needs 32. It is now a random v4 built from `RANDOM_BYTES`, unique,
    and no longer derived from — or reversible to — the primary key.
  - `community_ammo.submitted_by` was `NOT NULL` under an `ON DELETE SET NULL` foreign key
    (`ERROR 1830`). Now nullable, so a crowdsourced submission outlives its submitter's account.
  - `users.token_version` was declared in the model and absent from the schema, so every query
    against the table failed. (#19)
- **Every model attribute read as `undefined` at runtime.** Public class fields compiled under
  `target: ES2022` shadowed Sequelize's prototype getters — 87 of them across five models. Both auth
  guards were silently inoperative: `!user.is_active` was always `true`, and
  `payload.tokenVersion < user.token_version` was always `false`, so **JWT revocation never fired**.
  Fixed with the `declare` modifier. (#23)
- **Model associations were never registered.** Nothing imported `src/models/index.ts`, the module
  that defines every `hasMany` inverse, so `User.associations` was empty and any query using
  `include` would have failed. (#20)
- Cleared both High production advisories: `mysql2` auth-plugin downgrade leaking plaintext
  credentials ([GHSA-3f6p-5ww8-9rcr]) and the `brace-expansion` DoS trio. (#17)
- Drove `npm run security:osv` from 65 known vulnerabilities to **zero**, with no accepted exceptions
  — every advisory had a fix available. (#14)

### Changed

- **The PR gate now gates.** Every substantive step in `pr-check.yml` carried
  `continue-on-error: true`, so the job reported success no matter what happened. Install, lint and
  test are now blocking, and typecheck, build and the production security audit were added. (#16)
- **The SAST gate now runs rules.** `npm run security:semgrep` exited 7 and evaluated **zero** rules
  because the `p/express` ruleset had been retired upstream. Replaced with `p/nodejs`; a wrapper now
  makes a configuration error loudly distinguishable from a clean scan. Rules run: 0 → 255. (#13)
- GitHub Actions pinned to immutable commit SHAs rather than mutable tags.
- `.npmrc` sets `min-release-age=7`, quarantining newly published versions during resolution.
  `npm ci` is unaffected.
- Node floor confirmed at `^24.15.0 || >=26.0.0`, with the lockfile's mirrored `engines` kept in step
  and the floor guard no longer validating itself. (#8)

### Added

- [Knip](https://knip.dev) for unused files, exports and dependencies, wired into `npm run check`.
  (#20)
- `npm run lint:ci`, holding the ESLint warning count at a ceiling so the gate is meaningful without
  a mass cleanup first.
- Three test suites that need no database and would have caught the defects above:
  `schema-integrity`, `model-attribute-access`, and the extended `node-engine-floor`. Test count:
  0 → 25.

### Removed

- 16 unused dependencies. `mysql2` and `tsconfig-paths` were flagged too but retained — the first is
  resolved by Sequelize at runtime, the second by ts-node via `tsconfig.json`. (#20)
- `syncDatabase()`, which was unused and would have silently mutated a live database away from the
  committed schema.

### Security

Every gate is green as of this release: `security:audit` 0, `security:osv` 0, `security:semgrep` 0
findings across 255 rules, `gitleaks` clean, `license:check` clean.

[GHSA-3f6p-5ww8-9rcr]: https://github.com/advisories/GHSA-3f6p-5ww8-9rcr

## [1.0.0] - 2026-07-20

Initial tagged release.

[1.1.0]: https://github.com/karlgroves/mobileDOPE-api/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/karlgroves/mobileDOPE-api/releases/tag/v1.0.0
