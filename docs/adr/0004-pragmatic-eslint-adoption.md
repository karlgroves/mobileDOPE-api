# 4. Pragmatic ESLint adoption: noisy rules start as warnings

## Status

Accepted

## Context

Issue #2 specifies an aggressive ESLint configuration: `typescript-eslint`
`strictTypeChecked` + `stylisticTypeChecked`, plus `sonarjs`, `unicorn`, `jsdoc`
(required on all exports), `@typescript-eslint/naming-convention`, and file/function
size and complexity caps.

Enabling all of these as errors against the existing 26-file codebase surfaces
several hundred findings. Many require either subjective judgement (documentation,
naming) or behaviour-sensitive code changes (for example `||` → `??`, which differs
for falsy values such as `0` and `''`). Both issues also instruct: "Do NOT change
existing code logic or functionality."

## Decision

Adopt the full backend plugin set, but split rule severity pragmatically:

- **`error`** — safe, auto-fixable, or unambiguously correct rules
  (`no-floating-promises`, `consistent-type-imports`, `import-x/order`,
  `prefer-const`, `no-var`, `eqeqeq`, the deterministic `security/detect-*` rules,
  `promise/*`, `no-secrets/no-secrets`).
- **`warn`** — noisy, subjective, or behaviour-sensitive rules
  (`prefer-nullish-coalescing`, `restrict-template-expressions`,
  `no-unnecessary-*`, `explicit-*-types`, `jsdoc/*`, `sonarjs/cognitive-complexity`,
  `max-lines*`, `complexity`). These are surfaced for incremental cleanup and can be
  promoted to `error` in follow-up PRs.

`@typescript-eslint/naming-convention` (issue #3) is enforced as **`error`** and
tuned to this project's conventions: property-like identifiers and destructured
names are exempt from camelCase, because the API's data contract (DB columns,
request/response bodies, Sequelize model fields, query params) uses snake-case
naming end to end. The handful of query-param locals that were plain
`const x = req.query.x` casts were converted to the (exempt) destructuring form
already used elsewhere in the controllers, and one private static method was given
a leading-underscore prefix per the rule.

`exactOptionalPropertyTypes` from #2's foundations is **deferred** (not enabled) to
avoid widespread type churn; `noImplicitOverride` was added and its findings fixed.

## Consequences

- `npm run lint` passes with **0 errors** today; remaining findings are warnings.
- The lint gate is real (errors block) without forcing risky bulk edits.
- Follow-up issues can tighten specific `warn` rules to `error` as code is cleaned.
