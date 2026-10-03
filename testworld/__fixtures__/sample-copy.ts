// Test helpers for the W00 acceptance tests (spec-writer owned).
// They copy reference/sample-clients/ into a temp folder so a test can plant one fault
// without ever touching reference/ (the card forbids changing the sample clients).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SAMPLE_ROOT = join(REPO_ROOT, 'reference', 'sample-clients');

// One Luhn (SC R50, A463 row 9): the check digit comes from the sample generator's home, independent of guard.ts under
// test. util.mjs has no type declarations, so it is loaded by file URL and given its one signature here.
const util = (await import(pathToFileURL(join(SAMPLE_ROOT, 'lib', 'util.mjs')).href)) as { luhnValid: (s: string) => boolean };
/** The Luhn check digit (what a real business number or SIN passes): lib/util.mjs's own function, re-exported. */
export const { luhnValid } = util;

/** Client id to its folder under reference/sample-clients/ (one id per numbered folder; 11 to 15 from W14 and W15). */
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
  C11: '11-humber-bay-software',
  C12: '12-kensington-market-crafts',
  C13: '13-sharma-medicine',
  C14: '14-rouge-valley-landscaping-2024',
  C15: '15-rouge-valley-landscaping-2025',
} as const;
export type FixtureClientId = keyof typeof FOLDERS;
export const CLIENT_IDS = Object.keys(FOLDERS) as FixtureClientId[];

/** The parts of a raw answer-key.json these tests read or plant faults in (dollars as JSON numbers). */
export interface RawKey {
  accounts: { key: string; file?: string; qboFile?: string; role: string; glAccount: string }[];
  transactions: {
    id: string;
    acct: string;
    date: string;
    amount: number;
    line?: number;
    qboLine?: number;
    pair?: string;
    account: string;
    accountNo: string | null;
    missingFromExport?: boolean;
  }[];
  statementBalances: Record<string, { month: string; opening: number; closing: number; rolls: boolean; note?: string }[]>;
  adjustingEntries: {
    id: string;
    reason: string;
    lines: { account: string; gifi?: number | null; debit: number; credit: number }[];
    source: { transactions: string[]; onboarding: string[] };
  }[];
  trialBalance: Record<
    'opening' | 'unadjusted' | 'adjusted',
    { rows: { account: string; gifi: number | null; gifiStatus?: string; debit: number; credit: number }[] }
  >;
  flags: { id: string; rule: string; detail: string }[];
  prior_year?: unknown;
}

/** The parts of a raw onboarding.json these tests read or plant faults in. */
export interface RawOnboarding {
  corporation: { legal_name: string; business_number: string };
  owners: { name: string }[];
  client_notes: string[];
}

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

const jsonPath = (root: string, id: FixtureClientId, file: string): string => join(root, FOLDERS[id], file);

export function readKey(root: string, id: FixtureClientId): RawKey {
  return JSON.parse(readFileSync(jsonPath(root, id, 'answer-key.json'), 'utf8')) as RawKey;
}

export function readOnboarding(root: string, id: FixtureClientId): RawOnboarding {
  return JSON.parse(readFileSync(jsonPath(root, id, 'onboarding.json'), 'utf8')) as RawOnboarding;
}

/** Rewrites a client's answer-key.json in the temp copy. */
export function editKey(root: string, id: FixtureClientId, edit: (j: RawKey) => void): void {
  const j = readKey(root, id);
  edit(j);
  writeFileSync(jsonPath(root, id, 'answer-key.json'), JSON.stringify(j, null, 2) + '\n');
}

/** Rewrites a client's onboarding.json in the temp copy. */
export function editOnboarding(root: string, id: FixtureClientId, edit: (j: RawOnboarding) => void): void {
  const j = readOnboarding(root, id);
  edit(j);
  writeFileSync(jsonPath(root, id, 'onboarding.json'), JSON.stringify(j, null, 2) + '\n');
}

/** Rewrites one text file of a client in the temp copy. */
export function editText(root: string, id: FixtureClientId, file: string, edit: (t: string) => string): void {
  const p = join(root, FOLDERS[id], file);
  writeFileSync(p, edit(readFileSync(p, 'utf8')));
}

/** Any JSON value, for the table-driven plants that reach a field by its path. */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type JsonPath = readonly (string | number)[];

function at(j: Json, path: JsonPath, what: string): Json {
  let cur: Json = j;
  for (const k of path) {
    const next: Json | undefined =
      typeof k === 'number' ? (Array.isArray(cur) ? cur[k] : undefined) : cur !== null && typeof cur === 'object' && !Array.isArray(cur) ? cur[k] : undefined;
    if (next === undefined) throw new Error(`fixture: ${what} has no ${path.join('.')}`);
    cur = next;
  }
  return cur;
}

/** Reads one field of a client's JSON file (answer-key.json or onboarding.json) by its path; throws when it is missing. */
export function readJsonAt(root: string, id: FixtureClientId, file: string, path: JsonPath): unknown {
  return at(JSON.parse(readFileSync(jsonPath(root, id, file), 'utf8')) as Json, path, `${id} ${file}`);
}

/** Sets one existing field of a client's JSON file in the temp copy (the field must already be there). */
export function setJsonAt(root: string, id: FixtureClientId, file: string, path: JsonPath, value: string): void {
  const j = JSON.parse(readFileSync(jsonPath(root, id, file), 'utf8')) as Json;
  const last = path[path.length - 1];
  if (last === undefined) throw new Error('fixture: empty path');
  const parent = at(j, path.slice(0, -1), `${id} ${file}`);
  at(j, path, `${id} ${file}`);
  if (Array.isArray(parent) && typeof last === 'number') parent[last] = value;
  else if (parent !== null && typeof parent === 'object' && !Array.isArray(parent) && typeof last === 'string') parent[last] = value;
  else throw new Error(`fixture: cannot set ${path.join('.')}`);
  writeFileSync(jsonPath(root, id, file), JSON.stringify(j, null, 2) + '\n');
}

/** A nine-digit number that passes the Luhn check digit (what a real business number or SIN does), from eight digits; util.mjs's luhnValid decides. */
export function checkDigitPassing(first8: string): string {
  const d = Array.from({ length: 10 }, (_, k) => first8 + String(k)).find((x) => luhnValid(x));
  if (d === undefined) throw new Error('fixture: no check digit found');
  return d;
}

/** Dollars (a JSON number with at most two decimals) to cents, for comparing against the raw answer keys. */
export const rawCents = (x: number | undefined | null): number => Math.round((x ?? 0) * 100);
