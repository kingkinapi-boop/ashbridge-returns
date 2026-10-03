/* Prototype behaviour as a classic script (works from file://). In the build, MOJ Frontend's own sortable-table
   script does the sorting; this stand-in sorts the same markup so the prototype can be clicked. */
(function () {
  'use strict';
  var off = function () { return localStorage.getItem('app-shortcuts-off') === '1'; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ----- shortcuts toggle
  var tog = $('[data-shortcuts-off]');
  if (tog) { tog.checked = off(); tog.addEventListener('change', function () { localStorage.setItem('app-shortcuts-off', tog.checked ? '1' : '0'); }); }
  var inField = function (e) { var t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  document.addEventListener('keydown', function (e) {
    if (off() || inField(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { var s = $('#header-search'); if (s) { e.preventDefault(); s.focus(); } }
    var nx = $('[data-key-next]'), pv = $('[data-key-prev]');
    if (e.key === 'n' && nx) location.href = nx.href;
    if (e.key === 'p' && pv) location.href = pv.href;
  });

  // ----- header search: Enter opens the top match, no match goes to the empty state
  var f = $('[data-app-search]');
  if (f) f.addEventListener('submit', function (e) {
    var q = $('#header-search').value.trim().toLowerCase(); if (!q) { e.preventDefault(); return; }
    var hit = (window.APP_RETURNS || []).filter(function (r) { return (r.n + ' ' + r.b + ' ' + r.y).toLowerCase().indexOf(q) > -1; })[0];
    e.preventDefault(); location.href = hit ? hit.h : 'search-no-match.html?q=' + encodeURIComponent(q);
  });
  var qs = $('[data-echo-q]'); if (qs) { var m = /[?&]q=([^&]*)/.exec(location.search); qs.textContent = m ? decodeURIComponent(m[1]) : 'that text'; }

  // ----- sortable tables
  $$('table[data-app-sortable]').forEach(function (t) {
    var tb = t.tBodies[0];
    $$('th[aria-sort] button', t).forEach(function (b) {
      b.addEventListener('click', function () {
        var th = b.parentNode, idx = +b.getAttribute('data-index'), asc = th.getAttribute('aria-sort') !== 'ascending';
        $$('th[aria-sort]', t).forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var rows = $$('tr', tb); var y = window.scrollY;
        var val = function (r) { var c = r.cells[idx]; var v = c.getAttribute('data-sort-value'); v = v == null ? c.textContent.trim().toLowerCase() : v; return v; };
        rows.sort(function (a, b2) { var x = val(a), z = val(b2), nx = parseFloat(x), nz = parseFloat(z); var c = (!isNaN(nx) && !isNaN(nz) && String(nx) === x && String(nz) === z) ? nx - nz : (x < z ? -1 : x > z ? 1 : 0); return asc ? c : -c; });
        rows.forEach(function (r) { tb.appendChild(r); });
        window.scrollTo(0, y);
      });
    });
  });

  // ----- inline filter: text, chips, hash; no page load
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
    if (status) status.textContent = 'Showing ' + n + ' of ' + tot + ' returns';
    if (empty) empty.hidden = n !== 0;
    $$('[data-filter-key]').forEach(function (b) { b.setAttribute('aria-pressed', active[b.getAttribute('data-filter-key')] === b.getAttribute('data-filter-value') ? 'true' : 'false'); });
    $$('.app-pipeline a').forEach(function (a) { if (a.getAttribute('data-filter-key')) a.setAttribute('aria-current', active[a.getAttribute('data-filter-key')] === a.getAttribute('data-filter-value') ? 'true' : 'false'); });
  }
  if (ftxt) ftxt.addEventListener('input', apply);
  $$('[data-filter-key]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault(); var k = b.getAttribute('data-filter-key'), v = b.getAttribute('data-filter-value');
      if (active[k] === v) delete active[k]; else active[k] = v; apply();
    });
  });
  $$('[data-filter-clear]').forEach(function (b) { b.addEventListener('click', function () { active = {}; if (ftxt) ftxt.value = ''; apply(); }); });
  var hm = /#(state|tier|wait)=([\w,]+)/.exec(location.hash); if (hm) active[hm[1]] = hm[2];
  apply();

  // ----- row selection and bulk bar (Space on a checkbox selects; list keeps its place)
  var bar = $('[data-bulkbar]');
  function sel() {
    var n = $$('[data-row-select]:checked').length;
    if (bar) { bar.hidden = n === 0; var c = $('[data-sel-count]'); if (c) c.textContent = n + (n === 1 ? ' return selected' : ' returns selected'); }
  }
  $$('[data-row-select]').forEach(function (c) { c.addEventListener('change', sel); }); sel();
  var bf = $('[data-bulk-form]');
  if (bf) bf.addEventListener('submit', function (e) {
    var who = $('select', bf).value;
    if (!who) return; // goes to the error page (form action)
    e.preventDefault(); var n = $$('[data-row-select]:checked').length; var o = $('[data-bulk-result]');
    o.textContent = n + ' returns assigned to ' + who + '. The list has kept its place.'; o.hidden = false;
    $$('[data-row-select]:checked').forEach(function (c) { c.checked = false; }); sel(); o.focus();
  });

  var ap = $('[data-assign-page]');
  if (ap) ap.addEventListener('submit', function (e) { if ($('select', ap).value) { e.preventDefault(); location.href = 'queue-ops.html'; } });

  var cf = $('[data-confirm]');
  if (cf) cf.addEventListener('submit', function (e) { if ($('input', cf).value.trim()) { e.preventDefault(); location.href = 'rec-scarborough-robotics-ops.html'; } });

  // ----- split view (version B): pick a row, pane follows, no page load
  var rows = $$('[data-pane-row]'), panes = $$('[data-pane]');
  function show(id, focus) {
    panes.forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== id; });
    rows.forEach(function (r) { r.setAttribute('aria-selected', r.getAttribute('data-pane-row') === id ? 'true' : 'false'); });
  }
  if (rows.length) {
    rows.forEach(function (r) { $('a[data-pick]', r).addEventListener('click', function (e) { e.preventDefault(); history.replaceState(null, '', '#' + r.getAttribute('data-pane-row')); show(r.getAttribute('data-pane-row')); }); });
    var vis = rows.filter(function (r) { return !r.hidden; });
    show(location.hash.slice(1) && $('[data-pane-row="' + location.hash.slice(1) + '"]') ? location.hash.slice(1) : (vis[0] || rows[0]).getAttribute('data-pane-row'));
    document.addEventListener('keydown', function (e) {
      if (off() || inField(e)) return; if (e.key !== 'j' && e.key !== 'k') return;
      var v = rows.filter(function (r) { return !r.hidden; }); var cur = v.findIndex(function (r) { return r.getAttribute('aria-selected') === 'true'; });
      var nx = v[Math.max(0, Math.min(v.length - 1, cur + (e.key === 'j' ? 1 : -1)))]; if (nx) { show(nx.getAttribute('data-pane-row')); nx.scrollIntoView({ block: 'nearest' }); }
    });
  }

  // ----- second window (version C): the source window follows clicks made in the main window
  var src = $('[data-source-follow]');
  if (src && 'BroadcastChannel' in window) { var ch = new BroadcastChannel('ashbridge-source'); ch.onmessage = function (e) { if (e.data && e.data.href) location.href = e.data.href; }; }
  $$('a[data-source-open]').forEach(function (a) { a.addEventListener('click', function () { if ('BroadcastChannel' in window) new BroadcastChannel('ashbridge-source').postMessage({ href: a.getAttribute('href') }); }); });
})();
