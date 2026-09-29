// Small helpers: seeded random numbers, dates, money in cents, CSV, check digits.
// No packages. Everything here is deterministic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  cents(minD, maxD) { return this.int(Math.round(minD * 100), Math.round(maxD * 100)); }
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  sample(arr, n) { return this.shuffle(arr).slice(0, n); }
}

// ---- dates (ISO strings, UTC arithmetic, no time zones) ----
const MS = 86400000;
export const dnum = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / MS);
export const dstr = (n) => new Date(n * MS).toISOString().slice(0, 10);
export const addDays = (iso, n) => dstr(dnum(iso) + n);
export const diffDays = (a, b) => dnum(b) - dnum(a);
export const dow = (iso) => new Date(dnum(iso) * MS).getUTCDay();
export const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const isWeekend = (iso) => { const d = dow(iso); return d === 0 || d === 6; };
export const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const mdy = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
export const monthKey = (iso) => iso.slice(0, 7);
export function nextBiz(iso) { let d = iso; while (isWeekend(d)) d = addDays(d, 1); return d; }
export function prevBiz(iso) { let d = iso; while (isWeekend(d)) d = addDays(d, -1); return d; }
// Business day in the same month: forward if possible, else backward.
export function bizInMonth(iso) {
  const f = nextBiz(iso);
  return f.slice(0, 7) === iso.slice(0, 7) ? f : prevBiz(iso);
}
export function addMonths(iso, n) {
  let y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  const d = Math.min(+iso.slice(8, 10), daysIn(y, m + 1));
  return ymd(y, m + 1, d);
}
export function monthEnd(iso) { return ymd(+iso.slice(0, 4), +iso.slice(5, 7), daysIn(+iso.slice(0, 4), +iso.slice(5, 7))); }
// Months touched by [from, to], each with first and last day clipped to the range.
export function monthList(from, to) {
  const out = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    const first = ymd(y, m, 1), last = ymd(y, m, daysIn(y, m));
    out.push({ y, m, key: `${y}-${String(m).padStart(2, '0')}`, first: first < from ? from : first, last: last > to ? to : last });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
export const longDate = (iso) => {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${+iso.slice(8, 10)} ${M[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
};

// ---- money in integer cents ----
export const fmt = (c) => { const s = c < 0 ? '-' : ''; const a = Math.abs(c); return s + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0'); };
export const dol = (c) => c / 100;
export const hstOf = (totalIncl) => Math.round((totalIncl * 13) / 113); // HST inside a tax-included amount
export const hstOn = (net) => Math.round(net * 0.13);                    // HST on a tax-free amount
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);

// ---- CSV ----
export const csvField = (s) => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const csvLine = (arr) => arr.map(csvField).join(',');
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (ch === '\r') { /* skip */ }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// ---- check digits: every made-up number must FAIL Luhn ----
export function luhnValid(s) {
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) { let d = +s[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
  return sum % 10 === 0;
}
export function badNine(rng) {
  for (;;) {
    let s = String(rng.int(1, 9));
    for (let i = 0; i < 8; i++) s += rng.int(0, 9);
    if (!luhnValid(s)) return s;
  }
}

// n amounts (cents) within roughly [lo, hi] that add up to exactly `total`
export function splitTotal(rng, total, n, lo, hi) {
  let a = Array.from({ length: n }, () => lo + rng.next() * (hi - lo));
  const s = a.reduce((x, y) => x + y, 0);
  a = a.map((x) => Math.max(100, Math.round((x * total) / s)));
  a[0] += total - a.reduce((x, y) => x + y, 0);
  return a;
}
// prose money: $1,234.56
export const money = (c) => { const [i, d] = fmt(Math.abs(c)).split('.'); return '$' + i.replace(/\B(?=(\d{3})+$)/g, ',') + '.' + d; };

// ---- JSON writer: readable, but one line per record for long record lists ----
export function pretty(v, ind = 0, key = '') {
  const pad = '  '.repeat(ind);
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object')) return '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
    if (v.length > 6 || key === 'lines') return '[\n' + v.map((x) => pad + '  ' + JSON.stringify(x)).join(',\n') + '\n' + pad + ']';
    return '[\n' + v.map((x) => pad + '  ' + pretty(x, ind + 1)).join(',\n') + '\n' + pad + ']';
  }
  const ks = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function');
  if (ks.length === 0) return '{}';
  return '{\n' + ks.map((k) => pad + '  ' + JSON.stringify(k) + ': ' + pretty(v[k], ind + 1, k)).join(',\n') + '\n' + pad + '}';
}
