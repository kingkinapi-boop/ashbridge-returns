// The Client object: accounts, transactions with their double-entry coding, adjusting entries, flags.
// Money is integer cents. For every account, amt is the cash effect on the company: money in is positive,
// money out is negative (a card charge is negative, a card payment is positive).
import { Rng, addDays, ymd, daysIn, monthList, bizInMonth, isWeekend, hstOf, hstOn, sum, badNine, monthKey } from './util.mjs';
import { GL } from './chart.mjs';
import { locate, PERSONAL, CH } from './names.mjs';

export const HSTGL = '2050';
export const bnFromSeed = (seed) => badNine(new Rng(seed ^ 0x5bd1e995));
const NL = (n) => [n].flat(3).filter((x) => x !== undefined && x !== null && x !== false && x !== '');

export class Client {
  constructor(o) {
    Object.assign(this, {
      num: o.num, slug: o.slug, name: o.name, fyStart: o.fyStart, fyEnd: o.fyEnd,
      hstMethod: o.hstMethod ?? 'regular', hstFrom: o.hstFrom ?? null, quickRate: o.quickRate ?? 0.088,
      rates: o.rates ?? null,
    });
    this.dir = `${o.num}-${o.slug}`;
    this.rng = new Rng(o.seed);
    this.seed = o.seed;
    this.accts = {}; this.txs = []; this.ajes = []; this.flagList = []; this.opening = {};
    this.months = monthList(this.fyStart, this.fyEnd);
    this.onb = {}; this.t2 = {}; this.notes = []; this.planted = []; this.who = '';
    this.parties = []; this.owners = []; this.ccaAdds = []; this.ccaDisposals = [];
    this.bn = bnFromSeed(o.seed); this.people = {};
    this.seq = 0;
  }

  // ---------- people and numbers ----------
  party(name, kind) { if (!this.parties.find((p) => p.name === name)) this.parties.push({ name, kind }); return name; }
  owner(name, pct, o = {}) {
    this.party(name, o.corp ? 'company' : 'person');
    const ow = { name, percent: pct, shareClass: 'common', sin: o.bn ?? badNine(this.rng), ...o };
    this.owners.push(ow); this.people[name] = ow; return ow;
  }
  person(name) {
    if (!this.people[name]) { this.party(name, 'person'); this.people[name] = { name, sin: badNine(this.rng) }; }
    return this.people[name];
  }

  // ---------- accounts ----------
  account(key, d) {
    const a = {
      key, kind: d.kind, currency: d.currency ?? 'CAD', tag: d.tag, label: d.label, file: d.file, last4: d.last4, gl: d.gl,
      role: d.role, opening: d.opening ?? null, floor: d.floor ?? 200000, extra: d.extra ?? 0, holder: d.holder ?? '',
    };
    if ((a.role === 'card' || a.role === 'pcard') && a.opening == null) a.opening = this.rng.cents(400, 1900);
    this.accts[key] = a; return a;
  }
  rate(date) {
    if (!this.rates) throw new Error('no rates for ' + this.num);
    const r = this.rates[monthKey(date)];
    if (!r) throw new Error('no rate for ' + date);
    return r;
  }
  cad(a, cents, date) { return a.currency === 'USD' ? Math.round(cents * this.rate(date)) : cents; }

  // ---------- HST behaviour ----------
  hstMode(date, capital) {
    switch (this.hstMethod) {
      case 'regular': return 'itc';
      case 'none': return 'embedded';
      case 'quick': return capital ? 'itc' : 'embedded';
      case 'from': return date >= this.hstFrom ? 'itc' : 'embedded';
      default: throw new Error('hst method');
    }
  }
  collectsHst(date) { return this.hstMethod === 'regular' || this.hstMethod === 'quick' || (this.hstMethod === 'from' && date >= this.hstFrom); }
  expLines(date, T, gl, tax = 'std', capital = false) {
    if (tax === 'none' || tax === 'zero') return [{ gl, dr: T }];
    const h = hstOf(T);
    if (this.hstMode(date, capital) === 'embedded') return [{ gl, dr: T }];
    if (tax === 'meal') { const itc = Math.round(h / 2); return [{ gl, dr: T - itc }, { gl: HSTGL, dr: itc }]; }
    return [{ gl, dr: T - h }, { gl: HSTGL, dr: h }];
  }

