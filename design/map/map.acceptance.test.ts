// D01 acceptance tests: the staff screen map (design/map/screens.md and navigation.md).
// Format is in design/map/FORMAT.md. Written by the spec job; the builder edits neither.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p: string): string => readFileSync(p, 'utf8')

const ROLES = ['preparer', 'ops', 'cpa', 'owner']
const SCREEN_STATES = ['empty', 'normal', 'error', 'flagged', 'approved', 'void']
// Keys the browser or a screen reader owns: no shortcut may use these (RV-51).
const RESERVED = [
  'tab', 'enter', 'space', 'esc', 'escape', 'insert', 'capslock', 'f5', 'f6', 'f7', 'f12',
  'ctrl', 'alt', 'meta', 'cmd', '/', "'", 'h', 'b', 'k', 'd', 'l', 'f', 't', 'e',
]

type Table = { header: string[]; rows: string[][] }

export function parseTables(md: string): Table[] {
  const lines = md.split('\n')
  const out: Table[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const next = lines[i + 1] ?? ''
    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(next)) {
      const cells = (l: string): string[] => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
      const t: Table = { header: cells(line).map((h) => h.toLowerCase()), rows: [] }
      let j = i + 2
      while ((lines[j] ?? '').trim().startsWith('|')) {
        t.rows.push(cells(lines[j] ?? ''))
        j++
      }
      out.push(t)
      i = j
    }
  }
  return out
}

function section(md: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im')
  const m = re.exec(md)
  if (!m) return ''
  const rest = md.slice(m.index + m[0].length)
  const n = /^##\s/m.exec(rest)
  return n ? rest.slice(0, n.index) : rest
}

const list = (s: string): string[] => s.split(',').map((x) => x.trim()).filter((x) => x !== '')
const col = (t: Table, name: string): number => t.header.indexOf(name)

export type Screen = { name: string; address: string; roles: string[]; rolesRaw: string; states: string[]; clauses: string[]; screenStates: string[]; pattern: string }

export function parseScreens(md: string): Screen[] {
  const t = parseTables(md).find((x) => ['name', 'address', 'roles', 'lifecycle states', 'clauses', 'screen states', 'pattern'].every((h) => x.header.includes(h)))
  if (!t) return []
  return t.rows.map((r) => {
    const rolesRaw = r[col(t, 'roles')] ?? ''
    return {
      name: r[col(t, 'name')] ?? '',
      address: r[col(t, 'address')] ?? '',
      rolesRaw,
      roles: list(rolesRaw).map((x) => x.replace(/\s*\(.*\)\s*$/, '').toLowerCase()),
      states: list(r[col(t, 'lifecycle states')] ?? '').map((x) => x.toLowerCase()),
      clauses: list(r[col(t, 'clauses')] ?? ''),
      screenStates: list(r[col(t, 'screen states')] ?? '').map((x) => x.toLowerCase()),
      pattern: r[col(t, 'pattern')] ?? '',
    }
  })
}

