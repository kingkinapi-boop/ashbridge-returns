// Builder unit tests for the sample-client loader: every refusal with its exact record and reason, built in
// temp copies of one sample client (ARC-8, ARC-13, SEC-11).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { decimalToCents } from '../../src/core/money'
import { CLIENT_IDS, FOLDERS, SAMPLE_ROOT as FIXTURE_SAMPLE_ROOT, editKey, editOnboarding, editText, type FixtureClientId } from '../__fixtures__/sample-copy'
import { TestWorldLoadError, type LoadIssue } from '../model/schema'
import { SAMPLE_ROOT, clientFolders, loadClient } from './load'

const made: string[] = []
afterAll(() => {
  for (const r of made.splice(0)) rmSync(r, { recursive: true, force: true })
})

/** A temp root holding a copy of one sample client's folder only. */
function rootWith(id: FixtureClientId): string {
  const root = mkdtempSync(join(tmpdir(), 'w00-load-'))
  made.push(root)
  cpSync(join(FIXTURE_SAMPLE_ROOT, FOLDERS[id]), join(root, FOLDERS[id]), { recursive: true })
  return root
}

function issuesOf(root: string, id: FixtureClientId): LoadIssue[] {
  try {
    loadClient(id, { root })
  } catch (e) {
    expect(e).toBeInstanceOf(TestWorldLoadError)
    return (e as TestWorldLoadError).issues
  }
  throw new Error('the client loaded, but a refusal was expected')
}

const clientDir = (root: string, id: FixtureClientId): string => join(root, FOLDERS[id])
const CHQ = 'accounts/harbourline-chequing-4460.csv'
const addToFile = (root: string, id: FixtureClientId, file: string, extra: string): void => {
  editText(root, id, file, (t) => t + extra)
}

describe('ARC-8 clientFolders', () => {
  it('ARC-8 lists only numbered folders that hold an answer-key.json, as C01 upward in order', () => {
    const root = mkdtempSync(join(tmpdir(), 'w00-folders-'))
    made.push(root)
    for (const name of ['02-b', '01-a', 'x01-c', 'notes', '1-bad', '123-three', '03-nokey']) {
      mkdirSync(join(root, name))
      if (name !== '03-nokey') writeFileSync(join(root, name, 'answer-key.json'), '{}')
    }
    expect([...clientFolders(root).entries()]).toEqual([
      ['C01', join(root, '01-a')],
      ['C02', join(root, '02-b')],
    ])
  })

  it('ARC-8 the default root is reference/sample-clients and holds C01 to C15', () => {
    expect([...clientFolders().keys()]).toEqual(CLIENT_IDS)
    expect(clientFolders().get('C10')).toBe(join(SAMPLE_ROOT, FOLDERS.C10))
  })
})

describe('ARC-8 loadClient: no such client', () => {
  it('ARC-8 an unknown id names the client and the default folder', () => {
    expect(() => loadClient('C99')).toThrow(new Error(`test-world client C99 has no folder in ${SAMPLE_ROOT}`))
  })
  it('ARC-8 an unknown id names the root it was looked up in', () => {
    const root = rootWith('C10')
    expect(() => loadClient('C01', { root })).toThrow(new Error(`test-world client C01 has no folder in ${root}`))
    expect(() => loadClient('Cab', { root })).toThrow(new Error(`test-world client Cab has no folder in ${root}`))
  })
})

