// A01 spec harness: fixture loading, word-box comparison and disk snapshots for the reading acceptance tests.
// Test support only; product code never imports this file.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ReadingDocument, ReadingResult } from '../../../../contracts/reading'
import { expectedFileName, FIXTURES_DIR, type Expected, type ExpectedBox, type ExpectedWord } from './make-fixtures'

/** Card check 1: every box within one hundredth of the page. */
export const TOLERANCE = 0.01

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

export function fixtureBytes(name: string): Uint8Array {
  return Uint8Array.from(fs.readFileSync(path.join(FIXTURES_DIR, name)))
}

/** A reading document for a committed fixture: fingerprint is the SHA-256 of the bytes. */
export function fixtureDoc(name: string): ReadingDocument {
  const bytes = fixtureBytes(name)
  return { fingerprint: sha256(bytes), fileName: name, bytes }
}

export function expected(name: string): Expected {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, expectedFileName(name)), 'utf8')) as Expected
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE

export function boxesNear(a: ExpectedBox, b: ExpectedBox): boolean {
  return a.page === b.page && near(a.left, b.left) && near(a.top, b.top) && near(a.width, b.width) && near(a.height, b.height)
}

/**
 * Problems comparing a result's words with the expected words: the texts must match in reading order (page by
 * page), with no word missing or extra, and every box within TOLERANCE on page, left, top, width and height.
 * Returns an empty list when they match.
 */
export function wordProblems(result: Pick<ReadingResult, 'words'>, want: readonly ExpectedWord[]): string[] {
  const got = [...result.words].sort((a, b) => a.box.page - b.box.page || a.order - b.order)
  const problems: string[] = []
  const gotTexts = got.map((w) => `${String(w.box.page)}:${w.text}`)
  const wantTexts = want.map((w) => `${String(w.box.page)}:${w.text}`)
  if (JSON.stringify(gotTexts) !== JSON.stringify(wantTexts)) {
    problems.push(`words differ: got ${JSON.stringify(gotTexts)}, want ${JSON.stringify(wantTexts)}`)
    return problems
  }
  want.forEach((w, i) => {
    const g = got[i]
    if (g === undefined || !boxesNear(g.box, w.box)) {
      problems.push(`"${w.text}" on page ${String(w.box.page)}: got ${JSON.stringify(g?.box)}, want ${JSON.stringify(w.box)}`)
    }
  })
  return problems
}

/** A fresh temp folder per test; returns the folder and a cleanup. */
export function tempDir(label: string): { dir: string; cleanup: () => void } {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `a01-${label}-`)))
  return {
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Every file under `dir` with its size and modified time, sorted: equal snapshots mean nothing was written. */
export function snapshot(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .map((e) => {
      const p = path.join(e.parentPath, e.name)
      const st = fs.statSync(p)
      return `${path.relative(dir, p)} ${String(st.size)} ${String(st.mtimeMs)}`
    })
    .sort()
}

/** Runs `fn` and returns the error it threw or rejected with, or undefined when it did not fail. */
export async function failure(fn: () => Promise<unknown>): Promise<Error | undefined> {
  try {
    await fn()
    return undefined
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}
