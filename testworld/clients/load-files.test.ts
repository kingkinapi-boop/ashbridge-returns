// Builder unit tests for the loader's file and source checks (ARC-8, W00a): exact issues, never a raw ENOENT.
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_ROOT, clientFolders, loadClient } from './load'
import { TestWorldLoadError, type LoadIssue } from '../model/schema'

const folders = clientFolders()
const home = folders.get('C01')
if (home === undefined) throw new Error('fixture: no C01')
const name = home.slice(home.lastIndexOf('/') + 1)
const roots: string[] = []
let root = ''
let folder = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'w00a-load-'))
  roots.push(root)
  cpSync(join(SAMPLE_ROOT, name), join(root, name), { recursive: true })
  folder = join(root, name)
})
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

type Key = { accounts: { key: string; file: string; qboFile: string }[]; adjustingEntries: { id: string; source: { transactions: string[]; onboarding: string[] } }[] }
const editJson = (file: string, edit: (j: Record<string, unknown>) => void): void => {
  const p = join(folder, file)
  const j = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
  edit(j)
  writeFileSync(p, JSON.stringify(j))
}
const issues = (): LoadIssue[] => {
  try {
    loadClient('C01', { root })
  } catch (e) {
    if (e instanceof TestWorldLoadError) return e.issues
    throw e
  }
  return []
}
const firstKey = (): string => {
  const k = JSON.parse(readFileSync(join(folder, 'answer-key.json'), 'utf8')) as Key
  return k.accounts[0]?.key ?? ''
}
const issue = (check: LoadIssue['check'], record: string, reason: string): LoadIssue => ({ client: 'C01', check, record, reason })

describe('ARC-8 W00a missing client files', () => {
  it('a client with both files loads', () => {
    expect(issues()).toEqual([])
  })
  it('a missing onboarding.json is one file issue and nothing more', () => {
    rmSync(join(folder, 'onboarding.json'))
    expect(issues()).toEqual([issue('file', 'onboarding.json', 'the file is not in the client folder')])
  })
})

describe('ARC-8 W00a account files stay inside the client folder', () => {
  const setFile = (field: 'file' | 'qboFile', value: string): void => {
    editJson('answer-key.json', (j) => {
      const a = (j as unknown as Key).accounts[0]
      if (a !== undefined) a[field] = value
    })
  }
  it.each(['file', 'qboFile'] as const)('%s leading out by "../" is refused with its record and reason', (field) => {
    writeFileSync(join(root, 'x.csv'), 'a\n')
    setFile(field, '../x.csv')
    expect(issues()).toEqual([issue('file', `${firstKey()} ${field}`, '../x.csv is outside the client folder')])
  })
  it('the parent folder itself ("..") is outside', () => {
    setFile('file', '..')
    expect(issues()).toEqual([issue('file', `${firstKey()} file`, '.. is outside the client folder')])
  })
  it('an absolute path is outside', () => {
    setFile('qboFile', join(root, 'x.csv'))
    expect(issues()).toEqual([issue('file', `${firstKey()} qboFile`, `${join(root, 'x.csv')} is outside the client folder`)])
  })
  it('a file name that merely starts with two dots is inside', () => {
    const k = JSON.parse(readFileSync(join(folder, 'answer-key.json'), 'utf8')) as Key
    copyFileSync(join(folder, k.accounts[0]?.file ?? ''), join(folder, '..data.csv'))
    setFile('file', '..data.csv')
    expect(issues()).toEqual([])
  })
  it('a file that is not there names the account, the field and the file', () => {
    setFile('file', 'nope.csv')
    expect(issues()).toEqual([issue('file', `${firstKey()} file`, 'nope.csv is not in the client folder')])
  })
  it('a link that leads out of the folder is refused, for a file and for the parent folder', () => {
    writeFileSync(join(root, 'outside.csv'), 'a\n')
    symlinkSync(join(root, 'outside.csv'), join(folder, 'link.csv'))
    setFile('file', 'link.csv')
    expect(issues()).toEqual([issue('file', `${firstKey()} file`, 'link.csv leads out of the client folder')])
    symlinkSync(root, join(folder, 'up.csv'))
    setFile('file', 'up.csv')
    expect(issues()).toEqual([issue('file', `${firstKey()} file`, 'up.csv leads out of the client folder')])
  })
  it('a link that stays inside the folder is fine', () => {
    const k = JSON.parse(readFileSync(join(folder, 'answer-key.json'), 'utf8')) as Key
    symlinkSync(join(folder, k.accounts[0]?.file ?? ''), join(folder, 'inside.csv'))
    setFile('file', 'inside.csv')
    expect(issues()).toEqual([])
  })
})

describe('ARC-8 W00a adjusting entry sources', () => {
  const withSource = (source: string): LoadIssue[] => {
    editJson('answer-key.json', (j) => {
      const e = (j as unknown as Key).adjustingEntries[0]
      if (e !== undefined) e.source.onboarding = [source]
    })
    return issues().filter((i) => i.check === 'adjusting-entry')
  }
  const firstEntry = (): string => (JSON.parse(readFileSync(join(folder, 'answer-key.json'), 'utf8')) as Key).adjustingEntries[0]?.id ?? ''
  it('a source naming a top-level key, with or without a note, resolves', () => {
    for (const s of ['corporation', 'corporation (a note)', 'corporation(a note)', 'corporation (a note)  ']) expect(withSource(s), s).toEqual([])
  })
  it('a note not at the end does not resolve; the whole text is the key', () => {
    editJson('onboarding.json', (j) => {
      j['corporationy'] = 1
    })
    for (const s of ['corporation (x) (y)', 'corporation(x)y']) {
      expect(withSource(s), s).toEqual([issue('adjusting-entry', firstEntry(), `its source "${s}" is not in onboarding.json`)])
    }
  })
  it('an unknown transaction source is named', () => {
    editJson('answer-key.json', (j) => {
      const e = (j as unknown as Key).adjustingEntries[0]
      if (e !== undefined) e.source.transactions = ['NOPE']
    })
    expect(issues().filter((i) => i.check === 'adjusting-entry')).toEqual([issue('adjusting-entry', firstEntry(), 'its source "NOPE" is not a transaction of this client')])
  })
  it('a statement balance key for an undeclared account is named', () => {
    editJson('answer-key.json', (j) => {
      ;(j['statementBalances'] as Record<string, unknown>)['XTEST'] = []
    })
    expect(issues()).toEqual([issue('roll', 'XTEST', 'it has statement balances but the answer key declares no such account')])
  })
})

describe('ARC-8 W00a fault markers reach the model', () => {
  it('only a marked row carries dupOf or priorYear', () => {
    const c10 = loadClient('C10')
    const dup = c10.transactions.filter((t) => t.dupOf !== undefined)
    expect(dup.map((t) => t.id)).toEqual(['10-CHQ-2025-03-0009', '10-CHQ-2025-03-0011', '10-CHQ-2025-03-0049', '10-CHQ-2025-03-0053'].map((id) => dup.find((t) => t.id === id)?.id))
    expect(c10.transactions.filter((t) => t.priorYear === true)).toHaveLength(8)
    const plain = c10.transactions.find((t) => t.dupOf === undefined && t.priorYear === undefined)
    expect(plain).toBeDefined()
    expect(Object.hasOwn(plain ?? {}, 'dupOf')).toBe(false)
    expect(Object.hasOwn(plain ?? {}, 'priorYear')).toBe(false)
  })
})
