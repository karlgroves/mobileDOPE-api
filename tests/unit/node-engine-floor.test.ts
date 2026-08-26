/**
 * Guards the four places this repo pins a Node version against the real floor
 * imposed by the dependency tree.
 *
 * `.npmrc` sets `engine-strict=true`, so a declared floor that is lower than what
 * the tree actually requires is not a warning — it is a hard `EBADENGINE` refusal
 * that installs nothing. These assertions fail locally the moment any of the pins
 * drifts, which is the only signal available: CI installs on a single version and
 * therefore never exercises the declared floor.
 *
 * See issue #8.
 */
import fs from 'fs';
import path from 'path';

import semver from 'semver';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relative: string): string =>
  // Every caller passes a hardcoded repo-relative path (see below); there is no
  // user-controlled input reaching this helper.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const pkg = JSON.parse(read('package.json')) as { engines?: { node?: string } };

interface LockfileEntry {
  name: string;
  range: string;
}

/**
 * Every `engines.node` range recorded in the committed lockfile.
 *
 * Lockfile v3 records `engines` per package, so the true floor is derivable
 * without bisecting Node versions.
 */
const lockfileNodeRanges = (): LockfileEntry[] => {
  const lock = JSON.parse(read('package-lock.json')) as {
    packages?: Record<string, { engines?: { node?: string } | string[] }>;
  };

  const entries: LockfileEntry[] = [];
  for (const [name, meta] of Object.entries(lock.packages ?? {})) {
    // Some entries record `engines` as an array (legacy shape); only the object
    // form carries a node range.
    const engines = meta.engines;
    if (!engines || Array.isArray(engines)) continue;
    const range = engines.node;
    if (typeof range !== 'string' || !semver.validRange(range)) continue;
    entries.push({ name: name || '(root)', range });
  }
  return entries;
};

/**
 * The lowest Node version that satisfies every range in the lockfile.
 *
 * Candidates are drawn from the minimum of each *disjunct* rather than of each
 * range as a whole: `^22.22.2 || ^24.15.0 || >=26.0.0` has a minimum of 22.22.2,
 * but 24.15.0 is the candidate that matters once another package demands `>=24`.
 * Taking `minVersion()` of whole ranges misses it and understates the floor.
 */
const computeFloor = (ranges: LockfileEntry[]): semver.SemVer => {
  const candidates: semver.SemVer[] = [];
  for (const { range } of ranges) {
    for (const disjunct of range.split('||')) {
      const min = semver.minVersion(disjunct.trim());
      if (min) candidates.push(min);
    }
  }
  candidates.sort(semver.compare);

  const floor = candidates.find((candidate) =>
    ranges.every(({ range }) => semver.satisfies(candidate, range)),
  );
  if (!floor) {
    throw new Error('No single Node version satisfies every dependency');
  }
  return floor;
};

describe('declared Node floor', () => {
  const declared = pkg.engines?.node;

  it('declares a valid engines.node range', () => {
    expect(declared).toBeDefined();
    expect(semver.validRange(declared)).toBeTruthy();
  });

  it('is high enough for every engines.node range in the lockfile', () => {
    const floor = semver.minVersion(declared!);
    expect(floor).not.toBeNull();

    const unsatisfied = lockfileNodeRanges().filter(
      ({ range }) => !semver.satisfies(floor!, range),
    );

    // Reported with the offending package names so a failure says which
    // dependency raised the floor, not just that it moved.
    expect(unsatisfied.map(({ name, range }) => `${name} requires ${range}`)).toEqual([]);
  });

  it('is exactly the floor the lockfile requires, not higher', () => {
    // Guards the other direction: an inflated floor locks out contributors for
    // no reason, and a floor that drifts above the real one hides the next bump.
    const required = computeFloor(lockfileNodeRanges());
    const declaredFloor = semver.minVersion(declared!)!;

    expect(declaredFloor.version).toBe(required.version);
  });
});

describe('version pins agree with the declared floor', () => {
  const declared = pkg.engines?.node;
  if (declared === undefined) throw new Error('package.json declares no engines.node');

  it('.nvmrc satisfies engines.node', () => {
    const nvmrc = read('.nvmrc').trim();
    expect(semver.valid(nvmrc)).toBeTruthy();
    expect(semver.satisfies(nvmrc, declared)).toBe(true);
  });

  it('.node-version matches .nvmrc exactly', () => {
    expect(read('.node-version').trim()).toBe(read('.nvmrc').trim());
  });

  it('CI installs the version from .nvmrc rather than its own pin', () => {
    const workflow = read('.github/workflows/pr-check.yml');
    expect(workflow).toMatch(/node-version-file:\s*['"]?\.nvmrc['"]?/);
    // A literal `node-version:` is a second source of truth and would drift.
    expect(workflow).not.toMatch(/^\s*node-version:/m);
  });

  it('Docker base images are on the same major as the floor', () => {
    const floor = semver.minVersion(declared)!;
    for (const dockerfile of ['Dockerfile', 'Dockerfile.dev']) {
      const froms = read(dockerfile).match(/^FROM\s+node:(\S+)/gm) ?? [];
      expect(froms.length).toBeGreaterThan(0);
      for (const from of froms) {
        const tag = /node:(\S+)/.exec(from)?.[1];
        expect(tag).toBeDefined();
        const major = Number.parseInt(tag!.split(/[.-]/)[0]!, 10);
        expect(major).toBe(floor.major);
      }
    }
  });
});
