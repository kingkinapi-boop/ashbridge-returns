// A05 spec harness: temp roots, fixture copies and disk snapshots for the storage acceptance tests.
// Test support only; product code never imports this file.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES = path.dirname(fileURLToPath(import.meta.url))

/** Sample client C01 as the client app hands it over (made-up corporation id; legal name from reference/sample-clients/01-maple-ridge). */
export const C01 = { id: 'c01a0000-0000-4000-8000-000000000001', legalName: 'Maple Ridge Consulting Inc. (Test)' } as const
export const C01_FOLDER = 'Maple Ridge Consulting Inc. (Test) (c01a0000)'
export const C01_YEAR = 2025

/** The company folder without "(Test)" (SEC-11 fixture). */
export const NON_TEST = { id: 'c02b0000-0000-4000-8000-000000000002', legalName: 'Northgate Supplies Inc.' } as const
export const NON_TEST_FILE_ID = 'drv-nontest-0001'

export interface IndexEntry {
  drive_file_id: string
  path: string
  mime_type: string
}

export function readIndex(driveRoot: string): IndexEntry[] {
  const parsed = JSON.parse(fs.readFileSync(path.join(driveRoot, 'index.json'), 'utf8')) as { files: IndexEntry[] }
  return parsed.files
}

export function writeIndex(driveRoot: string, files: readonly IndexEntry[]): void {
  fs.writeFileSync(path.join(driveRoot, 'index.json'), JSON.stringify({ note: 'Made up (A05 spec, edited copy).', files }, null, 2))
}

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

/** A fresh temp folder per test; returns the folder and a cleanup. */
export function tempDir(label: string): { dir: string; cleanup: () => void } {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `a05-${label}-`)))
  return { dir, cleanup: () => { fs.rmSync(dir, { recursive: true, force: true }) } }
}

/** Copies a fixture Drive stand-in folder into `dest` and returns `dest`. */
export function copyFixture(name: 'drive-c01' | 'drive-no-test', dest: string): string {
  fs.cpSync(path.join(FIXTURES, name), dest, { recursive: true })
  return dest
}

/** Every regular file under `dir` (recursive, symlinks not followed), as absolute paths, sorted. */
export function allFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

/** Path, size, mtime and hash of every entry under `dir` (directories included), for "nothing changed" checks. */
export function snapshot(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      const st = fs.lstatSync(p)
      if (e.isDirectory()) {
        out.push(`dir ${path.relative(dir, p)}`)
        walk(p)
      } else {
        const hash = e.isFile() ? sha256(fs.readFileSync(p)) : 'link'
        out.push(`file ${path.relative(dir, p)} ${String(st.size)} ${String(st.mtimeMs)} ${hash}`)
      }
    }
  }
  walk(dir)
  return out.sort()
}

/** Runs `fn`; returns the error it threw or rejected with, or undefined when it succeeded. */
export async function failure(fn: () => unknown): Promise<Error | undefined> {
  try {
    await fn()
    return undefined
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

/** Function-valued property names of an object, own and inherited (stops at Object.prototype). */
export function methodNames(obj: object): string[] {
  const names = new Set<string>()
  let o: object | null = obj
  while (o !== null && o !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(o)) {
      if (k === 'constructor') continue
      const d = Object.getOwnPropertyDescriptor(o, k)
      if (d && typeof d.value === 'function') names.add(k)
    }
    o = Object.getPrototypeOf(o) as object | null
  }
  return [...names].sort()
}

/** Directory link type that works on Windows without admin rights (ignored on POSIX). */
export function linkDir(target: string, at: string): void {
  fs.symlinkSync(target, at, 'junction')
}