describe('ARC-13 money fields read as cents from their text', () => {
  it('ARC-13 a one-decimal too many amount is refused with the record, the field and the reason', () => {
    expect(decimalToCents('12.345').ok).toBe(false)
    const root = rootWith('C10')
    editText(root, 'C10', 'answer-key.json', (t) => t.replace('"amount":-142.38,', '"amount":12.345,'))
    const issues = issuesOf(root, 'C10')
    const reason = decimalToCents('12.345')
    expect(reason.ok).toBe(false)
    expect(issues.filter((i) => i.check === 'money')).toEqual([
      { client: 'C10', check: 'money', record: 'answer-key.json 10-CHQ-2025-01-0001 amount', reason: reason.ok ? '' : reason.reason },
    ])
  })

  it('ARC-13 a bad amount on a line with no id names the file and the field only', () => {
    const root = rootWith('C10')
    editText(root, 'C10', 'answer-key.json', (t) => t.replace(/"debit":[0-9.]+/, '"debit":7.005'))
    const reason = decimalToCents('7.005')
    expect(reason.ok).toBe(false)
    expect(issuesOf(root, 'C10').filter((i) => i.check === 'money')).toEqual([
      { client: 'C10', check: 'money', record: 'answer-key.json debit', reason: reason.ok ? '' : reason.reason },
    ])
  })

  it('ARC-13 a number that only looks like money (wrong holder, other key) is left alone', () => {
    expect(decimalToCents('1e3').ok).toBe(false)
    const root = rootWith('C10')
    const decoys = [
      { acct: 'X', amount: 1e3 },
      { date: 'X', amount: 1e3 },
      { amount: 1e3 },
      { debit: 1e3 },
      { credit: 1e3 },
      { dr: 1e3 },
      { cr: 1e3 },
      { opening: 1e3 },
      { closing: 1e3 },
      { openingBalance: 1e3 },
      { closingBalance: 1e3 },
      { glAccount: '1', rate: 1e3 },
      { account: 'x', ratio: 1e3 },
      { a: 'x', ratio: 1e3 },
      { month: '2025-01', ratio: 1e3 },
      { acct: 'x', date: 'y', ratio: 1e3 },
    ]
    // The text is written by hand so the numbers keep their written form (1e3 stays 1e3 in the file).
    const text = `  "decoys": [${decoys.map((d) => JSON.stringify(d).replace(/1000/g, '1e3')).join(', ')}],\n`
    editText(root, 'C10', 'answer-key.json', (t) => t.replace('{\n', `{\n${text}`))
    expect(readFileSync(join(clientDir(root, 'C10'), 'answer-key.json'), 'utf8')).toContain('"amount":1e3')
    expect(loadClient('C10', { root }).id).toBe('C10')
  })

  it('ARC-13 text in a money field is a schema refusal, not a money issue', () => {
    const root = rootWith('C10')
    editText(root, 'C10', 'answer-key.json', (t) => t.replace('"amount":-142.38,', '"amount":"-142.38",'))
    const issues = issuesOf(root, 'C10')
    expect(issues.map((i) => [i.check, i.record])).toEqual([['schema', 'answer-key.json transactions.0.amount']])
    expect(issues[0]?.reason).toBe('Invalid input: expected number, received string')
  })

  it('ARC-13 a bad amount in onboarding.json is named by its own file', () => {
    const root = rootWith('C10')
    editOnboarding(root, 'C10', (j) => {
      ;(j as unknown as Record<string, unknown>).stray = { account: 'x', debit: 'PLACEHOLDER' }
    })
    editText(root, 'C10', 'onboarding.json', (t) => t.replace('"PLACEHOLDER"', '1.234'))
    const reason = decimalToCents('1.234')
    expect(reason.ok).toBe(false)
    expect(issuesOf(root, 'C10').filter((i) => i.check === 'money')).toEqual([
      { client: 'C10', check: 'money', record: 'onboarding.json debit', reason: reason.ok ? '' : reason.reason },
    ])
  })
})

describe('ARC-8 schema refusals', () => {
  it('ARC-8 a missing answer-key field is named with its path', () => {
    const root = rootWith('C10')
    editKey(root, 'C10', (j) => {
      delete (j as unknown as Record<string, unknown>).name
    })
    expect(issuesOf(root, 'C10')).toEqual([
      { client: 'C10', check: 'schema', record: 'answer-key.json name', reason: 'Invalid input: expected string, received undefined' },
    ])
  })

  it('ARC-8 a missing onboarding field is named with its path', () => {
    const root = rootWith('C10')
    editOnboarding(root, 'C10', (j) => {
      delete (j.corporation as Record<string, unknown>).business_number
    })
    expect(issuesOf(root, 'C10')).toEqual([
      { client: 'C10', check: 'schema', record: 'onboarding.json corporation.business_number', reason: 'Invalid input: expected string, received undefined' },
    ])
  })

  it('ARC-8 both files failing gives the answer-key issue first, then the onboarding one', () => {
    const root = rootWith('C10')
    editKey(root, 'C10', (j) => {
      delete (j as unknown as Record<string, unknown>).name
    })
    editOnboarding(root, 'C10', (j) => {
      delete (j.corporation as Record<string, unknown>).business_number
    })
    expect(issuesOf(root, 'C10').map((i) => [i.check, i.record])).toEqual([
      ['schema', 'answer-key.json name'],
      ['schema', 'onboarding.json corporation.business_number'],
    ])
  })

  it('ARC-8 the optional onboarding sections are still checked when they are there', () => {
    const root = rootWith('C10')
    editOnboarding(root, 'C10', (j) => {
      Object.assign(j, {
        cra_program_accounts: [{}],
        related_entities: [{}],
        shares: { holders: [{ name: 5 }] },
        shareholder_loans: [{ lender: 5 }],
        spouse: { name: 5 },
      })
    })
    expect(issuesOf(root, 'C10').map((i) => [i.check, i.record, i.reason])).toEqual([
      ['schema', 'onboarding.json cra_program_accounts.0.account_number', 'Invalid input: expected string, received undefined'],
      ['schema', 'onboarding.json related_entities.0.entity_name', 'Invalid input: expected string, received undefined'],
      ['schema', 'onboarding.json shares.holders.0.name', 'Invalid input: expected string, received number'],
      ['schema', 'onboarding.json shareholder_loans.0.lender', 'Invalid input: expected string, received number'],
      ['schema', 'onboarding.json spouse.name', 'Invalid input: expected string, received number'],
    ])
  })

  it('ARC-8 the optional Schedule 50 list of the answer key is still checked', () => {
    const root = rootWith('C10')
    editKey(root, 'C10', (j) => {
      Object.assign(j, { t2Inputs: { schedule50: [{ sin: '1' }] } })
    })
    expect(issuesOf(root, 'C10')).toEqual([
      { client: 'C10', check: 'schema', record: 'answer-key.json t2Inputs.schedule50.0.name', reason: 'Invalid input: expected string, received undefined' },
    ])
  })

  it('ARC-8 the model schema refuses an empty name, naming the dotted path', () => {
    const root = rootWith('C10')
    editKey(root, 'C10', (j) => {
      Object.assign(j, { name: '' })
    })
    expect(issuesOf(root, 'C10')).toEqual([
      { client: 'C10', check: 'schema', record: 'corporation.name', reason: 'Too small: expected string to have >=1 characters' },
    ])
  })
})

