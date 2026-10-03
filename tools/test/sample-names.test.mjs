// FX8 acceptance tests (SEC-11, ARC-8): in every sample-client folder 01 to 15, every person or company the folder declares
// (answer-key.json and onboarding.json) is never named in any text of that folder without "(Test)" or "TEST" right after the name.
// Walk-driven: the declared names come from the files, never a typed list. The spec job wrote this file; the builder never edits it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLIENTS = path.join(ROOT, 'reference', 'sample-clients')
const folders = fs.readdirSync(CLIENTS).filter((d) => /^\d\d-/.test(d)).sort()

const TEXT = /\.(json|md|csv|txt|ofx|qbo|iif|tsv)$/i
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : TEXT.test(e.name) ? [p] : []
  })
}

// A declared person: a party of kind "person" in the answer key, or an owner in onboarding, named "<name> (Test)".
// (Companies are not people: a client may name a lender in their own words.) The bare name is what comes before "(Test)".
// The guard keeps a name only when it is "<name> (Test)" with a bare part of 5 characters or more (shorter names would match
// inside ordinary words). skippedPeople lists every declared person the guard drops, so no one is left unchecked silently (FX8 round 2).
function walkDeclared(folder) {
  const names = new Set()
  const skipped = []
  const add = (s) => {
    const m = typeof s === 'string' ? /^(.+?) \(Test\)$/.exec(s.trim()) : null
    if (m && m[1] && m[1].length >= 5) names.add(m[1])
    else skipped.push(String(s))
  }
  const read = (f) => (fs.existsSync(path.join(folder, f)) ? JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8')) : {})
  for (const party of read('answer-key.json').parties ?? []) if (party?.kind === 'person') add(party.name)
  const onboarding = read('onboarding.json')
  for (const owner of onboarding.owners ?? []) if (owner?.holder_kind === 'person' || owner?.holder_kind === undefined) add(owner?.name)
  return { names: [...names], skipped }
}
export function declaredNames(folder) {
  return walkDeclared(folder).names
}
export function skippedPeople(folder) {
  return walkDeclared(folder).skipped
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Bare uses of a name: the name (any case) not followed by " (Test)" or " TEST". Returns "file:line name" for each.
export function bareNames(folder) {
  const out = []
  const names = declaredNames(folder)
  for (const f of files(folder)) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const n of names) {
        const re = new RegExp(esc(n) + '(?! \\(Test\\)| TEST\\b)', 'gi')
        if (re.test(line)) out.push(`${path.relative(folder, f)}:${i + 1} ${n}`)
      }
    })
  }
  return out
}

const tmps = []
afterAll(() => tmps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))
function copyOf(folder) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fx8-'))
  tmps.push(d)
  const dest = path.join(d, path.basename(folder))
  fs.cpSync(folder, dest, { recursive: true })
  return dest
}

describe('FX8 bare names in sample-client text', () => {
  test('SEC-11 the walk finds all fifteen folders and declared people in each', () => {
    expect(folders).toHaveLength(15)
    // Most folders declare people; a folder that declares none (no persons in its files) has nothing to check.
    const withPeople = folders.filter((f) => declaredNames(path.join(CLIENTS, f)).length > 0)
    expect(withPeople.length).toBeGreaterThanOrEqual(12)
  })

  test('SEC-11 ARC-8 the rule catches a planted bare name and passes the clean copy', () => {
    const clean = copyOf(path.join(CLIENTS, '01-maple-ridge'))
    expect(bareNames(clean)).toEqual([])
    const planted = copyOf(path.join(CLIENTS, '01-maple-ridge'))
    const [name] = declaredNames(planted)
    const profile = path.join(planted, 'profile.md')
    fs.appendFileSync(profile, `\n- ${name} lent the company money.\n`)
    expect(bareNames(planted).some((m) => m.startsWith('profile.md:') && m.endsWith(name))).toBe(true)
  })

  test('SEC-11 ARC-8 no declared person in any folder is skipped by the 5-character name guard', () => {
    const skipped = folders.flatMap((f) => skippedPeople(path.join(CLIENTS, f)).map((n) => `${f} ${n}`))
    expect(skipped).toEqual([])
  })

  test('SEC-11 the skip check catches a planted short name and a planted person without "(Test)"', () => {
    const planted = copyOf(path.join(CLIENTS, '01-maple-ridge'))
    const keyPath = path.join(planted, 'answer-key.json')
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
    key.parties = [...(key.parties ?? []), { kind: 'person', name: 'Li (Test)' }, { kind: 'person', name: 'Harriet Vale TEST' }]
    fs.writeFileSync(keyPath, JSON.stringify(key, null, 2))
    expect(skippedPeople(planted)).toEqual(['Li (Test)', 'Harriet Vale TEST'])
    expect(skippedPeople(copyOf(path.join(CLIENTS, '01-maple-ridge')))).toEqual([])
  })

  for (const f of folders) {
    test(`SEC-11 ARC-8 ${f}: no declared name appears without "(Test)" or "TEST" after it`, () => {
      expect(bareNames(path.join(CLIENTS, f))).toEqual([])
    })
  }
})
