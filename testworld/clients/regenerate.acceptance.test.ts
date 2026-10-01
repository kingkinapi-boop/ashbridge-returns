// W00 acceptance tests: byte-identical regeneration of the sample clients (ARC-16, check 8, second half).
//
// Public API this file fixes (testworld/generate.ts):
//   checkRegeneration(opts?: { root?: string }): Promise<{ identical: boolean; differing: string[] }>
//     root is the sample-clients folder to compare against (default reference/sample-clients/). It runs
//     generate.mjs and make-csv.mjs in a temp folder (never writing into root), compares every generated file
//     with the one in root byte for byte, and lists the files that differ (or are missing) as paths relative
//     to root with forward slashes, sorted. identical is true exactly when differing is empty.
import { afterAll, describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkRegeneration } from '../generate';
import { SAMPLE_ROOT, copySamples, removeCopies } from '../__fixtures__/sample-copy';

afterAll(() => removeCopies());

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

describe('W00 regeneration (card check 8)', () => {
  test('ARC-16 a clean checkout regenerates byte-identical and the sample folder is not written to', async () => {
    const files = walk(SAMPLE_ROOT);
    const before = new Map(files.map((f) => [f, readFileSync(f)]));
    const r = await checkRegeneration();
    expect(r).toEqual({ identical: true, differing: [] });
    const after = walk(SAMPLE_ROOT);
    expect(after.sort()).toEqual(files.sort());
    for (const f of after) expect(readFileSync(f).equals(before.get(f)!), relative(SAMPLE_ROOT, f)).toBe(true);
  }, 120_000);

  test('ARC-16 one byte changed in one sample file is reported by name', async () => {
    const root = copySamples();
    const target = '07-riverdale-rentals/qbo/harbourline-chequing-7745.csv';
    const p = join(root, target);
    const buf = readFileSync(p);
    const i = buf.lastIndexOf(0x31) >= 0 ? buf.lastIndexOf(0x31) : buf.lastIndexOf(0x30); // last "1" (or "0")
    expect(i, 'fixture: a digit to change').toBeGreaterThan(0);
    buf[i] = buf[i] === 0x31 ? 0x32 : 0x31;
    writeFileSync(p, buf);
    const r = await checkRegeneration({ root });
    expect(r).toEqual({ identical: false, differing: [target] });
  }, 120_000);

  test('ARC-16 a changed Taxprep import file is reported by name too (make-csv output)', async () => {
    const root = copySamples();
    const target = '03-bluewater-renovations/taxprep/import.csv';
    const p = join(root, target);
    writeFileSync(p, readFileSync(p, 'utf8') + '\n');
    const r = await checkRegeneration({ root });
    expect(r).toEqual({ identical: false, differing: [target] });
  }, 120_000);
});