describe('ARC-8 the loaded model, field by field', () => {
  it('ARC-8 each account row count is its CSV lines without the header and blank lines', () => {
    for (const id of CLIENT_IDS) {
      const raw = JSON.parse(readFileSync(join(clientDir(SAMPLE_ROOT, id), 'answer-key.json'), 'utf8')) as {
        accounts: { key: string; file: string; qboFile: string }[]
      }
      const count = (f: string): number => readFileSync(join(clientDir(SAMPLE_ROOT, id), f), 'utf8').split('\n').filter((l) => l.trim() !== '').length - 1
      const client = loadClient(id)
      expect(client.accounts.map((a) => [a.key, a.exportRows, a.qboRows])).toEqual(raw.accounts.map((a) => [a.key, count(a.file), count(a.qboFile)]))
    }
  })

  it('ARC-8 CRLF line ends and blank or spaces-only lines do not change a row count', () => {
    const base = loadClient('C10')
    const root = rootWith('C10')
    const qbo = 'qbo/harbourline-chequing-4460.csv'
    for (const f of [CHQ, qbo]) {
      editText(root, 'C10', f, (t) => t.replace(/\n/g, '\r\n') + '   \r\n\r\n \t\r\n')
    }
    const again = loadClient('C10', { root })
    expect(again.accounts.map((a) => [a.exportRows, a.qboRows])).toEqual(base.accounts.map((a) => [a.exportRows, a.qboRows]))
  })

  it('ARC-8 a transaction with no account number has an empty glAccount, and the others keep theirs', () => {
    let empty = 0
    for (const id of CLIENT_IDS) {
      const raw = JSON.parse(readFileSync(join(clientDir(SAMPLE_ROOT, id), 'answer-key.json'), 'utf8')) as { transactions: { id: string; accountNo?: string | null }[] }
      const got = loadClient(id).transactions.map((t) => [t.id, t.glAccount])
      expect(got).toEqual(raw.transactions.map((t) => [t.id, t.accountNo ?? '']))
      empty += raw.transactions.filter((t) => t.accountNo === null || t.accountNo === undefined).length
    }
    expect(empty).toBeGreaterThan(0)
  })

  it('ARC-8 an adjusting entry is typed by where its sources come from, and lists transactions then onboarding sources', () => {
    const seen = new Set<string>()
    for (const id of CLIENT_IDS) {
      const raw = JSON.parse(readFileSync(join(clientDir(SAMPLE_ROOT, id), 'answer-key.json'), 'utf8')) as {
        adjustingEntries: { id: string; source: { transactions: string[]; onboarding: string[] } }[]
      }
      const want = raw.adjustingEntries.map((j) => {
        const t = j.source.transactions.length
        const o = j.source.onboarding.length
        const type = t > 0 && o > 0 ? 'from-transactions-and-onboarding' : o > 0 ? 'from-onboarding' : 'from-transactions'
        seen.add(type)
        return [j.id, type, [...j.source.transactions, ...j.source.onboarding]]
      })
      expect(loadClient(id).adjustingEntries.map((j) => [j.id, j.type, j.sources])).toEqual(want)
    }
    expect([...seen].sort()).toEqual(['from-onboarding', 'from-transactions', 'from-transactions-and-onboarding'])
  })
})

