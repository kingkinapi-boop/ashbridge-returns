// SC11 round 2 acceptance tests, the source rules (A500; spec-writer; builders never edit this file). Unit project:
// they read source text only, so they run on both backends and need no database.
// - R116: every `new Pool(` / `new Client(` from pg in a non-test file under src/ is assigned to a named variable
//   (`const x =`, `let x =`, `this.x =`) and has an `error` listener that records the error: `x.on('error', h)`
//   in the next 40 lines (up to the next such site), or a call to a helper whose name has listen, record, track or
//   watch in it with x as an argument (the file holding the site then has a non-empty `.on('error', ...)`). An empty
//   listener (`() => {}`, `() => undefined`, `() => null`, `noop`) is a swallow (R92) and does not count.
// - R117: a pool is ended only through the exported helper `endPool` (index.ts), so src/core/db has no raw
//   `<pool>.end()` outside the body of `function endPool`. The helper's runtime behaviour is in
//   rules.acceptance.db.test.ts (pg16).
// - Plant: __fixtures__/index-87066e33.ts is index.ts at 87066e33 (8 sites, no listener, three raw pool.end()).
//
// SC11 round 3 (A508), same file, same rules for builders. What these tests fix (amber in reports/SC11-spec.md):
// - S4: index.ts exports `settleAll(label, steps, opts?)`; a step is { name, run, boundMs? }, opts is
//   { primary?, boundMs? }. The steps run one after another, each after every earlier one has settled, failed or
//   not. It resolves when every step succeeds and no primary was given; else it rejects with an Error whose message
//   has the label, then the primary's message (when given), then each failed step by name with its error, in step
//   order, and whose `cause` is the primary (when given). A step still running after its bound (the step's boundMs,
//   else opts.boundMs, else STEP_BOUND_MS, which is 3000) is named with its bound ("<name> ... <bound> ms") and the
//   next step starts.
// - S5: endPool on a pool not made by openPool rejects "not opened by openPool"; an error on a live openPool pool
//   with no sink is reported by assertCleanClones as "no owner: ..."; after endPool it is "late: ..." as before.
// - S10: global-setup.ts exports `makeTeardown(deps, url, rolesAtSetup)`, deps = { dropRunDatabases(url),
//   listRoles(url) }; the function it returns runs both and rejects naming every failure, the roles left included.
// - S11: index.ts exports STEP_BOUND_MS and CLOSE_BOUNDS_MS (the bound of each step of PgDb.close, keys in order
//   inspectIdle, dropOwnedRoles, mainEnd, endPool, drop; endPool keeps its 5 s, the drop 5 s); the afterEach worst
//   case, STEP_BOUND_MS (the assert step) plus the sum of CLOSE_BOUNDS_MS, is at most 0.8 of the db project's
//   hookTimeout in vitest.config.ts.
// - R118, read with the TypeScript compiler API over every file in tools/test-homes.json `harness`. A cleanup
//   region is: a `finally` block, a `catch` block that holds a `throw`, the callback of afterEach or afterAll, a
//   function returned (by a return statement) in a global-setup file, and a function named close*, end*, drop*,
//   teardown*, cleanup* or assertClean* (a function nested in a region's function is judged under that name, so a
//   withAdmin callback inside dropRunDatabases is dropRunDatabases). Awaits are counted per function body; an await
//   inside a loop body counts as two. A finally or rethrowing catch with one await, or any other region with two,
//   must run each await through settleAll (`await settleAll(...)`) or have it sit in its own try (a try whose block
//   holds that one await) whose catch records the error (uses its binding outside a throw; an empty catch counts
//   only when tools/test-homes.json dbCatchAllow lists it for that file, as R92 does). No `Promise.all` holds a call
//   to close*, end*, drop* or destroy* (allSettled is the form). A problem names the region: "<file>:<line> <name>
//   (<kind>): ..." with kind function, finally, catch, hook, teardown or Promise.all.
// - Plants: __fixtures__/index-030e1d6f.ts, vitest-setup-030e1d6f.ts and global-setup-030e1d6f.ts are the harness
//   as the round 2 build left it (git show 030e1d6f:src/core/db/<file>.ts, import paths edited only).
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import ts from 'typescript'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readOwnSource } from '../testing/read-own-source'
import * as globalSetupModule from './global-setup'
import * as dbModule from './index'

