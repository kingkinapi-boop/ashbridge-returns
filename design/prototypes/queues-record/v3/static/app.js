/* Version 3 prototype script. It stands in for the build's React behaviour. The pages are static HTML written for the default
   signed-in user (Aisha Rahman (Test), preparer); this script shows each person their own role, list and returns.
   Official GOV.UK Frontend and MOJ Frontend scripts (static/govuk-frontend.js, static/moj-frontend.js) are started with initAll.
   Order matters: the role navigation and the lists are built first, then the official scripts start, then our handlers are added
   (so ours run after MOJ's own sort handler). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var area = function (n) { try { return window[n]; } catch (e) { return null; } };
  var store = function (a) { return { get: function (k) { try { return a.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { a.setItem(k, v); } catch (e) {} }, del: function (k) { try { a.removeItem(k); } catch (e) {} } }; };
  var ls = store(area('localStorage')), ss = store(area('sessionStorage'));
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var file = location.pathname.split('/').pop() || 'index.html';
  var body = document.body;
  var errTitle = function (on) { var t = document.title.replace(/^Error: /, ''); document.title = on ? 'Error: ' + t : t; };
  var json = function (id) { var el = document.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } };
  var param = function (k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; };
  var safeNext = function (s) { return /^[a-z0-9-]+\.html([?#].*)?$/i.test(s || '') ? s : ''; };
  var NOW_TEXT = '8 Jun 2026, 11:20';

  // ---------- people, sessions (SEC-1: 30 minutes idle, 12 hours in all) ----------
  var USERS = {
    aisha: { name: 'Aisha Rahman (Test)', role: 'preparer', label: 'preparer' },
    casey: { name: 'Casey Lee (Test)', role: 'preparer', label: 'preparer' },
    dana: { name: 'Dana Whitfield, CPA (Test)', role: 'cpa', label: '' },
    priti: { name: 'Priti Shah (Test)', role: 'ops', label: 'ops' },
    owen: { name: 'Owen Park (Test)', role: 'owner', label: 'owner' }
  };
  var PASSWORD = 'ashbridge-test', CODE = '482913';
  // the preparer queue is drawn two ways for the sitting (Q8): version A with view tabs, version B with a filter line; a person stays in the one they opened last
  if (/^queue-b/.test(file)) ss.set('proto-variant', 'b'); else if (/^queue-a/.test(file)) ss.set('proto-variant', 'a');
  var PREP_HOME = ss.get('proto-variant') === 'b' ? 'queue-b.html' : 'queue-a.html';
  var HOME = { preparer: PREP_HOME, cpa: 'queue-cpa.html', ops: 'queue-ops.html', owner: 'board.html' };
  var LANDING_TAB = { preparer: 'workbench', cpa: 'review', ops: 'overview', owner: 'overview' };
  var NAV = { prep: ['Preparer queue', PREP_HOME], review: ['Review queue', 'queue-cpa.html'], ops: ['Ops queue', 'queue-ops.html'], 'new': ['New returns', 'queue-new.html'], board: ['Board', 'board.html'] };
  var NAV_BY_ROLE = { preparer: ['prep'], ops: ['ops', 'new'], cpa: ['review', 'prep', 'ops', 'new', 'board'], owner: ['board', 'review', 'prep', 'ops', 'new'] };
  var IDLE_MS = 30 * 60 * 1000, MAX_MS = 12 * 60 * 60 * 1000;
  var current = function () { var u = ls.get('proto-user'); return u && USERS[u] ? u : null; };
  var signIn = function (u) { ls.set('proto-user', u); if (!ls.get('proto-since')) ls.set('proto-since', String(Date.now())); ls.set('proto-last', String(Date.now())); };
  var endSession = function () { ls.del('proto-since'); ls.del('proto-last'); ls.del('proto-user'); };
  var timedOut = function () { var now = Date.now(); return now - (+ls.get('proto-last') || 0) > IDLE_MS || now - (+ls.get('proto-since') || 0) > MAX_MS; };
  var asked = function () { return file + location.search + location.hash; };
  var page = body.getAttribute('data-page');
  var user = null, me = null, role = '';

  // ---------- the sign-in pages ----------
  function authPages() {
    var next = safeNext(param('next'));
    var nextEl = $('[data-next-shown]');
    if (nextEl) {
      var target = next || nextEl.getAttribute('data-next-default') || '';
      var label = nextEl.getAttribute('data-next-label');
      nextEl.textContent = label && target === nextEl.getAttribute('data-next-default') ? label : 'the page you asked for';
      $$('form[data-keep-next]').forEach(function (f) { f.setAttribute('data-next', target); });
    }
    $$('form[data-keep-next]').forEach(function (f) { if (!f.getAttribute('data-next') && next) f.setAttribute('data-next', next); });
    var f1 = $('form[data-signin]');
    if (f1) f1.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('#user-id', f1).value.trim().toLowerCase(), pw = $('#password', f1).value;
      var n = f1.getAttribute('data-next') || next;
      var q = n ? '?next=' + encodeURIComponent(n) : '';
      if (USERS[id] && pw === PASSWORD) { ss.set('proto-pending', id); location.href = 'code.html' + q; }
      else { ss.del('proto-pending'); location.href = 'sign-in-error.html' + q; }
    });
    var f2 = $('form[data-code]');
    if (f2) f2.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = $('#code', f2).value.replace(/\s+/g, '');
      var pending = ss.get('proto-pending') || (body.hasAttribute('data-direct-ok') ? 'aisha' : '');
      var n = f2.getAttribute('data-next') || next;
      var q = n ? '?next=' + encodeURIComponent(n) : '';
      if (pending && USERS[pending] && code === CODE) {
        ss.del('proto-pending'); signIn(pending);
        location.href = safeNext(n) || HOME[USERS[pending].role];
      } else { location.href = 'code-error.html' + q; }
    });
    var back = $('[data-back-signin]'); if (back && next) back.setAttribute('href', 'sign-in.html?next=' + encodeURIComponent(next));
    $$('a[data-keep-next]').forEach(function (a) { if (next) a.setAttribute('href', a.getAttribute('href').split('?')[0] + '?next=' + encodeURIComponent(next)); });
    var so = $('[data-signed-out]'); if (so) { endSession(); }
    // the error summary link moves focus to the field (GOV.UK pattern)
    var es = $('.govuk-error-summary'); if (es && !es.hidden) { es.focus({ preventScroll: true }); }
  }

  // ---------- guard: session, role, SEC-2 ----------
  function guard() {
    var demo = body.getAttribute('data-demo-user');
    if (demo && USERS[demo] && current() !== demo) { signIn(demo); }
    user = current();
    if (!user) { location.replace('sign-in.html?next=' + encodeURIComponent(asked())); return false; }
    if (timedOut()) { endSession(); location.replace('sign-in-ended.html?next=' + encodeURIComponent(asked())); return false; }
    me = USERS[user]; role = me.role;
    ls.set('proto-last', String(Date.now()));
    var roles = (body.getAttribute('data-roles') || '').split(' ').filter(Boolean);
    if (roles.length && roles.indexOf(role) < 0) { location.replace('not-found.html'); return false; }
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { ls.set('proto-last', String(Date.now())); }, true); });
    return true;
  }

  // ---------- the header and the role navigation ----------
  function chrome() {
    var ul = $('[data-user-line]'); if (ul) ul.textContent = 'Signed in as ' + me.name + (me.label ? ', ' + me.label : '');
    var nav = $('[data-role-nav]');
    if (nav) {
      var active = body.getAttribute('data-nav');
      var items = NAV_BY_ROLE[role].map(function (k) {
        var label = k === 'prep' && role === 'preparer' ? 'My returns' : NAV[k][0], on = k === active;
        // the page you are on is not a link to itself
        return on
          ? '<li class="govuk-service-navigation__item govuk-service-navigation__item--active"><span class="govuk-service-navigation__link" aria-current="page"><strong class="govuk-service-navigation__active-fallback">' + label + '</strong></span></li>'
          : '<li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="' + NAV[k][1] + '">' + label + '</a></li>';
      });
      items.push('<li class="govuk-service-navigation__item"><a class="govuk-service-navigation__link" href="signed-out.html" data-signout>Sign out</a></li>');
      nav.innerHTML = items.join('');
    }
    $$('[data-home]').forEach(function (a) { a.setAttribute('href', HOME[role]); });
    // Sign out: ends the session at once and closes the second window (SEC-1, QR4)
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-signout]'); if (!a) return;
      endSession(); ls.set('proto-signout', String(Date.now()));
    });
    var tog = $('[data-shortcuts-off]');
    var off = function () { return ls.get('app-shortcuts-off') === '1'; };
    if (tog) { tog.checked = off(); tog.addEventListener('change', function () { ls.set('app-shortcuts-off', tog.checked ? '1' : '0'); }); }
    var inField = function (e) { var t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
    document.addEventListener('keydown', function (e) {
      if (off() || inField(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 's') { var s = $('#header-search'); if (s) { e.preventDefault(); s.focus(); } }
    });
  }

  // ---------- list context: Back, previous and next follow the list you came from (rule 21) ----------
  function saveCtx(slug, title) {
    var vis = $$('#returns tbody tr[data-slug]').filter(function (r) { return !r.hidden; }), names = {};
    vis.forEach(function (r) { var a = $('a[data-pick]', r); names[r.getAttribute('data-slug')] = a ? a.textContent.trim() : ''; });
    ss.set('proto-ctx', JSON.stringify({ url: file + location.search + location.hash, title: title, current: slug, order: vis.map(function (r) { return r.getAttribute('data-slug'); }), names: names, y: window.scrollY }));
  }

  // ---------- list pages (D04 and the carried-over D09, D10 lists) ----------
  var list = null;
  function lists() {
    var cfg = json('list-config'), box = $('[data-list]'), tbl = $('#returns');
    if (!cfg || !box || !tbl) return;
    var own = cfg.scope === 'prep' && role === 'preparer';
    var mode = own ? 'mine' : 'all';
    var views = cfg.views[mode] || cfg.views.all;
    var title = (cfg.titles && cfg.titles[role]) || cfg.titles['default'];
    var rows = $$('tbody tr[data-slug]', tbl);
    rows.forEach(function (r) { r._in = own ? r.getAttribute('data-prep') === user : true; });
    // a column drawn for some roles only (the Preparer column is not for the preparer's own list)
    $$('[data-only]', tbl).forEach(function (c) { c.hidden = (' ' + c.getAttribute('data-only') + ' ').indexOf(' ' + role + ' ') < 0; });
    var attr = 'data-views-' + (rows[0] && rows[0].hasAttribute('data-views-' + mode) ? mode : 'all');
    var inView = function (r, k) { return (' ' + (r.getAttribute(attr) || '') + ' ').indexOf(' ' + k + ' ') > -1; };
    var h1 = $('[data-list-title]'); if (h1) h1.textContent = title;
    $$('[data-caption-title]', tbl).forEach(function (c) { c.textContent = title; });
    document.title = title + ' - Ashbridge Tax';
    $$('.app-tablewrap').forEach(function (w) { w.setAttribute('aria-label', title + ' table, scrollable'); });
    var lead = $('[data-list-lead]'); if (lead && cfg.leads) { lead.innerHTML = cfg.leads[role] || cfg.leads['default'] || ''; lead.hidden = !lead.innerHTML; }
    // "Held by": You for the signed-in person, a name for anyone else
    $$('[data-hold-name]', tbl).forEach(function (s) { var you = s.getAttribute('data-by') === user; s.textContent = you ? 'You' : s.getAttribute('data-name'); var td = s.closest('td,th'); if (td) td.setAttribute('data-sort-value', you ? '0' : '1'); });
    var st = { view: views[0][0], q: '', state: '' };
    var hash = function () { var o = {}; location.hash.slice(1).split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); }); return o; };
    var h = hash();
    if (h.view && views.some(function (v) { return v[0] === h.view; })) st.view = h.view;
    if (h.q) st.q = h.q;
    if (h.state) st.state = h.state;
    var filt = $('[data-list-filter]'); if (filt) filt.value = st.q;
    var counts = {}; views.forEach(function (v) { counts[v[0]] = rows.filter(function (r) { return r._in && inView(r, v[0]); }).length; });
    var tabs = $('[data-view-tabs] ul'), sel = $('[data-view-select]');
    // a count is named by the list it sits in, so "waiting on client" in My returns (the person's own) is never the same name as the one in the Preparer queue (everyone's);
    // the line that says how many are showing is named by the view, state and filter it counts, so one name is always one number
    if (tabs) tabs.innerHTML = views.map(function (v) { return '<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#view=' + v[0] + '" data-view="' + v[0] + '" data-count="' + esc(title + ': ' + v[1].toLowerCase()) + '" data-scope="' + esc(v[1]) + '">' + esc(v[1]) + ' <span class="moj-badge moj-badge--grey"><span class="govuk-visually-hidden">(</span>' + counts[v[0]] + '<span class="govuk-visually-hidden"> returns)</span></span></a></li>'; }).join('');
    if (sel) sel.innerHTML = views.map(function (v) { return '<option value="' + v[0] + '">' + esc(v[1]) + ' (' + counts[v[0]] + ')</option>'; }).join('');
    var viewName = function () { return views.filter(function (v) { return v[0] === st.view; })[0][1]; };
    var stateName = function () { var b = $('[data-state-filter="' + st.state + '"]'); return b ? b.getAttribute('data-scope') : st.state; };
    var statusEl = $('[data-list-status]'), clear = $('[data-filter-clear]'), tableBox = $('[data-list-table]'), emptyBox = $('[data-list-empty]');
    var writeHash = function () {
      var p = ['view=' + st.view]; if (st.q) p.push('q=' + encodeURIComponent(st.q)); if (st.state) p.push('state=' + st.state);
      var s = sortState(); if (s && !s.isDefault) p.push('sort=' + s.idx + (s.dir === 'ascending' ? 'a' : 'd'));
      try { history.replaceState(null, '', '#' + p.join('&')); } catch (e) {}
    };
    function sortState() {
      var th = $('th[aria-sort="ascending"], th[aria-sort="descending"]', tbl); if (!th) return cfg.defaultSort == null ? { idx: -1, dir: 'none', isDefault: true, name: '' } : { idx: -1, dir: 'none', isDefault: false, name: '' };
      var b = $('button', th), idx = b ? +b.getAttribute('data-index') : -1, dir = th.getAttribute('aria-sort');
      return { idx: idx, dir: dir, isDefault: cfg.defaultSort === idx && dir === 'ascending', name: b ? b.textContent.trim() : th.textContent.trim() };
    }
    function apply() {
      var q = st.q.trim().toLowerCase(), n = 0, tot = 0;
      rows.forEach(function (r) {
        if (!r._in) { r.hidden = true; return; }
        var okV = inView(r, st.view), okQ = !q || (r.getAttribute('data-text') || '').indexOf(q) > -1, okS = !st.state || r.getAttribute('data-state') === st.state;
        if (okV) tot++;
        var show = okV && okQ && okS; r.hidden = !show; if (show) n++;
        if (!show) { var c = $('[data-row-select]', r); if (c) c.checked = false; }
      });
      $$('[data-view]', tabs || document).forEach(function (a) { if (a.getAttribute('data-view') === st.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      if (sel) sel.value = st.view;
      var parts = []; if (st.state) parts.push('state ' + stateName()); if (st.q.trim()) parts.push('matching "' + st.q.trim() + '"');
      var cnt = $('[data-status-count]', statusEl); if (cnt) cnt.textContent = 'Showing ' + n + ' of ' + tot + ' returns in ' + viewName() + (parts.length ? ', ' + parts.join(', ') : '') + '.';
      if (statusEl) statusEl.setAttribute('data-count', title + ': ' + viewName().toLowerCase() + (parts.length ? ', ' + parts.join(', ') : '') + ' showing');
      var s = sortState(); var ord = $('[data-status-order]', statusEl);
      if (ord) ord.textContent = s.isDefault || s.idx < 0 ? 'Sorted by ' + cfg.orderText + '.' : 'Sorted by ' + s.name.toLowerCase() + ', ' + s.dir + '.';
      if (clear) clear.hidden = !(st.q.trim() || st.state);
      $$('[data-state-filter]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-state-filter') === st.state ? 'true' : 'false'); });
      if (tableBox) tableBox.hidden = n === 0;
      if (emptyBox) {
        emptyBox.hidden = n !== 0;
        if (n === 0) {
          var filtered = st.q.trim() || st.state;
          var t = $('[data-empty-title]', emptyBox), b2 = $('[data-empty-body]', emptyBox);
          if (filtered) { t.textContent = 'No returns match'; b2.textContent = 'Nothing in ' + viewName() + (st.q.trim() ? ' matches "' + st.q.trim() + '"' : '') + (st.state ? ' in state ' + stateName() : '') + '. Clear the filter to see the ' + tot + ' in this view.'; }
          else { var em = cfg.empty || {}; t.textContent = 'No returns in ' + viewName() + '.'; b2.textContent = (em[role + ':' + st.view] || em[st.view] || em['default'] || 'Choose another view, or use the search box at the top of the page.'); }
        }
      }
      sel1();
    }
    var go = function () { apply(); writeHash(); };
    if (tabs) tabs.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-view]'); if (!a) return; e.preventDefault();
      var same = st.view === a.getAttribute('data-view'); st.view = a.getAttribute('data-view'); go();
      // choosing the view that is already shown says so, so the click is never silent
      if (same) { var cnt = $('[data-status-count]', statusEl); if (cnt) cnt.textContent = viewName() + ' is already shown. ' + cnt.textContent; }
    });
    if (sel) sel.addEventListener('change', function () { st.view = sel.value; go(); });
    if (filt) filt.addEventListener('input', function () { st.q = filt.value; go(); });
    if (clear) clear.addEventListener('click', function () { st.q = ''; st.state = ''; if (filt) filt.value = ''; go(); var t = filt || $('[data-state-filter]'); if (t) t.focus({ preventScroll: true }); });
    $$('[data-state-filter]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-state-filter'); st.state = st.state === k ? '' : k; go(); }); });
    // bulk assign on New returns: sticky bar, error in place, focus to the next row, result announced (rule 19)
    var bar = $('[data-bulkbar]'), bsum = $('[data-bulk-summary]'), bres = $('[data-bulk-result]');
    var visibleRows = function () { return rows.filter(function (r) { return !r.hidden; }); };
    function clearBulkErr() {
      var g = $('[data-bulk-group]'), s1 = $('#assign-to'), e1 = $('#assign-to-error'); if (!g) return;
      g.classList.remove('govuk-form-group--error'); s1.classList.remove('govuk-select--error'); e1.hidden = true; s1.removeAttribute('aria-describedby'); bsum.hidden = true; errTitle(false);
    }
    function sel1() {
      if (!bar) return;
      var n = $$('[data-row-select]:checked').length; bar.hidden = n === 0;
      var c = $('[data-sel-count]'); if (c) c.textContent = n + (n === 1 ? ' return selected' : ' returns selected');
      if (n === 0) clearBulkErr();
    }
    if (bar) {
      $$('[data-row-select]').forEach(function (c) { c.addEventListener('change', sel1); }); sel1();
      bar.addEventListener('submit', function (e) {
        e.preventDefault();
        var s1 = $('#assign-to'), who = s1.value, grp = $('[data-bulk-group]'), em = $('#assign-to-error');
        if (!who) { grp.classList.add('govuk-form-group--error'); s1.classList.add('govuk-select--error'); em.hidden = false; s1.setAttribute('aria-describedby', 'assign-to-error'); bsum.hidden = false; errTitle(true); bsum.focus({ preventScroll: true }); return; }
        clearBulkErr();
        var chosen = $$('[data-row-select]:checked').map(function (c) { return c.closest('tr'); }), n = chosen.length;
        var whoText = s1.options[s1.selectedIndex].text;
        chosen.forEach(function (r) { var cell = $('[data-prep-cell]', r); if (cell) { cell.textContent = whoText; cell.parentNode.setAttribute('data-sort-value', whoText); } r.setAttribute('data-prep', who); });
        var vr = visibleRows(), last = chosen[chosen.length - 1], after = vr.filter(function (r) { return vr.indexOf(r) > vr.indexOf(last) && chosen.indexOf(r) < 0; })[0];
        $$('[data-row-select]:checked').forEach(function (c) { c.checked = false; }); s1.value = ''; sel1();
        bres.textContent = n + (n === 1 ? ' return' : ' returns') + ' assigned to ' + whoText + '. The list has kept its place.' + (after ? ' Focus is on the next row.' : ''); bres.hidden = false;
        var nl = after && $('a[data-pick]', after); if (nl) { nl.focus({ preventScroll: true }); var nr = nl.getBoundingClientRect(); if (nr.top < 0 || nr.bottom > window.innerHeight) nl.scrollIntoView({ block: 'nearest' }); } else bres.focus({ preventScroll: true });
      });
      var bl = $('[data-bulk-summary] a'); if (bl) bl.addEventListener('click', function (e) { e.preventDefault(); $('#assign-to').focus({ preventScroll: true }); });
    }
    list = { cfg: cfg, st: st, apply: apply, writeHash: writeHash, sortState: sortState, title: title, tbl: tbl, box: box, go: go, first: views[0][0], filt: filt, orig: rows.slice(), status: statusEl };
    apply();
  }
  // after the official scripts have started: restore the sort from the address, remember it, keep the list's place
  function listsAfter() {
    if (!list) return;
    var tbl = list.tbl;
    var setSort = function (idx, dir) {
      var b = $('th button[data-index="' + idx + '"]', tbl); if (!b) return;
      for (var i = 0; i < 2 && b.parentNode.getAttribute('aria-sort') !== dir; i++) b.click();
    };
    var m = /(?:^|&)sort=(\d+)([ad])/.exec(location.hash.slice(1));
    if (m) setSort(+m[1], m[2] === 'a' ? 'ascending' : 'descending');
    list.apply(); list.writeHash();
    var head = $('thead', tbl); if (head) head.addEventListener('click', function (e) { if (e.target.closest('button')) { list.apply(); list.writeHash(); } });
    // the logo goes to your own list; on that list it starts the list afresh: first view, no filter, the stated order
    var home = $('a[data-home]');
    if (home && list.st) home.addEventListener('click', function (e) {
      if (home.getAttribute('href') !== file) return;
      e.preventDefault();
      list.st.view = list.first; list.st.q = ''; list.st.state = ''; if (list.filt) list.filt.value = '';
      if (list.cfg.defaultSort != null) setSort(list.cfg.defaultSort, 'ascending');
      else { $$('th[aria-sort]', tbl).forEach(function (th) { th.setAttribute('aria-sort', 'none'); }); var tb = $('tbody', tbl); list.orig.forEach(function (r) { tb.appendChild(r); }); }
      list.apply(); list.writeHash();
      var cnt = $('[data-status-count]', list.status); if (cnt) cnt.textContent = 'List started afresh. ' + cnt.textContent;
      list.status.focus({ preventScroll: true });
    });
    list.box.addEventListener('click', function (e) { var a = e.target.closest('a[data-pick]'); if (!a) return; saveCtx(a.closest('tr').getAttribute('data-slug'), list.title); });
    var c = null; try { c = JSON.parse(ss.get('proto-ctx')); } catch (e) {}
    if (ss.get('proto-restore') === '1' && c && c.url === file + location.search + location.hash) {
      ss.del('proto-restore');
      var row = c.current && $('tr[data-slug="' + c.current + '"]'); var link = row && !row.hidden && $('a[data-pick]', row);
      window.scrollTo(0, c.y || 0);
      if (link) link.focus({ preventScroll: true });
    }
  }

  // ---------- search results (rule 21): one match opens the return, more show a list, none says so ----------
  function search() {
    var data = json('search-data'), box = $('[data-search-box]'); if (!data || !box) return;
    var q = param('q').trim(), ql = q.toLowerCase(), words = ql.split(/\s+/).filter(Boolean);
    var hits = words.length ? data.filter(function (r) { if (role === 'preparer' && r[7] !== user) return false; var hay = (r[0] + ' ' + r[1] + ' ' + r[2] + ' ' + r[8]).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) > -1; }); }) : [];
    var h1 = $('[data-search-h1]'), sum = $('[data-search-summary]'), qf = $('#header-search');
    if (qf && q) qf.value = q;
    var scopeText = role === 'preparer' ? 'among the returns assigned to you' : 'in every queue';
    if (!words.length) { h1.textContent = 'Search for a return'; sum.textContent = 'Type a corporation name, a business number or a year end in the search box at the top of the page.'; document.title = 'Search for a return - Ashbridge Tax'; return; }
    if (hits.length === 1) { location.replace('rec-' + hits[0][5] + '.html'); return; }
    if (!hits.length) { h1.textContent = 'No return matches that search'; sum.textContent = 'Nothing ' + scopeText + ' matches "' + q + '". Check the spelling, or search by business number or year end.'; document.title = 'No return matches that search - Ashbridge Tax'; return; }
    h1.textContent = hits.length + ' returns match "' + q + '"'; document.title = hits.length + ' returns match "' + q + '" - Ashbridge Tax';
    sum.textContent = 'Found ' + scopeText + ', sorted by corporation name. Choose one to open it.';
    var meta = json('search-meta');
    hits.sort(function (a, b) { return a[0].localeCompare(b[0]); });
    var th = function (t, a) { return '<th scope="col" class="govuk-table__header" aria-sort="' + (a || 'none') + '">' + t + '</th>'; };
    var cell = function (x) { return '<td class="govuk-table__cell">' + x + '</td>'; };
    $('[data-search-table]').innerHTML = '<div class="app-tablewrap" role="region" aria-label="Search results table, scrollable" tabindex="0"><table class="govuk-table" id="returns" data-module="moj-sortable-table"><caption class="govuk-table__caption govuk-visually-hidden">' + hits.length + ' returns match ' + esc(q) + ', sorted by corporation name</caption><thead class="govuk-table__head"><tr class="govuk-table__row">' + th('Corporation and year end', 'ascending') + th('Business number') + th('State') + th('Tier') + th('Filing due') + '</tr></thead><tbody class="govuk-table__body">' +
      hits.map(function (r) { var s = meta.states[r[3]], t = meta.tiers[r[4]]; return '<tr class="govuk-table__row" data-slug="' + r[5] + '"><th scope="row" class="govuk-table__header" data-sort-value="' + esc(r[0]) + '"><a class="govuk-link govuk-!-font-weight-bold" href="rec-' + r[5] + '.html" data-pick>' + esc(r[0]) + '</a><br><span class="govuk-hint govuk-!-margin-bottom-0">Year end ' + esc(r[2]) + '</span></th>' + cell(esc(r[1])) + cell('<strong class="govuk-tag govuk-tag--' + s[1] + '">' + s[0] + '</strong>') + cell('<strong class="govuk-tag govuk-tag--' + t[1] + '">' + t[0] + '</strong>') + '<td class="govuk-table__cell" data-sort-value="' + r[6] + '">' + esc(r[9]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    box.hidden = false;
    list = { title: 'Search results', tbl: $('#returns'), box: box, cfg: { defaultSort: 0 }, apply: function () {}, writeHash: function () {} };
    search.after = function () {
      var first = $('a[data-pick]', box); if (first) first.focus({ preventScroll: true });
    };
  }

  // ---------- the source viewer's text (stands in for D03) ----------
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
      (withSend ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0 app-viewer__send" data-module="govuk-button" data-second data-primary>Send to second window</button>' : '') +
      '<p class="govuk-body-s govuk-!-margin-bottom-0 app-viewer__meta">' + esc(d.ret) + ', year end ' + esc(d.ye) + '. Source: ' + esc(d.source) + '. Status: ' + esc(d.status) + '.</p>' +
      (withSend ? '<p class="govuk-body-s govuk-!-margin-bottom-0" role="status" data-second-status></p>' : '') + '</div>' +
      '<div class="app-viewer__scroll" data-viewer-scroll role="region" aria-label="Source lines, scrollable" tabindex="0"><table class="govuk-table govuk-!-margin-bottom-0"><caption class="govuk-table__caption govuk-visually-hidden">First rows of the source (made-up sample lines)</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Date</th><th scope="col" class="govuk-table__header">Description</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Withdrawals</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Deposits</th></tr></thead><tbody class="govuk-table__body">' + rows + '</tbody></table></div>';
    showHit(box);
  }
  function sourcePage() {
    var h1 = $('[data-source-h1]'); if (!h1) return;
    if (param('n')) { var d0 = { name: param('n'), source: param('s'), status: param('st'), ret: param('r'), ye: param('y') }; h1.textContent = d0.name; var meta = $('[data-source-meta]'); if (meta) meta.hidden = true; document.title = d0.name + ' - Ashbridge Tax'; renderSource($('[data-viewer-body]'), d0, false); }
    // sign out in the first window closes this one (SEC-1)
    window.addEventListener('storage', function (e) { if (e.key === 'proto-user' && !e.newValue) { try { window.close(); } catch (x) {} } });
  }

  // ---------- the return record: one shell for every role (rule 23) ----------
  function record() {
    var rec = json('rec-data'); if (!rec) return;
    if (role === 'preparer' && rec.prep !== user) { location.replace('not-found.html'); return false; }
    var assigned = role === 'preparer' && rec.prep === user;
    $$('[data-roles]').forEach(function (el) { var ok = el.getAttribute('data-roles').split(' ').indexOf(role) > -1; el.hidden = !ok || el.hasAttribute('data-locked'); });
    $$('[data-assigned]').forEach(function (el) { el.hidden = !assigned; });
    $$('[data-not-assigned]').forEach(function (el) { el.hidden = assigned; });
    // the hold (FLOW-10): not held, held by you, held by another, expired
    var hold = rec.hold, saved = ss.get('hold:' + rec.slug); if (saved) { try { hold = JSON.parse(saved); } catch (e) {} }
    var htext = $('[data-hold-text]');
    var holdWords = function () {
      if (hold.kind === 'held') return (hold.by === user ? 'Held by you' : 'Held by ' + hold.byName) + ', ends ' + hold.ends + ' if idle.';
      if (hold.kind === 'expired') return 'Ended ' + hold.endedAt + ': ' + hold.byName + ' was idle for ' + hold.hours + ' hours.';
      if (rec.state === 'closed') return 'None. The return is closed and read only.';
      return 'Nobody holds this return.';
    };
    var paintHold = function () { if (htext) htext.textContent = holdWords(); };
    paintHold();
    // the actions in the identity bar (the MOJ button menu): built for this person before the official script starts.
    // One action is a plain button; two or more become MOJ's "Actions" menu; none removes the block.
    var actionsBox = $('.moj-identity-bar__actions'), menu = actionsBox && $('.moj-button-menu', actionsBox);
    if (menu) {
      var items = [];
      if (assigned && hold.holdable) { if (hold.kind === 'held' && hold.by === user) items.push(['release', 'Release the hold']); else if (hold.kind !== 'held') items.push(['take', 'Take the hold']); }
      if (rec.waiting) items.push(['chase', 'Record a chase']);
      if (!items.length) { actionsBox.hidden = true; menu.innerHTML = ''; menu.removeAttribute('data-module'); }
      else {
        actionsBox.hidden = false; menu.setAttribute('data-module', 'moj-button-menu'); menu.setAttribute('data-button-classes', 'govuk-button--secondary'); menu.setAttribute('data-align-menu', 'right');
        menu.innerHTML = items.map(function (it) { return '<button type="button" class="govuk-button govuk-button--secondary moj-button-menu__item" data-module="govuk-button" data-action="' + it[0] + '">' + it[1] + '</button>'; }).join('');
      }
    }
    var addEvent = function (title, by, when) {
      var tl = $('[data-timeline]'); if (!tl) return;
      var it = document.createElement('div'); it.className = 'moj-timeline__item';
      it.innerHTML = '<div class="moj-timeline__header"><h3 class="moj-timeline__title">' + esc(title) + '</h3><p class="moj-timeline__byline">by ' + esc(by) + '</p></div><p class="moj-timeline__date">' + esc(when) + '</p>';
      tl.insertBefore(it, tl.firstChild);
    };
    var announce = $('[data-hold-announce]');
    var setHoldAction = function (btn, key, label) { btn.setAttribute('data-action', key); btn.textContent = label; };
    if (actionsBox) actionsBox.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]'); if (!btn) return;
      var act = btn.getAttribute('data-action');
      if (act === 'take') {
        hold = { kind: 'held', by: user, byName: me.name, ends: '15:20', endedAt: '', holdable: hold.holdable, hours: hold.hours };
        ss.set('hold:' + rec.slug, JSON.stringify(hold)); paintHold(); addEvent('Hold taken by ' + me.name, me.name, NOW_TEXT); setHoldAction(btn, 'release', 'Release the hold');
        if (announce) announce.textContent = 'You now hold this return until 15:20 if idle.';
        if (htext) htext.focus({ preventScroll: true });
      } else if (act === 'release') {
        hold = { kind: 'none', by: '', byName: '', ends: '', endedAt: '', holdable: hold.holdable, hours: hold.hours };
        ss.set('hold:' + rec.slug, JSON.stringify(hold)); paintHold(); addEvent('Hold released by ' + me.name, me.name, NOW_TEXT); setHoldAction(btn, 'take', 'Take the hold');
        if (announce) announce.textContent = 'You released the hold. Nobody holds this return.';
        if (htext) htext.focus({ preventScroll: true });
      } else if (act === 'chase') {
        goTab('history', function () { var r = $('#chase-how'); if (r) r.focus({ preventScroll: true }); });
      }
    });

    // tabs are client-side routes: 0 page loads, the header stays (rule 18)
    var LABELS = { overview: 'Overview', workbench: 'Workbench', review: 'Review', documents: 'Documents', exceptions: 'Exceptions', history: 'History', ops: 'Ops' };
    var panels = $$('[data-panel]'), links = $$('[data-route]'), curDoc = null, win = null;
    var srcUrl = function (d) { return 'source.html?n=' + encodeURIComponent(d.name) + '&s=' + encodeURIComponent(d.source) + '&st=' + encodeURIComponent(d.status) + '&r=' + encodeURIComponent(d.ret) + '&y=' + encodeURIComponent(d.ye); };
    var follow = function () { if (win && !win.closed && curDoc) { win = window.open(srcUrl(curDoc), 'ashbridge-source'); } };
    var curTab = function () { var t = (location.hash.slice(1) || LANDING_TAB[role]).split('/')[0]; return LABELS[t] ? t : LANDING_TAB[role]; };
    var focusTab = function (t) { var tl = $('.moj-sub-navigation__link[data-route="' + t + '"]'); if (tl) tl.focus({ preventScroll: true }); };
    var listNav = function () {
      var c = null; try { c = JSON.parse(ss.get('proto-ctx')); } catch (e) {}
      var back = $('[data-back]'), pv = $('[data-prev]'), nx = $('[data-next]'); if (!back) return;
      back.setAttribute('href', HOME[role]); back.textContent = 'Back to ' + (role === 'preparer' ? 'My returns' : { cpa: 'Review queue', ops: 'Ops queue', owner: 'Board' }[role]);
      if (!c) return;
      back.setAttribute('href', c.url); back.textContent = 'Back to ' + c.title; back.addEventListener('click', function () { ss.set('proto-restore', '1'); });
      var i = c.order.indexOf(rec.slug); if (i < 0) return;
      c.current = rec.slug; ss.set('proto-ctx', JSON.stringify(c));
      var nameOf = c.names || {};
      var set = function (a, slug, word) { if (!slug) return; a.hidden = false; a.setAttribute('data-slug', slug); a.href = 'rec-' + slug + '.html#' + curTab(); a.innerHTML = word + ' return<span class="govuk-visually-hidden">: ' + esc(nameOf[slug] || slug) + '</span>'; };
      set(pv, c.order[i - 1], 'Previous'); set(nx, c.order[i + 1], 'Next');
      [pv, nx].forEach(function (a) { a.addEventListener('click', function () { a.href = 'rec-' + a.getAttribute('data-slug') + '.html#' + curTab(); }); });
    };
    var selectDoc = function (n, move) {
      var b = $('[data-doc="' + n + '"]'); if (!b) return;
      $$('[data-doc]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      curDoc = { name: b.getAttribute('data-name'), source: b.getAttribute('data-source'), status: b.getAttribute('data-status'), ret: b.getAttribute('data-ret'), ye: b.getAttribute('data-ye') };
      var v = $('[data-viewer]'), vb = $('[data-viewer-body]', v); $('[data-viewer-empty]', v).hidden = true; vb.hidden = false;
      renderSource(vb, curDoc, true);
      var sb = $('[data-second]', vb); sb.addEventListener('click', function () { win = window.open(srcUrl(curDoc), 'ashbridge-source'); $('[data-second-status]', vb).textContent = win ? 'Opened in the second window. It follows each document you choose and each tab you open.' : 'The browser blocked the second window. Allow pop-ups for this page and try again.'; });
      if (move) { $('[data-viewer-title]', vb).focus({ preventScroll: true }); showHit(vb); }
      follow();
    };
    $$('[data-doc]').forEach(function (b) { b.addEventListener('click', function () { selectDoc(+b.getAttribute('data-doc'), true); history.replaceState(null, '', '#documents/' + b.getAttribute('data-doc')); }); });
    var route = function (focus) {
      var h = location.hash.slice(1);
      if (!h) { h = LANDING_TAB[role]; try { history.replaceState(null, '', '#' + h); } catch (e) {} }
      var parts = h.split('/'), tab = parts[0]; if (!LABELS[tab]) { tab = LANDING_TAB[role]; parts = [tab]; }
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
      links.forEach(function (a) { if (a.classList.contains('moj-sub-navigation__link')) { if (a.getAttribute('data-route') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
      document.title = (document.title.indexOf('Error: ') === 0 ? 'Error: ' : '') + LABELS[tab] + ' - ' + rec.name + ', year end ' + rec.ye + ' - Ashbridge Tax';
      var rs = $('[data-route-status]'); if (rs) rs.textContent = LABELS[tab] + ' tab';
      var sn = $('[data-since]'); if (sn) sn.hidden = !(tab === LANDING_TAB[role] || tab === 'overview');
      if (tab === 'documents' && parts[1]) selectDoc(+parts[1], focus);
      if (focus && !(tab === 'documents' && parts[1])) focusTab(tab);
      var nv = $('[data-prev]'); if (nv && !nv.hidden) nv.href = 'rec-' + nv.getAttribute('data-slug') + '.html#' + tab;
      nv = $('[data-next]'); if (nv && !nv.hidden) nv.href = 'rec-' + nv.getAttribute('data-slug') + '.html#' + tab;
      follow();
      if (afterRoute) { var f = afterRoute; afterRoute = null; f(); }
    };
    var afterRoute = null;
    listNav();
    var goTab = function (t, then) { if (location.hash.slice(1) === t) { focusTab(t); if (then) then(); } else { afterRoute = then || null; location.hash = t; } };
    // a link to the tab that is already open says so (the sub navigation keeps focus on the tab, as GOV.UK Tabs do)
    links.forEach(function (a) { a.addEventListener('click', function (e) { var t = a.getAttribute('data-route'); if (curTab() === t && location.hash.slice(1) === t) { e.preventDefault(); var rs = $('[data-route-status]'); if (rs) rs.textContent = LABELS[t] + ' tab is already open.'; focusTab(t); } }); });
    window.addEventListener('hashchange', function () { route(true); });
    route(false);

    // chase: a dated staff note on the return (QR16); in place, the GOV.UK error pattern, focus to the result (rules 9, 19)
    var cf = $('[data-chase-form]');
    if (cf) cf.addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = $('input[name="how"]:checked', cf), sum = $('[data-chase-summary]', cf), grp = $('[data-chase-group]', cf), em = $('#chase-how-error');
      if (!picked) { grp.classList.add('govuk-form-group--error'); em.hidden = false; sum.hidden = false; errTitle(true); sum.focus({ preventScroll: true }); return; }
      grp.classList.remove('govuk-form-group--error'); em.hidden = true; sum.hidden = true; errTitle(false);
      var how = picked.value;
      var lc = $('[data-last-contact]'); if (lc) lc.textContent = '8 Jun 2026, chased by ' + how + ', recorded by ' + me.name;
      addEvent('Chase recorded: ' + how, me.name, NOW_TEXT);
      var ban = $('[data-chase-banner]'), bt = $('[data-chase-banner-text]'); bt.textContent = 'Chase recorded: ' + how + ', ' + NOW_TEXT + '. It is a dated note on the return; nothing was sent to the client.';
      ban.hidden = false; picked.checked = false; ban.focus({ preventScroll: true });
    });
    var cl = $('[data-chase-error-link]'); if (cl) cl.addEventListener('click', function (e) { e.preventDefault(); var r = $('#chase-how'); if (r) r.focus({ preventScroll: true }); });

    // ops steps: forms of 3 fields or fewer, in place (rules 9, 19)
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
      var el = $('[data-ops-left]'); if (el) el.textContent = left.length ? 'Left to do on this return: ' + left.join(', then ') + '.' : 'Every ops step is done.';
    };
    $$('[data-ops-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var inp = $('input[name="f"]', f), k = f.getAttribute('data-step'), grp = $('[data-field-group]', f);
        var bad = inp && (inp.type === 'file' ? !inp.value : !inp.value.trim());
        if (bad) {
          var em = $('#f-' + k + '-error'); grp.classList.add('govuk-form-group--error'); em.hidden = false; inp.classList.add(inp.type === 'file' ? 'govuk-file-upload--error' : 'govuk-input--error'); inp.setAttribute('aria-describedby', 'f-' + k + '-hint f-' + k + '-error');
          var lk = $('[data-error-link]', osum); lk.textContent = $('[data-error-text]', em).textContent; lk.setAttribute('href', '#f-' + k); lk.onclick = function (ev) { ev.preventDefault(); inp.focus({ preventScroll: true }); };
          f.insertBefore(osum, f.firstChild); osum.hidden = false; errTitle(true); osum.focus({ preventScroll: true }); return;
        }
        osum.hidden = true; errTitle(false); if (osum.parentNode === f) osumHome.insertBefore(osum, osumNext);
        var li = f.parentNode; li.setAttribute('data-step-state', 'done'); $('[data-status-slot]', li).innerHTML = DONE_TAG; f.parentNode.removeChild(f);
        var nxt = f.getAttribute('data-after-state'); if (nxt && NEXT_STATE[nxt]) { var s = $('[data-state-tag] strong'); if (s) { s.textContent = NEXT_STATE[nxt][0]; s.className = 'govuk-tag govuk-tag--' + NEXT_STATE[nxt][1]; } }
        var u = UNLOCK[k]; if (u) { var ul = $('[data-step-item="' + u + '"]'); if (ul) { ul.setAttribute('data-step-state', 'todo'); $('[data-status-slot]', ul).innerHTML = TODO_TAG; var why = $('[data-lock-why]', ul); if (why) why.parentNode.removeChild(why); var uf = $('form', ul); if (uf) { uf.removeAttribute('data-locked'); uf.hidden = uf.getAttribute('data-roles').split(' ').indexOf(role) < 0; } } }
        leftText(); sortSteps(); ores.textContent = f.getAttribute('data-done'); ores.hidden = false; ores.focus({ preventScroll: true });
      });
    });
    return true;
  }

  // ---------- start ----------
  var proceed = true;
  if (page === 'auth') { authPages(); }
  else if (page === 'app') {
    proceed = guard();
    if (proceed) {
      chrome(); lists(); search();
      if (record() === false) proceed = false;
      sourcePage();
    }
  }
  if (!proceed) return;
  try { if (window.GOVUKFrontend) window.GOVUKFrontend.initAll(); if (window.MOJFrontend) window.MOJFrontend.initAll(); } catch (e) { if (window.console) console.error(e); }
  listsAfter();
  if (search.after) search.after();
  // the skip link moves focus to the main block and leaves the address alone: the address holds the record tab, the list view, the filter and the sort (rule 21),
  // so a jump to "#main-content" would send a record to its landing tab and lose the selection on a reload
  var skip = $('.govuk-skip-link');
  if (skip) skip.addEventListener('click', function (e) {
    var main = document.getElementById('main-content'); if (!main) return;
    e.preventDefault(); if (main.getAttribute('tabindex') === null) main.setAttribute('tabindex', '-1'); main.focus();
  });
  if (page === 'app' && $('[data-bulkbar]')) { /* the bulk bar is wired in lists() */ }
})();