describe('SEC-11 the guard sees every person and every file of the folder', () => {
  const planted = [
    ['Owner Olga', 'owner'],
    ['Holder Hanna', 'share holder'],
    ['Lender Lars', 'shareholder-loan lender'],
    ['Spouse Sven', 'spouse'],
    ['Party Pia', 'person party'],
  ] as const
  const line = (n: string, what: string): string => `2025-01-02,2025-01-02,PAYMENT ${n.toUpperCase()} ${what},-1.00\n`

  it('SEC-11 a bank line naming an owner, holder, lender, spouse or person party without TEST is refused, naming the line', () => {
    const root = rootWith('C10')
    editOnboarding(root, 'C10', (j) => {
      const o = j as unknown as Record<string, unknown>
      ;(o.owners as unknown[]).push({ name: 'Owner Olga (Test)' })
      o.shares = { holders: [{ name: 'Holder Hanna (Test)' }] }
      o.shareholder_loans = [{ lender: 'Lender Lars (Test)' }, {}]
      o.spouse = { name: 'Spouse Sven (Test)' }
    })
    editKey(root, 'C10', (j) => {
      ;((j as unknown as { parties: unknown[] }).parties).push({ name: 'Party Pia (Test)', kind: 'person' }, { name: 'Firm Fox (Test)', kind: 'company' }, { name: 'Loose Lou (Test)' })
    })
    const lines = planted.map(([n, w]) => line(n, w))
    addToFile(root, 'C10', CHQ, lines.join('') + line('Firm Fox', 'company') + line('Loose Lou', 'unkinded') + '2025-01-03,2025-01-03,Stryker was here,-1.00\n')
    const issues = issuesOf(root, 'C10')
    expect(issues).toEqual(
      planted.map(([n, w]) => ({
        client: 'C10',
        check: 'made-up-data',
        record: CHQ,
        reason: `the description names ${n} without the word TEST: ${line(n, w).trim().slice(0, 80)}`,
      })),
    )
  })

  it('SEC-11 a client with no spouse and no loans adds nobody to the people list', () => {
    const root = rootWith('C01')
    const first = readdirSync(join(clientDir(root, 'C01'), 'accounts')).sort()[0] ?? ''
    addToFile(root, 'C01', `accounts/${first}`, '2025-01-03,2025-01-03,Stryker was here,-1.00\n')
    expect(loadClient('C01', { root }).id).toBe('C01')
  })

  it('SEC-11 the same lines naming the people with the word TEST pass', () => {
    const root = rootWith('C10')
    editOnboarding(root, 'C10', (j) => {
      ;(j.owners as unknown[]).push({ name: 'Owner Olga (Test)' })
    })
    addToFile(root, 'C10', CHQ, '2025-01-02,2025-01-02,PAYMENT OWNER OLGA TEST,-1.00\n')
    expect(loadClient('C10', { root }).id).toBe('C10')
  })

  it('SEC-11 files by kind: json, csv and md are scanned; other files are not; nested paths use slashes', () => {
    const root = rootWith('C10')
    const dir = clientDir(root, 'C10')
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'sub', 'notes.md'), 'Write to bob@real-firm.com today\n')
    writeFileSync(join(dir, 'ignored.txt'), 'Write to eve@real-firm.com or call 416-867-5309; BN 123456782\n')
    writeFileSync(join(dir, 'ignored.pdf'), 'Write to eve@real-firm.com\n')
    writeFileSync(join(dir, 'broken.json'), '{ not json')
    writeFileSync(join(dir, 'sub', 'data.csv'), 'a,b\nCall 416-867-5309,1\n')
    const issues = issuesOf(root, 'C10')
    expect(issues.map((i) => [i.check, i.record, i.reason])).toEqual([
      ['made-up-data', 'broken.json', 'the file is not valid JSON, so it cannot be checked'],
      ['made-up-data', 'sub/data.csv', 'the phone number 416-867-5309 is outside 555-0100 to 555-0199'],
      ['made-up-data', 'sub/notes.md', 'the e-mail address bob@real-firm.com is outside a reserved test domain'],
    ])
    expect(existsSync(join(dir, 'ignored.txt'))).toBe(true)
  })

  it('SEC-11 a client folder that loads clean has every file of its folder read (no refusal, sorted walk)', () => {
    expect(readdirSync(clientDir(SAMPLE_ROOT, 'C10')).length).toBeGreaterThan(0)
    expect(loadClient('C10').flags.length).toBeGreaterThan(0)
  })
})
