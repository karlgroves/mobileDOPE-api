/**
 * Guards `database/init/001-schema.sql` against the defect classes that made it
 * unloadable.
 *
 * Nothing in this repository executes that file: the test suite never opens a
 * database connection, so a schema that MySQL rejects outright passed every
 * check. Three separate defects accumulated behind that blind spot, and each was
 * only found once the one in front of it was fixed:
 *
 *   1. `users.uuid` was a STORED generated column derived from the
 *      AUTO_INCREMENT `id` -- illegal (ERROR 3109), and it aborted the script at
 *      the first table, so nothing at all was created.
 *   2. `community_ammo.submitted_by` was NOT NULL while its foreign key used
 *      ON DELETE SET NULL -- contradictory (ERROR 1830).
 *   3. `users.token_version` was declared in `src/models/User.ts` but missing
 *      from the schema, so every query against the table failed.
 *
 * These assertions are static: they read the SQL and the model as text and need
 * no database, so they run in the normal suite. They do not replace exercising
 * the schema against a real MySQL -- see the PR for #19 -- but they catch the
 * specific mistakes that already happened, cheaply, on every run.
 *
 * See issue #19.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relative: string): string =>
  // Callers pass hardcoded repo-relative paths only; no user input reaches this.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const schema = read('database/init/001-schema.sql');

/**
 * Strips `--` line comments so prose describing a defect is not mistaken for the
 * defect itself. Without this, the comment block explaining the old `uuid`
 * column would trip the very assertion that exists to catch it.
 */
const stripComments = (sql: string): string =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

const sql = stripComments(schema);

/**
 * The body of each `CREATE TABLE` in the schema, keyed by table name.
 *
 * @returns A map of table name to the text between its outermost parentheses.
 */
const tableBodies = (): Map<string, string> => {
  const bodies = new Map<string, string>();
  const re = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(sql)) !== null) {
    const name = match[1]!;
    let depth = 1;
    let i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      const ch = sql.charAt(i);
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    bodies.set(name, sql.slice(re.lastIndex, i - 1));
  }
  return bodies;
};

/**
 * Splits a table body on top-level commas only, so a definition containing its
 * own parenthesised expression list (a DEFAULT expression, an ENUM, a generated
 * column) stays in one piece.
 *
 * @param body - The text between a CREATE TABLE's outermost parentheses.
 * @returns The comma-separated segments, parentheses respected.
 */
const splitTopLevel = (body: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
};

/**
 * Column definitions in a table body, as `name -> definition`.
 *
 * @param body - The text between a CREATE TABLE's outermost parentheses.
 * @returns A map of column name to its full definition text.
 */
const columnsOf = (body: string): Map<string, string> => {
  const cols = new Map<string, string>();
  for (const part of splitTopLevel(body)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Skip table-level clauses; they are not column definitions.
    if (/^(PRIMARY|UNIQUE|INDEX|KEY|FOREIGN|CONSTRAINT|FULLTEXT|SPATIAL|CHECK)\b/i.test(trimmed)) {
      continue;
    }
    const name = /^`?(\w+)`?\s/.exec(trimmed)?.[1];
    if (name) cols.set(name, trimmed);
  }
  return cols;
};

const bodies = tableBodies();

describe('schema loads at all', () => {
  it('parses into the tables the app expects', () => {
    // A sanity check on the parser itself -- every assertion below is vacuous if
    // this returns nothing.
    expect(bodies.size).toBeGreaterThanOrEqual(10);
    expect([...bodies.keys()]).toEqual(expect.arrayContaining(['users', 'community_ammo']));
  });

  it('has no generated column referring to an AUTO_INCREMENT column', () => {
    // MySQL ERROR 3109. This aborted the script at the first table, so *nothing*
    // was created -- the failure mode is total, not partial.
    const offenders: string[] = [];

    for (const [table, body] of bodies) {
      const cols = columnsOf(body);
      const autoInc = [...cols.entries()]
        .filter(([, def]) => /\bAUTO_INCREMENT\b/i.test(def))
        .map(([name]) => name);
      if (autoInc.length === 0) continue;

      for (const [name, def] of cols) {
        // A generated column is `... AS (expr)`, optionally STORED/VIRTUAL.
        const generated = /\bAS\s*\(/i.exec(def);
        if (!generated) continue;

        // Tokenise into identifiers and test set membership rather than building
        // a RegExp from a column name: a literal pattern keeps this free of the
        // injection footgun `security/detect-non-literal-regexp` warns about, and
        // it gives exact word matching without escaping.
        const identifiers = new Set(def.slice(generated.index).match(/[A-Za-z_]\w*/g) ?? []);
        for (const inc of autoInc) {
          if (identifiers.has(inc)) {
            offenders.push(`${table}.${name} refers to AUTO_INCREMENT column ${inc}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('has no NOT NULL column targeted by ON DELETE SET NULL', () => {
    // MySQL ERROR 1830. Sat behind the first defect and surfaced only once the
    // script got far enough to reach it.
    const offenders: string[] = [];

    for (const [table, body] of bodies) {
      const cols = columnsOf(body);
      const fkRe = /FOREIGN KEY\s*\(\s*`?(\w+)`?\s*\)[^,]*?ON DELETE SET NULL/gi;
      let fk: RegExpExecArray | null;
      while ((fk = fkRe.exec(body)) !== null) {
        const col = fk[1]!;
        const def = cols.get(col);
        if (def && /\bNOT\s+NULL\b/i.test(def)) {
          offenders.push(`${table}.${col} is NOT NULL but its FK uses ON DELETE SET NULL`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('the users table and its Sequelize model agree', () => {
  const model = read('src/models/User.ts');

  /**
   * Attribute names declared in the `User.init({...})` call.
   *
   * @returns The attribute names, in declaration order.
   */
  const modelAttributes = (): string[] => {
    const start = model.indexOf('User.init(');
    expect(start).toBeGreaterThan(-1);
    const body = model.slice(start, model.indexOf('\n  },\n  {', start));
    return [...body.matchAll(/^ {4}(\w+):\s*\{/gm)].map((m) => m[1]!);
  };

  it('every model attribute exists as a column in the schema', () => {
    // `token_version` was declared in the model and absent from the schema. It
    // gates JWT revocation in src/middlewares/auth.ts, and its absence made
    // every query against the table fail.
    const cols = columnsOf(bodies.get('users')!);
    const missing = modelAttributes().filter((attr) => !cols.has(attr));

    expect(missing).toEqual([]);
  });

  it('the uuid column is defaulted rather than derived from the primary key', () => {
    const def = columnsOf(bodies.get('users')!).get('uuid');
    expect(def).toBeDefined();

    // Derived-from-id is the original defect; a DEFAULT is the fix. Assert both
    // directions so replacing one with the other cannot pass silently.
    expect(def).not.toMatch(/\bAS\s*\(/i);
    expect(def).toMatch(/\bDEFAULT\s*\(/i);
    expect(def).toMatch(/\bNOT\s+NULL\b/i);
  });

  it('the uuid column is unique in both the schema and the model', () => {
    // Uniqueness used to be implied by deriving from the primary key. Now that
    // the value is random, it has to be declared.
    expect(bodies.get('users')).toMatch(/UNIQUE KEY\s+idx_users_uuid\s*\(\s*uuid\s*\)/i);
    expect(model).toMatch(/\{\s*fields:\s*\['uuid'\],\s*unique:\s*true\s*\}/);
  });
});
