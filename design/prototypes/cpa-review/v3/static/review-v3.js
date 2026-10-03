/* CPA review, version 3 (round 3). Prototype behaviour only: no data leaves the page.
   One record page per scenario; section and tab changes are client-side routes (#/section/number), so 0 page loads.
   Every action runs in place, keeps the scroll, moves focus to the result and announces it (staff-screens rules 18, 19).
   Single keys repeat a visible control and never unmark, approve, send or resolve (rules 10, 22). Keys come from D01's one list. */
(function () {
  'use strict';
  function boot() {
  var body = document.body;
  var person = body.getAttribute('data-person') || '';
  var channel = ('BroadcastChannel' in window) ? new BroadcastChannel('ashbridge-source') : null;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function one(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function announce(msg) { var l = document.getElementById('app-live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 20); } }
  function store(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function drop(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  var PREF = 'ashbridge-pref:' + person;
  function prefs() { try { return JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) { return {}; } }
  function prefGet(k) { return prefs()[k]; }
  function prefSet(k, v) { var o = prefs(); o[k] = v; try { localStorage.setItem(PREF, JSON.stringify(o)); } catch (e) { /* private mode */ } }

  /* -------- keys off switch (WCAG 2.1.4): one choice per signed-in person, shared by every window */
  var keysOff = one('#keys-off');
  if (keysOff) {
    keysOff.checked = prefGet('keysOff') === true;
    keysOff.addEventListener('change', function () { prefSet('keysOff', keysOff.checked); announce(keysOff.checked ? 'Single-key shortcuts are off.' : 'Single-key shortcuts are on.'); });
  }
  function keysOn() { return !(keysOff && keysOff.checked); }

  /* -------- signing out closes the second window and forgets the session (task 9) */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-signout]')) return;
    if (channel) channel.postMessage({ t: 'signout' });
    drop('ashbridge-queue'); drop('ashbridge-judg');
  });
  if (body.hasAttribute('data-signedout')) { if (channel) channel.postMessage({ t: 'signout' }); return; }

  /* -------- the source viewer: one implementation, used in the review window and in the second window */
  function makeViewer() {
    var cur = null, k = 0;
    function hideAll() { all('[data-source]').forEach(function (e) { e.hidden = true; }); all('[data-srcset]').forEach(function (e) { e.hidden = true; }); }
    function boxIntoView(root) {
      var box = one('.app-source__hit, .app-hit', root); var pane = one('[data-source-body]');
      if (!box || !pane) { if (pane) pane.scrollTop = 0; return; }
      var b = pane.getBoundingClientRect(), r = box.getBoundingClientRect();
      pane.scrollTop += r.top - b.top - b.height / 2 + r.height / 2;
    }
    function show(id, idx) {
      cur = id; hideAll(); var st = one('[data-source-state]'); if (st) st.innerHTML = '';
      var set = one('[data-srcset="' + id + '"]'); var cap = one('[data-source-caption]');
      if (!set) { if (cap) { cap.hidden = false; cap.textContent = 'No source for this item.'; } return; }
      set.hidden = false;
      if (set.hasAttribute('data-nosource')) { k = 0; if (cap) cap.hidden = true; return; }
      var n = +set.getAttribute('data-count'); k = ((idx % n) + n) % n;
      var el = one('[data-source="' + id + ':' + k + '"]'); if (el) { el.hidden = false; if (cap) cap.hidden = true; boxIntoView(el); }
    }
    function state(id, which) {
      cur = id; hideAll(); var st = one('[data-source-state]'); var cap = one('[data-source-caption]'); if (!st) return;
      var set = one('[data-srcset="' + id + '"]'); var n = set ? +(set.getAttribute('data-count') || 1) : 1;
      if (which === 'loading') st.innerHTML = '<div role="status"><p class="app-caption">Loading source 1 of ' + n + '...</p><div class="app-skeleton"></div><div class="app-skeleton"></div><div class="app-skeleton"></div><div class="app-skeleton"></div></div>';
      else st.innerHTML = '<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>The page image for source 1 of ' + n + ' did not load. The number is not marked Traced until you see it.</strong></div><p><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-retry>Try again</button></p>';
      if (cap) cap.hidden = true;
    }
    return { show: show, state: state, get: function () { return { id: cur, k: k }; }, count: function () { var s = cur && one('[data-srcset="' + cur + '"]'); return s && s.getAttribute('data-count') ? +s.getAttribute('data-count') : 0; } };
  }

  /* ================================================================ the second window */
  if (body.hasAttribute('data-source-window')) {
    var wv = makeViewer(); var follow = document.getElementById('follow');
    var label = one('[data-win-for]'); var myWhich = body.getAttribute('data-which'); var leaving = false;
    var hashPart = location.hash.slice(1).split(':');
    if (hashPart[0] && one('[data-srcset="' + hashPart[0] + '"]')) wv.show(hashPart[0], +hashPart[1] || 0);
    function stepWin(d) {
      var g = wv.get(); if (!g.id || !wv.count()) { announce('Pick a number in the review window first.'); return; }
      wv.show(g.id, g.k + d); if (channel) channel.postMessage({ t: 'step', id: g.id, k: wv.get().k });
      var cap = one('[data-source="' + g.id + ':' + wv.get().k + '"] .app-caption'); announce(cap ? cap.textContent : 'Source changed');
    }
    if (channel) {
      channel.postMessage({ t: 'here', which: myWhich });
      channel.onmessage = function (m) {
        var d = m.data;
        if (d.t === 'signout' || d.t === 'close') { leaving = true; window.close(); announce('The review window asked this window to close.'); return; }
        if (d.t === 'hello') channel.postMessage({ t: 'here', which: myWhich });
        if (d.t === 'select' && follow.checked) {
          if (d.which && d.which !== myWhich) { leaving = true; location.replace(d.srcFile + (d.id ? '#' + d.id + ':' + (d.k || 0) : '')); return; }
          if (d.id && one('[data-srcset="' + d.id + '"]')) { wv.show(d.id, d.k || 0); label.textContent = 'Showing ' + d.label + ' (' + d.tab + ').'; }
          else { all('[data-srcset],[data-source]').forEach(function (e) { e.hidden = true; }); var c = one('[data-source-caption]'); c.hidden = false; c.textContent = d.tab + ': no source on this tab. Pick a number in the review window.'; label.textContent = 'The review window is on ' + d.tab + '.'; }
          announce('Source updated');
        }
      };
      window.addEventListener('pagehide', function () {
        try { localStorage.setItem('ashbridge-win', JSON.stringify({ l: window.screenX, t: window.screenY, w: window.outerWidth, h: window.outerHeight })); } catch (e) { /* private mode */ }
        if (!leaving) channel.postMessage({ t: 'gone' });
      });
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-src-next]')) stepWin(1); else if (e.target.closest('[data-src-prev]')) stepWin(-1);
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, tag = t && t.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !keysOn()) return;
      if (e.key === ']') { stepWin(1); e.preventDefault(); } else if (e.key === '[') { stepWin(-1); e.preventDefault(); }
    });
    return;
  }

  /* ================================================================ the queue (V15) */
  if (body.hasAttribute('data-queue')) {
    var form = one('[data-qfilter]'); var table = one('[data-q-table]');
    var qviews = all('[data-qview]');
    var viewNow = function () { return location.hash === '#/rework' ? 'rework' : 'all'; };
    var markViews = function () { qviews.forEach(function (a) { if (a.getAttribute('data-qview') === viewNow()) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); };
    var samePlace = function (e) {
      var l = e.target.closest('.govuk-header__homepage-link, .govuk-service-navigation__link[aria-current], [data-qview][aria-current]');
      if (l) { e.preventDefault(); announce('You are already on the review queue' + (viewNow() === 'rework' ? ', the Back from rework view.' : '.')); var qh = one('h1'); qh.setAttribute('tabindex', '-1'); qh.focus(); }
    };
    document.addEventListener('click', samePlace);
    if (!table) {
      var showNone = function () { all('[data-q-none]').forEach(function (e) { e.hidden = e.getAttribute('data-q-none') !== viewNow(); }); markViews(); };
      window.addEventListener('hashchange', function () { showNone(); announce(viewNow() === 'rework' ? 'Back from rework. No returns are back from rework.' : 'All. No returns are waiting for your review.'); });
      showNone();
      return;
    }
    var rows = all('tbody tr', table);
    var visible = function () { return rows.filter(function (r) { return !r.hidden; }); };
    var sortState = function () { var ths = all('thead th', table); for (var i = 0; i < ths.length; i++) { var a = ths[i].getAttribute('aria-sort'); if (a && a !== 'none') return { i: i, a: a }; } return null; };
    var save = function () {
      store('ashbridge-queue', { q: one('#q-search').value, tier: one('#q-tier').value, view: viewNow(), sort: sortState(), scroll: window.scrollY, hrefs: visible().map(function (r) { var a = one('[data-q-open]', r); return a ? a.getAttribute('href').split('#')[0] : null; }).filter(Boolean), page: location.pathname.split('/').pop() });
    };
    var apply = function (quiet) {
      var q = one('#q-search').value.trim().toLowerCase(), t = one('#q-tier').value, v = viewNow(), n = 0, inView = 0;
      rows.forEach(function (r) {
        var inV = v === 'all' || r.getAttribute('data-q-round') === 'Back from rework'; if (inV) inView++;
        var ok = inV && (!q || r.getAttribute('data-q-name').indexOf(q) > -1) && (!t || r.getAttribute('data-q-tier') === t); r.hidden = !ok; if (ok) n++;
      });
      var filtered = !!(q || t); var what = v === 'rework' ? 'back from rework' : 'waiting';
      var txt = filtered ? n + (n === 1 ? ' return' : ' returns') + ' shown of ' + inView + ' ' + what + '.' : inView + (inView === 1 ? ' return ' : ' returns ') + what + '.';
      one('[data-q-count]').textContent = txt; one('[data-q-count]').setAttribute('data-scope', what);
      var empty = one('[data-q-empty]'); empty.hidden = n !== 0;
      if (n === 0) {
        one('[data-q-empty-title]').textContent = inView === 0 ? 'No returns are back from rework.' : 'No returns match.';
        one('[data-q-empty-why]').textContent = inView === 0 ? 'A return appears here when its preparer sends it back after your comments. Switch to All to see the ' + rows.length + ' waiting.' : 'Clear the filters to see all ' + inView + '.';
      }
      markViews(); save();
      if (quiet !== true) announce(txt);
    };
    var saved = store('ashbridge-queue');
    if (saved) { one('#q-search').value = saved.q || ''; one('#q-tier').value = saved.tier || ''; if (!location.hash && saved.view === 'rework') history.replaceState(null, '', '#/rework'); }
    if (!location.hash) history.replaceState(null, '', '#/all');
    apply(true);
    if (saved && saved.sort && !(saved.sort.i === 2 && saved.sort.a === 'ascending')) {
      var th = all('thead th', table)[saved.sort.i]; var b = th && one('button', th); var tries = 0;
      while (b && th.getAttribute('aria-sort') !== saved.sort.a && tries < 3) { b.click(); tries++; }
    }
    if (saved && saved.scroll) window.scrollTo(0, saved.scroll);
    form.addEventListener('input', function () { apply(true); }); form.addEventListener('change', function () { apply(true); });
    form.addEventListener('submit', function (e) { e.preventDefault(); announce(one('[data-q-count]').textContent); });
    window.addEventListener('hashchange', function () { apply(false); });
    one('[data-q-clear]').addEventListener('click', function () { one('#q-search').value = ''; one('#q-tier').value = ''; apply(true); announce('Filters cleared. ' + one('[data-q-count]').textContent); one('#q-search').focus(); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-q-open]') || e.target.closest('th button')) setTimeout(save, 0); });
    new MutationObserver(save).observe(one('thead', table), { attributes: true, subtree: true, attributeFilter: ['aria-sort'] });
    window.addEventListener('scroll', function () { clearTimeout(window.__sv); window.__sv = setTimeout(save, 150); });
    document.addEventListener('keydown', function (e) {
      var t = e.target, tag = t && t.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !keysOn()) return;
      if (e.key === 's') { e.preventDefault(); one('#q-search').focus(); announce('Search the queue by name.'); }
    });
    return;
  }

  /* ================================================================ the approval record */
  if (body.hasAttribute('data-approved')) {
    var which = body.getAttribute('data-which');
    var FILES = { red: ['red.html', 'red-rework.html', 'red-gate.html', 'red-ready.html'], green: ['green.html', 'green-ready.html', 'green-void.html'], blue: ['bluewater.html'], scar: ['scarborough.html'] };
    var qs = store('ashbridge-queue'); var nlink = one('[data-queue-next-link]');
    if (qs && qs.hrefs && qs.hrefs.length) {
      var mine = FILES[which] || []; var mi = -1; qs.hrefs.forEach(function (h, i) { if (mi < 0 && mine.indexOf(h) > -1) mi = i; });
      var nxt = mi > -1 ? qs.hrefs[mi + 1] : null; if (!nxt) nxt = qs.hrefs.filter(function (h) { return mine.indexOf(h) < 0; })[0];
      if (nxt) nlink.setAttribute('href', nxt + '#/brief');
    }
    var sj = store('ashbridge-judg');
    if (sj && sj.which === which && sj.judg) {
      Object.keys(sj.judg).forEach(function (id) {
        var tr = one('[data-judg-row="' + id + '"]'); var j = sj.judg[id]; if (!tr) return;
        one('[data-judg-word]', tr).textContent = j.kind === 'accept' ? 'Accepted' : 'Commented instead';
        one('[data-judg-why]', tr).textContent = j.kind === 'accept' ? j.reason : 'Comment ' + j.comment + ' sent to the preparer.';
        one('[data-judg-who]', tr).textContent = j.by + ', ' + j.when;
      });
    }
    return;
  }
  if (!body.hasAttribute('data-record')) return;

  /* ================================================================ the return record page */
  var D = JSON.parse(document.getElementById('app-data').textContent);
  var S = { marks: JSON.parse(JSON.stringify(D.marks)), judg: JSON.parse(JSON.stringify(D.judg)), comments: D.comments.slice(), cur: null, sec: null, last: {}, win: false, winBlocked: false, sent: false, unmarkOpen: false, judgOpen: {}, reviewHash: '#/brief', srcOpened: 0, lastFlag: null, route: null };
  var secByKey = {}, secBySlug = {}, order = [], flagById = {};
  D.sections.forEach(function (s, i) { s.i = i; secByKey[s.key] = s; secBySlug[s.slug] = s; order.push(s.key); });
  D.flags.forEach(function (f) { flagById[f.id] = f; });
  var viewer = makeViewer();
  var panesEl = one('[data-panes]'), tb = one('[data-toolbar-body]'), h1 = one('#route-title');
  var listBody = one('[data-list-body]');
  var VIEW_ROUTES = { comments: 1, history: 1, changes: 1 };

  function hasRows(s) { return s.type === 'flags' || s.type === 'rows'; }
  function isOn(k) { return S.marks[k] && S.marks[k] !== 'off'; }
  function isOff(k) { return S.marks[k] === 'off'; }
  function nOn() { return order.filter(isOn).length; }
  function risks() { return D.flags.filter(function (f) { return f.kind === 'accepted'; }); }
  function unjudged() { return risks().filter(function (f) { return !S.judg[f.id]; }); }
  function secsLeft() { return D.sections.filter(function (s) { return !isOn(s.key); }); }
  function allDone() { return D.canAct && secsLeft().length === 0 && unjudged().length === 0; }
  function leftCount() { return secsLeft().length + unjudged().length; }
  function lineOf(id) { return D.lines[id]; }
  function routeFor(id) {
    if (flagById[id]) return '#/flags/' + id;
    var l = lineOf(id); return l ? '#/' + secByKey[l.section].slug + '/' + id : '#/brief';
  }
  function labelFor(id) { var f = flagById[id]; return f ? f.id + ' ' + f.title : (lineOf(id) ? lineOf(id).label : id); }
  function titleOf(key) { return key === 'unplaced' ? 'Forms not yet placed' : secByKey[key].title; }
  function errTitle() { document.title = 'Error: ' + h1.textContent + ' - ' + D.corp + ' - Ashbridge Tax'; }
  function okTitle() { document.title = h1.textContent + ' - ' + D.corp + ' - Ashbridge Tax'; }
  function parse() { var p = location.hash.replace(/^#\/?/, '').split('/'); return { a: p[0] || 'brief', b: p[1] ? decodeURIComponent(p[1]) : null, c: p[2] || null }; }
  function go(hash, replace) { if (replace) history.replaceState(null, '', hash); else location.hash = hash; }
  function rowEl(id) { return one('[data-row="' + id + '"]'); }
  function rowBtn(id) { var r = rowEl(id); return r && one('[data-pick]', r); }
  function focusRowOf(id) { var b = id && rowBtn(id); if (b) b.focus(); else h1.focus(); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }

  /* -------- derived text that must agree everywhere (rule 5, V5) */
  function stateText(id) {
    var f = flagById[id]; if (!f || f.kind !== 'accepted') return 'No judgment needed';
    var j = S.judg[id]; return !j ? 'Not judged' : j.kind === 'accept' ? 'Accepted' : 'Commented instead';
  }
  function markWord(k) { return isOn(k) ? 'Reviewed' : isOff(k) ? 'Mark came off' : 'Not reviewed'; }
  function refreshCounts() {
    all('[data-count-reviewed]').forEach(function (e) { e.textContent = nOn(); });
    var tag = one('[data-count-tag]'); if (tag) tag.className = 'govuk-tag ' + (nOn() === order.length ? 'govuk-tag--green' : 'govuk-tag--grey');
    all('[data-comment-count]').forEach(function (e) { e.textContent = S.comments.length; });
    var sp = one('[data-section-pick]');
    if (sp) {
      var want = S.route ? (S.route.a === 'brief' ? '#/brief' : S.route.a === 'approve' ? '#/approve' : secBySlug[S.route.a] ? '#/' + S.route.a : null) : null;
      var left = unjudged().length;
      sp.innerHTML = '<option value="#/brief">Brief</option>' + D.sections.map(function (s, i) { var w = markWord(s.key) + (s.key === 'flags' && left ? ', ' + left + ' to judge' : ''); return '<option value="#/' + s.slug + '">' + (i + 1) + ' ' + esc(titleOf(s.key)) + ' (' + w + ')</option>'; }).join('') + (D.canAct ? '<option value="#/approve">Approve (' + (allDone() ? 'ready' : leftCount() + ' left') + ')</option>' : '');
      if (want) sp.value = want;
    }
    D.sections.forEach(function (s) {
      var m = one('[data-rail-mark="' + s.key + '"]'); if (!m) return;
      var left2 = s.key === 'flags' ? unjudged().length : 0;
      m.innerHTML = '<span class="app-rail__word">' + markWord(s.key) + (left2 ? ', ' + left2 + ' accepted risks to judge' : '') + '</span>';
      m.className = 'app-rail__mark' + (isOn(s.key) ? ' app-rail__mark--on' : isOff(s.key) ? ' app-rail__mark--off' : '');
    });
    var am = one('[data-rail-mark="approve"]');
    if (am) { am.innerHTML = '<span class="app-rail__word">' + (allDone() ? 'Ready' : leftCount() + ' left') + '</span>'; am.className = 'app-rail__mark' + (allDone() ? ' app-rail__mark--on' : ''); }
    all('[data-flag-state]').forEach(function (e) { e.textContent = stateText(e.getAttribute('data-flag-state')); var cell = e.closest('td[data-sort-value]'); if (cell) cell.setAttribute('data-sort-value', e.textContent); });
    all('[data-off-state]').forEach(function (e) { var k = e.getAttribute('data-off-state'); e.textContent = isOn(k) ? 'You have marked it Reviewed again.' : 'Still to re-mark: look at the changed numbers, then mark it.'; });
    renderJudgeHosts(); renderNotes(); renderCommentsList(); renderSendBack(); renderApprove();
  }
  function refreshAll() { renderToolbar(S.route); refreshCounts(); }

  /* -------- Approve (RV-10): what remains as links, then the button */
  function approveButton() { return '<a class="govuk-button app-btn-sm" role="button" draggable="false" data-approve data-primary href="' + esc(D.approveHref) + '" aria-keyshortcuts="a">Approve return</a>'; }
  function renderApprove() {
    var host = one('[data-approve-body]'); if (!host) return;
    var sl = secsLeft(), ul = unjudged(), r = risks(), oc = S.comments.filter(function (c) { return !c.resolved; });
    var html = '<h2 class="govuk-heading-m" id="approve-h" tabindex="-1">Approve ' + esc(D.corp) + '</h2>';
    if (!sl.length && !ul.length) {
      html += '<p class="govuk-body"><strong>Everything is done.</strong> ' + order.length + ' of ' + order.length + ' sections are Reviewed' + (r.length ? ' and ' + r.length + ' of ' + r.length + ' accepted risks are judged' : ', and no flag is an accepted risk') + '.</p><p>' + approveButton() + '</p>';
    } else {
      html += '<p class="govuk-body"><strong>Approve is not here yet.</strong> It appears when every section is Reviewed and every accepted risk is judged. Still to do:</p>';
      var placed = sl.filter(function (s) { return s.key !== 'unplaced'; });
      if (placed.length) html += '<h3 class="govuk-heading-s" data-count="sections-left" data-scope="sections">Sections not Reviewed (' + sl.length + ' of ' + order.length + ')</h3><ul class="app-inline-list app-inline-list--col">' + sl.map(function (s) { return '<li><a class="govuk-link" href="#/' + s.slug + '">' + esc(titleOf(s.key)) + (isOff(s.key) ? ' (mark came off)' : '') + '</a></li>'; }).join('') + '</ul>';
      else if (sl.length) html += '<h3 class="govuk-heading-s" data-count="sections-left" data-scope="sections">Sections not Reviewed (' + sl.length + ' of ' + order.length + ')</h3><ul class="app-inline-list app-inline-list--col">' + sl.map(function (s) { return '<li><a class="govuk-link" href="#/' + s.slug + '">' + esc(titleOf(s.key)) + '</a></li>'; }).join('') + '</ul>';
      if (D.unplaced.length && !isOn('unplaced')) html += '<h3 class="govuk-heading-s">Forms not placed (' + D.unplaced.length + ')</h3><ul class="app-inline-list app-inline-list--col">' + D.unplaced.map(function (f) { return '<li><a class="govuk-link" href="#/forms-not-placed">form not placed: ' + esc(f) + '</a></li>'; }).join('') + '</ul>';
      if (ul.length) html += '<h3 class="govuk-heading-s" data-count="risks-left" data-scope="accepted risks">Accepted risks not judged (' + ul.length + ' of ' + r.length + ')</h3><ul class="app-inline-list app-inline-list--col">' + ul.map(function (f) { return '<li><a class="govuk-link" href="#/flags/' + f.id + '">' + esc(f.id) + ' ' + esc(f.title) + '</a></li>'; }).join('') + '</ul>';
    }
    if (oc.length) html += '<div class="govuk-inset-text app-inset-tight"><p class="govuk-body"><strong>Comments still open (' + oc.length + '):</strong> ' + plural(oc.filter(function (c) { return c.severity === 'Must fix'; }).length, 'must fix', 'must fix') + ' of them. They do not stop Approve (RV-10 names sections, forms and accepted risks only) and they stay in the approval record. <a class="govuk-link" href="#/comments">Open the comments</a></p></div>';
    html += '<p class="govuk-body-s">The approval record keeps each mark with who and when, your judgment on each accepted risk with your reason, the time on each section and every source you opened (RV-11).</p>';
    if (host.getAttribute('data-sig') !== html) { host.setAttribute('data-sig', html); host.innerHTML = html; }
  }

  /* -------- toolbar */
  function renderToolbar(r) {
    var html = '', sec = secBySlug[r.a];
    if (!D.canAct) {
      if (r.a === 'brief') html += '<a class="govuk-button app-btn-sm" role="button" draggable="false" href="#/flags" aria-keyshortcuts="n">Start with the flags</a> ';
      else if (sec) {
        if (isOn(sec.key)) html += '<strong class="govuk-tag govuk-tag--green">Reviewed by ' + esc(S.marks[sec.key].by) + ', ' + esc(S.marks[sec.key].when) + '</strong> ';
        else html += '<strong class="govuk-tag govuk-tag--' + (isOff(sec.key) ? 'red' : 'grey') + '">' + markWord(sec.key) + '</strong> ';
        var nx0 = order[sec.i + 1]; if (nx0) html += '<a class="govuk-button govuk-button--secondary app-btn-sm" role="button" draggable="false" href="#/' + secByKey[nx0].slug + '">Next section<span class="govuk-visually-hidden">: ' + esc(titleOf(nx0)) + '</span></a> ';
      }
      html += '<span class="app-readonly">' + esc(D.readWhy) + '</span>';
      tb.innerHTML = html; one('[data-unmark]').innerHTML = ''; return;
    }
    if (r.a === 'brief') {
      html += '<a class="govuk-button app-btn-sm" role="button" draggable="false" data-primary href="#/flags" aria-keyshortcuts="n">Start review: Flags</a> <a class="govuk-link" href="#/comments/send">Send back to ' + esc(D.preparer) + '</a>';
    } else if (sec) {
      var key = sec.key;
      if (isOn(key)) html += '<strong class="govuk-tag govuk-tag--green">Reviewed by ' + esc(S.marks[key].by) + ', ' + esc(S.marks[key].when) + '</strong> ';
      else if (isOff(key)) html += '<strong class="govuk-tag govuk-tag--red">Mark came off</strong> ';
      else html += '<strong class="govuk-tag govuk-tag--grey">Not reviewed</strong> ';
      if (key === 'flags') { var rr = risks(); if (rr.length) html += '<span class="app-sectionof" data-count="judged" data-scope="accepted risks">' + (rr.length - unjudged().length) + ' of ' + rr.length + ' accepted risks judged</span> '; }
      if (!isOn(key)) html += '<button type="button" class="govuk-button app-btn-sm" data-primary data-reviewed-next aria-keyshortcuts="r">Reviewed, next</button>';
      else {
        var nxt = order[sec.i + 1];
        if (nxt) html += '<a class="govuk-button govuk-button--secondary app-btn-sm" role="button" draggable="false" href="#/' + secByKey[nxt].slug + '">Next section<span class="govuk-visually-hidden">: ' + esc(titleOf(nxt)) + '</span></a> ';
        html += '<button type="button" class="govuk-button govuk-button--warning app-btn-sm" data-unmark-open aria-expanded="' + (S.unmarkOpen ? 'true' : 'false') + '">Take the mark off</button>';
      }
    }
    if (r.a !== 'approve') html += ' ' + (allDone() ? approveButton() : '<span class="app-approvehint"><a class="govuk-link" href="#/approve" aria-keyshortcuts="a">Approve: ' + leftCount() + ' left</a></span>');
    tb.innerHTML = html;
    var u = one('[data-unmark]');
    if (sec && S.unmarkOpen && isOn(sec.key)) u.innerHTML = '<form class="app-unmark" data-unmark-form novalidate><div class="govuk-form-group govuk-!-margin-bottom-2" data-ug><label class="govuk-label govuk-label--s" for="um-why">Why does the mark come off? <span class="app-required" aria-hidden="true">*</span></label><div id="um-hint" class="govuk-hint">Required. It goes in the history.</div><p id="um-err" class="govuk-error-message" hidden><span class="govuk-visually-hidden">Error:</span> Enter a reason for taking the mark off</p><textarea class="govuk-textarea" id="um-why" rows="2" aria-describedby="um-hint"></textarea></div><button class="govuk-button govuk-button--warning app-btn-sm" data-prevent-double-click="true">Take the mark off</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-unmark-cancel>Cancel</button></form>';
    else u.innerHTML = '';
    if (sec && isOff(sec.key) && D.offReason[sec.key]) u.innerHTML = '<div class="govuk-inset-text app-offwhy"><strong>Why the mark came off:</strong> ' + esc(D.offReason[sec.key]) + '</div>';
  }

  /* -------- rendering a route */
  function render(opts) {
    opts = opts || {};
    var r = parse(); S.route = r; S.curHash = location.hash;
    var isReview = r.a === 'brief' || r.a === 'find' || (r.a === 'approve' && D.canAct) || !!secBySlug[r.a];
    if (!isReview && !(VIEW_ROUTES[r.a] && one('[data-view="' + r.a + '"]'))) { go('#/brief', true); return render(opts); }
    all('[data-view]').forEach(function (v) { v.hidden = !(isReview ? v.getAttribute('data-view') === 'review' : v.getAttribute('data-view') === r.a); });
    var tabName = isReview ? 'review' : r.a;
    all('[data-tab]').forEach(function (t) { if (t.getAttribute('data-tab') === tabName) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    if (isReview) { S.reviewHash = location.hash || '#/brief'; var rl = one('[data-tab="review"]'); rl.setAttribute('href', S.reviewHash.split('/').slice(0, 2).join('/')); }
    var title = 'Brief', sec = secBySlug[r.a];
    if (isReview) {
      all('[data-panel]').forEach(function (p) { p.hidden = true; });
      var key = r.a === 'brief' ? 'brief' : r.a === 'find' ? 'find' : r.a === 'approve' ? 'approve' : sec.key;
      one('[data-panel="' + key + '"]').hidden = false;
      S.sec = sec ? sec.key : null;
      all('[data-rail]').forEach(function (a) { if (a.getAttribute('data-rail') === (sec ? sec.key : r.a)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      var cr = one('[data-rail][aria-current]'), rail = one('.app-rail');
      if (cr && rail && rail.scrollHeight > rail.clientHeight) { var rb2 = rail.getBoundingClientRect(), cb = cr.getBoundingClientRect(); if (cb.top < rb2.top) rail.scrollTop -= rb2.top - cb.top; else if (cb.bottom > rb2.bottom) rail.scrollTop += cb.bottom - rb2.bottom; }
      var wide = !sec || !hasRows(sec);
      panesEl.setAttribute('data-layout', wide ? 'wide' : 'three');
      panesEl.setAttribute('data-mix', sec && sec.key === 'flags' ? 'flags' : 'rows');
      one('[data-list-foot]').hidden = wide;
      title = sec ? titleOf(sec.key) : r.a === 'find' ? 'Find a number' : r.a === 'approve' ? 'Approve' : 'Brief';
      one('[data-list-title]').textContent = sec ? (!hasRows(sec) ? (sec.type === 'forms' ? 'Forms not yet placed' : sec.type === 'empty' ? 'Nothing in this section' : 'Printed return pages') : sec.key === 'flags' ? 'Flags: red first, then dollar effect' : 'Return, in printed order') : r.a === 'approve' ? 'Approve: what is left' : r.a === 'find' ? 'Find a number' : 'Brief';
      if (S.prevA !== r.a) listBody.scrollTop = 0;
      S.prevA = r.a;
      if (r.a === 'find') renderFind(r.b || '');
      if (sec && hasRows(sec)) {
        var id = r.b && rowEl(r.b) ? r.b : (S.last[sec.key] && rowEl(S.last[sec.key]) ? S.last[sec.key] : sec.rows[0]);
        select(id, { noHash: !!(r.b === id), state: r.c, focusRow: opts.focusRow, focusSource: opts.focusSource, silent: opts.silent });
        if (!r.b) go('#/' + sec.slug + '/' + id + (r.c ? '/' + r.c : ''), true);
      } else {
        S.cur = null; all('[data-trace]').forEach(function (t) { t.hidden = true; }); one('[data-trace-empty]').hidden = false; closeComment();
        all('[data-row].is-selected').forEach(function (x) { x.classList.remove('is-selected'); });
        sendSelect(null, title);
      }
    } else {
      title = r.a === 'comments' ? 'Comments' : r.a === 'history' ? 'History' : (D.kind === 'void' ? 'What changed after you approved' : 'Changes since you sent it back');
      sendSelect(null, title);
      if (r.a === 'comments') { renderCommentsList(); renderSendBack(); }
    }
    h1.textContent = title; okTitle();
    renderToolbar(r);
    refreshCounts();
    if (opts.focusH1 || (opts.focusRow && isReview && (!sec || !hasRows(sec)))) h1.focus();
    if (r.a === 'brief' && r.b === 'attest') { var ah = one('#attest-h'); if (ah) { listBody.scrollTop += ah.getBoundingClientRect().top - listBody.getBoundingClientRect().top - 6; ah.focus({ preventScroll: true }); announce('Attestations. ' + ah.textContent); } }
    if (r.a === 'approve') { var ap = one('#approve-h'); if (ap && opts.focusH1) { h1.focus(); } }
    if (r.a === 'comments' && r.b === 'send') { var sb = one('#sb-text'); if (sb) { sb.focus(); if (r.c === 'error') submitSendBack(one('[data-sendback-form]')); } }
    if (r.c === 'error' && sec && sec.key === 'flags' && r.b) judgeSubmit(one('[data-judge-form="' + r.b + '"]'), true);
    if (r.c === 'comment-error' && S.cur) { openComment(); var cf = one('[data-comment-form]'); if (cf) submitComment(cf); }
  }

  /* -------- picking a number */
  function select(id, o) {
    o = o || {}; var r = rowEl(id); if (!r) return;
    var key = r.getAttribute('data-section'); S.cur = id; S.last[key] = id; if (key === 'flags') S.lastFlag = id;
    all('[data-row].is-selected').forEach(function (x) { x.classList.remove('is-selected'); var b = one('[data-pick]', x); if (b) b.removeAttribute('aria-current'); });
    r.classList.add('is-selected'); var pb = one('[data-pick]', r); if (pb) pb.setAttribute('aria-current', 'true');
    all('[data-trace]').forEach(function (t) { t.hidden = t.getAttribute('data-trace') !== id; });
    one('[data-trace-empty]').hidden = true; one('[data-trace-body]').scrollTop = 0;
    var cob = one('[data-comment-open]'); if (cob) cob.firstChild.nodeValue = key === 'flags' ? 'Comment on this flag' : 'Comment on this number';
    closeComment(true);
    if (o.state === 'loading' || o.state === 'failed') viewer.state(id, o.state); else viewer.show(id, 0);
    S.srcOpened++;
    var br = listBody.getBoundingClientRect(), rr = r.getBoundingClientRect();
    if (rr.top < br.top + 30) listBody.scrollTop -= (br.top + 30 - rr.top); else if (rr.bottom > br.bottom - 8) listBody.scrollTop += rr.bottom - br.bottom + 8;
    if (!o.noHash && !o.silent) { var sec = secByKey[key]; history.replaceState(null, '', '#/' + sec.slug + '/' + id + (o.state ? '/' + o.state : '')); S.reviewHash = location.hash; }
    if (!o.silent) announce('Selected ' + (r.getAttribute('data-label') || id) + '. Source shown.');
    sendSelect(id, secByKey[key].title);
    if (o.focusRow && pb) pb.focus();
    if (o.focusSource) { var sb = one('[data-source-body]'); sb.focus({ preventScroll: true }); }
  }
  function sendSelect(id, tab) { if (channel) channel.postMessage({ t: 'select', which: D.which, srcFile: D.srcFile, id: id, k: viewer.get().k, label: id ? labelFor(id) : '', tab: tab }); }

  /* -------- stepping: numbers (m), flags (n, p), sources (] and [) */
  function allNumberIds() { var out = []; D.sections.forEach(function (s) { if (s.type === 'rows') s.rows.forEach(function (id) { out.push({ sec: s, id: id }); }); }); return out; }
  function stepNumber(dir) {
    var rows = allNumberIds(); if (!rows.length) return;
    var i = -1; for (var j = 0; j < rows.length; j++) if (rows[j].id === S.cur && S.sec === rows[j].sec.key) { i = j; break; }
    if (i === -1 && dir > 0) i = -1; else if (i === -1) i = rows.length;
    var n = Math.max(0, Math.min(rows.length - 1, i + dir)); var t = rows[n];
    if (i + dir < 0 || i + dir > rows.length - 1) { announce(dir > 0 ? 'This is the last number.' : 'This is the first number.'); if (i > -1) { focusRowOf(S.cur); return; } }
    if (t.sec.key !== S.sec) { go('#/' + t.sec.slug + '/' + t.id, true); render({ focusRow: true }); announce('Section ' + titleOf(t.sec.key) + '. ' + labelFor(t.id)); }
    else select(t.id, { focusRow: true });
  }
  function stepFlag(dir) {
    // next and previous follow the list as it is sorted on the screen (the Flags list is an MOJ sortable table, default red first, then dollar effect)
    var fl = all('[data-panel="flags"] tr[data-row]').map(function (r) { return { id: r.getAttribute('data-row') }; });
    if (!fl.length) fl = D.flags;
    if (!fl.length) { announce('This return has no flags.'); return; }
    var onFlags = S.route && S.route.a === 'flags' && S.cur; var cur = onFlags ? S.cur : S.lastFlag; var ci = -1; fl.forEach(function (f, i) { if (f.id === cur) ci = i; });
    var wrap = ci > -1 && ((dir > 0 && ci === fl.length - 1) || (dir < 0 && ci === 0));
    var n = ci === -1 ? (dir > 0 ? 0 : fl.length - 1) : (ci + dir + fl.length) % fl.length;
    S.lastFlag = fl[n].id; go('#/flags/' + fl[n].id, true); render({ focusRow: true });
    if (wrap) announce('Flag ' + fl[n].id + '. ' + (dir > 0 ? 'Back at the first flag.' : 'At the last flag.'));
  }
  function stepSource(d, viaKey) {
    var g = viewer.get(); if (!g.id || !viewer.count()) { if (viaKey) one('[data-source-body]').focus({ preventScroll: true }); announce('Pick a number with a source first.'); return; }
    if (viaKey) one('[data-source-body]').focus({ preventScroll: true });
    viewer.show(g.id, g.k + d); S.srcOpened++; sendSelect(g.id, S.sec ? titleOf(S.sec) : '');
    var cap = one('[data-source="' + g.id + ':' + viewer.get().k + '"] .app-caption'); announce(cap ? cap.textContent : 'Source changed');
  }

  /* -------- marks (RV-5): "Reviewed, next" marks and moves on; it never unmarks */
  function addHistory(title, desc) {
    var t = one('[data-timeline]'); if (!t) return;
    var d = document.createElement('div'); d.className = 'moj-timeline__item';
    d.innerHTML = '<div class="moj-timeline__header"><h3 class="moj-timeline__title">' + esc(title) + '</h3><p class="moj-timeline__byline">by Zo</p></div><p class="moj-timeline__date"><time>' + esc(D.now) + '</time></p>' + (desc ? '<div class="moj-timeline__description"><p class="govuk-body">' + esc(desc) + '</p></div>' : '');
    t.appendChild(d);
  }
  function reviewedNext() {
    var key = S.sec;
    if (!key) { announce('Reviewed, next marks a section. Open a section first: press n for the flags.'); return; }
    var wasOn = isOn(key);
    if (!wasOn) { S.marks[key] = { by: 'Zo', when: D.now }; addHistory(titleOf(key) + ' marked Reviewed', ''); }
    var nx = order[secByKey[key].i + 1];
    var msg = wasOn ? titleOf(key) + ' is already Reviewed.' : titleOf(key) + ' marked Reviewed. ' + nOn() + ' of ' + order.length + '.';
    if (nx) {
      go('#/' + secByKey[nx].slug, true); render({ silent: false, focusRow: true });
      announce(msg + ' Now ' + titleOf(nx) + '.' + (allDone() ? ' Everything is done. Approve return is now available.' : ''));
    } else {
      refreshAll();
      announce(msg + (allDone() ? ' Everything is done. Approve return is now available.' : ' ' + leftCount() + ' left before Approve: the Approve page lists them.'));
      var ap = one('[data-approve]') || one('.app-approvehint a'); if (ap) ap.focus();
    }
  }

  /* -------- judgments (A421, V03): one per accepted risk, before Approve */
  function judgeFormHtml(id, prev) {
    var f = flagById[id];
    return '<form class="app-judge" data-judge-form="' + id + '" novalidate aria-labelledby="jh-' + id + '"><h4 class="govuk-heading-s" id="jh-' + id + '">Your judgment on ' + esc(id) + ' <span class="govuk-visually-hidden">(' + esc(f.title) + ')</span></h4>' +
      '<div class="govuk-error-summary" data-module="govuk-error-summary" data-jes hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#jr-' + id + '">Enter why you accept this risk</a></li></ul></div></div></div>' +
      '<div class="govuk-form-group" data-jg><label class="govuk-label govuk-label--s" for="jr-' + id + '">Why do you accept this risk? <span class="app-required" aria-hidden="true">*</span></label><div id="jh2-' + id + '" class="govuk-hint">Required. It goes in the approval record.</div><p class="govuk-error-message" id="je-' + id + '" hidden><span class="govuk-visually-hidden">Error:</span> Enter why you accept this risk</p><textarea class="govuk-textarea" id="jr-' + id + '" rows="2" aria-describedby="jh2-' + id + '">' + (prev && prev.kind === 'accept' ? esc(prev.reason) : '') + '</textarea></div>' +
      '<button class="govuk-button app-btn-sm" data-primary data-prevent-double-click="true">Accept the risk</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-judge-comment="' + id + '" aria-keyshortcuts="c">Comment instead</button></form>';
  }
  function judgedHtml(id, j) {
    var detail = j.kind === 'accept' ? 'Your reason: ' + esc(j.reason) : 'Comment ' + esc(j.comment) + ' on this flag goes to the preparer with the return.';
    return '<div class="app-judged" data-judged tabindex="-1"><h4 class="govuk-heading-s">Your judgment: ' + (j.kind === 'accept' ? 'Accepted' : 'Commented instead') + '</h4><p class="govuk-body-s govuk-!-margin-bottom-1">' + esc(j.by) + ', ' + esc(j.when) + '. ' + detail + '</p><button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-judge-change="' + id + '">Change my judgment</button></div>';
  }
  function renderJudgeHosts() {
    all('[data-judge]').forEach(function (h) {
      var id = h.getAttribute('data-judge'); var j = S.judg[id];
      var sig = j && !S.judgOpen[id] ? j.kind + ':' + j.when + ':' + (j.comment || '') : (j ? 'change' : 'form');
      if (h.getAttribute('data-rendered') === sig && h.innerHTML) return;
      h.setAttribute('data-rendered', sig);
      h.innerHTML = j && !S.judgOpen[id] ? judgedHtml(id, j) : judgeFormHtml(id, j);
    });
  }
  function judgeSubmit(form, forceError) {
    if (!form) return;
    var id = form.getAttribute('data-judge-form'); var why = one('textarea', form).value.trim();
    if (!why || forceError) {
      one('[data-jes]', form).hidden = false; one('[data-jg]', form).classList.add('govuk-form-group--error'); var em = one('.govuk-error-message', form); em.hidden = false;
      one('textarea', form).setAttribute('aria-describedby', 'jh2-' + id + ' je-' + id); one('[data-jes]', form).focus(); errTitle(); announce('There is a problem. Enter why you accept this risk.'); return;
    }
    S.judg[id] = { kind: 'accept', reason: why, by: 'Zo', when: D.now }; S.judgOpen[id] = false; okTitle();
    addHistory('Accepted risk ' + id + ' judged: accepted', why); saveJudg();
    refreshAll();
    var left = unjudged();
    announce('Accepted risk ' + id + ' judged: accepted. ' + (left.length ? left.length + ' accepted ' + (left.length === 1 ? 'risk' : 'risks') + ' left to judge.' : 'Every accepted risk is judged.') + (allDone() ? ' Approve return is now available.' : ''));
    if (left.length) { go('#/flags/' + left[0].id, true); render({ focusRow: true, silent: true }); } else { var jd = one('[data-trace="' + id + '"] [data-judged]'); if (jd) jd.focus(); }
  }
  function saveJudg() { store('ashbridge-judg', { which: D.which, judg: S.judg }); }

  /* -------- comments (RV-4, RV-7): an in-place panel, 3 fields, 0 page loads */
  function nextCommentId() { return 'C-' + (S.comments.length + 1); }
  function curCaption() {
    var g = viewer.get(); var cap = g && g.id ? one('[data-source="' + g.id + ':' + g.k + '"] .app-caption') : null;
    if (cap) return cap.textContent;
    var vis = all('[data-source] .app-caption').filter(function (c) { return !c.closest('[hidden]'); })[0];
    return vis ? vis.textContent : 'No source found for this number';
  }
  function openComment() {
    if (!D.canAct) return;
    if (!S.cur) { announce('Pick a number first, then comment on it.'); return; }
    if (!panesEl || panesEl.getAttribute('data-layout') === 'wide') { announce('Open a number or a flag first, then comment on it.'); return; }
    var host = one('[data-comment-host]'); var id = S.cur;
    var radios = function (name, items, hint) { return '<div class="govuk-form-group" data-g="' + name + '"><fieldset class="govuk-fieldset"' + (hint ? ' aria-describedby="' + name + '-hint"' : '') + '><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + (name === 'type' ? 'Type of comment' : 'Severity') + '<span class="govuk-visually-hidden"> (required)</span> <span class="app-required" aria-hidden="true">*</span></legend>' + (hint ? '<div id="' + name + '-hint" class="govuk-hint">' + hint + '</div>' : '') + '<p class="govuk-error-message" id="' + name + '-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-msg></span></p><div class="govuk-radios govuk-radios--small govuk-radios--inline">' + items.map(function (t, i) { return '<div class="govuk-radios__item"><input class="govuk-radios__input" id="' + name + '-' + i + '" name="' + name + '" type="radio" value="' + t + '"><label class="govuk-label govuk-radios__label" for="' + name + '-' + i + '">' + t + '</label></div>'; }).join('') + '</div></fieldset></div>'; };
    var accepted = flagById[id] && flagById[id].kind === 'accepted' && !S.judg[id];
    host.innerHTML = '<form class="app-cp" data-comment-form novalidate aria-labelledby="cp-h"><div class="app-cp__head"><h3 class="govuk-heading-s" id="cp-h">Comment on ' + esc(labelFor(id)) + '</h3><p class="app-caption" data-cp-caption>Source: ' + esc(curCaption()) + '</p></div><div class="app-cp__body"><div class="govuk-error-summary" data-module="govuk-error-summary" data-es hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list" data-es-list></ul></div></div></div>' +
      radios('type', ['Error', 'Question', 'Missing evidence', 'Presentation']) + radios('severity', ['Must fix', 'Should fix', 'Note']) +
      '<div class="govuk-form-group" data-g="text"><label class="govuk-label govuk-label--s" for="text">Comment</label><p class="govuk-error-message" id="text-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-msg></span></p><textarea class="govuk-textarea" id="text" name="text" rows="2" aria-describedby="text-hint text-note"></textarea><div id="text-hint" class="govuk-hint">Say what you want done. Optional for a presentation comment.</div></div></div>' +
      '<div class="app-cp__foot"><button class="govuk-button app-btn-sm" data-primary data-prevent-double-click="true">Add comment</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-comment-cancel>Cancel</button><p id="text-note" class="govuk-hint app-cp__note">' + (accepted ? 'This also counts as your judgment of ' + esc(id) + ': you commented instead of accepting.' : 'For an error or a presentation comment, AI drafts the fix and the preparer approves it first (RV-12).') + '</p></div></form>';
    host.setAttribute('data-open', id);
    one('#type-0').focus();
    announce('Comment panel open for ' + labelFor(id) + '. It covers the trace and the source; Escape closes it.');
  }
  function closeComment() { var host = one('[data-comment-host]'); if (host && host.innerHTML) { host.innerHTML = ''; host.removeAttribute('data-open'); } }
  function submitComment(form) {
    var type = (one('input[name=type]:checked', form) || {}).value, sev = (one('input[name=severity]:checked', form) || {}).value, text = one('#text', form).value.trim();
    var errs = [];
    if (!type) errs.push(['type-0', 'Select the type of comment', 'type']);
    if (!sev) errs.push(['severity-0', 'Select how serious it is', 'severity']);
    if (!text && type !== 'Presentation') errs.push(['text', 'Enter what you want done', 'text']);
    all('[data-g]', form).forEach(function (g) { g.classList.remove('govuk-form-group--error'); one('.govuk-error-message', g).hidden = true; });
    var es = one('[data-es]', form);
    if (errs.length) {
      one('[data-es-list]', form).innerHTML = errs.map(function (e) { return '<li><a href="#' + e[0] + '">' + e[1] + '</a></li>'; }).join('');
      errs.forEach(function (e) { var g = one('[data-g="' + e[2] + '"]', form); g.classList.add('govuk-form-group--error'); var m = one('.govuk-error-message', g); m.hidden = false; one('[data-msg]', m).textContent = e[1]; });
      es.hidden = false; es.focus(); errTitle(); announce('There is a problem. ' + errs.length + (errs.length === 1 ? ' thing needs' : ' things need') + ' fixing.'); return;
    }
    var on = S.cur, f = flagById[on];
    var c = { id: nextCommentId(), line: on, type: type, severity: sev, who: 'Zo', when: D.now, text: text || '(Presentation comment, no text)', status: (type === 'Presentation' || type === 'Error') ? 'Draft, not sent. AI drafts a fix for the preparer to approve (RV-12).' : 'Draft, not sent', flag: f ? f.id : '' };
    S.comments.push(c); closeComment(); okTitle();
    var judgedNow = false;
    if (f && f.kind === 'accepted' && !S.judg[f.id]) { S.judg[f.id] = { kind: 'comment', comment: c.id, by: 'Zo', when: D.now }; judgedNow = true; addHistory('Accepted risk ' + f.id + ' judged: commented instead', 'Comment ' + c.id + '.'); saveJudg(); }
    addHistory('Comment ' + c.id + ' added (draft, not sent)', c.type + ', ' + c.severity.toLowerCase() + '.');
    refreshAll(); focusRowOf(on);
    announce('Comment ' + c.id + ' added on ' + labelFor(on) + '. ' + (judgedNow ? 'This is your judgment of ' + f.id + '. ' : '') + 'It goes to ' + D.preparer + ' when you send the return back. ' + S.comments.length + ' comments.' + (judgedNow && allDone() ? ' Approve return is now available.' : ''));
  }
  function renderNotes() {
    all('[data-notes]').forEach(function (n) {
      var id = n.getAttribute('data-notes'); var cs = S.comments.filter(function (c) { return c.line === id; });
      n.innerHTML = cs.length ? cs.map(function (c) { return '<p class="govuk-body-s govuk-!-margin-bottom-1"><strong>' + esc(c.id) + ' ' + esc(c.type) + ', ' + esc(c.severity) + '</strong> (' + esc(c.status) + '): ' + esc(c.text) + '</p>'; }).join('') : '<p class="govuk-body-s">No comments on this number.</p>';
    });
  }
  function commentsSig() { return S.comments.map(function (c) { return c.id + (c.resolved ? 'r' : '') + c.status; }).join('|'); }
  function renderCommentsList() {
    var host = one('[data-comments-list]'); if (!host) return;
    var sig = commentsSig(); if (host.getAttribute('data-sig') === sig && host.innerHTML) return; host.setAttribute('data-sig', sig);
    if (!S.comments.length) { host.innerHTML = '<div class="govuk-inset-text"><p class="govuk-body"><strong>No comments on this return yet.</strong></p><p class="govuk-body">' + (D.canAct ? 'Open a number and press <kbd>c</kbd> to comment. Comments go to ' + esc(D.preparer) + ' when you send the return back.' : D.mode === 'preparer' ? 'The CPA has not sent any comments yet. Draft comments stay hidden until the return is sent back.' : 'No comments were sent on this return.') + '</p></div>'; return; }
    var round2 = D.kind === 'rework' || D.kind === 'gate' || D.kind === 'ready';
    var anyResolve = S.comments.some(function (c) { return c.canResolve; });
    var done = S.comments.filter(function (c) { return c.resolved; }).length;
    host.innerHTML = (round2 ? '<p class="govuk-body" data-count="resolved" data-scope="comments resolved">' + done + ' of ' + S.comments.length + ' comments resolved</p>' : '') + '<div class="app-scroll-x" role="region" aria-label="Comments table" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Comments, in the order written (' + S.comments.length + ')</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">No.</th><th scope="col" class="govuk-table__header">On</th><th scope="col" class="govuk-table__header">Type</th><th scope="col" class="govuk-table__header">Severity</th><th scope="col" class="govuk-table__header">Comment</th><th scope="col" class="govuk-table__header">State' + (round2 ? " and the preparer's answer" : '') + '</th><th scope="col" class="govuk-table__header">Who and when</th>' + (anyResolve ? '<th scope="col" class="govuk-table__header">Resolve</th>' : '') + '</tr></thead><tbody class="govuk-table__body">' +
      S.comments.map(function (c) {
        var on = '<a class="govuk-link" href="' + routeFor(c.line) + '">' + esc(labelFor(c.line)) + '</a>' + (c.flag && c.flag !== c.line ? '<br><span class="app-quiet">Flag ' + esc(c.flag) + '</span>' : '');
        var st = esc(c.status) + (c.reply ? '<br><span class="app-quiet">Preparer: ' + esc(c.reply) + '</span>' : '');
        var act = anyResolve ? '<td class="govuk-table__cell">' + (c.canResolve && !c.resolved ? '<button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-resolve="' + esc(c.id) + '">Resolve<span class="govuk-visually-hidden"> comment ' + esc(c.id) + '</span></button>' : (c.resolved ? 'Resolved' : 'Waiting for the preparer')) + '</td>' : '';
        return '<tr data-comment-row="' + esc(c.id) + '"><td class="govuk-table__cell">' + esc(c.id) + '</td><td class="govuk-table__cell">' + on + '</td><td class="govuk-table__cell">' + esc(c.type) + '</td><td class="govuk-table__cell">' + esc(c.severity) + '</td><td class="govuk-table__cell">' + esc(c.text) + '</td><td class="govuk-table__cell">' + st + '</td><td class="govuk-table__cell">' + esc(c.who) + ', ' + esc(c.when) + '</td>' + act + '</tr>';
      }).join('') + '</tbody></table></div><p class="govuk-body-s">For a presentation comment, or an error on one number, AI drafts the fix with citations when you send the return back. It is shown as an "AI draft" and changes nothing until the preparer approves it and it goes through the normal round trip (RV-12).</p>';
  }
  function resolveComment(id) {
    var c = S.comments.filter(function (x) { return x.id === id; })[0]; if (!c || c.resolved || !c.canResolve) return;
    c.resolved = true; c.canResolve = false; c.status = 'Resolved by Zo, ' + D.now;
    addHistory('Comment ' + id + ' resolved', c.reply ? 'Preparer: ' + c.reply : '');
    var host = one('[data-comments-list]'); host.removeAttribute('data-sig'); renderCommentsList(); refreshAll();
    var next = one('[data-resolve]'); var left = S.comments.filter(function (x) { return x.canResolve; }).length;
    if (next) next.focus(); else { var cap = one('[data-comments-list] caption'); var rg = one('[data-comments-list] [role=region]'); if (rg) rg.focus(); else if (cap) h1.focus(); }
    announce('Comment ' + id + ' resolved. ' + S.comments.filter(function (x) { return x.resolved; }).length + ' of ' + S.comments.length + ' comments resolved.' + (left ? ' ' + plural(left, 'comment', 'comments') + ' left that the preparer has answered.' : ' None left that the preparer has answered.'));
  }
  function renderSendBack() {
    var host = one('[data-sendback]'); if (!host || host.getAttribute('data-done')) return;
    if (host.querySelector('form')) return;
    host.innerHTML = '<form class="app-sendback" data-sendback-form novalidate><h2 class="govuk-heading-s">Send back to ' + esc(D.preparer) + '</h2><div class="govuk-error-summary" data-module="govuk-error-summary" hidden tabindex="-1" data-sb-es><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#sb-text">Enter what the preparer should do first</a></li></ul></div></div></div><div class="govuk-form-group" data-sbg><label class="govuk-label govuk-label--s" for="sb-text">What should the preparer do first? <span class="app-required" aria-hidden="true">*</span></label><div id="sb-hint" class="govuk-hint">Required. One or two sentences. Your comments go with it.</div><p class="govuk-error-message" id="sb-error" hidden><span class="govuk-visually-hidden">Error:</span> Enter what the preparer should do first</p><textarea class="govuk-textarea" id="sb-text" rows="3" aria-describedby="sb-hint"></textarea></div><button class="govuk-button app-btn-sm" data-prevent-double-click="true">Send back</button></form>';
  }
  function submitSendBack(f) {
    var tx = one('#sb-text').value.trim();
    if (!tx) { one('[data-sb-es]').hidden = false; one('[data-sbg]').classList.add('govuk-form-group--error'); one('#sb-error').hidden = false; one('#sb-text').setAttribute('aria-describedby', 'sb-hint sb-error'); one('[data-sb-es]').focus(); errTitle(); announce('There is a problem. Enter what the preparer should do first.'); return; }
    okTitle(); var host = one('[data-sendback]'); host.setAttribute('data-done', '1'); S.sent = true;
    S.comments.forEach(function (c) { if (/^Draft/.test(c.status)) c.status = 'Sent to the preparer, ' + D.now + '.'; });
    host.innerHTML = '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" tabindex="-1" data-sb-done><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Returned to ' + esc(D.preparer) + '. It leaves your queue until the preparer sends it back. ' + S.comments.length + ' comments went with it. <a class="govuk-notification-banner__link" href="queue.html">Back to the queue</a></p></div></div>';
    addHistory('Returned to the preparer', tx); refreshCounts(); one('[data-sb-done]').focus(); announce('Returned to ' + D.preparer + '.');
  }

  /* -------- search across every section (rule 21) */
  function hitsFor(q) { var ql = q.toLowerCase(); return D.index.filter(function (x) { return !ql || x.label.toLowerCase().indexOf(ql) > -1 || (x.acct && x.acct.indexOf(ql) > -1); }); }
  function renderFind(q) {
    var host = one('[data-find-results]'); var hits = hitsFor(q);
    if (!hits.length) { host.innerHTML = '<h2 class="govuk-heading-s" id="find-h" tabindex="-1">No number matches "' + esc(q) + '"</h2><div class="govuk-inset-text">Try part of a name, for example "travel" or "loan", or an account number. The search covers every section and every flag.</div>'; return; }
    host.innerHTML = '<h2 class="govuk-heading-s" id="find-h" tabindex="-1">' + hits.length + (hits.length === 1 ? ' result' : ' results') + ' for "' + esc(q) + '"</h2><table class="govuk-table"><caption class="govuk-table__caption govuk-visually-hidden">Search results (' + hits.length + ')</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">This year</th></tr></thead><tbody class="govuk-table__body">' + hits.map(function (x) { return '<tr><th scope="row" class="govuk-table__header"><a class="govuk-link" href="' + routeFor(x.id) + '">' + esc(x.label) + '</a></th><td class="govuk-table__cell">' + esc(titleOf(x.sec)) + '</td><td class="govuk-table__cell app-money">' + esc(x.val) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* -------- the second window (task 9): off by default, remembered per person, opens only when asked */
  function winOn() { return prefGet('win') === true; }
  function setWinWords() {
    var e = one('[data-source-win]'); var cb = one('#win-pref'); if (cb) cb.checked = winOn();
    if (!e) return;
    e.textContent = !winOn() ? 'Second window: off' : S.winBlocked ? 'Second window: on, blocked by the browser. Allow pop-ups for this site, then press o' : S.win ? 'Second window: on, open, following' : 'Second window: on, not open yet. Press o to open it';
  }
  function openWindow() {
    var g = null; try { g = JSON.parse(localStorage.getItem('ashbridge-win') || 'null'); } catch (e) { g = null; }
    var feats = 'popup=yes,width=' + (g ? g.w : 980) + ',height=' + (g ? g.h : 900) + (g ? ',left=' + g.l + ',top=' + g.t : '');
    var cur = viewer.get();
    var w = window.open(D.srcFile + (cur.id ? '#' + cur.id + ':' + cur.k : ''), 'ashbridge-source', feats);
    if (!w) { S.winBlocked = true; setWinWords(); announce('The browser blocked the second window. Allow pop-ups for this site, then press o again.'); return false; }
    S.winBlocked = false; setWinWords();
    announce('Second window opened. It follows every number and section you pick.');
    setTimeout(function () { sendSelect(S.cur, S.sec ? titleOf(S.sec) : (S.route ? S.route.a : '')); }, 400);
    return true;
  }
  function openSource(viaKey) {
    var sb = one('[data-source-body]');
    if (winOn()) { openWindow(); var ob = one('[data-open-source]'); if (ob && viaKey) ob.focus({ preventScroll: true }); }
    else { if (sb) sb.focus({ preventScroll: true }); announce(S.cur ? 'Source in focus. Tick Open in a second window to show it on your second monitor too.' : 'Pick a number to see its source. Tick Open in a second window to use your second monitor.'); }
  }
  if (channel) {
    channel.onmessage = function (m) {
      var d = m.data;
      if (d.t === 'here') { S.win = true; S.winBlocked = false; setWinWords(); sendSelect(S.cur, S.sec ? titleOf(S.sec) : (S.route ? S.route.a : '')); }
      if (d.t === 'gone') { S.win = false; setWinWords(); }
      if (d.t === 'step' && d.id === S.cur) { viewer.show(d.id, d.k); }
    };
    channel.postMessage({ t: 'hello' });
  }
  window.addEventListener('storage', function (e) { if (e.key === PREF) { setWinWords(); if (keysOff) keysOff.checked = prefGet('keysOff') === true; } });

  /* -------- queue links: Back, previous and next follow the list you came from (rule 21) */
  (function () {
    var q = store('ashbridge-queue'); if (!q) return;
    var me = location.pathname.split('/').pop(); var i = q.hrefs ? q.hrefs.indexOf(me) : -1;
    var prev = one('[data-queue-prev]'), next = one('[data-queue-next]');
    if (i > 0) { prev.href = q.hrefs[i - 1] + '#/brief'; prev.hidden = false; }
    if (i > -1 && i < q.hrefs.length - 1) { next.href = q.hrefs[i + 1] + '#/brief'; next.hidden = false; }
    if (q.page) one('[data-queue-back]').href = q.page + (q.view === 'rework' ? '#/rework' : '');
  })();

  /* -------- events */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var pk = t.closest('[data-pick]');
    if (pk) { var row = pk.closest('[data-row]'); if (S.cur === row.getAttribute('data-row') && row.classList.contains('is-selected')) { announce((row.getAttribute('data-label') || 'This number') + ' is already selected. Its trace and source are beside the list.'); return; } select(row.getAttribute('data-row'), { focusSource: row.getAttribute('data-section') !== 'flags' }); return; }
    var g = t.closest('[data-goto]'); if (g && S.cur) { viewer.show(S.cur, +g.getAttribute('data-goto')); S.srcOpened++; sendSelect(S.cur, S.sec ? titleOf(S.sec) : ''); one('[data-source-body]').focus({ preventScroll: true }); return; }
    if (t.closest('[data-src-next]')) return stepSource(1);
    if (t.closest('[data-src-prev]')) return stepSource(-1);
    if (t.closest('[data-step-next]')) return stepNumber(1);
    if (t.closest('[data-step-prev]')) return stepNumber(-1);
    if (t.closest('[data-flag-next]')) return stepFlag(1);
    if (t.closest('[data-flag-prev]')) return stepFlag(-1);
    if (t.closest('[data-reviewed-next]')) return reviewedNext();
    if (t.closest('[data-unmark-open]')) { S.unmarkOpen = !S.unmarkOpen; renderToolbar(S.route); if (S.unmarkOpen) { var w = one('#um-why'); if (w) w.focus(); } return; }
    if (t.closest('[data-unmark-cancel]')) { S.unmarkOpen = false; renderToolbar(S.route); var ub = one('[data-unmark-open]'); if (ub) ub.focus(); return; }
    if (t.closest('[data-comment-open]') || t.closest('[data-comment-kind]') || t.closest('[data-judge-comment]')) return openComment();
    if (t.closest('[data-comment-cancel]')) { closeComment(); focusRowOf(S.cur); announce('Comment cancelled.'); return; }
    if (t.closest('[data-judge-change]')) { var jid = t.closest('[data-judge-change]').getAttribute('data-judge-change'); S.judgOpen[jid] = true; renderJudgeHosts(); var jt = one('#jr-' + jid); if (jt) jt.focus(); announce('Change your judgment of ' + jid + '.'); return; }
    if (t.closest('[data-resolve]')) return resolveComment(t.closest('[data-resolve]').getAttribute('data-resolve'));
    if (t.closest('[data-open-source]')) return openSource(false);
    if (t.closest('[data-approve]')) { saveJudg(); return; }
    if (t.closest('[data-retry]')) { var id = S.cur; announce('Loading the source again.'); setTimeout(function () { viewer.show(id, 0); announce('Source loaded.'); history.replaceState(null, '', '#/' + secByKey[S.sec].slug + '/' + id); }, 500); return; }
    if (t.closest('[data-page-next],[data-page-prev]')) {
      var host = one('[data-panel="' + S.sec + '"]'); var pages = all('[data-page]', host); var ci = pages.findIndex(function (p) { return !p.hidden; });
      var ni = (ci + (t.closest('[data-page-next]') ? 1 : -1) + pages.length) % pages.length; pages.forEach(function (p, i) { p.hidden = i !== ni; }); announce(one('.app-caption', pages[ni]).textContent); return;
    }
    var a = t.closest('a[href^="#/"]');
    if (a && a.getAttribute('href') === location.hash) {
      e.preventDefault();
      var nm = a.matches('.app-approvehint a') ? 'the Approve page' : (a.textContent.trim().replace(/\s+\d+\s*[a-z ]*$/i, '').replace(/\s+/g, ' ') || 'this page');
      announce('You are already on ' + nm + '.'); (S.route && S.route.a === 'brief' && S.route.b === 'attest' && one('#attest-h') ? one('#attest-h') : h1).focus(); return;
    }
    if (a && a.closest('[data-tab="review"]') === null && a.getAttribute('href') === '#/brief' && S.route && S.route.a === 'brief') { /* handled above when identical; a brief/attest link goes on to the heading */ }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-section-pick]')) { location.hash = e.target.value; return; }
    if (e.target.matches('#win-pref')) {
      prefSet('win', e.target.checked); S.winBlocked = false;
      if (e.target.checked) { if (!openWindow()) { /* words say why */ } else { setWinWords(); } }
      else { if (channel) channel.postMessage({ t: 'close' }); S.win = false; setWinWords(); announce('Second window off. It closed, and it stays off until you tick the box again.'); }
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-comment-form]')) { e.preventDefault(); submitComment(f); }
    else if (f.matches('[data-judge-form]')) { e.preventDefault(); judgeSubmit(f); }
    else if (f.matches('[data-find]')) {
      e.preventDefault(); var q = one('#find-q').value.trim();
      if (!q) { announce('Type part of a name or an account number to find.'); one('#find-q').focus(); return; }
      var hits = hitsFor(q);
      if (hits.length === 1) { go(routeFor(hits[0].id)); announce('One match: ' + hits[0].label + '.'); }
      else { go('#/find/' + encodeURIComponent(q)); setTimeout(function () { var fh = one('#find-h'); if (fh) fh.focus(); announce(hits.length + ' results for ' + q); }, 30); }
    }
    else if (f.matches('[data-unmark-form]')) {
      e.preventDefault(); var why = one('#um-why').value.trim(); var key = S.sec;
      if (!why) { one('[data-ug]').classList.add('govuk-form-group--error'); one('#um-err').hidden = false; one('#um-why').setAttribute('aria-describedby', 'um-hint um-err'); one('#um-why').focus(); errTitle(); announce('Error: enter a reason for taking the mark off.'); return; }
      S.marks[key] = null; S.unmarkOpen = false; okTitle(); addHistory(titleOf(key) + ' mark taken off', why); refreshAll(); announce(titleOf(key) + ' mark taken off. Reason recorded.'); var rb = one('[data-reviewed-next]'); if (rb) rb.focus();
    }
    else if (f.matches('[data-sendback-form]')) { e.preventDefault(); submitSendBack(f); }
  });

  window.addEventListener('hashchange', function () {
    /* the skip link (#main-content) is not a route: keep the route you were on and move focus to the page heading */
    if (location.hash && location.hash.charAt(1) !== '/') { history.replaceState(null, '', S.curHash || '#/brief'); h1.focus(); announce('Skipped to the main content.'); return; }
    render({ focusH1: true });
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName;
    var inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
    if (e.key === 'Escape') {
      if (one('[data-comment-host]').innerHTML) { closeComment(); focusRowOf(S.cur); announce('Comment closed.'); e.preventDefault(); return; }
      if (t && t.closest && t.closest('[data-source-body]') && S.cur) { var rb = rowBtn(S.cur); if (rb) { rb.focus(); e.preventDefault(); } }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || inField || !keysOn()) return;
    var k = e.key;
    if (!D.canAct && (k === 'r' || k === 'a' || k === 'c')) return;
    if (k === 'n') stepFlag(1); else if (k === 'p') stepFlag(-1); else if (k === 'm') stepNumber(1);
    else if (k === ']') stepSource(1, true); else if (k === '[') stepSource(-1, true);
    else if (k === 'o') openSource(true);
    else if (k === 'c') { if (S.cur && panesEl.getAttribute('data-layout') !== 'wide') openComment(); else announce('Open a number or a flag first, then press c to comment on it.'); }
    else if (k === 'r') reviewedNext();
    else if (k === 's') { var fq = one('#find-q'); if (fq) { fq.focus(); announce('Find a number: type part of a name or an account number, then press Enter.'); } }
    else if (k === 'a') {
      var ap = one('[data-approve]');
      if (ap) { ap.focus(); announce('Approve return. Everything is done. Press Enter to approve.'); }
      else {
        var hl = one('.app-approvehint a'); if (hl) hl.focus(); else { var ab = one('[data-panel="approve"]:not([hidden]) a'); if (ab) ab.focus(); else h1.focus(); }
        announce('Approve is not ready: ' + plural(secsLeft().length, 'section', 'sections') + ' not Reviewed and ' + plural(unjudged().length, 'accepted risk', 'accepted risks') + ' not judged. The Approve page lists them.');
      }
    }
    else return;
    e.preventDefault();
  });

  if (!location.hash) history.replaceState(null, '', '#/brief');
  setWinWords();
  refreshCounts(); render({ silent: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
