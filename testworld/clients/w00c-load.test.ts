// Builder unit tests for W00c's loader boundary: dates, roles, account files, client files, qualifiers (ARC-8).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_ROOT, clientFolders, loadClient } from './load'
import { TestWorldLoadError, type ClientId, type LoadIssue } from '../model/schema'

type Obj = Record<string, unknown>
const roots: string[] = []
let root = ''
let folder = ''
let id: ClientId = 'C01'
const open = (client: ClientId): void => {
  id = client
  const home = clientFolders().get(client)
  if (home === undefined) throw new Error('fixture: no client')
  const name = home.slice(home.lastIndexOf('/') + 1)
  root = mkdtempSync(join(tmpdir(), 'w00c-load-'))
  roots.push(root)
  cpSync(join(SAMPLE_ROOT, name), join(root, name), { recursive: true })
  folder = join(root, name)
}
beforeEach(() => {
  open('C01')
})
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

const edit = (file: string, f: (j: Obj) => void): void => {
  const p = join(folder, file)
  const j = JSON.parse(readFileSync(p, 'utf8')) as Obj
  f(j)
  writeFileSync(p, JSON.stringify(j))
}
const issues = (): LoadIssue[] => {
  try {
    loadClient(id, { root })
  } catch (e) {
    if (e instanceof TestWorldLoadError) return e.issues
    throw e
  }
  return []
}
const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({ client: id, check, record, reason })
const key = (): { accounts: Obj[]; transactions: Obj[]; adjustingEntries: Obj[]; fiscalYear: Obj } =>
  JSON.parse(readFileSync(join(folder, 'answer-key.json'), 'utf8')) as ReturnType<typeof key>

describe('ARC-8 W00c every date is a real calendar date', () => {
  it.each(['2025-03-99', '2025-02-30', '2025-03', '2025-3-05', '25-03-05', ''])('a transaction dated "%s" is refused, naming the field', (d) => {
    edit('answer-key.json', (j) => {
      ;((j['transactions'] as Obj[])[0] as Obj)['date'] = d
    })
    expect(issues()).toEqual([issue('schema', 'answer-key.json transactions.0.date', 'it is not a calendar date written YYYY-MM-DD')])
  })
  it('an adjusting entry date and both fiscal year dates are refused the same way', () => {
    edit('answer-key.json', (j) => {
      ;((j['adjustingEntries'] as Obj[])[0] as Obj)['date'] = '2025-02-29'
      const fy = j['fiscalYear'] as Obj
      fy['start'] = '2025-13-01'
      fy['end'] = '2025-00-10'
    })
    expect(issues().map((i) => i.record)).toEqual(['answer-key.json fiscalYear.start', 'answer-key.json fiscalYear.end', 'answer-key.json adjustingEntries.0.date'])
  })
  it('the last day of a leap February is a date', () => {
    expect(key().fiscalYear['start']).toMatch(/^\d{4}-/)
    edit('answer-key.json', (j) => {
      ;((j['adjustingEntries'] as Obj[])[0] as Obj)['date'] = '2024-02-29'
    })
    // W00c round 2 (RC3): the date falls outside C01's year, so the entry may be named for that; it is never refused as
    // not a calendar date.
    expect(issues().filter((i) => i.reason === 'it is not a calendar date written YYYY-MM-DD')).toEqual([])
  })
})

describe('ARC-8 W00c an account role is one of the four known', () => {
  it('a role outside the list is refused, naming the field', () => {
    edit('answer-key.json', (j) => {
      ;((j['accounts'] as Obj[])[0] as Obj)['role'] = 'savings (Test)'
    })
    const out = issues()
    expect(out).toHaveLength(1)
    expect(out[0]?.check).toBe('schema')
    expect(out[0]?.record).toBe('answer-key.json accounts.0.role')
  })
})