const SRC = 'src'
const DB_DIR = 'src/core/db'
const SITE = /new\s+(?:pg\.)?(?:Pool|Client)\s*\(/g
const SWALLOW = String.raw`(?:\(\s*\w*\s*\)\s*=>\s*(?:undefined|void 0|null|\{\s*\})|noop)`
const HELPER = /\b\w*(?:listen|record|track|watch)\w*\s*\(/i

interface Src {
  file: string
  src: string
}

function sources(dir: string, onlyThisDir = false): Src[] {
  const out: Src[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__fixtures__' || e.name === 'node_modules' || onlyThisDir) continue
      out.push(...sources(p))
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push({ file: p, src: readOwnSource(p) })
    }
  }
  return out
}

/** One string per pg.Pool or pg.Client site without a recording error listener, naming file and line. */
function unlistened(files: Src[]): string[] {
  const bad: string[] = []
  for (const { file, src } of files) {
    const sites = [...src.matchAll(SITE)]
    const hasListener = new RegExp(String.raw`\.on\(\s*['"]error['"]\s*,\s*(?!${SWALLOW}\s*\))`).test(src)
    sites.forEach((m, i) => {
      const line = src.slice(0, m.index).split('\n').length
      const where = `${file}:${String(line)}`
      const before = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index)
      const v = /(?:(?:const|let)\s+|this\.)(\w+)\s*(?::[^=]+)?=\s*$/.exec(before)?.[1]
      if (v === undefined) return void bad.push(`${where} not assigned to a named variable`)
      const end = i + 1 < sites.length ? (sites[i + 1]?.index ?? src.length) : src.length
      const after = src
        .slice(m.index, Math.min(end, m.index + 4000))
        .split('\n')
        .slice(0, 41)
        .join('\n')
      const direct = new RegExp(String.raw`\b${v}\.on\(\s*['"]error['"]\s*,\s*(?!${SWALLOW}\s*\))\S`).test(after)
      const viaHelper = new RegExp(`${HELPER.source.replace(/\\s\*\\\($/, '')}\\s*\\([^)]*\\b${v}\\b`, 'i').test(after)
      if (!direct && !(viaHelper && hasListener)) bad.push(`${where} ${v} has no recording error listener`)
    })
  }
  return bad
}

/** One string per raw `<pool>.end()` call outside the body of `function endPool`. */
function rawPoolEnds(files: Src[]): string[] {
  const bad: string[] = []
  for (const { file, src } of files) {
    const helper = /(?:export\s+)?(?:async\s+)?function\s+endPool\b[\s\S]*?\n\}/.exec(src)
    const [from, to] = helper ? [helper.index, helper.index + helper[0].length] : [-1, -1]
    for (const m of src.matchAll(/\b\w*[pP]ool\.end\s*\(\s*\)/g)) {
      if (m.index >= from && m.index < to) continue
      bad.push(`${file}:${String(src.slice(0, m.index).split('\n').length)} raw ${m[0]}`)
    }
  }
  return bad
}

const plant = (): Src[] => [
  {
    file: 'plant',
    src: fs.readFileSync(`${DB_DIR}/__fixtures__/index-87066e33.ts`, 'utf8'),
  },
]

