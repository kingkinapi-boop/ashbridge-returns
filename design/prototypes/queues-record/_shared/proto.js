/* The shared prototype script (stands in for the build's React behaviour and MOJ's own scripts, which are ES modules
   and do not load from file://). Used by every page of version A. One place for in-place actions (staff-screens rules 18 to 22):
   every action runs on the page, keeps the scroll, moves focus to the result or next row and announces it. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ss = { get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) {} } };
  var off = function () { try { return localStorage.getItem('app-shortcuts-off') === '1'; } catch (e) { return false; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var file = location.pathname.split('/').pop();
  var errTitle = function (on) { var t = document.title.replace(/^Error: /, ''); document.title = on ? 'Error: ' + t : t; };

  // ----- shortcuts: each repeats a visible control, none runs inside a field, all can be turned off (rule 10, 22)
  var tog = $('[data-shortcuts-off]');
  if (tog) { tog.checked = off(); tog.addEventListener('change', function () { try { localStorage.setItem('app-shortcuts-off', tog.checked ? '1' : '0'); } catch (e) {} }); }
  var inField = function (e) { var t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  var visibleRows = function () { return $$('table[data-app-sortable] tbody tr[data-slug]').filter(function (r) { return !r.hidden; }); };
  var rowOf = function (el) { while (el && el.tagName !== 'TR') el = el.parentNode; return el && el.getAttribute && el.getAttribute('data-slug') ? el : null; };
  document.addEventListener('keydown', function (e) {
    if (off() || inField(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { var s = $('#header-search'); if (s) { e.preventDefault(); s.focus(); } return; }
    if (e.key === 'j' || e.key === 'k') {
      var rows = visibleRows(); if (!rows.length) return;
      var cur = rowOf(document.activeElement); var i = cur ? rows.indexOf(cur) : -1;
      var nx = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))];
      var a = $('a[data-pick]', nx); if (a) { e.preventDefault(); a.focus(); }
      return;
    }
    if (e.key === 'o') { var r = rowOf(document.activeElement); var l = r && $('a[data-pick]', r); if (l) { e.preventDefault(); l.click(); } return; }
    if (e.key === 'n' || e.key === 'p') { var link = $(e.key === 'n' ? '[data-key-next]' : '[data-key-prev]'); if (link && !link.hidden) { e.preventDefault(); link.click(); } }
  });

  // ----- sortable tables (MOJ's own script does this in the build)
  function sortTable(t, idx, asc) {
    var tb = t.tBodies[0];
    $$('th[aria-sort]', t).forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
    var b = $('th button[data-index="' + idx + '"]', t); if (b) b.parentNode.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
    var rows = $$('tr', tb); var y = window.scrollY;
    var val = function (r) { var c = r.cells[idx]; var v = c.getAttribute('data-sort-value'); return v == null ? c.textContent.trim().toLowerCase() : v; };
    rows.sort(function (a, b2) { var x = val(a), z = val(b2), nx = parseFloat(x), nz = parseFloat(z); var c = (!isNaN(nx) && !isNaN(nz) && String(nx) === x && String(nz) === z) ? nx - nz : (x < z ? -1 : x > z ? 1 : 0); return asc ? c : -c; });
    rows.forEach(function (r) { tb.appendChild(r); });
    window.scrollTo(0, y);
  }
  function initSort(t) {
    $$('th[aria-sort] button', t).forEach(function (b) {
      b.addEventListener('click', function () { var th = b.parentNode; sortTable(t, +b.getAttribute('data-index'), th.getAttribute('aria-sort') !== 'ascending'); });
    });
  }
  $$('table[data-app-sortable]').forEach(initSort);

  // ----- inline filter: text, chips, strip, hash; no page load. Chips and the strip are real buttons.
  var tbl = $('table[data-app-sortable]'), ftxt = $('[data-list-filter]'), status = $('[data-list-status]'), empty = $('[data-list-empty]');
  var active = {};
  function apply() {
    if (!tbl) return; var q = ftxt ? ftxt.value.trim().toLowerCase() : ''; var n = 0, tot = 0;
    $$('tbody tr', tbl).forEach(function (r) {
      tot++; var ok = !q || (r.getAttribute('data-text') || '').indexOf(q) > -1;
      Object.keys(active).forEach(function (k) {
        var v = active[k]; var rv = r.getAttribute('data-' + k);
        if (k === 'due') { ok = ok && +rv <= +v; } else if (k === 'wait') { ok = ok && rv === v; } else { ok = ok && v.split(',').indexOf(rv) > -1; }
      });
      r.hidden = !ok; if (ok) n++;
    });
    var parts = [];
    Object.keys(active).forEach(function (k) { active[k].split(',').forEach(function (v) { var b = $('[data-filter-key="' + k + '"][data-filter-value="' + v + '"]'); var l = b ? (b.getAttribute('data-name') || ($('.app-pipe__label', b) || $('[data-chip-label]', b) || b).textContent.trim()) : v; parts.push(k === 'state' ? 'state ' + l : l); }); });
    if (q) parts.push('text "' + ftxt.value.trim() + '"');
    var desc = 'Showing ' + n + ' of ' + tot + ' returns' + (parts.length ? ', ' + parts.join(', ') : '');
    if (status) status.textContent = desc + '. ' + (status.getAttribute('data-note') || '');
    var cap = $('[data-list-caption]'); if (cap) cap.textContent = desc;
    $$('[data-filter-clear]').forEach(function (b) { b.hidden = parts.length === 0; });
    if (empty) empty.hidden = n !== 0;
    $$('[data-filter-key]').forEach(function (b) { b.setAttribute('aria-pressed', active[b.getAttribute('data-filter-key')] === b.getAttribute('data-filter-value') ? 'true' : 'false'); });
  }
  if (ftxt) ftxt.addEventListener('input', apply);
  $$('[data-filter-key]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-filter-key'), v = b.getAttribute('data-filter-value');
      if (active[k] === v) delete active[k]; else active[k] = v;
      apply();
      if (b.hasAttribute('data-scroll-list') && active[k] === v) { var top = $('#list-top'); if (top) { top.scrollIntoView({ block: 'start' }); top.focus({ preventScroll: true }); } }
    });
  });
  $$('[data-filter-clear]').forEach(function (b) { b.addEventListener('click', function () { active = {}; if (ftxt) ftxt.value = ''; apply(); var g = b.closest('.app-chips'); var t = g ? $('.app-chip', g) : ($('#list-top') || ftxt); if (t) t.focus({ preventScroll: true }); }); });
  var hm = /#(state|tier|wait|band)=([\w,]+)/.exec(location.hash); if (hm) active[hm[1]] = hm[2];
  apply();

  // ----- list context: Back, n and p follow the list you came from, with its filter, sort and scroll (rule 21)
  var listBox = $('[data-list]');
  function saveCtx(slug) {
    if (!listBox) return;
    var th = $('th[aria-sort="ascending"] button, th[aria-sort="descending"] button', tbl || document);
    ss.set('proto-ctx', JSON.stringify({
      url: file + location.search, title: listBox.getAttribute('data-list'), current: slug,
      order: visibleRows().map(function (r) { return r.getAttribute('data-slug'); }),
      q: ftxt ? ftxt.value : '', active: active,
      sort: th ? { idx: +th.getAttribute('data-index'), asc: th.parentNode.getAttribute('aria-sort') === 'ascending' } : null,
      y: window.scrollY
    }));
  }
  $$('a[data-pick]').forEach(function (a) { a.addEventListener('click', function () { var r = rowOf(a); saveCtx(r ? r.getAttribute('data-slug') : ''); }); });
  function restoreList() {
    if (!listBox) return false;
    var nav = (window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    if (ss.get('proto-restore') !== '1' && nav.type !== 'back_forward' && !restoreList.again) return false;
    var c = null; try { c = JSON.parse(ss.get('proto-ctx')); } catch (e) {}
    if (!c || c.url !== file + location.search) return false;
    ss.del('proto-restore');
    if (ftxt) ftxt.value = c.q || '';
    active = c.active || {}; apply();
    if (c.sort && tbl) sortTable(tbl, c.sort.idx, c.sort.asc);
    var row = c.current && $('tr[data-slug="' + c.current + '"]'); var link = row && !row.hidden && $('a[data-pick]', row);
    if (link) { link.focus({ preventScroll: true }); var ly = link.getBoundingClientRect(); if (ly.top < 0 || ly.bottom > innerHeight) { link.scrollIntoView({ block: 'center' }); } } else { window.scrollTo(0, c.y || 0); }
    return true;
  }
  restoreList();
  window.addEventListener('pageshow', function (e) { if (e.persisted) { restoreList.again = true; restoreList(); } });

  // ----- search results page: one match opens the return, more show a list, none says so (rule 21)
  var sr = $('[data-search-summary]');
  if (sr && window.APP_ALL) {
    var m = /[?&]q=([^&]*)/.exec(location.search); var q = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() : '';
    var ql = q.toLowerCase();
    var hits = ql ? window.APP_ALL.filter(function (r) { return (r[0] + ' ' + r[1] + ' ' + r[2] + ' ' + (r[8] || '')).toLowerCase().indexOf(ql) > -1; }) : [];
    var h1 = $('[data-search-h1]');
    if (hits.length === 1) { location.replace('rec-' + hits[0][5] + '.html#overview'); }
    else if (!ql) { /* the page says what to type */ }
    else if (hits.length === 0) { h1.textContent = 'No return matches that search'; sr.textContent = 'Nothing in any queue matches "' + q + '".'; $('[data-search-none]').hidden = false; document.title = 'No return matches that search - Ashbridge Tax'; }
    else {
      h1.textContent = hits.length + ' returns match "' + q + '"'; document.title = hits.length + ' returns match "' + q + '" - Ashbridge Tax';
      sr.textContent = 'Choose one to open it. Sorted by corporation name; click a heading to sort.';
      var meta = window.APP_META, box = $('[data-search-table]');
      var th = function (t, i) { return '<th scope="col" class="govuk-table__header" aria-sort="' + (i === 0 ? 'ascending' : 'none') + '"><button type="button" data-index="' + i + '">' + t + '</button></th>'; };
      hits.sort(function (a, b) { return a[0].localeCompare(b[0]); });
      box.innerHTML = '<table class="govuk-table" data-app-sortable><caption class="govuk-table__caption govuk-visually-hidden">' + hits.length + ' returns match ' + esc(q) + ', sorted by corporation name</caption><thead class="govuk-table__head"><tr class="govuk-table__row">' + ['Corporation', 'Business number', 'Year end', 'State', 'Tier', 'Filing due'].map(th).join('') + '</tr></thead><tbody class="govuk-table__body">' +
        hits.map(function (r) { var s = meta.states[r[3]], t = meta.tiers[r[4]]; return '<tr class="govuk-table__row" data-slug="' + r[5] + '"><td class="govuk-table__cell"><a class="govuk-link govuk-!-font-weight-bold" href="rec-' + r[5] + '.html#overview" data-pick aria-keyshortcuts="o">' + esc(r[0]) + '</a></td><td class="govuk-table__cell">' + r[1] + '</td><td class="govuk-table__cell">' + r[2] + '</td><td class="govuk-table__cell"><strong class="govuk-tag govuk-tag--' + s[1] + '">' + s[0] + '</strong></td><td class="govuk-table__cell"><strong class="govuk-tag govuk-tag--' + t[1] + '">' + t[0] + '</strong></td><td class="govuk-table__cell">' + r[7] + '</td></tr>'; }).join('') + '</tbody></table>';
      box.hidden = false; box.setAttribute('data-list', 'Search results'); box.setAttribute('data-land', 'overview'); listBox = box; tbl = $('table', box);
      initSort(tbl); restoreList();
      $$('a[data-pick]', box).forEach(function (a) { a.addEventListener('click', function () { saveCtx(rowOf(a).getAttribute('data-slug')); }); });
    }
    var qf = $('#header-search'); if (qf && q) qf.value = q;
  }

  // ----- bulk assign on the ops list: sticky bar, error in place, focus to the next row, result announced (rule 19)
  var bar = $('[data-bulkbar]'), bsum = $('[data-bulk-summary]'), bres = $('[data-bulk-result]');
  function clearBulkErr() {
    var g = $('[data-bulk-group]'), s1 = $('#assign-to'), e1 = $('#assign-to-error'); if (!g) return;
    g.classList.remove('govuk-form-group--error'); s1.classList.remove('govuk-select--error'); e1.hidden = true; s1.removeAttribute('aria-describedby'); bsum.hidden = true; errTitle(false);
  }
  function sel() {
    var n = $$('[data-row-select]:checked').length;
    if (bar) { bar.hidden = n === 0; var c = $('[data-sel-count]'); if (c) c.textContent = n + (n === 1 ? ' return selected' : ' returns selected'); if (n === 0 && bsum) clearBulkErr(); }
  }
  $$('[data-row-select]').forEach(function (c) { c.addEventListener('change', sel); }); sel();
  if (bar) bar.addEventListener('submit', function (e) {
    e.preventDefault();
    var sel1 = $('#assign-to'), who = sel1.value, grp = $('[data-bulk-group]'), em = $('#assign-to-error');
    if (!who) {
      grp.classList.add('govuk-form-group--error'); sel1.classList.add('govuk-select--error'); em.hidden = false; sel1.setAttribute('aria-describedby', 'assign-to-error');
      bsum.hidden = false; errTitle(true); bsum.focus({ preventScroll: true }); return;
    }
    clearBulkErr();
    var chosen = $$('[data-row-select]:checked').map(rowOf); var n = chosen.length;
    chosen.forEach(function (r) { var cell = $('[data-prep-cell]', r); if (cell) { cell.textContent = who; cell.parentNode.setAttribute('data-sort-value', who); } r.setAttribute('data-prep', who.indexOf('Aisha') === 0 ? 'aisha' : 'ben'); });
    var rows = visibleRows(); var last = chosen[chosen.length - 1]; var after = rows.filter(function (r) { return rows.indexOf(r) > rows.indexOf(last) && chosen.indexOf(r) < 0; })[0];
    $$('[data-row-select]:checked').forEach(function (c) { c.checked = false; }); sel1.value = ''; sel();
    bres.textContent = n + (n === 1 ? ' return' : ' returns') + ' assigned to ' + who + '. The list has kept its place.' + (after ? ' Focus is on the next row.' : ''); bres.hidden = false;
    var nl = after && $('a[data-pick]', after); if (nl) { nl.focus({ preventScroll: true }); var nr = nl.getBoundingClientRect(); if (nr.top < 0 || nr.bottom > innerHeight) nl.scrollIntoView({ block: 'nearest' }); } else bres.focus({ preventScroll: true });
  });
  var bsl = $('[data-bulk-summary] a'); if (bsl) bsl.addEventListener('click', function (e) { e.preventDefault(); $('#assign-to').focus({ preventScroll: true }); });

  // ----- source viewer (stands in for D03): beside the list, full height, box scrolled into view, focus moved in, second window follows
  var LINES = (function () { var L = [], D = ['FUEL TEST', 'E-TRANSFER IN CLIENT TEST', 'MONTHLY FEE', 'UTILITY AUTOPAY TEST', 'SUPPLIES TEST', 'POS PURCHASE TEST']; for (var i = 0; i < 40; i++) { var day = ('0' + (1 + (i * 3) % 28)).slice(-2), mon = ('0' + (1 + Math.floor(i / 4))).slice(-2); var dep = i % 5 === 1; L.push(['2025-' + mon + '-' + day, D[i % D.length], dep ? '' : (20 + i * 13.37).toFixed(2), dep ? '5,200.00' : '']); } return L; })();
  var HIT = 17;
  function showHit(box) {
    var hit = $('[data-hit]', box), reg = $('[data-viewer-scroll]', box); if (!hit || !reg) return;
    var rr = reg.getBoundingClientRect(), hr = hit.getBoundingClientRect(), head = $('thead', reg);
    reg.scrollTop = Math.max(0, reg.scrollTop + (hr.top - rr.top) - (head ? head.getBoundingClientRect().height : 0) - 4);
  }
  function renderSource(box, d, withSend) {
    var rows = LINES.map(function (x, i) { return '<tr class="govuk-table__row' + (i === HIT ? ' app-src__hit' : '') + '"' + (i === HIT ? ' data-hit data-evidence' : '') + '><td class="govuk-table__cell">' + x[0] + '</td><td class="govuk-table__cell">' + x[1] + (i === HIT ? ' <strong class="govuk-tag govuk-tag--yellow">Cited line</strong>' : '') + '</td><td class="govuk-table__cell govuk-table__cell--numeric"><span class="app-money">' + x[2] + '</span></td><td class="govuk-table__cell govuk-table__cell--numeric"><span class="app-money">' + x[3] + '</span></td></tr>'; }).join('');
    box.innerHTML = '<div class="app-viewer__head"><h3 class="govuk-heading-s govuk-!-margin-bottom-0" tabindex="-1" data-viewer-title>' + esc(d.name) + '</h3>' +
      (withSend ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0 app-viewer__send" data-second data-primary>Send to second window</button>' : '') +
      '<p class="govuk-body-s govuk-!-margin-bottom-0 app-viewer__meta">' + esc(d.ret) + ', year end ' + esc(d.ye) + '. Source: ' + esc(d.source) + '. Status: ' + esc(d.status) + '.</p>' +
      (withSend ? '<p class="govuk-body-s govuk-!-margin-bottom-0" role="status" data-second-status></p>' : '') + '</div>' +
      '<div class="app-viewer__scroll" data-viewer-scroll role="region" aria-label="Source lines, scrollable" tabindex="0"><table class="govuk-table govuk-!-margin-bottom-0"><caption class="govuk-table__caption govuk-visually-hidden">First rows of the source (made-up sample lines)</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Date</th><th scope="col" class="govuk-table__header">Description</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Withdrawals</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Deposits</th></tr></thead><tbody class="govuk-table__body">' + rows + '</tbody></table></div>';
    showHit(box);
  }
  var srcPage = $('[data-source-h1]');
  if (srcPage) {
    var P = function (k) { var m2 = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search); return m2 ? decodeURIComponent(m2[1].replace(/\+/g, ' ')) : ''; };
    if (P('n')) { var d0 = { name: P('n'), source: P('s'), status: P('st'), ret: P('r'), ye: P('y') }; srcPage.textContent = d0.name; $('[data-source-meta]').hidden = true; document.title = d0.name + ' - Ashbridge Tax'; renderSource($('[data-viewer-body]'), d0, false); }
  }

  // ----- the return record: tabs are client-side routes, 0 page loads (rule 18)
  var rec = window.APP_REC;
  if (rec) {
    var LABELS = { overview: 'Overview', workbench: 'Workbench', review: 'Review', documents: 'Documents', exceptions: 'Exceptions', history: 'History', ops: 'Ops' };
    var panels = $$('[data-panel]'), links = $$('[data-route]'), curDoc = null, win = null;
    var srcUrl = function (d) { return 'source.html?n=' + encodeURIComponent(d.name) + '&s=' + encodeURIComponent(d.source) + '&st=' + encodeURIComponent(d.status) + '&r=' + encodeURIComponent(d.ret) + '&y=' + encodeURIComponent(d.ye); };
    var follow = function () { if (win && !win.closed && curDoc) { win = window.open(srcUrl(curDoc), 'ashbridge-source'); } };
    var curTab = function () { var t = (location.hash.slice(1) || 'overview').split('/')[0]; return LABELS[t] ? t : 'overview'; };
    var listNav = function () {
      var c = null; try { c = JSON.parse(ss.get('proto-ctx')); } catch (e) {}
      var back = $('[data-back]'), pv = $('[data-key-prev]'), nx = $('[data-key-next]'); if (!back) return;
      if (!c) { pv.hidden = true; nx.hidden = true; return; }
      back.href = c.url; back.textContent = 'Back to ' + c.title; back.addEventListener('click', function () { ss.set('proto-restore', '1'); });
      var i = c.order.indexOf(rec.slug);
      if (i < 0) { pv.hidden = true; nx.hidden = true; return; }
      c.current = rec.slug; ss.set('proto-ctx', JSON.stringify(c));
      var set = function (a, slug, word) { if (!slug) { a.hidden = true; return; } a.hidden = false; a.setAttribute('data-slug', slug); a.href = 'rec-' + slug + '.html#' + curTab(); };
      set(pv, c.order[i - 1]); set(nx, c.order[i + 1]);
      [pv, nx].forEach(function (a) { a.addEventListener('click', function () { a.href = 'rec-' + a.getAttribute('data-slug') + '.html#' + curTab(); }); });
    };
    var selectDoc = function (n, move) {
      var b = $('[data-doc="' + n + '"]'); if (!b) return;
      $$('[data-doc]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      curDoc = { name: b.getAttribute('data-name'), source: b.getAttribute('data-source'), status: b.getAttribute('data-status'), ret: b.getAttribute('data-ret'), ye: b.getAttribute('data-ye') };
      var v = $('[data-viewer]'), body = $('[data-viewer-body]', v); $('[data-viewer-empty]', v).hidden = true; body.hidden = false;
      renderSource(body, curDoc, true);
      var sb = $('[data-second]', body); sb.addEventListener('click', function () { win = window.open(srcUrl(curDoc), 'ashbridge-source'); $('[data-second-status]', body).textContent = win ? 'Opened in the second window. It follows each document you choose and each tab you open.' : 'The browser blocked the second window. Allow pop-ups for this page and try again.'; });
      if (move) { $('[data-viewer-title]', body).focus({ preventScroll: true }); showHit(body); }
      follow();
    };
    $$('[data-doc]').forEach(function (b) { b.addEventListener('click', function () { selectDoc(+b.getAttribute('data-doc'), true); history.replaceState(null, '', '#documents/' + b.getAttribute('data-doc')); }); });
    var route = function (focus) {
      var h = location.hash.slice(1) || 'overview', parts = h.split('/'), tab = parts[0];
      if (!LABELS[tab]) return;
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
      links.forEach(function (a) { if (a.getAttribute('data-route') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.title = (document.title.indexOf('Error: ') === 0 ? 'Error: ' : '') + LABELS[tab] + ' - ' + rec.name + ', year end ' + rec.ye + ' - Ashbridge Tax';
      var rs = $('[data-route-status]'); if (rs) rs.textContent = LABELS[tab] + ' tab';
      if (tab === 'documents' && parts[1]) selectDoc(+parts[1], focus);
      if (focus && !(tab === 'documents' && parts[1])) { var hd = $('#h-' + tab); if (hd) hd.focus(); }
      var nv = $('[data-key-prev]'); if (nv && !nv.hidden) nv.href = 'rec-' + nv.getAttribute('data-slug') + '.html#' + tab;
      nv = $('[data-key-next]'); if (nv && !nv.hidden) nv.href = 'rec-' + nv.getAttribute('data-slug') + '.html#' + tab;
      follow();
    };
    listNav();
    // choosing the tab you are already on moves focus to its heading, so no control is dead (rule 8)
    var goTab = function (t) { if (curTab() === t) { var hd = $('#h-' + t); if (hd) hd.focus(); } else location.hash = t; };
    $$('[data-goto]').forEach(function (b) { b.addEventListener('click', function () { goTab(b.getAttribute('data-goto')); }); });
    links.forEach(function (a) { a.addEventListener('click', function (e) { if (curTab() === a.getAttribute('data-route')) { e.preventDefault(); goTab(a.getAttribute('data-route')); } }); });
    window.addEventListener('hashchange', function () { route(true); });
    route(false);

    // nudge: in place, banner focused, last contact updated (fix 8)
    var nb = $('[data-nudge]');
    if (nb) nb.addEventListener('click', function () {
      var ban = $('[data-nudge-banner]'); ban.hidden = false;
      var lc = $('[data-last-contact]'); if (lc) lc.textContent = '8 Jun 2026: Nudge sent from the client app';
      var tl = $('[data-timeline]'); if (tl) { var it = document.createElement('div'); it.className = 'moj-timeline__item'; it.innerHTML = '<div class="moj-timeline__header"><h3 class="moj-timeline__title govuk-heading-s govuk-!-margin-bottom-0">Nudge sent to client</h3><p class="moj-timeline__byline govuk-body-s">by Priti Shah (Test)</p></div><p class="moj-timeline__date govuk-body-s">8 Jun 2026, 11:20</p>'; tl.insertBefore(it, tl.firstChild); }
      nb.hidden = true; ban.focus({ preventScroll: true });
    });

    // ops steps: forms of 3 fields or fewer, in place, GOV.UK error pattern (rule 9, 19)
    var NEXT_STATE = { client_sign: ['Client signing', 'green'], ready_to_file: ['Ready to file', 'green'], filed: ['Filed', 'turquoise'], assessed: ['Assessed', 'turquoise'] };
    var UNLOCK = { t183: 'cert', cert: 'chk', chk: 'conf', conf: 'noa' };
    var osum = $('[data-ops-summary]'), ores = $('[data-ops-result]'); var osumHome = osum && osum.parentNode, osumNext = osum && osum.nextSibling;
    var DONE_TAG = '<strong class="govuk-tag govuk-tag--green">Done</strong>', TODO_TAG = '<strong class="govuk-tag govuk-tag--blue">To do</strong>';
    var sortSteps = function () {
      var ol = $('.app-steps'); if (!ol) return; var rank = { todo: 0, locked: 1, done: 2 };
      $$('[data-step-item]', ol).sort(function (a, b) { return (rank[a.getAttribute('data-step-state')] - rank[b.getAttribute('data-step-state')]) || (+a.getAttribute('data-order') - +b.getAttribute('data-order')); }).forEach(function (li) { ol.appendChild(li); });
    };
    var leftText = function () {
      var left = $$('[data-step-item]').filter(function (li) { return li.getAttribute('data-step-state') !== 'done'; }).map(function (li) { return $('.app-step__name', li).textContent.split(',')[0].replace(/ \(.*\)/, '').toLowerCase(); });
      $('[data-ops-left]').textContent = left.length ? 'Left to do on this return: ' + left.join(', then ') + '.' : 'Every ops step is done.';
    };
    $$('[data-ops-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var inp = $('input[name="f"]', f), k = f.getAttribute('data-step'), grp = $('[data-field-group]', f);
        var bad = inp && (inp.type === 'file' ? !inp.value : !inp.value.trim());
        if (bad) {
          var em = $('#f-' + k + '-error'); grp.classList.add('govuk-form-group--error'); em.hidden = false; inp.classList.add(inp.type === 'file' ? 'govuk-file-upload--error' : 'govuk-input--error'); inp.setAttribute('aria-describedby', 'f-' + k + '-hint f-' + k + '-error');
          var lk = $('[data-error-link]', osum); lk.textContent = $('[data-error-text]', em).textContent; lk.setAttribute('href', '#f-' + k); lk.onclick = function (ev) { ev.preventDefault(); inp.focus(); };
          f.insertBefore(osum, f.firstChild); osum.hidden = false; errTitle(true); osum.focus({ preventScroll: true }); return;
        }
        osum.hidden = true; errTitle(false); if (osum.parentNode === f) osumHome.insertBefore(osum, osumNext);
        var li = f.parentNode; li.setAttribute('data-step-state', 'done'); $('[data-status-slot]', li).innerHTML = DONE_TAG; f.parentNode.removeChild(f);
        var nxt = f.getAttribute('data-next'); if (nxt && NEXT_STATE[nxt]) { var st = $('[data-state-tag] strong'); if (st) { st.textContent = NEXT_STATE[nxt][0]; st.className = 'govuk-tag govuk-tag--' + NEXT_STATE[nxt][1]; } }
        var u = UNLOCK[k]; if (u) { var ul = $('[data-step-item="' + u + '"]'); if (ul) { ul.setAttribute('data-step-state', 'todo'); $('[data-status-slot]', ul).innerHTML = TODO_TAG; var why = $('[data-lock-why]', ul); if (why) why.parentNode.removeChild(why); var uf = $('form', ul); if (uf) uf.hidden = false; } }
        leftText(); sortSteps(); ores.textContent = f.getAttribute('data-done'); ores.hidden = false; ores.focus({ preventScroll: true });
      });
    });
  }
})();