describe('ARC-8 W00c account files are regular CSV files of their own subfolder', () => {
  const set = (field: 'file' | 'qboFile', value: string): void => {
    edit('answer-key.json', (j) => {
      ;((j['accounts'] as Obj[])[0] as Obj)[field] = value
    })
  }
  const first = (): string => String(key().accounts[0]?.['key'])
  it.each([
    ['file', '', 'accounts'],
    ['file', 'accounts', 'accounts'],
    ['file', 'accounts/', 'accounts'],
    ['file', 'accounts/.csv', 'accounts'],
    ['file', 'accounts/x.txt', 'accounts'],
    ['file', 'accounts/sub/x.csv', 'accounts'],
    ['file', 'qbo/x.csv', 'accounts'],
    ['file', 'answer-key.json', 'accounts'],
    ['file', 'accountsx/x.csv', 'accounts'],
    ['qboFile', 'accounts/x.csv', 'qbo'],
    ['qboFile', 'qbo', 'qbo'],
    ['qboFile', 'qbo/a.txt', 'qbo'],
  ] as const)('%s set to "%s" is refused with the account, the field and the folder', (field, value, dir) => {
    set(field, value)
    expect(issues()).toEqual([issue('file', `${first()} ${field}`, `${value} is not a ${dir}/<name>.csv file of the client folder`)])
  })
  it('a one-letter file name is a file name', () => {
    const a = key().accounts[0] as Obj
    const name = String(a['file'])
    writeFileSync(join(folder, 'accounts/x.csv'), readFileSync(join(folder, name)))
    set('file', 'accounts/x.csv')
    expect(issues()).toEqual([])
  })
  it('a directory named like a CSV is not a regular file', () => {
    mkdirSync(join(folder, 'accounts/dir.csv'))
    set('file', 'accounts/dir.csv')
    expect(issues()).toEqual([issue('file', `${first()} file`, 'accounts/dir.csv is not a regular file')])
  })
  it('a link out of the folder is still refused as leading out', () => {
    mkdirSync(join(root, 'elsewhere'))
    writeFileSync(join(root, 'elsewhere', 'y.csv'), 'a\n')
    symlinkSync(join(root, 'elsewhere', 'y.csv'), join(folder, 'accounts/out.csv'))
    set('file', 'accounts/out.csv')
    expect(issues()).toEqual([issue('file', `${first()} file`, 'accounts/out.csv leads out of the client folder')])
  })
})

describe('ARC-8 W00c a client JSON file that is a directory or not JSON is a file issue', () => {
  it.each(['answer-key.json', 'onboarding.json'])('%s replaced by a directory', (name) => {
    rmSync(join(folder, name))
    mkdirSync(join(folder, name))
    expect(issues()).toEqual([issue('file', name, 'it is not a regular file')])
  })
  it.each(['answer-key.json', 'onboarding.json'])('%s that is not valid JSON', (name) => {
    writeFileSync(join(folder, name), '{"a": ')
    const out = issues()
    expect(out).toHaveLength(1)
    expect(out[0]?.check).toBe('file')
    expect(out[0]?.record).toBe(name)
    expect(out[0]?.reason.startsWith('it is not valid JSON: ')).toBe(true)
  })
  it('both files broken give both issues', () => {
    writeFileSync(join(folder, 'answer-key.json'), '{')
    rmSync(join(folder, 'onboarding.json'))
    mkdirSync(join(folder, 'onboarding.json'))
    expect(issues().map((i) => i.record)).toEqual(['answer-key.json', 'onboarding.json'])
  })
  it('a missing onboarding.json is still a file issue', () => {
    rmSync(join(folder, 'onboarding.json'))
    expect(issues()).toEqual([issue('file', 'onboarding.json', 'the file is not in the client folder')])
  })
})

describe('ARC-8 W00c a "(...)" qualifier on an onboarding source names a record of its key', () => {
  const entryId = (): string => String(key().adjustingEntries.find((j) => JSON.stringify(j).includes('(1200 Prepaid expenses)'))?.['id'])
  const use = (source: string): LoadIssue[] => {
    open('C07')
    edit('answer-key.json', (j) => {
      for (const e of j['adjustingEntries'] as { source: { onboarding: string[] } }[]) {
        e.source.onboarding = e.source.onboarding.map((s) => (s === 'prior_year_closing_balances (1200 Prepaid expenses)' ? source : s))
      }
    })
    return issues().filter((i) => i.check === 'adjusting-entry')
  }
  const bad = (source: string): LoadIssue[] => [issue('adjusting-entry', entryId(), `its source "${source}" is not in onboarding.json`)]
  it('the real qualifier resolves', () => {
    expect(use('prior_year_closing_balances (1200 Prepaid expenses)')).toEqual([])
  })
  it.each([
    'prior_year_closing_balances (1200 Wrong)',
    'prior_year_closing_balances (9999 Prepaid expenses)',
    'prior_year_closing_balances (x)',
    'prior_year_closing_balances ()',
    'prior_year_closing_balances (1200)',
    'nothing (1200 Prepaid expenses)',
    'tenants (1200 Prepaid expenses)',
    'prior_year_closing_balances (A200 Prepaid expenses)',
  ])('"%s" is refused, naming the source', (source) => {
    const out = use(source)
    expect(out.map((i) => i.reason)).toContain(`its source "${source}" is not in onboarding.json`)
  })
  it('a qualifier on a key with no account list is refused', () => {
    expect(use('owners (1200 Prepaid expenses)')).toEqual(bad('owners (1200 Prepaid expenses)'))
  })
  it('an answer id resolves whole', () => {
    open('C12')
    expect(issues().filter((i) => i.check === 'adjusting-entry')).toEqual([])
  })
})