describe('SC11 R116 every pg Pool and Client has a recording error listener (ARC-6, ARC-15)', () => {
  test('ARC-15 the scan accepts a direct listener and a helper, and flags a site with none, a swallowing one, or no variable', () => {
    const ok = [
      "const p = new pg.Pool(o)\np.on('error', (e) => problems.push(e))",
      "this.main = new pg.Client(o)\nthis.main.on('error', (err) => { record(err) })",
      "const c = new Client(o)\nlistenForErrors(c)\nfunction listenForErrors(x) { x.on('error', (e) => seen.push(e)) }",
    ]
    for (const src of ok) expect(unlistened([{ file: 'f.ts', src }]), src).toEqual([])
    const bad = [
      'const p = new pg.Pool(o)\nawait p.end()',
      "const p = new pg.Pool(o)\np.on('error', () => {})",
      "const p = new pg.Pool(o)\np.on('error', () => undefined)",
      "const p = new pg.Pool(o)\np.on('error', noop)",
      "return new pg.Pool(o)\n// p.on('error', (e) => seen.push(e))",
    ]
    for (const src of bad) expect(unlistened([{ file: 'f.ts', src }]), src).toHaveLength(1)
  })

  test('ARC-15 PLANT: index.ts at 87066e33 is flagged once for each of its 8 sites, with its line', () => {
    const src = plant()[0]?.src ?? ''
    const sites = src.split('\n').flatMap((l, n) => (/new\s+pg\.(?:Pool|Client)\(/.test(l) ? [n + 1] : []))
    expect(sites, 'sentinel: the plant really has 8 sites').toHaveLength(8)
    const found = unlistened(plant())
    expect(found).toHaveLength(8)
    for (const n of sites) expect(found.join('\n')).toContain(`plant:${String(n)} `)
  })

  test('ARC-15 the real src/** has no pg Pool or Client without a recording error listener', () => {
    const files = sources(SRC)
    expect(
      files.some((f) => f.file === `${DB_DIR}/index.ts`),
      'sentinel: the scan reads index.ts',
    ).toBe(true)
    expect(unlistened(files)).toEqual([])
  })
})

describe('SC11 R117 a pool is ended only by endPool (ARC-6, ARC-15)', () => {
  test('ARC-15 the scan allows pool.end() inside function endPool only', () => {
    const inHelper = 'export async function endPool(pool) {\n  await pool.end()\n  await settled(pool)\n}\n'
    expect(rawPoolEnds([{ file: 'f.ts', src: inHelper }])).toEqual([])
    expect(
      rawPoolEnds([
        {
          file: 'f.ts',
          src: `${inHelper}async function other() {\n  await pool.end()\n}\n`,
        },
      ]),
    ).toHaveLength(1)
    expect(
      rawPoolEnds([
        { file: 'f.ts', src: 'await this.pool.end()' },
        { file: 'g.ts', src: 'await schemaPool.end()' },
      ]),
    ).toHaveLength(2)
  })

  test('ARC-15 PLANT: index.ts at 87066e33 has its three raw pool.end() calls flagged', () => {
    expect(rawPoolEnds(plant())).toHaveLength(3)
  })

  test('ARC-15 src/core/db has no raw pool.end() outside endPool, and index.ts defines and exports endPool', () => {
    const files = sources(DB_DIR, true)
    expect(rawPoolEnds(files)).toEqual([])
    expect(readOwnSource(`${DB_DIR}/index.ts`)).toMatch(/export\s+(?:async\s+)?function\s+endPool\b/)
  })
})

// ---------------------------------------------------------------------------------------------------------------
// SC11 round 3 (A508): S4, S5, S10, S11 and R118.

interface Step {
  name: string
  run: () => unknown
  boundMs?: number
}
interface Round3Api {
  settleAll(label: string, steps: Step[], opts?: { primary?: unknown; boundMs?: number }): Promise<void>
  STEP_BOUND_MS: number
  CLOSE_BOUNDS_MS: Record<string, number>
  openPool(config: pg.PoolConfig, sink?: { label: string; problems: string[] }): pg.Pool
  endPool(pool: pg.Pool): Promise<void>
  takeLateErrors(): string[]
  assertCleanClones(): Promise<void>
}
function exported<K extends keyof Round3Api>(k: K): Round3Api[K] {
  const v = (dbModule as unknown as Partial<Round3Api>)[k]
  if (v === undefined) throw new Error(`src/core/db/index.ts does not export ${k} (SC11 round 3 build)`)
  return v
}
interface TeardownDeps {
  dropRunDatabases(url: string): Promise<void>
  listRoles(url: string): Promise<string[]>
}
type MakeTeardown = (deps: TeardownDeps, url: string, rolesAtSetup: string[]) => () => Promise<void>
function makeTeardown(): MakeTeardown {
  const f = (globalSetupModule as unknown as { makeTeardown?: MakeTeardown }).makeTeardown
  if (typeof f !== 'function') throw new Error('src/core/db/global-setup.ts does not export makeTeardown (SC11 round 3 build)')
  return f
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))
async function rejectionOf(p: Promise<unknown>): Promise<unknown> {
  try {
    await p
  } catch (e) {
    return e
  }
  throw new Error('expected a rejection, but it resolved')
}
/** The index of each needle in text, asserting each is there. */
function positions(text: string, needles: string[]): number[] {
  return needles.map((n) => {
    const i = text.indexOf(n)
    expect(i, `${JSON.stringify(n)} in ${JSON.stringify(text)}`).toBeGreaterThanOrEqual(0)
    return i
  })
}
const isAscending = (xs: number[]): boolean => xs.every((x, i) => i === 0 || (xs[i - 1] ?? -1) < x)

