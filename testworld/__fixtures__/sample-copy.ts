// Test helpers for the W00 acceptance tests (spec-writer owned).
// They copy reference/sample-clients/ into a temp folder so a test can plant one fault
// without ever touching reference/ (the card forbids changing the sample clients).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SAMPLE_ROOT = join(REPO_ROOT, 'reference', 'sample-clients');

/** Client id to its folder under reference/sample-clients/. */
export const FOLDERS = {
  C01: '01-maple-ridge',
  C02: '02-halton-haulage',
  C03: '03-bluewater-renovations',
  C04: '04-lakeshore-eats',
  C05: '05-eglinton-holdings',
  C06: '06-eglinton-retail',
  C07: '07-riverdale-rentals',
  C08: '08-queen-west-design',
  C09: '09-scarborough-robotics',
  C10: '10-danforth-cleaning',
} as const;
export type FixtureClientId = keyof typeof FOLDERS;
export const CLIENT_IDS = Object.keys(FOLDERS) as FixtureClientId[];

const made: string[] = [];

/** A fresh temp copy of the whole sample-clients folder; returns its root. */
export function copySamples(): string {
  const root = mkdtempSync(join(tmpdir(), 'w00-samples-'));
  cpSync(SAMPLE_ROOT, root, { recursive: true });
  made.push(root);
  return root;
}

export function removeCopies(): void {
  for (const r of made.splice(0)) rmSync(r, { recursive: true, force: true });
}

export function readRaw<T = any>(root: string, id: FixtureClientId, file: string): T {
  return JSON.parse(readFileSync(join(root, FOLDERS[id], file), 'utf8')) as T;
}

/** Rewrites one JSON file of a client in the temp copy. */
export function editJson(root: string, id: FixtureClientId, file: string, edit: (j: any) => void): void {
  const p = join(root, FOLDERS[id], file);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  edit(j);
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}

/** Rewrites one text file of a client in the temp copy. */
export function editText(root: string, id: FixtureClientId, file: string, edit: (t: string) => string): void {
  const p = join(root, FOLDERS[id], file);
  writeFileSync(p, edit(readFileSync(p, 'utf8')));
}

/** Independent Luhn check (the business-number and SIN check digit), written here on purpose. */
export function luhnValid(s: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = Number(s[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Dollars (a JSON number with at most two decimals) to cents, for comparing against the raw answer keys. */
export const rawCents = (x: number | undefined | null): number => Math.round((x ?? 0) * 100);
