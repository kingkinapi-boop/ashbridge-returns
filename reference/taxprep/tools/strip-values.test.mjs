import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = join(dirname(fileURLToPath(import.meta.url)), 'strip-values.mjs');
const secrets = ['918273', "'-4455661", '0.0834', '2025-06-30', 'Zebra Quartz Holdings long text value here', 'Qx7 short', '31415.92'];
const fixture = [
  '[Made Up Co. (Test)|0|0|aaaa],"Current Year","Last Year",""',
  'A.1,"918273","","Total line"',
  `A.2,"'-4455661","31415.92","Loss line"`,
  'A.3,"","","Empty line"',
  'A.4,"0.0834","","Rate line"',
  'A.5,"2025-06-30","","Date line"',
  'A.6,"Y","N","Flag, with comma"',
  'A.7,"Qx7 short","Zebra Quartz Holdings long text value here","Text line"',
].join('\r\n') + '\r\n';

test('structure only: no input value in output file or stdout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sv-'));
  const inp = join(dir, 'in.csv'), outp = join(dir, 'out.csv');
  writeFileSync(inp, fixture);
  const stdout = execFileSync('node', [tool, inp, outp], { encoding: 'utf8' });
  const out = readFileSync(outp, 'utf8');
  for (const s of secrets) {
    assert.ok(!out.includes(s), `output leaks ${s.length}-char value`);
    assert.ok(!stdout.includes(s), `stdout leaks ${s.length}-char value`);
  }
  assert.ok(!out.includes('Made Up Co'));
  assert.match(stdout, /rows: 7/);
  assert.match(stdout, /filled current: 6/);
  assert.match(stdout, /filled last: 3/);
  const lines = out.trim().split('\n');
  assert.equal(lines.length, 8);
  assert.match(lines[2], /,Y,Y,"negative","whole dollars"|,Y,Y,"negative","decimal"/);
  assert.match(lines[4], /"rate"/);
  assert.match(lines[5], /"date"/);
  assert.match(lines[6], /"Y\/N","Y\/N"/);
  assert.match(lines[7], /"short text","long text"/);
});
