/* CPA review, version 1 (second round). Prototype behaviour only: no data leaves the page.
   One return page per scenario; section and tab changes are client-side routes (#/section/number), so 0 page loads.
   Every action runs in place, keeps the scroll, moves focus to the result and announces it (staff-screens rules 18, 19).
   Single keys repeat a visible control and never unmark, approve, send or delete (rules 10, 22). */
(function () {
  'use strict';
  function boot() {
  var body = document.body;
  var channel = ('BroadcastChannel' in window) ? new BroadcastChannel('ashbridge-source') : null;
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function one(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function announce(msg) { var l = document.getElementById('app-live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 20); } }
  function store(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

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
      if (!set) { if (cap) cap.textContent = 'No source for this item.'; return; }
      set.hidden = false;
      if (set.hasAttribute('data-nosource')) { k = 0; if (cap) cap.textContent = 'Not checked: no evidence'; return; }
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
    var label = one('[data-win-for]');
    function fromHash() { var h = location.hash.slice(1).split(':'); if (h[0] && one('[data-srcset="' + h[0] + '"]')) wv.show(h[0], +h[1] || 0); }
    fromHash();
    if (channel) {
      channel.postMessage({ t: 'here' });
      channel.onmessage = function (m) {
        var d = m.data;
        if (d.t === 'hello') channel.postMessage({ t: 'here' });
        if (d.t === 'select' && follow.checked) {
          if (d.id && one('[data-srcset="' + d.id + '"]')) { wv.show(d.id, d.k || 0); label.textContent = 'Showing ' + d.label + ' (' + d.tab + ').'; }
          else { all('[data-srcset],[data-source]').forEach(function (e) { e.hidden = true; }); var c = one('[data-source-caption]'); c.hidden = false; c.textContent = d.tab + ': no source on this tab. Pick a number in the review window.'; label.textContent = 'The review window is on ' + d.tab + '.'; }
          announce('Source updated');
        }
      };
      window.addEventListener('pagehide', function () {
        try { localStorage.setItem('ashbridge-win', JSON.stringify({ l: window.screenX, t: window.screenY, w: window.outerWidth, h: window.outerHeight })); } catch (e) { /* private mode */ }
        channel.postMessage({ t: 'gone' });
      });
    }
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-src-next],[data-src-prev]'); if (!d) return;
      var g = wv.get(); if (!g.id) return;
      wv.show(g.id, g.k + (d.hasAttribute('data-src-next') ? 1 : -1));
      if (channel) channel.postMessage({ t: 'step', id: g.id, k: wv.get().k });
    });
    return;
  }

  /* ================================================================ the queue */
  if (body.hasAttribute('data-queue')) {
    var form = one('[data-qfilter]'); var table = one('[data-q-table]');
    var rows = all('tbody tr', table);
    function visible() { return rows.filter(function (r) { return !r.hidden; }); }
    function sortState() { var ths = all('thead th', table); for (var i = 0; i < ths.length; i++) { var a = ths[i].getAttribute('aria-sort'); if (a && a !== 'none') return { i: i, a: a }; } return null; }
    function save() {
      store('ashbridge-queue', { q: one('#q-search').value, tier: one('#q-tier').value, state: one('#q-state').value, sort: sortState(), scroll: window.scrollY, hrefs: visible().map(function (r) { var a = one('[data-q-open]', r); return a ? a.getAttribute('href').split('#')[0] : null; }).filter(Boolean), page: location.pathname.split('/').pop() });
    }
    function apply() {
      var q = one('#q-search').value.trim().toLowerCase(), t = one('#q-tier').value, s = one('#q-state').value, n = 0;
      rows.forEach(function (r) { var ok = (!q || r.getAttribute('data-q-name').indexOf(q) > -1) && (!t || r.getAttribute('data-q-tier') === t) && (!s || r.getAttribute('data-q-state') === s); r.hidden = !ok; if (ok) n++; });
      one('[data-q-count]').textContent = n + (n === 1 ? ' return' : ' returns') + ' shown of ' + rows.length + ' waiting.';
      one('[data-q-empty]').hidden = n !== 0;
      save();
    }
    document.addEventListener('click', function (e) { var l = e.target.closest('.govuk-header__homepage-link, .govuk-service-navigation__link[aria-current]'); if (l) { e.preventDefault(); announce('You are already on the review queue.'); var qh = one('h1'); qh.setAttribute('tabindex', '-1'); qh.focus(); } });
    var saved = store('ashbridge-queue');
    if (saved) { one('#q-search').value = saved.q || ''; one('#q-tier').value = saved.tier || ''; one('#q-state').value = saved.state || ''; }
    apply();
    if (saved && saved.sort && !(saved.sort.i === 2 && saved.sort.a === 'ascending')) {
      var th = all('thead th', table)[saved.sort.i]; var b = th && one('button', th); var tries = 0;
      while (b && th.getAttribute('aria-sort') !== saved.sort.a && tries < 3) { b.click(); tries++; }
    }
    if (saved && saved.scroll) window.scrollTo(0, saved.scroll);
    form.addEventListener('input', apply); form.addEventListener('change', apply);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    one('[data-q-clear]').addEventListener('click', function () { one('#q-search').value = ''; one('#q-tier').value = ''; one('#q-state').value = ''; apply(); announce('Filters cleared. ' + one('[data-q-count]').textContent); one('#q-search').focus(); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-q-open]') || e.target.closest('th button')) setTimeout(save, 0); });
    new MutationObserver(save).observe(one('thead', table), { attributes: true, subtree: true, attributeFilter: ['aria-sort'] });
    window.addEventListener('scroll', function () { clearTimeout(window.__sv); window.__sv = setTimeout(save, 150); });
    return;
  }

  /* ================================================================ the approved page */
  if (body.hasAttribute('data-approved')) {
    var qs = store('ashbridge-queue'); var link = one('[data-queue-next-link]');
    if (qs && qs.hrefs && qs.hrefs.length) { var me = location.pathname.split('/').pop().indexOf('green') > -1 ? 'green.html' : 'red.html'; var mi = qs.hrefs.indexOf(me); if (mi < 0) mi = qs.hrefs.indexOf('red-rework.html'); var nxt = qs.hrefs[mi + 1] || qs.hrefs.filter(function (h) { return h !== me && h !== 'red-rework.html'; })[0]; if (nxt) link.setAttribute('href', nxt + '#/brief'); }
    return;
  }
  if (!body.hasAttribute('data-record')) return;

  /* ================================================================ the return record page */
  var D = JSON.parse(document.getElementById('app-data').textContent);
  var S = { marks: D.marks, flags: {}, comments: D.comments.slice(), cur: null, sec: null, last: {}, win: false, sent: false, unmarkOpen: false, reviewHash: '#/brief', srcOpened: 0 };
  D.flags.forEach(function (f) { S.flags[f.id] = f.decided; });
  var secByKey = {}, secBySlug = {}, order = [];
  D.sections.forEach(function (s, i) { s.i = i; secByKey[s.key] = s; secBySlug[s.slug] = s; order.push(s.key); });
  var viewer = makeViewer();
  var keysOff = one('#keys-off');
  if (keysOff) { try { keysOff.checked = sessionStorage.getItem('keysOff') === '1'; } catch (e) { /* ignore */ } keysOff.addEventListener('change', function () { try { sessionStorage.setItem('keysOff', keysOff.checked ? '1' : '0'); } catch (e) { /* ignore */ } }); }

  var panesEl = one('[data-panes]'), tb = one('[data-toolbar-body]'), h1 = one('#route-title');
  var listBody = one('[data-list-body]');

  function isOn(k) { return S.marks[k] && S.marks[k] !== 'off'; }
  function isOff(k) { return S.marks[k] === 'off'; }
  function nOn() { return order.filter(isOn).length; }
  function openFlags() { return D.flags.filter(function (f) { return !S.flags[f.id]; }); }
  function allOn() { return nOn() === order.length; }
  function routeFor(id) {
    var f = D.flags.filter(function (x) { return x.id === id; })[0]; if (f) return '#/flags/' + id;
    var l = D.lines[id]; return l ? '#/' + secByKey[l.section].slug + '/' + id : '#/brief';
  }
  function labelFor(id) { var f = D.flags.filter(function (x) { return x.id === id; })[0]; return f ? f.id + ' ' + f.title : (D.lines[id] ? D.lines[id].label : id); }
  function errTitle() { document.title = 'Error: ' + h1.textContent + ' - ' + D.corp + ' - Ashbridge Tax'; }
  function okTitle() { document.title = h1.textContent + ' - ' + D.corp + ' - Ashbridge Tax'; }
  function parse() { var p = location.hash.replace(/^#\/?/, '').split('/'); return { a: p[0] || 'brief', b: p[1] ? decodeURIComponent(p[1]) : null, c: p[2] || null }; }
  function go(hash, replace) { if (replace) history.replaceState(null, '', hash); else location.hash = hash; }
  function rowEl(id) { return one('[data-row="' + id + '"]'); }
  function rowBtn(id) { var r = rowEl(id); return r && one('[data-pick]', r); }
  function secRows(key) { var s = secByKey[key]; return s.printed ? [] : s.rows; }

  /* -------- derived text that must agree everywhere (rule 5, check 7) */
  function stateText(id) { var d = S.flags[id]; return d === 'accept' ? 'Accepted by CPA' : d === 'send' ? 'Sent back to the preparer' : 'Open: needs your decision'; }
  function refreshCounts() {
    all('[data-count-reviewed]').forEach(function (e) { e.textContent = nOn(); });
    var tag = one('[data-count-tag]'); if (tag) tag.className = 'govuk-tag ' + (allOn() ? 'govuk-tag--green' : 'govuk-tag--grey');
    all('[data-comment-count]').forEach(function (e) { e.textContent = S.comments.length; });
    var sp = one('[data-section-pick]'); if (sp) { var cur = sp.value; sp.innerHTML = '<option value="#/brief">Brief</option>' + D.sections.map(function (s, i) { var w = s.key === 'flags' && openFlags().length ? openFlags().length + ' open' : isOn(s.key) ? 'Reviewed' : isOff(s.key) ? 'mark came off' : 'not reviewed'; return '<option value="#/' + s.slug + '">' + (i + 1) + ' ' + esc(s.title) + ' (' + w + ')</option>'; }).join(''); sp.value = cur || '#/brief'; if (S.route) { var wanted = S.route.a === 'brief' ? '#/brief' : secBySlug[S.route.a] ? '#/' + S.route.a : null; if (wanted) sp.value = wanted; } }
    D.sections.forEach(function (s) {
      var m = one('[data-rail-mark="' + s.key + '"]'); if (!m) return;
      var txt = s.key === 'flags' && openFlags().length ? openFlags().length + ' open' : isOn(s.key) ? 'Reviewed' : isOff(s.key) ? 'Mark came off' : 'Not reviewed';
      m.innerHTML = '<span class="app-rail__word">' + txt + '</span>';
      m.className = 'app-rail__mark' + (isOn(s.key) ? ' app-rail__mark--on' : isOff(s.key) ? ' app-rail__mark--off' : '');
    });
    all('[data-flag-state]').forEach(function (e) { e.textContent = stateText(e.getAttribute('data-flag-state')); });
    renderLeft(); renderFlagForms(); renderNotes(); renderCommentsList(); renderSendBack();
  }
  function renderLeft() {
    var host = one('[data-left-list]'); if (!host) return;
    var left = D.sections.filter(function (s) { return !isOn(s.key); });
    host.innerHTML = left.length ? '<h2 class="govuk-heading-s" data-count="sections-left" data-scope="sections">Left before Approve shows (' + left.length + ' of ' + order.length + ')</h2><ul class="app-inline-list">' + left.map(function (s) { return '<li><a class="govuk-link" href="#/' + s.slug + '">' + esc(s.title) + (isOff(s.key) ? ' (mark came off)' : '') + '</a></li>'; }).join('') + '</ul>' : '<p class="govuk-body"><strong>Every section is Reviewed.</strong> Approve is ready in the bar above.</p>';
  }

  /* -------- toolbar */
  function approveHtml() { return '<a class="govuk-button app-btn-sm" role="button" draggable="false" data-approve href="' + esc(D.approveHref) + '" aria-keyshortcuts="a">Approve return</a>'; }
  function renderToolbar(r) {
    var html = '';
    var sec = secBySlug[r.a];
    if (r.a === 'brief') {
      html += '<a class="govuk-button app-btn-sm" role="button" draggable="false" href="#/flags" aria-keyshortcuts="n">Start review: Flags</a> <a class="govuk-link" href="#/comments/send">Send back to ' + esc(D.preparer) + '</a>';
    } else if (sec) {
      var key = sec.key, idx = sec.i + 1;
      if (isOn(key)) html += '<strong class="govuk-tag govuk-tag--green">Reviewed by ' + esc(S.marks[key].by) + ', ' + esc(S.marks[key].when) + '</strong> ';
      else if (isOff(key)) html += '<strong class="govuk-tag govuk-tag--red">Mark came off</strong> ';
      else html += '<strong class="govuk-tag govuk-tag--grey">Not reviewed</strong> ';
      if (key === 'flags' && !isOn(key) && openFlags().length) html += '<span class="app-sectionof" data-count="flags-open" data-scope="flags need a decision">' + openFlags().length + ' flags need a decision. Step through them with the Next flag button or <kbd>f</kbd>; the Reviewed button shows when none is open.</span>';
      else if (!isOn(key)) html += '<button type="button" class="govuk-button app-btn-sm" data-primary data-reviewed-next aria-keyshortcuts="r">Reviewed, next</button>';
      else {
        var nxt = order[sec.i + 1];
        if (nxt) html += '<a class="govuk-button govuk-button--secondary app-btn-sm" role="button" draggable="false" href="#/' + secByKey[nxt].slug + '" aria-keyshortcuts="n">Next section<span class="govuk-visually-hidden">: ' + esc(secByKey[nxt].title) + '</span></a> ';
        html += '<button type="button" class="govuk-button govuk-button--warning app-btn-sm" data-unmark-open aria-expanded="' + (S.unmarkOpen ? 'true' : 'false') + '">Take the mark off</button>';
      }
    }
    html += ' ' + (allOn() ? approveHtml() : '<span class="app-approvehint"><a class="govuk-link" href="#/brief">Approve: ' + (order.length - nOn()) + ' sections left</a></span>');
    tb.innerHTML = html;
    var u = one('[data-unmark]');
    if (sec && S.unmarkOpen && isOn(sec.key)) u.innerHTML = '<form class="app-unmark" data-unmark-form novalidate><div class="govuk-form-group govuk-!-margin-bottom-2" data-ug><label class="govuk-label govuk-label--s" for="um-why">Why does the mark come off? <span class="app-required" aria-hidden="true">*</span></label><div id="um-hint" class="govuk-hint">Required. It goes in the history.</div><p id="um-err" class="govuk-error-message" hidden><span class="govuk-visually-hidden">Error:</span> Enter a reason for taking the mark off</p><textarea class="govuk-textarea" id="um-why" rows="2" aria-describedby="um-hint"></textarea></div><button class="govuk-button govuk-button--warning app-btn-sm" data-prevent-double-click="true">Take the mark off</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-unmark-cancel>Cancel</button></form>';
    else u.innerHTML = '';
    if (sec && isOff(sec.key) && D.offReason[sec.key]) u.innerHTML = '<div class="govuk-inset-text app-offwhy"><strong>Why the mark came off:</strong> ' + esc(D.offReason[sec.key]) + '</div>';
  }

  /* -------- rendering a route */
  var rendering = false;
  function render(opts) {
    opts = opts || {};
    var r = parse(); S.route = r; S.curHash = location.hash;
    var isReview = r.a === 'brief' || r.a === 'find' || !!secBySlug[r.a];
    var views = { comments: 'comments', history: 'history', changes: 'changes' };
    all('[data-view]').forEach(function (v) { v.hidden = !(isReview ? v.getAttribute('data-view') === 'review' : v.getAttribute('data-view') === views[r.a]); });
    if (!isReview && !views[r.a]) { go('#/brief', true); return render(opts); }
    var tabName = isReview ? 'review' : r.a;
    all('[data-tab]').forEach(function (t) { if (t.getAttribute('data-tab') === tabName) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    if (isReview) { S.reviewHash = location.hash || '#/brief'; var rl = one('[data-tab="review"]'); rl.setAttribute('href', S.reviewHash.split('/').slice(0, 2).join('/')); }
    var title = 'Brief';
    if (isReview) {
      var sec = secBySlug[r.a];
      all('[data-panel]').forEach(function (p) { p.hidden = true; });
      var key = r.a === 'brief' ? 'brief' : r.a === 'find' ? 'find' : sec.key;
      one('[data-panel="' + key + '"]').hidden = false;
      S.sec = sec ? sec.key : null;
      all('[data-rail]').forEach(function (a) { if (a.getAttribute('data-rail') === (sec ? sec.key : r.a)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      var wide = !sec || sec.printed;
      panesEl.setAttribute('data-layout', wide ? 'wide' : 'three');
      one('[data-list-foot]').hidden = !sec || sec.printed;
      title = sec ? sec.title : r.a === 'find' ? 'Find a number' : 'Brief';
      one('[data-list-title]').textContent = sec ? (sec.printed ? 'Printed return pages' : sec.key === 'flags' ? 'Flags: red first, then dollar effect' : 'Return, in printed order') : title;
      if (r.a === 'find') renderFind(r.b || '');
      if (sec && !sec.printed) {
        var id = r.b && rowEl(r.b) ? r.b : (S.last[sec.key] && rowEl(S.last[sec.key]) ? S.last[sec.key] : sec.rows[0]);
        select(id, { noHash: !!(r.b === id), state: r.c, focusRow: opts.focusRow, focusSource: opts.focusSource, silent: opts.silent });
        if (!r.b) go('#/' + sec.slug + '/' + id + (r.c ? '/' + r.c : ''), true);
      } else {
        S.cur = null; all('[data-trace]').forEach(function (t) { t.hidden = true; }); one('[data-trace-empty]').hidden = false; closeComment();
        if (sec && sec.printed) { all('[data-row].is-selected').forEach(function (x) { x.classList.remove('is-selected'); }); }
        sendSelect(null, title);
      }
    } else {
      title = r.a === 'comments' ? 'Comments' : r.a === 'history' ? 'History' : 'Changes since you sent it back';
      sendSelect(null, title);
      if (r.a === 'comments') { renderCommentsList(); renderSendBack(); if (r.b === 'send') setTimeout(function () { var t = one('#sb-text'); if (t) { t.focus(); } }, 0); }
    }
    h1.textContent = title; document.title = title + ' - ' + D.corp + ' - Ashbridge Tax';
    renderToolbar(r);
    refreshCounts();
    if (opts.focusH1 || (opts.focusRow && isReview && (!secBySlug[r.a] || secBySlug[r.a].printed))) h1.focus();
    if (listBody && !opts.keepScroll && isReview) { /* a section change starts at the top of the list pane */ }
  }

  /* -------- picking a number */
  function select(id, o) {
    o = o || {}; var r = rowEl(id); if (!r) return;
    var key = r.getAttribute('data-section'); S.cur = id; S.last[key] = id;
    all('[data-row].is-selected').forEach(function (x) { x.classList.remove('is-selected'); var b = one('[data-pick]', x); if (b) b.removeAttribute('aria-current'); });
    r.classList.add('is-selected'); var pb = one('[data-pick]', r); if (pb) pb.setAttribute('aria-current', 'true');
    all('[data-trace]').forEach(function (t) { t.hidden = t.getAttribute('data-trace') !== id; });
    one('[data-trace-empty]').hidden = true;
    closeComment(true);
    if (o.state === 'loading' || o.state === 'failed') viewer.state(id, o.state); else viewer.show(id, 0);
    S.srcOpened++;
    // keep the row in view inside its own pane (the page does not scroll)
    var br = listBody.getBoundingClientRect(), rr = r.getBoundingClientRect();
    if (rr.top < br.top + 30) listBody.scrollTop -= (br.top + 30 - rr.top); else if (rr.bottom > br.bottom - 8) listBody.scrollTop += rr.bottom - br.bottom + 8;
    if (!o.noHash && !o.silent) { var sec = secByKey[key]; history.replaceState(null, '', '#/' + sec.slug + '/' + id + (o.state ? '/' + o.state : '')); S.reviewHash = location.hash; }
    if (!o.silent) announce('Selected ' + (r.getAttribute('data-label') || id) + '. Source shown.');
    sendSelect(id, secByKey[key].title);
    if (o.focusRow && pb) pb.focus();
    if (o.focusSource) { var sb = one('[data-source-body]'); sb.focus({ preventScroll: true }); }
  }
  function sendSelect(id, tab) { if (channel) channel.postMessage({ t: 'select', id: id, k: viewer.get().k, label: id ? labelFor(id) : '', tab: tab }); }

  function allRowIds() { var out = []; D.sections.forEach(function (s) { secRows(s.key).forEach(function (id) { out.push({ sec: s, id: id }); }); }); return out; }
  function step(dir) {
    var rows = allRowIds(); if (!rows.length) return;
    var i = -1; for (var j = 0; j < rows.length; j++) if (rows[j].id === S.cur && (!S.sec || rows[j].sec.key === S.sec)) { i = j; break; }
    if (i === -1 && S.route && S.route.a === 'brief' && dir > 0) i = -1; else if (i === -1 && S.sec) { var f = rows.filter(function (x) { return x.sec.key === S.sec; })[0]; i = f ? rows.indexOf(f) - 1 : -1; }
    var n = Math.max(0, Math.min(rows.length - 1, i + dir)); var t = rows[n];
    if (t.sec.key !== S.sec) { go('#/' + t.sec.slug + '/' + t.id, true); render({ focusRow: true }); announce('Section ' + t.sec.title + '. ' + labelFor(t.id)); }
    else select(t.id, { focusRow: true });
  }
  function nextFlag() {
    var fl = D.flags; if (!fl.length) return;
    var cur = S.route && S.route.a === 'flags' ? S.cur : S.lastFlag; var ci = -1; fl.forEach(function (f, i) { if (f.id === cur) ci = i; });
    var pick = null; for (var q = 1; q <= fl.length; q++) { var f = fl[(ci + q) % fl.length]; if (!S.flags[f.id]) { pick = f; break; } }
    if (!pick) pick = fl[(ci + 1) % fl.length];
    S.lastFlag = pick.id; go('#/flags/' + pick.id, true); render({ focusRow: true });
  }
  function nextSection() {
    var r = S.route; var cur = r.a === 'brief' ? -1 : secBySlug[r.a] ? secBySlug[r.a].i : null; if (cur === null) return;
    var nx = D.sections[cur + 1]; if (!nx) { announce('This is the last section.'); return; }
    go('#/' + nx.slug, false);
    setTimeout(function () { var b = S.cur && rowBtn(S.cur); if (b) b.focus(); else h1.focus(); }, 30);
  }
  function stepSource(d, viaKey) {
    var g = viewer.get(); if (!g.id || !viewer.count()) { if (viaKey) one('[data-source-body]').focus({ preventScroll: true }); return; }
    if (viaKey) one('[data-source-body]').focus({ preventScroll: true });
    viewer.show(g.id, g.k + d); S.srcOpened++; sendSelect(g.id, S.sec ? secByKey[S.sec].title : '');
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
    var key = S.sec; if (!key) return;
    if (key === 'flags' && openFlags().length) { announce(openFlags().length + ' flags still need your decision.'); return; }
    var wasOn = isOn(key);
    if (!wasOn) { S.marks[key] = { by: 'Zo', when: D.now }; addHistory(secByKey[key].title + ' marked Reviewed', ''); }
    var nx = order[secByKey[key].i + 1];
    var msg = wasOn ? secByKey[key].title + ' is already Reviewed.' : secByKey[key].title + ' marked Reviewed. ' + nOn() + ' of ' + order.length + '.';
    if (nx) { go('#/' + secByKey[nx].slug, true); render({ silent: false, focusRow: true }); announce(msg + ' Now ' + secByKey[nx].title + '.'); }
    else { renderToolbar(S.route); refreshCounts(); announce(msg + (allOn() ? ' Every section is Reviewed. Approve return is now available.' : '')); var ap = one('[data-approve]'); if (ap) ap.focus(); }
    if (allOn() && nx) announce(msg + ' Every section is Reviewed. Approve return is now available.');
  }

  /* -------- comments (RV-4, RV-7): an in-place panel, 3 fields, 0 page loads */
  function nextCommentId() { return 'C-' + (S.comments.length + 1); }
  function curCaption() {
    var g = viewer.get(); var cap = g && g.id ? one('[data-source="' + g.id + ':' + g.k + '"] .app-caption') : null;
    if (cap) return cap.textContent;
    var vis = all('[data-source] .app-caption').filter(function (c) { return !c.closest('[hidden]'); })[0];
    return vis ? vis.textContent : 'No source found for this number';
  }
  function openComment() {
    if (!S.cur) { announce('Pick a number first, then comment on it.'); return; }
    var host = one('[data-comment-host]'); var id = S.cur;
    var radios = function (name, items, hint) { return '<div class="govuk-form-group" data-g="' + name + '"><fieldset class="govuk-fieldset"' + (hint ? ' aria-describedby="' + name + '-hint"' : '') + '><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + (name === 'type' ? 'Type of comment' : 'Severity') + '<span class="govuk-visually-hidden"> (required)</span> <span class="app-required" aria-hidden="true">*</span></legend>' + (hint ? '<div id="' + name + '-hint" class="govuk-hint">' + hint + '</div>' : '') + '<p class="govuk-error-message" id="' + name + '-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-msg></span></p><div class="govuk-radios govuk-radios--small govuk-radios--inline">' + items.map(function (t, i) { return '<div class="govuk-radios__item"><input class="govuk-radios__input" id="' + name + '-' + i + '" name="' + name + '" type="radio" value="' + t + '"><label class="govuk-label govuk-radios__label" for="' + name + '-' + i + '">' + t + '</label></div>'; }).join('') + '</div></fieldset></div>'; };
    host.innerHTML = '<form class="app-cp" data-comment-form novalidate aria-labelledby="cp-h"><div class="app-cp__head"><h3 class="govuk-heading-s" id="cp-h">Comment on ' + esc(labelFor(id)) + '</h3><p class="app-caption" data-cp-caption>Source: ' + esc(curCaption()) + '</p></div><div class="app-cp__body"><div class="govuk-error-summary" data-module="govuk-error-summary" data-es hidden tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list" data-es-list></ul></div></div></div>' +
      radios('type', ['Error', 'Question', 'Missing evidence', 'Presentation']) + radios('severity', ['Must fix', 'Should fix', 'Note']) +
      '<div class="govuk-form-group" data-g="text"><label class="govuk-label govuk-label--s" for="text">Comment</label><p class="govuk-error-message" id="text-error" hidden><span class="govuk-visually-hidden">Error:</span> <span data-msg></span></p><textarea class="govuk-textarea" id="text" name="text" rows="2" aria-describedby="text-hint text-note"></textarea><div id="text-hint" class="govuk-hint">Say what you want done. Optional for a presentation comment.</div></div></div>' +
      '<div class="app-cp__foot"><button class="govuk-button app-btn-sm" data-primary data-prevent-double-click="true">Add comment</button> <button type="button" class="govuk-button govuk-button--secondary app-btn-sm" data-comment-cancel>Cancel</button><p id="text-note" class="govuk-hint app-cp__note">For an error or a presentation comment, AI drafts the fix and the preparer approves it first (RV-12).</p></div></form>';
    host.setAttribute('data-open', id);
    one('#type-0').focus();
    announce('Comment panel open for ' + labelFor(id) + '. It covers the trace and the source; Escape closes it.');
  }
  function closeComment(quiet) { var host = one('[data-comment-host]'); if (host && host.innerHTML) { host.innerHTML = ''; host.removeAttribute('data-open'); } }
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
    var c = { id: nextCommentId(), line: S.cur, type: type, severity: sev, who: 'Zo', when: D.now, text: text || '(Presentation comment, no text)', status: (type === 'Presentation' || type === 'Error') ? 'Draft, not sent. AI drafts a fix for the preparer to approve (RV-12).' : 'Draft, not sent' };
    S.comments.push(c); closeComment(); okTitle();
    refreshCounts(); var b = S.cur && rowBtn(S.cur); if (b) b.focus();
    announce('Comment ' + c.id + ' added on ' + labelFor(c.line) + '. It goes to ' + D.preparer + ' when you send the return back. ' + S.comments.length + ' comments.');
  }
  function renderNotes() {
    all('[data-notes]').forEach(function (n) {
      var id = n.getAttribute('data-notes'); var cs = S.comments.filter(function (c) { return c.line === id; });
      n.innerHTML = cs.length ? cs.map(function (c) { return '<p class="govuk-body-s govuk-!-margin-bottom-1"><strong>' + esc(c.id) + ' ' + esc(c.type) + ', ' + esc(c.severity) + '</strong> (' + esc(c.status) + '): ' + esc(c.text) + '</p>'; }).join('') : '<p class="govuk-body-s">No comments on this number.</p>';
    });
  }
  function renderCommentsList() {
    var host = one('[data-comments-list]'); if (!host) return;
    if (!S.comments.length) { host.innerHTML = '<div class="govuk-inset-text"><p class="govuk-body"><strong>No comments on this return yet.</strong></p><p class="govuk-body">Open a number and press <kbd>c</kbd> to comment. Comments go to ' + esc(D.preparer) + ' when you send the return back.</p></div>'; return; }
    host.innerHTML = '<div class="app-scroll-x" role="region" aria-label="Comments table" tabindex="0"><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Comments, newest last (' + S.comments.length + ')</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">No.</th><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Type</th><th scope="col" class="govuk-table__header">Severity</th><th scope="col" class="govuk-table__header">Comment</th><th scope="col" class="govuk-table__header">State</th><th scope="col" class="govuk-table__header">Who and when</th></tr></thead><tbody class="govuk-table__body">' +
      S.comments.map(function (c) { return '<tr><td class="govuk-table__cell">' + esc(c.id) + '</td><td class="govuk-table__cell"><a class="govuk-link" href="' + routeFor(c.line) + '">' + esc(labelFor(c.line)) + '</a></td><td class="govuk-table__cell">' + esc(c.type) + '</td><td class="govuk-table__cell">' + esc(c.severity) + '</td><td class="govuk-table__cell">' + esc(c.text) + '</td><td class="govuk-table__cell">' + esc(c.status) + '</td><td class="govuk-table__cell">' + esc(c.who) + ', ' + esc(c.when) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="govuk-body-s">For a presentation comment, or an error on one number, AI drafts the fix with citations when you send the return back. Nothing changes until the preparer approves the draft and it goes through the normal round trip (RV-12).</p>';
  }
  function renderSendBack() {
    var host = one('[data-sendback]'); if (!host || host.getAttribute('data-done')) return;
    if (host.querySelector('form')) return;
    host.innerHTML = '<form class="app-sendback" data-sendback-form novalidate><h2 class="govuk-heading-s">Send back to ' + esc(D.preparer) + '</h2><div class="govuk-error-summary" data-module="govuk-error-summary" hidden tabindex="-1" data-sb-es><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#sb-text">Enter what the preparer should do first</a></li></ul></div></div></div><div class="govuk-form-group" data-sbg><label class="govuk-label govuk-label--s" for="sb-text">What should the preparer do first? <span class="app-required" aria-hidden="true">*</span></label><div id="sb-hint" class="govuk-hint">Required. One or two sentences. Your comments go with it.</div><p class="govuk-error-message" id="sb-error" hidden><span class="govuk-visually-hidden">Error:</span> Enter what the preparer should do first</p><textarea class="govuk-textarea" id="sb-text" rows="3" aria-describedby="sb-hint"></textarea></div><button class="govuk-button app-btn-sm" data-prevent-double-click="true">Send back</button></form>';
  }

  /* -------- flag decisions (in place) */
  function renderFlagForms() {
    all('[data-flag-decide]').forEach(function (h) {
      var id = h.getAttribute('data-flag-decide');
      if (h.getAttribute('data-rendered') === (S.flags[id] || 'open') && h.innerHTML) return;
      h.setAttribute('data-rendered', S.flags[id] || 'open');
      if (S.flags[id]) h.innerHTML = '<p class="govuk-body-s">Decision recorded: ' + (S.flags[id] === 'accept' ? 'accepted by the CPA' : 'sent back to the preparer') + '. Press <kbd>f</kbd> for the next flag.</p>';
      else h.innerHTML = '<div class="govuk-error-summary" data-module="govuk-error-summary" hidden tabindex="-1" data-fes><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#d-' + id + '-a">Select your decision on this flag</a></li></ul></div></div></div><div class="govuk-form-group govuk-!-margin-bottom-2" data-fg><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Your decision on ' + esc(id) + '</legend><p class="govuk-error-message" hidden data-fgerr><span class="govuk-visually-hidden">Error:</span> Select your decision on this flag</p><div class="govuk-radios govuk-radios--small"><div class="govuk-radios__item"><input class="govuk-radios__input" id="d-' + id + '-a" name="d-' + id + '" type="radio" value="accept"><label class="govuk-label govuk-radios__label" for="d-' + id + '-a">Accept the risk</label></div><div class="govuk-radios__item"><input class="govuk-radios__input" id="d-' + id + '-s" name="d-' + id + '" type="radio" value="send"><label class="govuk-label govuk-radios__label" for="d-' + id + '-s">Send back to the preparer</label></div></div></fieldset></div><button class="govuk-button app-btn-sm" data-primary data-prevent-double-click="true">Record decision</button>';
    });
  }
  function decideFlag(form) {
    var id = form.getAttribute('data-flag-form'); var v = (one('input:checked', form) || {}).value;
    if (!v) { var es = one('[data-fes]', form); es.hidden = false; one('[data-fg]', form).classList.add('govuk-form-group--error'); one('[data-fgerr]', form).hidden = false; es.focus(); errTitle(); announce('There is a problem. Select your decision on this flag.'); return; }
    S.flags[id] = v; okTitle();
    var f = D.flags.filter(function (x) { return x.id === id; })[0];
    if (v === 'send') { S.comments.push({ id: nextCommentId(), line: id, type: 'Question', severity: 'Must fix', who: 'Zo', when: D.now, text: 'Flag ' + id + ' sent back: ' + f.title, status: 'Draft, not sent' }); }
    addHistory('Flag ' + id + (v === 'accept' ? ' accepted by the CPA' : ' sent back to the preparer'), '');
    refreshCounts(); renderToolbar(S.route);
    var left = openFlags(); var nxt = D.flags.filter(function (x) { return !S.flags[x.id]; })[0];
    announce('Flag ' + id + (v === 'accept' ? ' accepted by the CPA.' : ' sent back to the preparer. A comment was added.') + ' ' + (left.length ? left.length + ' flags still open.' : 'No flag is open. Reviewed, next is now available.'));
    if (nxt) { go('#/flags/' + nxt.id, true); render({ focusRow: true, silent: true }); } else { var rb = one('[data-reviewed-next]'); if (rb) rb.focus(); }
  }

  /* -------- search across every section (rule 21) */
  function renderFind(q) {
    var host = one('[data-find-results]'); var ql = q.toLowerCase();
    var hits = D.index.filter(function (x) { return !ql || x.label.toLowerCase().indexOf(ql) > -1 || (x.acct && x.acct.indexOf(ql) > -1); });
    if (!hits.length) { host.innerHTML = '<h2 class="govuk-heading-s">No number matches "' + esc(q) + '"</h2><div class="govuk-inset-text">Try part of a name, for example "travel" or "loan". The search covers every section and every flag.</div>'; return; }
    host.innerHTML = '<h2 class="govuk-heading-s" id="find-h">' + hits.length + (hits.length === 1 ? ' result' : ' results') + ' for "' + esc(q) + '"</h2><table class="govuk-table"><caption class="govuk-table__caption govuk-visually-hidden">Search results</caption><thead class="govuk-table__head"><tr><th scope="col" class="govuk-table__header">Number</th><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header app-money">This year</th></tr></thead><tbody class="govuk-table__body">' + hits.map(function (x) { return '<tr><th scope="row" class="govuk-table__header"><a class="govuk-link" href="' + routeFor(x.id) + '">' + esc(x.label) + '</a></th><td class="govuk-table__cell">' + esc(secByKey[x.sec].title) + '</td><td class="govuk-table__cell app-money">' + esc(x.val) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* -------- the second window */
  function openWindow() {
    var g = null; try { g = JSON.parse(localStorage.getItem('ashbridge-win') || 'null'); } catch (e) { g = null; }
    var feats = 'popup=yes,width=' + (g ? g.w : 980) + ',height=' + (g ? g.h : 900) + (g ? ',left=' + g.l + ',top=' + g.t : '');
    var cur = viewer.get();
    var w = window.open(D.srcFile + (cur.id ? '#' + cur.id + ':' + cur.k : ''), 'ashbridge-source', feats);
    if (!w) { announce('The browser blocked the second window. Allow pop-ups for this site, then press o again.'); setWin(false, 'blocked'); return; }
    announce('Second window opened. It follows every number and section you pick.');
    setTimeout(function () { sendSelect(S.cur, S.sec ? secByKey[S.sec].title : (S.route ? S.route.a : '')); }, 400);
  }
  function setWin(on, why) { S.win = on; var e = one('[data-source-win]'); if (e) e.textContent = on ? 'Second window: open, following' : why === 'blocked' ? 'Second window: blocked, allow pop-ups' : 'Second window: not open'; }
  if (channel) {
    channel.onmessage = function (m) {
      var d = m.data;
      if (d.t === 'here') { setWin(true); sendSelect(S.cur, S.sec ? secByKey[S.sec].title : (S.route ? S.route.a : '')); }
      if (d.t === 'gone') setWin(false);
      if (d.t === 'step' && d.id === S.cur) { viewer.show(d.id, d.k); }
    };
    channel.postMessage({ t: 'hello' });
  }

  /* -------- queue links: Back, previous and next follow the list you came from (rule 21) */
  (function () {
    var q = store('ashbridge-queue'); if (!q) return;
    var me = location.pathname.split('/').pop(); var i = q.hrefs ? q.hrefs.indexOf(me) : -1;
    var prev = one('[data-queue-prev]'), next = one('[data-queue-next]');
    if (i > 0) { prev.href = q.hrefs[i - 1] + '#/brief'; prev.hidden = false; }
    if (i > -1 && i < q.hrefs.length - 1) { next.href = q.hrefs[i + 1] + '#/brief'; next.hidden = false; }
    if (q.page) one('[data-queue-back]').href = q.page;
  })();

  /* -------- events */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var pk = t.closest('[data-pick]'); if (pk) { var row = pk.closest('[data-row]'); if (S.cur === row.getAttribute('data-row') && row.getAttribute('data-section') === 'flags' && row.classList.contains('is-selected')) { announce((row.getAttribute('data-label') || 'This number') + ' is already selected. Its trace and source are beside the list.'); return; } select(row.getAttribute('data-row'), { focusSource: row.getAttribute('data-section') !== 'flags' }); return; }
    var g = t.closest('[data-goto]'); if (g && S.cur) { viewer.show(S.cur, +g.getAttribute('data-goto')); S.srcOpened++; sendSelect(S.cur, S.sec ? secByKey[S.sec].title : ''); one('[data-source-body]').focus({ preventScroll: true }); return; }
    if (t.closest('[data-src-next]')) return stepSource(1);
    if (t.closest('[data-src-prev]')) return stepSource(-1);
    if (t.closest('[data-step-next]')) return step(1);
    if (t.closest('[data-step-prev]')) return step(-1);
    if (t.closest('[data-next-flag]')) return nextFlag();
    if (t.closest('[data-reviewed-next]')) return reviewedNext();
    if (t.closest('[data-unmark-open]')) { S.unmarkOpen = !S.unmarkOpen; renderToolbar(S.route); if (S.unmarkOpen) { var w = one('#um-why'); if (w) w.focus(); } return; }
    if (t.closest('[data-unmark-cancel]')) { S.unmarkOpen = false; renderToolbar(S.route); var ub = one('[data-unmark-open]'); if (ub) ub.focus(); return; }
    if (t.closest('[data-comment-open]') || t.closest('[data-comment-kind]')) return openComment();
    if (t.closest('[data-comment-cancel]')) { closeComment(); var b = S.cur && rowBtn(S.cur); if (b) b.focus(); announce('Comment cancelled.'); return; }
    if (t.closest('[data-open-source]')) return openWindow();
    if (t.closest('[data-retry]')) { var id = S.cur; announce('Loading the source again.'); setTimeout(function () { viewer.show(id, 0); announce('Source loaded.'); history.replaceState(null, '', '#/' + secByKey[S.sec].slug + '/' + id); }, 500); return; }
    if (t.closest('[data-page-next],[data-page-prev]')) {
      var host = one('[data-panel="' + S.sec + '"]'); var pages = all('[data-page]', host); var ci = pages.findIndex(function (p) { return !p.hidden; });
      var ni = (ci + (t.closest('[data-page-next]') ? 1 : -1) + pages.length) % pages.length; pages.forEach(function (p, i) { p.hidden = i !== ni; }); announce(one('.app-caption', pages[ni]).textContent); return;
    }
    var here = t.closest('[data-rail][aria-current],[data-tab][aria-current],.app-approvehint a'); if (here && (here.hasAttribute('aria-current') || (S.route && S.route.a === 'brief'))) { announce('You are already on ' + (here.matches('.app-approvehint a') ? 'the brief. The sections left are listed below.' : (here.textContent.trim().replace(/\s+\d+$/, '')) + '.')); var tgt = here.matches('.app-approvehint a') ? one('[data-left-list] h2') : h1; if (tgt) { tgt.setAttribute('tabindex', '-1'); tgt.focus(); } e.preventDefault(); return; }
    var rail = t.closest('[data-rail],[data-tab],.app-flagmark,[data-left-list] a'); if (rail) { setTimeout(function () { if (!S.route || S.route.a) { /* focus the heading after the route renders, for pointer and Enter alike */ } }, 0); }
  });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-section-pick]')) location.hash = e.target.value; });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-comment-form]')) { e.preventDefault(); submitComment(f); }
    else if (f.matches('[data-flag-form]')) { e.preventDefault(); decideFlag(f); }
    else if (f.matches('[data-find]')) { e.preventDefault(); var q = one('#find-q').value.trim(); if (!q) { announce('Type part of a name to find.'); one('#find-q').focus(); return; }
      var hits = D.index.filter(function (x) { return x.label.toLowerCase().indexOf(q.toLowerCase()) > -1 || (x.acct && x.acct.indexOf(q) > -1); });
      if (hits.length === 1) { go(routeFor(hits[0].id)); announce('One match: ' + hits[0].label + '.'); } else { go('#/find/' + encodeURIComponent(q)); setTimeout(function () { var fh = one('#find-h'); if (fh) { fh.setAttribute('tabindex', '-1'); fh.focus(); } announce(hits.length + ' results for ' + q); }, 30); } }
    else if (f.matches('[data-unmark-form]')) { e.preventDefault(); var why = one('#um-why').value.trim(); var key = S.sec;
      if (!why) { one('[data-ug]').classList.add('govuk-form-group--error'); one('#um-err').hidden = false; one('#um-why').focus(); errTitle(); announce('Error: enter a reason for taking the mark off.'); return; }
      S.marks[key] = null; S.unmarkOpen = false; okTitle(); addHistory(secByKey[key].title + ' mark taken off', why); renderToolbar(S.route); refreshCounts(); announce(secByKey[key].title + ' mark taken off. Reason recorded.'); var rb = one('[data-reviewed-next]'); if (rb) rb.focus(); }
    else if (f.matches('[data-sendback-form]')) { e.preventDefault(); var tx = one('#sb-text').value.trim();
      if (!tx) { one('[data-sb-es]').hidden = false; one('[data-sbg]').classList.add('govuk-form-group--error'); one('#sb-error').hidden = false; one('[data-sb-es]').focus(); errTitle(); announce('There is a problem. Enter what the preparer should do first.'); return; }
      okTitle(); var host = one('[data-sendback]'); host.setAttribute('data-done', '1'); S.sent = true;
      host.innerHTML = '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" tabindex="-1" data-sb-done><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Returned to ' + esc(D.preparer) + '. It leaves your queue until the preparer sends it back. ' + S.comments.length + ' comments went with it. <a class="govuk-notification-banner__link" href="queue.html">Back to the queue</a></p></div></div>';
      addHistory('Returned to the preparer', tx); one('[data-sb-done]').focus(); announce('Returned to ' + D.preparer + '.'); }
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
      if (one('[data-comment-host]').innerHTML) { closeComment(); var b = S.cur && rowBtn(S.cur); if (b) b.focus(); announce('Comment closed.'); e.preventDefault(); return; }
      if (t && t.closest && t.closest('[data-source-body]') && S.cur) { var rb = rowBtn(S.cur); if (rb) { rb.focus(); e.preventDefault(); } }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || inField || (keysOff && keysOff.checked)) return;
    if (!document.querySelector('[data-view="review"]') || (S.route && !(S.route.a === 'brief' || S.route.a === 'find' || secBySlug[S.route.a]) && e.key !== 'a')) return;
    var k = e.key;
    if (k === 'j') step(1); else if (k === 'k') step(-1); else if (k === 'f') nextFlag();
    else if (k === ']') stepSource(1, true); else if (k === '[') stepSource(-1, true);
    else if (k === 'o') { var ob = one('[data-open-source]'); openWindow(); if (ob) ob.focus({ preventScroll: true }); } else if (k === 'c') openComment();
    else if (k === 'n') nextSection(); else if (k === 'r') reviewedNext();
    else if (k === 'a') { var ap = one('[data-approve]'); if (ap) { ap.focus(); announce('Approve return. Every section is Reviewed. Press Enter to approve.'); } else { var hl = one('.app-approvehint a'); if (hl) hl.focus(); announce('Approve is not ready: ' + (order.length - nOn()) + ' of ' + order.length + ' sections left to mark Reviewed. The brief lists them.'); } }
    else return;
    e.preventDefault();
  });

  if (!location.hash) history.replaceState(null, '', '#/brief');
  refreshCounts(); render({ silent: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