  // ---------- transactions ----------
  add(key, date, d1, d2, amt, o = {}) {
    const a = this.accts[key];
    if (!a) throw new Error('no account ' + key);
    if (!o.outside && (date < this.fyStart || date > this.fyEnd)) throw new Error(`${this.num}: date ${date} outside the year (${d1} ${d2})`);
    if (amt === 0) throw new Error('zero amount ' + d2);
    const t = {
      n: this.seq++, acct: key, date, d1, d2, amt, lines: o.lines ?? null, real: o.real !== false, inExport: o.inExport !== false,
      kind: o.kind ?? null, personal: !!o.personal, external: !!o.external, mirror: !!o.mirror, tags: o.tags ?? [], notes: [],
      flags: [], meta: o.meta ?? {}, sortDate: o.sortDate, sortN: o.sortN, qty: o.qty, pdate: o.pdate ?? null, post: [],
    };
    if (o.notes) t.notes.push(...NL(o.notes));
    if (t.lines) {
      const cad = this.cad(a, amt, date);
      const dr = sum(t.lines, (l) => l.dr ?? 0) + (cad > 0 ? cad : 0);
      const cr = sum(t.lines, (l) => l.cr ?? 0) + (cad < 0 ? -cad : 0);
      if (dr !== cr) throw new Error(`${this.num}: unbalanced entry ${date} ${d2}: dr ${dr} cr ${cr}`);
      for (const l of t.lines) if (!GL[l.gl]) throw new Error('unknown GL ' + l.gl);
    }
    this.txs.push(t); return t;
  }
  exp(key, date, d1, d2, total, gl, o = {}) {
    const a = this.accts[key]; const T = this.cad(a, total, date);
    const t = this.add(key, date, d1, d2, -total, { ...o, kind: o.kind ?? 'expense', lines: this.expLines(date, T, gl, o.tax ?? 'std', o.capital) });
    t.meta.gl = gl; return t;
  }
  // Revenue: net is the sales amount before HST (account currency). Deposit = net + HST when HST is charged.
  rev(key, date, d1, d2, net, gl, o = {}) {
    const a = this.accts[key]; const tax = o.tax ?? 'std';
    const h = tax === 'std' && this.collectsHst(date) ? hstOn(net) : 0;
    const total = net + h;
    const lines = [{ gl, cr: this.cad(a, net, date) }];
    if (h) lines.push({ gl: HSTGL, cr: h });
    const t = this.add(key, date, d1, d2, total, { ...o, kind: o.kind ?? 'revenue', lines });
    t.meta.gl = gl; return t;
  }
  bs(key, date, d1, d2, signed, gl, o = {}) {
    const a = this.accts[key]; const c = this.cad(a, Math.abs(signed), date);
    const t = this.add(key, date, d1, d2, signed, { ...o, kind: o.kind ?? 'balance-sheet', lines: signed > 0 ? [{ gl, cr: c }] : [{ gl, dr: c }] });
    t.meta.gl = gl; return t;
  }
  custom(key, date, d1, d2, signed, lines, o = {}) { return this.add(key, date, d1, d2, signed, { ...o, lines }); }
  personalRow(key, date, d1, d2, signed, o = {}) { return this.add(key, date, d1, d2, signed, { ...o, personal: true, kind: o.kind ?? 'personal', lines: null }); }
  // A business item paid on the owner's personal card: posted later by an adjusting entry.
  pcardBusiness(key, date, d2, total, gl, o = {}) {
    const t = this.add(key, date, '', d2, -total, { ...o, kind: 'personal-card-business', lines: null });
    t.meta.biz = { gl, tax: o.tax ?? 'std', total }; return t;
  }
  reimburseLines(txs, date, creditGl = '1300') {
    const lines = [];
    for (const t of txs) {
      const { gl, tax, total } = t.meta.biz;
      lines.push(...this.expLines(date, total, gl, tax));
      lines.push({ gl: creditGl, cr: total });
    }
    return lines;
  }
  xfer(fromKey, toKey, date, dFrom, dTo, amt, o = {}) {
    const A = this.accts[fromKey], B = this.accts[toKey];
    const c = this.cad(A, amt, date);
    const t1 = this.add(fromKey, date, dFrom[0], dFrom[1], -amt, { ...o, kind: o.kind ?? 'transfer', lines: [{ gl: B.gl, dr: c }] });
    const t2 = this.add(toKey, o.dateTo ?? date, dTo[0], dTo[1], amt, { ...o, kind: o.kind ?? 'transfer', mirror: true, lines: null });
    t1.pair = t2; t2.pair = t1; return [t1, t2];
  }
  // Currency conversion between the client's own USD and CAD accounts. The difference is booked to FX gain or loss.
  xferFx(usdKey, cadKey, date, usd, cadReceived, dU, dC, o = {}) {
    const U = this.accts[usdKey], C = this.accts[cadKey];
    const book = this.cad(U, usd, date);
    const lines = [{ gl: C.gl, dr: cadReceived }];
    const diff = book - cadReceived;
    if (diff > 0) lines.push({ gl: '4310', dr: diff }); else if (diff < 0) lines.push({ gl: '4310', cr: -diff });
    const t1 = this.add(usdKey, date, dU[0], dU[1], -usd, { ...o, kind: 'transfer-fx', lines });
    const t2 = this.add(cadKey, date, dC[0], dC[1], cadReceived, { ...o, kind: 'transfer-fx', mirror: true, lines: null });
    t1.pair = t2; t2.pair = t1; return [t1, t2];
  }