describe('SC11 S4 settleAll runs every cleanup step and names every failure (ARC-6, ARC-15)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('ARC-6 every step runs after earlier failures, one after another, and the rejection names each failed step in order', async () => {
    const settleAll = exported('settleAll')
    const events: string[] = []
    const step = (name: string, fail: boolean, sync = false): Step => ({
      name,
      run: () => {
        events.push(`start ${name}`)
        if (sync && fail) throw new Error(`${name} broke (Test)`)
        return Promise.resolve().then(() => {
          events.push(`end ${name}`)
          if (fail) throw new Error(`${name} broke (Test)`)
        })
      },
    })
    const err = await rejectionOf(
      settleAll('closing sc11_db_test', [step('inspectIdle', true), step('mainEnd', false), step('endPool', true, true), step('drop', true)]),
    )
    expect(events).toEqual(['start inspectIdle', 'end inspectIdle', 'start mainEnd', 'end mainEnd', 'start endPool', 'start drop', 'end drop'])
    const msg = messageOf(err)
    expect(msg).toContain('closing sc11_db_test')
    expect(isAscending(positions(msg, ['inspectIdle', 'inspectIdle broke (Test)', 'endPool', 'endPool broke (Test)', 'drop broke (Test)']))).toBe(true)
    expect(msg).not.toContain('mainEnd')
  })

  test('ARC-6 settleAll resolves when every step succeeds and no primary error is given', async () => {
    const settleAll = exported('settleAll')
    const ran: string[] = []
    await expect(
      settleAll('clean (Test)', [
        { name: 'a', run: () => void ran.push('a') },
        {
          name: 'b',
          run: () => {
            ran.push('b')
            return Promise.resolve()
          },
        },
      ]),
    ).resolves.toBeUndefined()
    expect(ran).toEqual(['a', 'b'])
  })

  test('ARC-6 a primary error passed in stays first in the message and is the cause, ahead of every step failure', async () => {
    const settleAll = exported('settleAll')
    const primary = new Error('schema file 001_kill.sql failed (Test)')
    const err = await rejectionOf(
      settleAll(
        'template sc11_tpl_test',
        [
          { name: 'endPool', run: () => Promise.reject(new Error('pool would not end (Test)')) },
          { name: 'drop', run: () => Promise.reject(new Error('drop refused (Test)')) },
        ],
        { primary },
      ),
    )
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).cause).toBe(primary)
    const msg = messageOf(err)
    expect(isAscending(positions(msg, ['schema file 001_kill.sql failed (Test)', 'pool would not end (Test)', 'drop refused (Test)']))).toBe(true)
  })

  test('ARC-6 with a primary error and no failing step, settleAll still runs every step and rejects with that primary', async () => {
    const settleAll = exported('settleAll')
    const primary = new Error('the run failed first (Test)')
    const ran: string[] = []
    const err = await rejectionOf(
      settleAll('withAdmin (Test)', [
          {
            name: 'end',
            run: () => {
              ran.push('end')
              return Promise.resolve()
            },
          },
        ], { primary }),
    )
    expect(ran).toEqual(['end'])
    expect(err === primary || (err as Error).cause === primary, 'the primary is the rejection or its cause').toBe(true)
    expect(messageOf(err)).toContain('the run failed first (Test)')
  })

  test('ARC-6 a hung step is named after its own bound and the next step still runs (fake timers)', async () => {
    const settleAll = exported('settleAll')
    vi.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') })
    const ran: string[] = []
    let settled: unknown = 'pending'
    const p = settleAll('closing sc11_hung_test', [
      { name: 'mainEnd', run: () => new Promise<void>(() => undefined), boundMs: 1000 },
      {
        name: 'drop',
        run: () => {
          ran.push('drop')
          return Promise.resolve()
        },
      },
    ]).then(
      () => 'resolved',
      (e: unknown) => e,
    )
    void p.then((v) => {
      settled = v
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe('pending')
    expect(ran).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(ran).toEqual(['drop'])
    expect(messageOf(settled)).toMatch(/mainEnd[^\n]*\b1000 ?ms/)
  })

  test('ARC-6 a step with no bound of its own is bounded by opts.boundMs, else by STEP_BOUND_MS, which is 3000 ms (fake timers)', async () => {
    const settleAll = exported('settleAll')
    expect(exported('STEP_BOUND_MS')).toBe(3000)
    vi.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') })
    for (const [opts, bound] of [
      [undefined, 3000],
      [{ boundMs: 1500 }, 1500],
    ] as const) {
      let settled: unknown = 'pending'
      const p = settleAll('bounded (Test)', [{ name: 'inspectIdle', run: () => new Promise<void>(() => undefined) }], opts).then(
        () => 'resolved',
        (e: unknown) => e,
      )
      void p.then((v) => {
        settled = v
      })
      await vi.advanceTimersByTimeAsync(bound - 1)
      expect(settled, `still waiting at ${String(bound - 1)} ms`).toBe('pending')
      await vi.advanceTimersByTimeAsync(1)
      await p
      expect(messageOf(settled)).toMatch(new RegExp(`inspectIdle[^\\n]*\\b${String(bound)} ?ms`))
    }
  })
})

describe('SC11 S5 a pool error always has an owner, and endPool ends only its own pools (ARC-6)', () => {
  const offline: pg.PoolConfig = { host: '127.0.0.1', port: 1, user: 'postgres', database: 'sc11_offline_test', max: 1 }
  const killed = (): Error => Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' })

  test('ARC-6 endPool refuses a pool that openPool did not make, naming why', async () => {
    const endPool = exported('endPool')
    const raw = new pg.Pool(offline)
    raw.on('error', () => {
      throw new Error('no error is expected from an unconnected pool (Test)')
    })
    const err = await rejectionOf(endPool(raw))
    expect(messageOf(err)).toMatch(/not opened by openPool/)
  })

  test('ARC-6 an error on a live openPool pool with no sink is named "no owner" by assertCleanClones, and "late" once the pool ended', async () => {
    const { openPool, endPool, takeLateErrors, assertCleanClones } = {
      openPool: exported('openPool'),
      endPool: exported('endPool'),
      takeLateErrors: exported('takeLateErrors'),
      assertCleanClones: exported('assertCleanClones'),
    }
    takeLateErrors()
    const pool = openPool({ ...offline, application_name: 'sc11_noowner_test' })
    try {
      expect(() => pool.emit('error', killed())).not.toThrow()
      const live = messageOf(await rejectionOf(assertCleanClones()))
      expect(live).toMatch(/no owner:[^\n]*57P01/)
      expect(live).not.toMatch(/late:/)
    } finally {
      await endPool(pool)
    }
    expect(() => pool.emit('error', killed())).not.toThrow()
    const ended = messageOf(await rejectionOf(assertCleanClones()))
    expect(ended).toMatch(/late:[^\n]*57P01/)
    expect(takeLateErrors()).toEqual([])
  })
})

