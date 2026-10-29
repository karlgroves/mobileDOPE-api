/**
 * Why `overrides["body-parser"]` exists, and when it may be deleted.
 *
 * `body-parser` is what express uses to parse every request body this API
 * receives. GHSA-27r3-jxmh-p828 -- denial of service via trailing bytes after a
 * compressed request body -- affects `<1.20.9`, and an API whose job is parsing
 * request bodies reaches it directly. The production audit gate rated it high.
 *
 * express asks for `~1.20.5`, which *admits* 1.20.9 but does not require it, so a
 * fresh resolution is free to pick a vulnerable 1.20.x again. The override
 * removes that choice.
 *
 * Like the proxy-addr override, this is a workaround for a loose upstream range.
 * These assertions are the reason, made executable: when express's own range
 * stops admitting a vulnerable `body-parser`, the override no longer changes
 * anything. A failure here is not a regression -- it is the removal signal.
 */
import fs from 'fs';
import path from 'path';

import semver from 'semver';

/** The first `body-parser` release clear of GHSA-27r3-jxmh-p828. */
const FIRST_PATCHED = '1.20.9';

/** The last `body-parser` release inside the advisory range. */
const LAST_VULNERABLE = '1.20.8';

const ROOT = path.join(__dirname, '../..');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  overrides?: Record<string, string>;
};

/**
 * An installed package's manifest.
 *
 * Read from `node_modules` rather than mocked, for the reason given in
 * `proxy-addr-override.test.ts`: the question is what the resolved tree does. A
 * missing package throws rather than skipping.
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
        'body-parser override is still needed. Install dependencies and re-run; ' +
        'do not delete this file to make it quiet.',
    );
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return JSON.parse(fs.readFileSync(file, 'utf8')) as {
    version: string;
    dependencies?: Record<string, string>;
  };
};

describe('the body-parser override is still needed', () => {
  it('pins body-parser at or above the patched release', () => {
    expect(pkg.overrides?.['body-parser']).toBe(`^${FIRST_PATCHED}`);
  });

  it('resolves a body-parser clear of the advisory', () => {
    expect(semver.gte(manifest('body-parser').version, FIRST_PATCHED)).toBe(true);
  });

  it('is still reached through express', () => {
    // If express stops depending on body-parser, this override is pinning a
    // package nothing uses. Delete it and this file.
    expect(manifest('express').dependencies?.['body-parser']).toBeDefined();
  });

  it("still has express's range admitting a vulnerable body-parser", () => {
    // The actual cause. When express raises its floor to 1.20.9 or later, the
    // override becomes redundant -- that is the signal.
    const range = manifest('express').dependencies?.['body-parser'] ?? '';

    expect(semver.validRange(range)).not.toBeNull();
    expect(semver.satisfies(LAST_VULNERABLE, range)).toBe(true);
  });
});