  // ---------- routine spending ----------
  pickDates(m, n, o = {}) {
    const lo = o.from && o.from > m.first ? o.from : m.first, hi = o.to && o.to < m.last ? o.to : m.last;
    const cand = []; for (let d = lo; d <= hi; d = addDays(d, 1)) if (!o.wk || !isWeekend(d)) cand.push(d);
    if (!cand.length) return [];
    const out = []; for (let i = 0; i < n; i++) out.push(this.rng.pick(cand));
    return out.sort();
  }
  clampDate(a, d) {
    let x = a.role === 'bank' || a.role === 'broker' ? bizInMonth(d) : d;
    if (x < this.fyStart) x = this.fyStart; if (x > this.fyEnd) x = this.fyEnd; return x;
  }
  // s: { gl, tax, d1, merch: [names] | fn(rng), n: [min,max] per month, amt: [minD,maxD], wk, from, to }
  routine(key, s) {
    const a = this.accts[key];
    for (const m of this.months) {
      const n = this.rng.int(s.n[0], s.n[1]);
      for (const d0 of this.pickDates(m, n, s)) {
        const base = typeof s.merch === 'function' ? s.merch(this.rng) : this.rng.pick(s.merch);
        const amt = this.rng.cents(s.amt[0], s.amt[1]);
        this.exp(key, this.clampDate(a, d0), s.d1 ?? '', locate(this.rng, base), amt, s.gl, { tax: s.tax, capital: s.capital, tags: s.tags });
      }
    }
  }
  // Fixed monthly item. s: { gl, tax, d1, d2, day, amt: cents | fn(i, m, rng), from, to, o }
  monthly(key, s) {
    const a = this.accts[key];
    this.months.forEach((m, i) => {
      let date = ymd(m.y, m.m, Math.min(s.day, daysIn(m.y, m.m)));
      if (a.role === 'bank' || a.role === 'broker') date = bizInMonth(date);
      if (date < this.fyStart || date > this.fyEnd) return;
      if ((s.from && date < s.from) || (s.to && date > s.to)) return;
      const amt = typeof s.amt === 'function' ? s.amt(i, m, this.rng) : s.amt;
      if (!amt) return;
      const d2 = typeof s.d2 === 'function' ? s.d2(m, i) : s.d2;
      this.exp(key, date, s.d1 ?? '', d2, amt, s.gl, { tax: s.tax, ...(s.o ?? {}) });
    });
  }
  // The company card is paid in full from the chequing account on `day` of the month after the charges.
  cardPayments(cardKey, chqKey, day = 20) {
    const card = this.accts[cardKey];
    let owing = card.opening;
    for (const m of this.months) {
      let paid = 0;
      if (owing > 0) {
        const date = bizInMonth(ymd(m.y, m.m, Math.min(day, daysIn(m.y, m.m))));
        if (date >= this.fyStart && date <= this.fyEnd) {
          this.xfer(chqKey, cardKey, date, ['PAYMENT TO CARD', `AURORA CARD TEST ${card.last4}`], ['', 'PAYMENT - THANK YOU'], owing, { kind: 'card-payment' });
          paid = owing;
        }
      }
      const net = -sum(this.txs.filter((t) => t.acct === cardKey && t.real && monthKey(t.date) === m.key && t.kind !== 'card-payment'), (t) => t.amt);
      owing = owing - paid + net;
    }
  }
  // The owner's personal card is paid from her own bank, which is not in this data.
  externalCardPayments(cardKey, day = 18) {
    const card = this.accts[cardKey];
    let owing = card.opening;
    for (const m of this.months) {
      let paid = 0;
      if (owing > 0) {
        const date = ymd(m.y, m.m, Math.min(day, daysIn(m.y, m.m)));
        if (date >= this.fyStart && date <= this.fyEnd) {
          this.add(cardKey, date, '', 'PAYMENT - THANK YOU', owing, { kind: 'card-payment', external: true, personal: true, lines: null });
          paid = owing;
        }
      }
      const net = -sum(this.txs.filter((t) => t.acct === cardKey && t.real && monthKey(t.date) === m.key && t.kind !== 'card-payment'), (t) => t.amt);
      owing = owing - paid + net;
    }
  }
  personalSpend(key, scale = 1) {
    const a = this.accts[key];
    for (const m of this.months) for (const p of PERSONAL) {
      const n = Math.max(0, Math.round(this.rng.int(p.n[0], p.n[1]) * scale));
      for (const d of this.pickDates(m, n)) {
        this.personalRow(key, d, '', locate(this.rng, this.rng.pick(CH[p.d])), -this.rng.cents(p.a[0], p.a[1]));
      }
    }
  }

