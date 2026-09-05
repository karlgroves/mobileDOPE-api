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

/**
 * Versions the admitted-range check samples.
 *
 * Every major from the declared floor upward, at its `.0` and at a late minor,
 * because the gaps that matter sit between majors: a `^24.15.0` disjunct ends at
 * 25.0.0 and the next disjunct may not start until 26. Extend when Node ships a
 * new major.
 */
const CANDIDATE_VERSIONS = [
  '24.15.0',
  '24.99.0',
  '25.0.0',
  '25.99.0',
  '26.0.0',
  '26.99.0',
  '27.0.0',
];

const repoRoot = path.resolve(__dirname, '../..');
const read = (relative: string): string =>
  // Every caller passes a hardcoded repo-relative path (see below); there is no
  // user-controlled input reaching this helper.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const pkg = JSON.parse(read('package.json')) as { engines?: Record<string, string> };

interface LockfileEntry {
  name: string;
  range: string;
}

/**
 * The node range an `engines` field declares, in either shape npm writes.
 *
 * @param engines - The raw `engines` value from a lockfile entry.
 * @returns A valid semver range, or null when the entry declares no node constraint.
 */
const nodeRangeOf = (engines: unknown): string | null => {
  if (!engines) return null;

  // Array form: entries look like 'node >=0.10.0'.
  if (Array.isArray(engines)) {
    for (const entry of engines) {
      if (typeof entry !== 'string') continue;
      const match = /^\s*node\s+(.+)$/.exec(entry);
      const range = match?.[1]?.trim();
      if (range && semver.validRange(range)) return range;
    }
    return null;
  }

  const range = (engines as { node?: unknown }).node;
  return typeof range === 'string' && semver.validRange(range) ? range : null;
};

/**
 * The lockfile's own record of this package's `engines`.
 *
 * npm mirrors the root `package.json` into `packages[""]` on every install, so
 * this is a copy that can fall out of step with the original — and did: #8's fix
 * changed `engines.node` but the mirrored copy stayed at `>=20.0.0` until the
 * next install rewrote it.
 *
 * Returned whole rather than as a single range: `engines.npm` is mirrored by the
 * same mechanism and goes stale by the same route, so checking only `node` would
 * leave half of the drift unguarded.
 *
 * @returns The root entry's `engines` object, or undefined when the lockfile records none.
 */
const lockfileRootEngines = (): Record<string, string> | undefined => {
  const lock = JSON.parse(read('package-lock.json')) as {
    packages?: Record<string, { engines?: Record<string, string> }>;
  };
  return lock.packages?.['']?.engines;
};

/**
 * Every `engines.node` range recorded by a dependency in the committed lockfile.
 *
 * Lockfile v3 records `engines` per package, so the true floor is derivable
 * without bisecting Node versions.
 *
 * The root entry (`packages[""]`) is deliberately excluded. It is not a
 * constraint the tree imposes — it is npm's mirror of the very `engines.node`
 * these tests are checking, so including it makes the derivation circular: an
 * inflated floor propagates into the lockfile on the next `npm install` and then
 * validates itself. With the root included, a floor of `>=26.0.0` passed every
 * assertion here while the tree's real floor was 24.15.0. `lockfileRootNodeRange`
 * checks that mirror against `package.json` separately, which is the honest test.
 */
const lockfileNodeRanges = (): LockfileEntry[] => {
  const lock = JSON.parse(read('package-lock.json')) as {
    packages?: Record<string, { engines?: { node?: string } | string[] }>;
  };

  const entries: LockfileEntry[] = [];
  for (const [name, meta] of Object.entries(lock.packages ?? {})) {
    if (name === '') continue;

    // Two shapes occur. Modern npm writes `engines: { node: '>=24' }`; a handful of
    // older packages (bunyan, concat-stream, inflection, jsonparse) write
    // `engines: ['node >=0.10.0']`. The array form DOES carry a node constraint, so
    // skipping it would leave a blind spot in exactly the check this file exists for.
    const range = nodeRangeOf(meta.engines);
    if (range === null) continue;
    entries.push({ name, range });
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

  it('admits no version that would fail to install', () => {
    // Checking only `minVersion(declared)` tests a single point and says nothing
    // about the rest of the range. `>=24.15.0` passed that check while admitting
    // the whole Node 25 line, every version of which fails `npm ci` here:
    // read-package-json-fast and friends declare
    // `^22.22.2 || ^24.15.0 || >=26.0.0`, which 25.x satisfies through no
    // disjunct. Under `engine-strict=true` that is a hard EBADENGINE refusal --
    // the exact defect class this file exists to prevent.
    const ranges = lockfileNodeRanges();

    const broken = CANDIDATE_VERSIONS.filter(
      (version) =>
        semver.satisfies(version, declared!) &&
        ranges.some(({ range }) => !semver.satisfies(version, range)),
    );

    expect(broken).toEqual([]);
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

  it('the lockfile mirrors the declared engines', () => {
    // `npm install` copies the root `engines` into `packages[""]`, so the two drift
    // apart whenever `engines` is edited without a reinstall -- which is what
    // happened to #8's own fix. `npm ci` tolerates it (it reads the real
    // `package.json`), so nothing else in the toolchain reports the drift, and a
    // stale mirror is what let the floor derivation above go circular unnoticed.
    // Compared whole, because `engines.npm` is mirrored and drifts the same way.
    expect(lockfileRootEngines()).toEqual(pkg.engines);
  });

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