export type Link = { from: string; control: string; to: string; back: string }
export function parseLinks(md: string): Link[] {
  const t = parseTables(section(md, 'Links')).find((x) => x.header.includes('leads to'))
  if (!t) return []
  return t.rows.map((r) => ({ from: r[col(t, 'from')] ?? '', control: r[col(t, 'control')] ?? '', to: r[col(t, 'leads to')] ?? '', back: r[col(t, 'back goes to')] ?? '' }))
}
export type Entry = { role: string; screen: string }
export function parseEntries(md: string): Entry[] {
  const t = parseTables(section(md, 'Entry points')).find((x) => x.header.includes('role'))
  if (!t) return []
  return t.rows.map((r) => ({ role: (r[col(t, 'role')] ?? '').toLowerCase(), screen: r[col(t, 'screen')] ?? '' }))
}
export type Shortcut = { key: string; control: string; screen: string }
export function parseShortcuts(md: string): Shortcut[] {
  const t = parseTables(section(md, 'Shortcuts')).find((x) => x.header.includes('key'))
  if (!t) return []
  return t.rows.map((r) => ({ key: (r[col(t, 'key')] ?? '').replace(/`/g, '').trim(), control: r[col(t, 'control it repeats')] ?? '', screen: r[col(t, 'screen')] ?? '' }))
}

/** Roles allowed for a screen reached by a lifecycle state actor, from blueprint 02. */
export function actingStates(lifecycle: string): { state: string; role: string }[] {
  const t = parseTables(lifecycle).find((x) => x.header[0] === 'state')
  if (!t) return []
  const out: { state: string; role: string }[] = []
  for (const r of t.rows) {
    const who = (r[1] ?? '').toLowerCase()
    for (const role of ['preparer', 'ops', 'cpa']) if (new RegExp(`\\b${role}\\b`).test(who)) out.push({ state: (r[0] ?? '').toLowerCase(), role })
  }
  return out
}

export function rvClauses(screens06: string): string[] {
  return [...screens06.matchAll(/\*\*(RV-\d+)\*\*/g)].map((m) => m[1] ?? '')
}

// Checks as pure functions so the planted-fault tests can run them on bad input.
export function missingClauses(screens: Screen[], every: string, required: string[]): string[] {
  return required.filter((id) => {
    const n = Number(id.slice(3))
    if (n >= 50) return !new RegExp(`\\b${id}\\b`).test(every) && !screens.some((s) => s.clauses.includes(id))
    return !screens.some((s) => s.clauses.includes(id))
  })
}
export function uncoveredActions(screens: Screen[], acting: { state: string; role: string }[]): string[] {
  return acting
    .filter((a) => !screens.some((s) => s.states.includes(a.state) && s.roles.includes(a.role)))
    .map((a) => `${a.state}/${a.role}`)
}
export function roleViolations(screens: Screen[]): string[] {
  const bad: string[] = []
  for (const s of screens) {
    if (s.roles.length === 0) bad.push(`${s.name}: no roles`)
    for (const r of s.roles) if (!ROLES.includes(r)) bad.push(`${s.name}: unknown role ${r}`)
    for (const r of ['cpa', 'owner']) if (!s.roles.includes(r)) bad.push(`${s.name}: ${r} sees everything (SEC-2)`)
    if (s.roles.includes('preparer') && !/\(assigned only\)/i.test(s.rolesRaw)) bad.push(`${s.name}: preparer must be "(assigned only)"`)
    if (s.clauses.includes('RV-40') && (s.roles.includes('preparer') || s.roles.includes('ops'))) bad.push(`${s.name}: owner pipeline shown to ${s.roles.join('/')}`)
    if (s.clauses.includes('RV-30') && s.roles.includes('preparer')) bad.push(`${s.name}: ops work shown to preparer`)
    if (s.states.includes('review') && s.roles.includes('ops')) bad.push(`${s.name}: CPA review shown to ops`)
  }
  return bad
}
export function deadEnds(screens: Screen[], links: Link[], entries: Entry[]): string[] {
  const names = new Set(screens.map((s) => s.name))
  const bad: string[] = []
  for (const l of links) {
    if (!names.has(l.from)) bad.push(`link from unknown screen "${l.from}"`)
    if (!names.has(l.to)) bad.push(`"${l.control}" leads to unknown screen "${l.to}"`)
    if (!names.has(l.back)) bad.push(`Back from "${l.from}" goes to unknown screen "${l.back}"`)
    if (l.control === '' ) bad.push('link with no control text')
  }
  const inbound = new Set([...links.map((l) => l.to), ...entries.map((e) => e.screen)])
  for (const s of screens) {
    if (!inbound.has(s.name)) bad.push(`"${s.name}" is unreachable`)
    if (!links.some((l) => l.from === s.name)) bad.push(`"${s.name}" has no way out`)
  }
  return bad
}
export function seenByWrongRole(screens: Screen[], links: Link[], entries: Entry[]): string[] {
  const roles = (n: string): string[] => screens.find((s) => s.name === n)?.roles ?? []
  const bad: string[] = []
  for (const e of entries) if (!roles(e.screen).includes(e.role)) bad.push(`${e.role} entry "${e.screen}" is not visible to ${e.role}`)
  // a link from a screen to a screen: every role that sees the source must see the target, or the link is a dead button
  for (const l of links) for (const r of roles(l.from)) if (!roles(l.to).includes(r) && roles(l.to).length > 0) bad.push(`${r} sees "${l.control}" on "${l.from}" but not "${l.to}"`)
  return bad
}
export function shortcutProblems(shortcuts: Shortcut[], links: Link[], screens: Screen[]): string[] {
  const bad: string[] = []
  const seen = new Set<string>()
  const names = new Set([...screens.map((s) => s.name), 'all'])
  for (const s of shortcuts) {
    const parts = s.key.toLowerCase().split('+').map((p) => p.trim())
    if (parts.some((p) => RESERVED.includes(p)) || parts.length > 1) bad.push(`${s.key}: clashes with a browser or screen reader key, or uses a modifier`)
    if (!links.some((l) => l.control.toLowerCase() === s.control.toLowerCase())) bad.push(`${s.key}: "${s.control}" is not a visible control in Links`)
    if (!names.has(s.screen)) bad.push(`${s.key}: unknown screen "${s.screen}"`)
    const id = `${s.screen}|${s.key.toLowerCase()}`
    if (seen.has(id) || (s.screen !== 'all' && seen.has(`all|${s.key.toLowerCase()}`)) || (s.screen === 'all' && [...seen].some((x) => x.endsWith(`|${s.key.toLowerCase()}`)))) bad.push(`${s.key}: used twice`)
    seen.add(id)
  }
  return bad
}
export function mermaidMissing(md: string, screens: Screen[]): string[] {
  const m = /```mermaid\n([\s\S]*?)```/.exec(md)
  if (!m) return ['no mermaid block']
  return screens.filter((s) => !(m[1] ?? '').includes(s.name)).map((s) => `diagram lacks "${s.name}"`)
}

const screensPath = join(here, 'screens.md')
const navPath = join(here, 'navigation.md')
const built = existsSync(screensPath) && existsSync(navPath)
const screensMd = built ? read(screensPath) : ''
const navMd = built ? read(navPath) : ''
const screens = parseScreens(screensMd)
const links = parseLinks(navMd)
const entries = parseEntries(navMd)
const shortcuts = parseShortcuts(navMd)
const lifecycle = read(join(root, 'blueprint', '02-lifecycle.md'))
const rv = rvClauses(read(join(root, 'blueprint', '06-screens.md')))

describe('D01 files exist and parse', () => {
  test('RV-50 screens.md and navigation.md exist with at least ten screens, one row each, unique names and addresses', () => {
    expect(built, 'design/map/screens.md and navigation.md must exist').toBe(true)
    expect(screens.length).toBeGreaterThanOrEqual(10)
    expect(new Set(screens.map((s) => s.name)).size).toBe(screens.length)
    expect(new Set(screens.map((s) => s.address)).size).toBe(screens.length)
    for (const s of screens) {
      expect(s.address.startsWith('/'), `${s.name} address`).toBe(true)
      expect(s.pattern, `${s.name} pattern`).not.toBe('')
      expect(s.screenStates.length, `${s.name} screen states`).toBeGreaterThan(0)
      for (const st of s.screenStates) expect(SCREEN_STATES, `${s.name} state ${st}`).toContain(st)
    }
  })
  test('RV-50 the blueprint RV list was read (guards the tests themselves)', () => {
    expect(rv.length).toBeGreaterThanOrEqual(25)
    expect(rv).toContain('RV-40')
  })
})

describe('check 1: every RV clause is met by a screen', () => {
  test('RV-1 RV-20 RV-30 RV-40 RV-50 every RV clause of blueprint 06 is on a screen (RV-50 to RV-55 may sit under "Every screen")', () => {
    expect(missingClauses(screens, section(screensMd, 'Every screen'), rv)).toEqual([])
  })
  test('RV-1 planted: a map missing RV-40 is caught', () => {
    const planted: Screen[] = [{ name: 'A', address: '/a', roles: ROLES, rolesRaw: '', states: [], clauses: ['RV-1'], screenStates: ['normal'], pattern: 'x' }]
    expect(missingClauses(planted, '', ['RV-1', 'RV-40'])).toEqual(['RV-40'])
  })
  test('RV-50 every screen cites at least one clause and the screen map has a brief, a three-pane view, a queue, an ops screen and an owner screen', () => {
    for (const s of screens) expect(s.clauses.length, s.name).toBeGreaterThan(0)
    for (const id of ['RV-2', 'RV-4', 'RV-20', 'RV-21', 'RV-23', 'RV-30', 'RV-40']) expect(screens.some((s) => s.clauses.includes(id)), id).toBe(true)
  })
})

describe('check 2: every state with a person acting has a screen where they act', () => {
  test('RV-20 RV-30 blueprint 02 states acted by preparer, ops or CPA each have a screen that role can see', () => {
    const acting = actingStates(lifecycle)
    expect(acting.length).toBeGreaterThanOrEqual(8)
    expect(uncoveredActions(screens, acting)).toEqual([])
  })
  test('RV-20 planted: a map with no screen for respond/preparer is caught', () => {
    const planted: Screen[] = [{ name: 'A', address: '/a', roles: ['preparer'], rolesRaw: '', states: ['prepare'], clauses: [], screenStates: ['normal'], pattern: 'x' }]
    expect(uncoveredActions(planted, [{ state: 'respond', role: 'preparer' }])).toEqual(['respond/preparer'])
  })
})

describe('check 3: SEC-2 visibility', () => {
  test('SEC-2 roles are known, CPA and owner see every screen, a preparer sees only assigned returns, the owner pipeline and ops work stay with their roles', () => {
    expect(roleViolations(screens)).toEqual([])
  })
  test('SEC-2 planted: a preparer on the pipeline, no "(assigned only)", ops on review are caught', () => {
    const base = { address: '/x', rolesRaw: '', states: [] as string[], clauses: [] as string[], screenStates: ['normal'], pattern: 'x' }
    const bad = roleViolations([
      { ...base, name: 'Pipeline', roles: ['preparer', 'cpa', 'owner'], rolesRaw: 'preparer, cpa, owner', clauses: ['RV-40'] },
      { ...base, name: 'Review', roles: ['ops', 'cpa', 'owner'], states: ['review'] },
      { ...base, name: 'Ghost', roles: ['intern', 'cpa'] },
    ])
    expect(bad.length).toBeGreaterThanOrEqual(4)
  })
  test('SEC-2 every navigation entry and link is visible to the role that sees it', () => {
    expect(seenByWrongRole(screens, links, entries)).toEqual([])
    for (const r of ROLES) expect(entries.some((e) => e.role === r), `entry points for ${r}`).toBe(true)
  })
  test('SEC-2 planted: a preparer entry to an owner-only screen is caught', () => {
    const s: Screen[] = [{ name: 'Owner', address: '/o', roles: ['owner', 'cpa'], rolesRaw: '', states: [], clauses: [], screenStates: ['normal'], pattern: 'x' }]
    expect(seenByWrongRole(s, [], [{ role: 'preparer', screen: 'Owner' }]).length).toBe(1)
  })
})

describe('check 4: no dead ends', () => {
  test('RV-50 every link leads to a named screen, every screen is reachable and has a way out and a Back', () => {
    expect(links.length).toBeGreaterThanOrEqual(screens.length)
    expect(deadEnds(screens, links, entries)).toEqual([])
  })
  test('RV-50 planted: a link to an unnamed screen and an orphan screen are caught', () => {
    const s: Screen[] = [{ name: 'A', address: '/a', roles: ROLES, rolesRaw: '', states: [], clauses: [], screenStates: ['normal'], pattern: 'x' }, { name: 'B', address: '/b', roles: ROLES, rolesRaw: '', states: [], clauses: [], screenStates: ['normal'], pattern: 'x' }]
    const bad = deadEnds(s, [{ from: 'A', control: 'Go', to: 'Nowhere', back: 'A' }], [{ role: 'ops', screen: 'A' }])
    expect(bad.some((b) => b.includes('unknown screen "Nowhere"'))).toBe(true)
    expect(bad.some((b) => b.includes('"B" is unreachable'))).toBe(true)
  })
  test('RV-50 the flow diagram is Mermaid and names every screen', () => {
    expect(mermaidMissing(navMd, screens)).toEqual([])
    expect(mermaidMissing('no diagram', screens)).toEqual(['no mermaid block'])
  })
  test('RV-50 the navigation names the identity bar with corporation and year end, and what Back does', () => {
    const bar = section(navMd, 'Identity bar').toLowerCase()
    expect(bar).toContain('corporation')
    expect(bar).toContain('year end')
    expect(navMd.toLowerCase()).toContain('back')
  })
})

describe('check 5: keyboard shortcuts', () => {
  test('RV-51 every shortcut repeats a visible control, none uses a modifier or a reserved key, none repeats', () => {
    expect(shortcuts.length).toBeGreaterThanOrEqual(6)
    expect(shortcutProblems(shortcuts, links, screens)).toEqual([])
  })
  test('RV-51 planted: Ctrl+F, a hidden control and a repeated key are caught', () => {
    const l: Link[] = [{ from: 'A', control: 'Next flag', to: 'A', back: 'A' }]
    const s: Screen[] = [{ name: 'A', address: '/a', roles: ROLES, rolesRaw: '', states: [], clauses: [], screenStates: ['normal'], pattern: 'x' }]
    const bad = shortcutProblems(
      [
        { key: 'Ctrl+F', control: 'Next flag', screen: 'A' },
        { key: 'x', control: 'Secret control', screen: 'A' },
        { key: 'n', control: 'Next flag', screen: 'A' },
        { key: 'n', control: 'Next flag', screen: 'A' },
      ],
      l,
      s,
    )
    expect(bad.length).toBe(3)
  })
  test('RV-6 the CPA keys exist: next flag, next number, open source, comment, reviewed and next section, approve', () => {
    const c = shortcuts.map((x) => x.control.toLowerCase()).join(' | ')
    for (const k of ['next flag', 'next number', 'open source', 'comment', 'reviewed', 'approve']) expect(c, k).toContain(k)
  })
})

describe('house style', () => {
  test('RV-50 no em dash or en dash, no placeholder text in either file', () => {
    for (const md of [screensMd, navMd]) {
      expect(md).not.toMatch(/[–—]/)
      expect(md).not.toMatch(/\b(TBD|TODO|lorem|placeholder)\b/i)
    }
  })
})
