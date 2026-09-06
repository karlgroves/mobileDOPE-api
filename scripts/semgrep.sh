#!/usr/bin/env bash
#
# SAST gate.
#
# Exists as a script rather than an inline npm command for one reason: semgrep
# exits 7 when it cannot resolve a ruleset, and that is visually indistinguishable
# from a clean scan to anyone skimming output or a CI log. The `p/express`
# ruleset was retired and started returning HTTP 404, so this gate ran ZERO rules
# and reported nothing for an unknown length of time -- worse than failing,
# because "no findings" read as "nothing found" when the truth was "nothing
# looked". See issue #13.
#
# Exit codes, after this wrapper:
#   0  scan ran, no findings
#   1  scan ran, findings (--error turns findings into a failure)
#   2  scan could not run -- config error, reported loudly and distinguishably
set -uo pipefail

# Rulesets. p/express was retired upstream (HTTP 404); p/nodejs is the
# server-side JavaScript successor and covers the Express patterns.
CONFIGS=(
  --config=p/typescript
  --config=p/javascript
  --config=p/nodejsscan
  --config=p/nodejs
  --config=p/owasp-top-ten
  --config=p/secrets
)

# Rules excluded, each for a stated reason. Excluding a rule is a claim that it
# cannot apply here -- not that its findings are inconvenient.
#
# 1. njsscan's `good_helmet_checks` are POSITIVE rules: they fire to report that
#    a security header IS correctly set ("HSTS header is present", "Default
#    X-Powered-By is removed"). They are informational output, and in a gate that
#    treats findings as failures they would fail the build for doing the right
#    thing.
#
# 2. `node_nosqli_injection` is a MongoDB rule. It matches any `findOne()` call
#    reached by request data, but this application is Sequelize on MySQL, where a
#    `where` object is parameterised, not interpolated into a query string.
#    Sequelize 6 also disables operator aliases by default, so a string key like
#    "$ne" arriving in a JSON body is not interpreted as an operator. Genuine SQL
#    injection is still covered by p/typescript, p/javascript and p/owasp-top-ten.
EXCLUDES=(
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_dns_prefetch
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_hsts
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_ienoopen
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_nosniff
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_x_powered_by
  --exclude-rule=ajinabraham.njsscan.good.good_helmet_checks.helmet_header_xss_filter
  --exclude-rule=ajinabraham.njsscan.database.nosql_find_injection.node_nosqli_injection
)

semgrep "${CONFIGS[@]}" "${EXCLUDES[@]}" --error --metrics=off "$@"
status=$?

if [ "$status" -ge 2 ]; then
  echo
  echo "############################################################"
  echo "# SEMGREP DID NOT RUN (exit ${status}) -- THIS IS NOT A CLEAN SCAN"
  echo "#"
  echo "# A non-zero exit of 2 or more is a configuration or internal"
  echo "# error, not a findings result. No rules were evaluated, so"
  echo "# the absence of findings above means nothing."
  echo "#"
  echo "# Exit 7 specifically means a ruleset failed to resolve --"
  echo "# usually retired or renamed upstream. Check each --config"
  echo "# URL: https://semgrep.dev/c/p/<name> should return 200."
  echo "############################################################"
  exit 2
fi

exit "$status"