describe('SC11 S10 the global teardown never skips the role check (ARC-6, SEC-1)', () => {
  test('SEC-1 makeTeardown with a failing dropRunDatabases still compares roles and rejects naming both failures', async () => {
    const calls: string[] = []
    const deps: TeardownDeps = {
      dropRunDatabases: (url) => {
        calls.push(`drop ${url}`)
        return Promise.reject(new Error('drop of ashbridge_t_run_db1 refused (Test)'))
      },
      listRoles: (url) => {
        calls.push(`roles ${url}`)
        return Promise.resolve(['postgres', 'sc11_left_role_test'])
      },
    }
    const url = 'postgres://postgres@127.0.0.1:5432/postgres'
    const teardown = makeTeardown()(deps, url, ['postgres'])
    expect(teardown).toBeTypeOf('function')
    const msg = messageOf(await rejectionOf(teardown()))
    expect(msg).toContain('drop of ashbridge_t_run_db1 refused (Test)')
    expect(msg).toContain('sc11_left_role_test')
    expect(calls).toEqual([`drop ${url}`, `roles ${url}`])
  })

  test('SEC-1 makeTeardown resolves when the drop succeeds and no role was left, and rejects naming a left role alone', async () => {
    const url = 'postgres://postgres@127.0.0.1:5432/postgres'
    const ok = makeTeardown()({ dropRunDatabases: () => Promise.resolve(), listRoles: () => Promise.resolve(['postgres']) }, url, ['postgres'])
    await expect(ok()).resolves.toBeUndefined()
    const left = makeTeardown()(
      { dropRunDatabases: () => Promise.resolve(), listRoles: () => Promise.resolve(['postgres', 'sc11_only_role_test']) },
      url,
      ['postgres'],
    )
    expect(messageOf(await rejectionOf(left()))).toContain('sc11_only_role_test')
  })

  test('SEC-1 a failing listRoles is named too, after the drop ran', async () => {
    const calls: string[] = []
    const t = makeTeardown()(
      {
        dropRunDatabases: () => {
          calls.push('drop')
          return Promise.resolve()
        },
        listRoles: () => Promise.reject(new Error('pg_roles unreadable (Test)')),
      },
      'postgres://postgres@127.0.0.1:5432/postgres',
      ['postgres'],
    )
    expect(messageOf(await rejectionOf(t()))).toContain('pg_roles unreadable (Test)')
    expect(calls).toEqual(['drop'])
  })
})

describe('SC11 S11 the afterEach worst case fits inside the hookTimeout (ARC-6)', () => {
  test('ARC-6 the assert step plus every step bound of close, endPool 5 s and the drop 5 s included, is at most 0.8 of the db hookTimeout', () => {
    const src = readOwnSource('vitest.config.ts')
    const from = src.indexOf("'src/core/db/vitest-setup.ts'")
    expect(from, 'sentinel: the db project block of vitest.config.ts').toBeGreaterThan(0)
    const m = /hookTimeout:\s*([\d_]+)/.exec(src.slice(from))
    expect(m, 'sentinel: the db project sets a hookTimeout').not.toBeNull()
    const hookTimeout = Number((m?.[1] ?? '').replaceAll('_', ''))
    expect(hookTimeout).toBeGreaterThan(0)
    const step = exported('STEP_BOUND_MS')
    const close = exported('CLOSE_BOUNDS_MS')
    expect(Object.keys(close)).toEqual(['inspectIdle', 'dropOwnedRoles', 'mainEnd', 'endPool', 'drop'])
    expect(close['endPool']).toBe(5000)
    expect(close['drop']).toBe(5000)
    for (const [k, v] of Object.entries(close)) expect(v, `${k} is a positive bound`).toBeGreaterThan(0)
    const worst = step + Object.values(close).reduce((a, b) => a + b, 0)
    expect(worst).toBeLessThanOrEqual(0.8 * hookTimeout)
  })
})

// R118: the scan.
const LOOP_KINDS = new Set([ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement])
const CLEANUP_NAME = /^(?:close|end|drop|teardown|cleanup|assertClean)/
const ENDING_CALL = /^(?:close|end|drop|destroy)/

interface Cleanup {
  file: string
  line: number
  name: string
  kind: 'function' | 'finally' | 'catch' | 'hook' | 'teardown' | 'Promise.all'
  text: string
}
interface CleanupScan {
  problems: string[]
  found: Cleanup[]
  regions: { name: string; kind: Cleanup['kind'] }[]
}

function isFn(n: ts.Node): n is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n) ||
    ts.isConstructorDeclaration(n)
  )
}
function outerOf(n: ts.Node): ts.Node {
  let p = n.parent
  while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p)) p = p.parent
  return p
}
function nameText(n: ts.Node | undefined): string | undefined {
  return n !== undefined && (ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || ts.isStringLiteral(n)) ? n.text : undefined
}
function ownName(f: ts.FunctionLikeDeclaration): string | undefined {
  if (!ts.isFunctionExpression(f) && !ts.isArrowFunction(f) && f.name !== undefined) return nameText(f.name)
  if (ts.isFunctionExpression(f) && f.name !== undefined) return f.name.text
  const p = outerOf(f)
  if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) return nameText(p.name)
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return ts.isPropertyAccessExpression(p.left) ? p.left.name.text : nameText(p.left)
  }
  return undefined
}
function hookOf(f: ts.Node): string | undefined {
  const p = f.parent
  if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && /^after(?:Each|All)$/.test(p.expression.text) && p.arguments.some((a) => a === f)) {
    return p.expression.text
  }
  return undefined
}
function enclosingFn(n: ts.Node): ts.FunctionLikeDeclaration | undefined {
  for (let p = n.parent as ts.Node | undefined; p !== undefined; p = p.parent) if (isFn(p)) return p
  return undefined
}
function calleeName(c: ts.CallExpression): string | undefined {
  const e = c.expression
  return ts.isPropertyAccessExpression(e) ? e.name.text : nameText(e)
}

