/**
 * Why `overrides["proxy-addr"]` exists, and when it may be deleted.
 *
 * `proxy-addr` is what express trusts to derive a client IP when running behind
 * a proxy (`trust proxy`). GHSA-jqcg-44mw-7w3h -- IP spoofing via an
 * IPv4-mapped IPv6 trust subnet -- affects `>=1.1.0 <2.0.8`, so anything keyed
 * on that derived address is defeated along with it: rate limiting, allowlists,
 * audit logs. The production audit gate rated it critical.
 *
 * The cause was a stale lockfile rather than a stale install. The committed
 * `package-lock.json` pinned 2.0.7 while `node_modules` already held 2.0.8, so
 * `npm ls` looked clean while `npm audit` -- which reads the lockfile -- did not.
 * Anyone installing from the lockfile got the vulnerable version.
 *
 * express asks for `~2.0.7`, which *admits* 2.0.8 but does not require it, so a
 * fresh resolution is free to pick 2.0.7 again. The override removes that choice.
 *
 * The override is therefore a workaround for a loose upstream range, which makes
 * it the kind of thing that outlives its reason silently. These assertions are
 * the reason, made executable: when express's own range stops admitting a
 * vulnerable `proxy-addr`, the override no longer changes anything. A failure
 * here is not a regression -- it is the removal signal.
 */
import fs from 'fs';
import path from 'path';

import semver from 'semver';

/** The first `proxy-addr` release clear of GHSA-jqcg-44mw-7w3h. */
const FIRST_PATCHED = '2.0.8';

const ROOT = path.join(__dirname, '../..');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  overrides?: Record<string, string>;
};

/**
 * An installed package's manifest.
 *
 * Read from `node_modules` rather than mocked: the question these tests ask is
 * what the *resolved dependency tree* does, which a fixture cannot answer. A
 * missing package throws rather than skipping -- this file is the only record of
 * why the override exists, and a version of it that quietly passes when it
 * cannot see the tree would let the override rot unobserved.
 *
 * @param name - Package name as it appears under `node_modules`.
 * @returns The parsed manifest.
 */
const manifest = (name: string): { version: string; dependencies?: Record<string, string> } => {
  const file = path.join(ROOT, 'node_modules', name, 'package.json');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(file)) {
    throw new Error(
      `${name} is not installed, so this guard cannot check whether the ` +
        'proxy-addr override is still needed. Install dependencies and re-run; ' +
        'do not delete this file to make it quiet.',
    );
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return JSON.parse(fs.readFileSync(file, 'utf8')) as {
    version: string;
    dependencies?: Record<string, string>;
  };
};

describe('the proxy-addr override is still needed', () => {
  it('pins proxy-addr at or above the patched release', () => {
    expect(pkg.overrides?.['proxy-addr']).toBe(`^${FIRST_PATCHED}`);
  });

  it('resolves a proxy-addr clear of the advisory', () => {
    // Declaring the override and it taking effect are separate questions. This
    // is the one the lockfile got wrong.
    expect(semver.gte(manifest('proxy-addr').version, FIRST_PATCHED)).toBe(true);
  });

  it('is still reached through express', () => {
    // If express stops depending on proxy-addr, this override is pinning a
    // package nothing uses. Delete it and this file.
    expect(manifest('express').dependencies?.['proxy-addr']).toBeDefined();
  });

  it("still has express's range admitting a vulnerable proxy-addr", () => {
    // The actual cause. `~2.0.7` admits both 2.0.7 and 2.0.8, so resolution may
    // legitimately pick the vulnerable one. When express raises its floor to
    // 2.0.8 or later, the override becomes redundant -- that is the signal.
    const range = manifest('express').dependencies?.['proxy-addr'] ?? '';

    expect(semver.validRange(range)).not.toBeNull();
    expect(semver.satisfies('2.0.7', range)).toBe(true);
  });
});
