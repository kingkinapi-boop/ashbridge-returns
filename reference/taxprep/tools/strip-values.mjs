// Structure-only view of a Taxprep CSV export. Never prints or writes a value.
// Usage: node strip-values.mjs <in.csv> <out.csv>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function shapeOf(raw) {
  const v = raw.replace(/^'/, '').trim();
  if (v === '') return '';
  if (/^-\s*\d[\d,]*(\.\d+)?$/.test(v) || /^\(\d[\d,]*(\.\d+)?\)$/.test(v)) return 'negative';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v) || /^\d{8}$/.test(v) && /^(19|20)\d{6}$/.test(v)) return 'date';
  if (/^(y|n|yes|no)$/i.test(v)) return 'Y/N';
  if (/^\d+(\.\d+)?\s*%$/.test(v) || /^\d*\.\d{3,}$/.test(v)) return 'rate';
  if (/^\d[\d,]*$/.test(v)) return 'whole dollars';
  if (/^\d[\d,]*\.\d{1,2}$/.test(v)) return 'decimal';
  return v.length <= 20 ? 'short text' : 'long text';
}

const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

export function strip(text) {
  const rows = parseCsv(text);
  // drop file name line(s) and header: everything up to the column header row
  let start = rows.findIndex((r) => /^(current year|value)$/i.test((r[1] || '').trim()));
  start = start < 0 ? 1 : start + 1;
  const out = [['id', 'description', 'current_filled', 'last_filled', 'current_shape', 'last_shape'].join(',')];
  const counts = { rows: 0, filledCurrent: 0, filledLast: 0, shapes: {} };
  for (const r of rows.slice(start)) {
    if (r.length < 2 || !r[0].trim()) continue;
    const cur = shapeOf(r[1] || ''), last = shapeOf(r[2] || '');
    counts.rows++;
    if (cur) { counts.filledCurrent++; counts.shapes[cur] = (counts.shapes[cur] || 0) + 1; }
    if (last) { counts.filledLast++; counts.shapes[last] = (counts.shapes[last] || 0) + 1; }
    out.push([q(r[0].trim()), q(r[3] || ''), cur ? 'Y' : 'N', last ? 'Y' : 'N', q(cur), q(last)].join(','));
  }
  return { csv: out.join('\n') + '\n', counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inp, outp] = process.argv.slice(2);
  if (!inp || !outp) { console.error('Usage: node strip-values.mjs <in.csv> <out.csv>'); process.exit(2); }
  const { csv, counts } = strip(readFileSync(inp, 'utf8'));
  writeFileSync(outp, csv);
  console.log(`rows: ${counts.rows}`);
  console.log(`filled current: ${counts.filledCurrent}`);
  console.log(`filled last: ${counts.filledLast}`);
  console.log('shapes: ' + (Object.entries(counts.shapes).map(([k, n]) => `${k}=${n}`).join(', ') || 'none'));
}