  // ---------- entries, flags, tax inputs ----------
  aje(o) {
    const id = `${this.num}-AJE-${String(this.ajes.length + 1).padStart(2, '0')}`;
    const lines = o.lines.filter((l) => (l.dr ?? 0) !== 0 || (l.cr ?? 0) !== 0);
    const dr = sum(lines, (l) => l.dr ?? 0), cr = sum(lines, (l) => l.cr ?? 0);
    if (dr !== cr) throw new Error(`${this.num}: unbalanced adjusting entry ${o.reason}: dr ${dr} cr ${cr}`);
    for (const l of lines) if (!GL[l.gl]) throw new Error('unknown GL ' + l.gl);
    if (o.date < this.fyStart || o.date > this.fyEnd) throw new Error('adjusting entry date outside year ' + o.date);
    this.ajes.push({ id, date: o.date, lines, reason: o.reason, tx: NL(o.tx), onb: NL(o.onb), confirm: !!o.confirm, note: o.note ?? null, amount: dr });
    return id;
  }
  flag(o) {
    const id = `${this.num}-F${String(this.flagList.length + 1).padStart(2, '0')}`;
    const f = { id, rule: o.rule, detail: o.detail, tx: NL(o.tx), onb: NL(o.onb), aje: NL(o.aje), severity: o.severity ?? 'must fire', action: o.action ?? 'flag for a person; do not decide alone', judgement: !!o.judgement };
    for (const t of f.tx) if (typeof t === 'object') t.flags.push(id);
    this.flagList.push(f); return id;
  }
  cca(cls, o) { this.ccaAdds.push({ cls, ...o }); }
  // HST collected less HST claimed on entries dated from..to (positive = owing), leaving out payments to and refunds from CRA
  hstNet(from, to) {
    let n = 0;
    for (const t of this.txs) {
      if (!t.lines || !t.real || t.mirror || t.date < from || t.date > to || ['hst-remit', 'hst-refund', 'hst-instalment'].includes(t.kind)) continue;
      for (const l of t.lines) if (l.gl === HSTGL) n += (l.cr ?? 0) - (l.dr ?? 0);
    }
    return n;
  }
  // net debit of a GL account from the opening balances and the entries made so far (bank accounts need an explicit opening)
  glNet(gl) {
    let n = this.opening[gl] ?? 0;
    for (const a of Object.values(this.accts)) if (a.gl === gl && a.opening != null && (a.role === 'bank' || a.role === 'broker')) n += a.currency === 'USD' ? Math.round(a.opening * this.rates.open) : a.opening;
    for (const t of this.txs) {
      if (!t.lines || !t.real || t.mirror) continue;
      for (const l of t.lines) if (l.gl === gl) n += (l.dr ?? 0) - (l.cr ?? 0);
      const a = this.accts[t.acct];
      if (a.gl === gl) n += this.cad(a, t.amt, t.date);
    }
    return n;
  }
  nativeBalance(key) { const a = this.accts[key]; return a.opening + sum(this.txs.filter((t) => t.acct === key && t.real), (t) => t.amt); }
  sumGl(gl) { // year activity so far from posted entries (used to size entries before finalize)
    let n = 0;
    for (const t of this.txs) if (t.lines && t.real && !t.mirror) for (const l of t.lines) if (l.gl === gl) n += (l.dr ?? 0) - (l.cr ?? 0);
    return n;
  }
  txsOf(pred) { return this.txs.filter(pred); }
}