interface Aw {
  node: ts.Node
  weight: number
}
/** The awaits of one function body or block (not of functions nested in it); an await in a loop body weighs two. */
function awaitsIn(root: ts.Node): Aw[] {
  const out: Aw[] = []
  const visit = (n: ts.Node, inLoop: boolean): void => {
    if (n !== root && isFn(n)) return
    if (ts.isAwaitExpression(n)) out.push({ node: n, weight: inLoop ? 2 : 1 })
    if (ts.isForOfStatement(n) && n.awaitModifier !== undefined) out.push({ node: n, weight: 2 })
    ts.forEachChild(n, (c) => {
      const once =
        ((ts.isForOfStatement(n) || ts.isForInStatement(n)) && c === n.expression) || (ts.isForStatement(n) && c === n.initializer)
      visit(c, inLoop || (LOOP_KINDS.has(n.kind) && !once))
    })
  }
  visit(root, false)
  return out
}
const weightOf = (aws: Aw[]): number => aws.reduce((a, b) => a + b.weight, 0)

function scanCleanup(file: string, src: string, allowedEmptyCatches: string[]): CleanupScan {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const isGlobalSetup = /(?:^|\/)global-setup[^/]*\.ts$/.test(file)
  const found: Cleanup[] = []
  const regions: CleanupScan['regions'] = []
  const lineOf = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const records = (cc: ts.CatchClause): boolean => {
    if (cc.block.statements.length === 0) return allowedEmptyCatches.includes(`${src.slice(cc.getStart(sf), cc.block.getStart(sf))}{}`)
    const v = cc.variableDeclaration?.name
    if (v === undefined || !ts.isIdentifier(v)) return false
    let used = false
    const visit = (n: ts.Node): void => {
      if (ts.isThrowStatement(n)) return
      if (ts.isIdentifier(n) && n.text === v.text) used = true
      ts.forEachChild(n, visit)
    }
    cc.block.statements.forEach(visit)
    return used
  }
  const handled = (a: Aw, root: ts.Node): boolean => {
    const n = a.node
    if (ts.isAwaitExpression(n)) {
      let e: ts.Expression = n.expression
      while (ts.isParenthesizedExpression(e)) e = e.expression
      if (ts.isCallExpression(e) && calleeName(e) === 'settleAll') return true
    }
    for (let p = n.parent as ts.Node | undefined; p !== undefined && p !== root; p = p.parent) {
      if (!ts.isTryStatement(p) || p.catchClause === undefined) continue
      const inTry = n.pos >= p.tryBlock.pos && n.end <= p.tryBlock.end
      if (inTry && records(p.catchClause) && weightOf(awaitsIn(p.tryBlock)) === 1) return true
    }
    return false
  }
  const judge = (root: ts.Node | undefined, at: ts.Node, name: string, kind: Cleanup['kind'], threshold: number): void => {
    if (root === undefined) return
    regions.push({ name, kind })
    const aws = awaitsIn(root)
    if (weightOf(aws) < threshold) return
    const bad = aws.filter((a) => !handled(a, root))
    const first = bad[0]
    if (first === undefined) return
    found.push({
      file,
      line: lineOf(at),
      name,
      kind,
      text: `${String(bad.length)} await(s) neither run through settleAll nor each in its own try that records, first: ${first.node.getText(sf).replace(/\s+/g, ' ').slice(0, 70)}`,
    })
  }
  const regionName = (f: ts.FunctionLikeDeclaration | undefined): { name: string; kind: Cleanup['kind'] } | undefined => {
    if (f === undefined) return undefined
    const hook = hookOf(f)
    if (hook !== undefined) return { name: hook, kind: 'hook' }
    if (isGlobalSetup && ts.isReturnStatement(outerOf(f))) return { name: 'teardown', kind: 'teardown' }
    const own = ownName(f)
    if (own !== undefined && CLEANUP_NAME.test(own)) return { name: own, kind: 'function' }
    const outer = regionName(enclosingFn(f))
    return outer === undefined ? undefined : { name: outer.name, kind: 'function' }
  }
  const labelOf = (n: ts.Node): string => {
    for (let f = enclosingFn(n); f !== undefined; f = enclosingFn(f)) {
      const r = regionName(f)
      if (r !== undefined) return r.name
      const own = ownName(f)
      if (own !== undefined) return own
    }
    return '(top level)'
  }

  const visit = (n: ts.Node): void => {
    if (isFn(n)) {
      const r = regionName(n)
      if (r !== undefined) judge(n.body, n, r.name, r.kind, 2)
    }
    if (ts.isTryStatement(n) && n.finallyBlock !== undefined) judge(n.finallyBlock, n.finallyBlock, labelOf(n), 'finally', 1)
    if (ts.isCatchClause(n)) {
      const seen = { rethrows: false }
      const look = (c: ts.Node): void => {
        if (isFn(c)) return
        if (ts.isThrowStatement(c)) seen.rethrows = true
        ts.forEachChild(c, look)
      }
      look(n.block)
      if (seen.rethrows) judge(n.block, n, labelOf(n), 'catch', 1)
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'all' &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === 'Promise'
    ) {
      const ending: string[] = []
      const look = (c: ts.Node): void => {
        if (ts.isCallExpression(c)) {
          const callee = calleeName(c)
          if (callee !== undefined && ENDING_CALL.test(callee)) ending.push(callee)
        }
        ts.forEachChild(c, look)
      }
      n.arguments.forEach(look)
      if (ending.length > 0) {
        found.push({ file, line: lineOf(n), name: labelOf(n), kind: 'Promise.all', text: `Promise.all over ${ending.join(', ')}: use Promise.allSettled and name every failure` })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return { found, regions, problems: found.map((c) => `${c.file}:${String(c.line)} ${c.name} (${c.kind}): ${c.text}`) }
}

interface Homes {
  harness?: unknown
  dbCatchAllow?: { file: string; text: string }[]
}
const homes = (): Homes => JSON.parse(readOwnSource('tools/test-homes.json')) as Homes
const allowedFor = (file: string): string[] => (homes().dbCatchAllow ?? []).filter((a) => a.file === file).map((a) => a.text)
const named = (scan: CleanupScan, name: string, kind?: Cleanup['kind']): boolean =>
  scan.found.some((c) => c.name === name && (kind === undefined || c.kind === kind))

const R118_MS = 30_000

describe('SC11 R118 a cleanup sequence runs every step and keeps every failure (ARC-6, ARC-15)', () => {
  test(
    'ARC-15 the scan flags each way a cleanup stops at its first failure or masks the error in flight, once each',
    () => {
      const bad: [string, string, string, Cleanup['kind']][] = [
        ['f.ts', 'async function withThing(run) {\n  const c = open()\n  try { return await run(c) } finally { await c.end() }\n}', 'withThing', 'finally'],
        ['f.ts', 'async function make(dir) {\n  try { await load(dir) } catch (e) {\n    await pool.end()\n    throw e\n  }\n}', 'make', 'catch'],
        ['f.ts', 'class H {\n  async close() {\n    await this.main.end()\n    await dropDatabase(this.name)\n  }\n}', 'close', 'function'],
        ['f.ts', 'async function dropAll(names) {\n  for (const n of names) await drop(n)\n}', 'dropAll', 'function'],
        ['f.ts', 'async function closeBoth(a, b) {\n  try {\n    await a.close()\n    await b.close()\n  } catch (e) { note(e) }\n}', 'closeBoth', 'function'],
        ['f.ts', 'async function endBoth(a, b) {\n  try { await a.end() } catch (e) { throw e }\n  try { await b.end() } catch (e) { note(e) }\n}', 'endBoth', 'function'],
        ['f.ts', 'async function closeClones(open) {\n  await Promise.all(open.map((c) => c.close()))\n}', 'closeClones', 'Promise.all'],
        ['f.ts', "afterEach(async () => {\n  await assertCleanClones()\n  await closeClones()\n})", 'afterEach', 'hook'],
        ['global-setup.ts', 'export default async function setup() {\n  return async () => {\n    await dropRunDatabases(url)\n    check(await listRoles(url))\n  }\n}', 'teardown', 'teardown'],
        ['f.ts', 'async function dropRuns(url) {\n  await withAdmin(url, async (a) => {\n    const r = await a.query(q)\n    await a.query(r)\n  })\n}', 'dropRuns', 'function'],
        ['f.ts', 'async function cleanupAll(xs) {\n  try { await a() } catch {}\n  try { await b() } catch (e) { note(e) }\n}', 'cleanupAll', 'function'],
      ]
      for (const [file, src, name, kind] of bad) {
        const scan = scanCleanup(file, src, [])
        expect(scan.found.map((c) => `${c.name} (${c.kind})`), src).toEqual([`${name} (${kind})`])
      }
    },
    R118_MS,
  )

  test(
    'ARC-15 a small good harness that runs its cleanups through settleAll, or each in its own recording try, passes',
    () => {
      const good = [
        "import { settleAll } from './index'",
        'export async function closeClones(open) {',
        "  const r = await Promise.allSettled(open.map((c) => c.close()))",
        '  report(r)',
        '}',
        'export async function dropRunDatabases(url) {',
        '  const failures = []',
        '  let rows = []',
        '  try { rows = await list(url) } catch (e) { failures.push(e) }',
        '  for (const n of rows) {',
        '    try { await drop(n) } catch (e) { failures.push(e) }',
        '  }',
        '  if (failures.length > 0) throw new Error(failures.join())',
        '}',
        'export async function withAdmin(url, run) {',
        '  const admin = open(url)',
        '  try {',
        '    return await run(admin)',
        '  } catch (e) {',
        "    await settleAll('admin', [{ name: 'end', run: () => admin.end() }], { primary: e })",
        '    throw e',
        '  } finally {',
        '    try { await admin.end() } catch (e) { errors.push(e) }',
        '  }',
        '}',
        'class H {',
        '  async close() {',
        "    await settleAll(this.name, [{ name: 'endPool', run: () => endPool(this.pool) }, { name: 'drop', run: () => drop(this.name) }])",
        '  }',
        '  async transaction(fn) {',
        '    try { return await fn() } catch (e) {',
        '      try { await rollback() } catch {}',
        '      throw e',
        '    }',
        '  }',
        '}',
        "afterEach(async () => {\n  await settleAll('afterEach', [{ name: 'assert', run: () => assertCleanClones() }, { name: 'close', run: () => closeClones() }])\n})",
        'afterAll(async () => {\n  await assertCleanClones()\n})',
      ].join('\n')
      expect(scanCleanup('src/core/db/index.ts', good, ['catch {}']).problems).toEqual([])
      expect(scanCleanup('src/core/db/index.ts', good, []).problems, 'the empty catch needs its dbCatchAllow entry').toHaveLength(1)
      const setup = [
        'export function makeTeardown(deps, url, roles) {',
        "  return async () => { await settleAll('teardown', [{ name: 'drop', run: () => deps.dropRunDatabases(url) }, { name: 'roles', run: () => deps.listRoles(url) }]) }",
        '}',
        'export default async function setup() {\n  return makeTeardown(deps, url, await listRoles(url))\n}',
      ].join('\n')
      const scan = scanCleanup('src/core/db/global-setup.ts', setup, [])
      expect(scan.problems).toEqual([])
      expect(scan.regions.some((r) => r.kind === 'teardown'), 'the returned function is judged').toBe(true)
    },
    R118_MS,
  )

  test(
    'ARC-15 PLANT: the harness at 030e1d6f fails, naming close, withAdmin, the template catch, closeClones, assertCleanClones, dropOwnedRoles, dropRunDatabases, the afterEach and the teardown',
    () => {
      const read = (f: string): string => fs.readFileSync(`${DB_DIR}/__fixtures__/${f}`, 'utf8')
      const index = scanCleanup('src/core/db/__fixtures__/index-030e1d6f.ts', read('index-030e1d6f.ts'), allowedFor(`${DB_DIR}/index.ts`))
      for (const [name, kind] of [
        ['close', 'function'],
        ['withAdmin', 'finally'],
        ['createPg16Template', 'catch'],
        ['closeClones', 'Promise.all'],
        ['assertCleanClones', 'function'],
        ['dropOwnedRoles', 'function'],
        ['dropRunDatabases', 'function'],
      ] as const) {
        expect(named(index, name, kind), `${name} (${kind}) in:\n${index.problems.join('\n')}`).toBe(true)
      }
      const setup = scanCleanup('src/core/db/__fixtures__/vitest-setup-030e1d6f.ts', read('vitest-setup-030e1d6f.ts'), [])
      expect(named(setup, 'afterEach', 'hook'), setup.problems.join('\n')).toBe(true)
      expect(named(setup, 'afterAll'), 'one await in afterAll is not a sequence').toBe(false)
      const global = scanCleanup('src/core/db/__fixtures__/global-setup-030e1d6f.ts', read('global-setup-030e1d6f.ts'), [])
      expect(named(global, 'teardown', 'teardown'), global.problems.join('\n')).toBe(true)
      expect(index.problems.every((p) => p.startsWith('src/core/db/__fixtures__/index-030e1d6f.ts:'))).toBe(true)
    },
    R118_MS,
  )

  test(
    'ARC-15 every harness file in tools/test-homes.json exists and has no cleanup that stops at its first failure',
    () => {
      const list = homes().harness
      expect(Array.isArray(list), 'tools/test-homes.json has a harness list').toBe(true)
      const files = list as string[]
      expect(files.length).toBeGreaterThan(0)
      expect(files).toEqual(expect.arrayContaining([`${DB_DIR}/index.ts`, `${DB_DIR}/global-setup.ts`, `${DB_DIR}/vitest-setup.ts`]))
      const problems: string[] = []
      for (const file of files) {
        expect(fs.existsSync(file), `${file} (harness) exists`).toBe(true)
        const scan = scanCleanup(file, readOwnSource(file), allowedFor(file))
        if (file === `${DB_DIR}/global-setup.ts`) expect(scan.regions.some((r) => r.kind === 'teardown'), 'sentinel: the teardown is judged').toBe(true)
        if (file === `${DB_DIR}/vitest-setup.ts`) expect(scan.regions.filter((r) => r.kind === 'hook').map((r) => r.name).sort()).toEqual(['afterAll', 'afterEach'])
        if (file === `${DB_DIR}/index.ts`) expect(scan.regions.some((r) => r.name === 'close'), 'sentinel: close is judged').toBe(true)
        problems.push(...scan.problems)
      }
      expect(problems).toEqual([])
    },
    R118_MS,
  )
})
