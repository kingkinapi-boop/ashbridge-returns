/* Version B prototype behaviour. Shows how the built screen acts: client-side steps (0 page loads), in-place actions, shared source viewer, second window.
   Nothing here is product code. Everything on the pages can be read without it, except the actions. */
import { initAll as govukInit } from '../../vendor/govuk-frontend.min.js';
import { initAll as mojInit } from '../../vendor/moj-frontend.min.js';
(function () {
  'use strict';
  var d = document;
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  var live = $('#live');
  function say(t) { if (!live) { return; } live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }
  function store(k, v) { try { if (v === undefined) { return sessionStorage.getItem(k); } sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var params = new URLSearchParams(location.search);

  govukInit();
  mojInit();

  /* ---------- keys ---------- */
  var KEY_OFF = 'ashbridge.keys.off';
  function keysOff() { try { return localStorage.getItem(KEY_OFF) === '1'; } catch (e) { return false; } }
  var toggle = $('#keys-off');
  if (toggle) { toggle.checked = keysOff(); toggle.addEventListener('change', function () { try { localStorage.setItem(KEY_OFF, toggle.checked ? '1' : '0'); } catch (e) {} }); }

  /* ---------- second window and shared viewer ---------- */
  var win = null;
  var chan = null;
  try { chan = new BroadcastChannel('ashbridge-source'); } catch (e) { chan = null; }
  var current = { key: null, label: '' };
  function post(key, label) {
    current = { key: key, label: label || '' };
    var msg = { key: key, label: label || '', t: Date.now() };
    if (chan) { try { chan.postMessage(msg); } catch (e) {} }
    try { localStorage.setItem('ash.src', JSON.stringify(msg)); } catch (e) {}
    if (win && !win.closed) { try { win.postMessage(msg, '*'); } catch (e) {} }
  }
  /* ---------- pane layout (round 2): head, then the source (evidence first), then the rest, with the decision pinned at the foot ---------- */
  function layoutItem(it) {
    if (it.getAttribute('data-laid')) { return; }
    it.setAttribute('data-laid', '1');
    var kids = Array.prototype.slice.call(it.children);
    var pager = kids.filter(function (k) { return k.classList.contains('app-pager'); })[0];
    var hasActs = kids.some(function (k) { return k.classList.contains('app-actions'); });
    var footEls = kids.filter(function (k) { return (k.matches('form[data-form]') && !hasActs) || k.classList.contains('app-actions') || (k.tagName === 'P' && k.children.length === 1 && k.firstElementChild.matches('a') && k.textContent.trim() === k.firstElementChild.textContent.trim()); });
    var scroll = d.createElement('div'); scroll.className = 'app-item__scroll';
    var head = d.createElement('div'); head.className = 'app-item__head';
    var rest = d.createElement('div'); rest.className = 'app-item__rest'; rest.setAttribute('role', 'region'); rest.setAttribute('aria-label', 'More detail, scrollable');
    var inHead = true;
    kids.forEach(function (k) {
      if (k === pager || footEls.indexOf(k) >= 0) { return; }
      if (inHead && head.children.length < 3 && (k.tagName === 'H2' || (k.tagName === 'P' && (head.children.length < 2 || k.textContent.trim().length <= 70)))) { head.appendChild(k); } else { inHead = false; rest.appendChild(k); }
    });
    scroll.appendChild(head); scroll.appendChild(rest);
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Detail and source, scrollable');
    it.appendChild(scroll);
    var pos = pager ? $('[data-pos]', pager) : null;
    var stateP = $('[data-state-slot]', head) ? $('[data-state-slot]', head).parentNode : null;
    if (footEls.length) {
      var foot = d.createElement('div'); foot.className = 'app-item__foot';
      footEls.forEach(function (k) { foot.appendChild(k); });
      var prim = $('button[type="submit"]', foot) || $('.govuk-button:not(.govuk-button--secondary):not(.govuk-button--warning)', foot) || $('a', foot);
      if (prim) { prim.setAttribute('data-primary', ''); }
      var acts = $$('.app-actions', foot).pop();
      if (pager && acts) {
        $$('button', pager).forEach(function (b) { if (b.getAttribute('data-nav') === 'prev') { b.textContent = 'Prev'; b.setAttribute('aria-label', 'Previous row'); } else { b.setAttribute('aria-label', 'Next row'); } acts.appendChild(b); });
        if (pos) { var hh = $('h2', head); if (hh && hh.nextSibling) { head.insertBefore(pos, hh.nextSibling); } else { head.appendChild(pos); } }
        pager.remove();
      } else if (pager) { head.appendChild(pager); }
      it.appendChild(foot);
    } else if (pager) { head.appendChild(pager); }
  }
  function placeViewer(pane, item) {
    var v = $('[data-viewer]', pane);
    if (!v || !item) { return; }
    var head = $('.app-item__head', item);
    if (head && v.previousElementSibling !== head) { head.parentNode.insertBefore(v, head.nextSibling); }
  }
  function fitPane() {
    var host = $('.app-ws') || $('.app-split');
    var pane = $('.app-pane');
    if (!host || !pane) { return; }
    if (window.innerWidth < 720) { pane.style.removeProperty('--app-pane-h'); return; }
    var top = host.getBoundingClientRect().top + window.scrollY;
    pane.style.setProperty('--app-pane-h', Math.max(240, window.innerHeight - top - 8) + 'px');
    scrollFocusable();
  }
  function scrollFocusable() {
    $$('.app-item__scroll, .app-item__rest, .app-pane').forEach(function (el) {
      if (!el.getClientRects().length) { return; }
      var over = el.scrollHeight > el.clientHeight + 1;
      if (el.classList.contains('app-pane')) { el.tabIndex = over ? 0 : -1; if (!over) { el.removeAttribute('tabindex'); } }
      else { if (over) { el.tabIndex = 0; } else { el.removeAttribute('tabindex'); } }
    });
  }
  window.addEventListener("resize", fitPane);
  window.addEventListener("load", fitPane);
  function renderViewer(pane, key, label, item) {
    var v = $('[data-viewer]', pane);
    if (!v) { return; }
    if (item) { placeViewer(pane, item); }
    var s = window.ASH_SOURCES && window.ASH_SOURCES[key];
    if (!s) { v.hidden = true; return; }
    v.hidden = false;
    $('[data-viewer-title]', v).textContent = s.title;
    var box = $('[data-viewer-box]', v);
    box.innerHTML = window.ASH_RENDER(key);
    $('[data-viewer-caption]', v).textContent = s.caption;
    var hl = $('[data-hl]', box);
    if (hl) { box.scrollTop = Math.max(0, hl.offsetTop - box.clientHeight / 2 + hl.offsetHeight / 2); }
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-src-window]');
    if (!b) { return; }
    win = window.open('source-window.html', 'ashbridge-source', 'width=860,height=900');
    var st = $('[data-src-status]', b.closest('[data-viewer]'));
    if (!win) { if (st) { st.textContent = 'The browser blocked the second window. Allow pop-ups for this site and press the button again.'; } return; }
    if (st) { st.textContent = 'The second window follows every row and step you choose here.'; }
    $$('[data-src-status]').forEach(function (x) { x.textContent = 'The second window follows every row and step you choose here.'; });
    setTimeout(function () { if (current.key) { post(current.key, current.label); } }, 600);
    say('Second window opened. It follows your selection.');
  });
  d.addEventListener('click', function (e) { if (e.target.closest('[data-signout]')) { post(null, ''); if (chan) { chan.postMessage({ close: true }); } try { localStorage.setItem('ash.src', JSON.stringify({ close: true, t: Date.now() })); } catch (x) {} } });

  /* ---------- stage (prototype only: which point in the life of this return is shown) ---------- */
  var stage = params.get('stage') || store('ash.b.stage') || 'import';
  function applyStage() {
    d.body.setAttribute('data-stage', stage);
    store('ash.b.stage', stage);
    $$('[data-stage-only]').forEach(function (el) { el.hidden = el.getAttribute('data-stage-only').split(' ').indexOf(stage) < 0; });
    $$('[data-stage-set]').forEach(function (el) { el.setAttribute('aria-current', el.getAttribute('data-stage-set') === stage ? 'true' : 'false'); el.classList.toggle('app-stage-on', el.getAttribute('data-stage-set') === stage); });
    var map = { import: ['Round trip', 'blue'], upload: ['Round trip', 'blue'], traced: ['Trace', 'purple'], rework: ['CPA rework', 'orange'] };
    $$('[data-stage-tag]').forEach(function (el) { el.innerHTML = '<strong class="govuk-tag govuk-tag--' + map[stage][1] + '">' + map[stage][0] + '</strong>'; });
    recount();
  }
  var held = params.get('hold') === 'other' || store('ash.b.hold') === 'other';
  function applyHold() {
    d.body.classList.toggle('app-held', held);
    store('ash.b.hold', held ? 'other' : 'me');
    $$('[data-hold-text]').forEach(function (el) { el.textContent = held ? 'Held by Sam Okafor (Test), read only' : 'Held by you'; });
    $$('[data-hold-who]').forEach(function (el) { el.textContent = held ? 'Sam Okafor (Test), since 14:05' : 'Dana Whitfield (Test), since 09:12'; });
    $$('[data-held-only]').forEach(function (el) { el.hidden = !held; });
  }
  d.addEventListener('click', function (e) { if (e.target.closest('[data-hold-toggle]')) { held = !held; applyHold(); say(held ? 'Now showing the return held by someone else.' : 'Now showing the return held by you.'); } });
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-stage-set]');
    if (!b) { return; }
    stage = b.getAttribute('data-stage-set');
    applyStage();
    if (d.querySelector('.app-ws[data-return]')) { route(true); }
    say('Showing the return at: ' + b.textContent.trim());
  });

  /* ---------- counts: every number on the page is counted from the rows, so two counts never disagree ---------- */
  function rowVisibleByStage(tr) { var s = tr.closest('[data-stage-only]'); return !s || s.getAttribute('data-stage-only').split(' ').indexOf(stage) >= 0; }
  function countOpen(name) {
    var v = $('.app-view[data-view="' + name + '"]');
    if (!v) { return null; }
    return $$('tr[data-open="1"]', v).filter(rowVisibleByStage).length;
  }
  function recount() {
    var names = {};
    $$('[data-count],[data-badge],[data-count-status],[data-show-zero],[data-show-open]').forEach(function (el) {
      var n = el.getAttribute('data-count') || el.getAttribute('data-badge') || el.getAttribute('data-count-status') || el.getAttribute('data-show-zero') || el.getAttribute('data-show-open');
      names[n] = true;
    });
    var c = {};
    Object.keys(names).forEach(function (n) { c[n] = countOpen(n); });
    $$('[data-badge]').forEach(function (el) {
      var n = c[el.getAttribute('data-badge')];
      var na = el.getAttribute('data-na-stage');
      if (n === null || n === undefined || (na && na.split(' ').indexOf(stage) >= 0)) { el.hidden = true; return; }
      el.hidden = false;
      el.setAttribute('data-zero', n === 0 ? '1' : '0');
      $('[data-n]', el).textContent = n;
    });
    $$('[data-count]').forEach(function (el) {
      var n = c[el.getAttribute('data-count')];
      if (n === null || n === undefined) { return; }
      el.textContent = (el.getAttribute('data-fmt') || '{n}').replace('{n}', n).replace('{s}', n === 1 ? '' : 's');
    });
    $$('[data-count-status]').forEach(function (el) {
      var n = c[el.getAttribute('data-count-status')];
      if (n === null || n === undefined) { return; }
      el.className = 'govuk-tag govuk-tag--' + (n === 0 ? 'green' : 'blue');
      el.textContent = n === 0 ? 'Complete' : 'In progress';
    });
    $$('[data-show-zero]').forEach(function (el) { el.hidden = c[el.getAttribute('data-show-zero')] !== 0; });
    $$('[data-show-open]').forEach(function (el) { el.hidden = c[el.getAttribute('data-show-open')] === 0; });
    /* hand-off list: what is left, as links, from the same counts */
    var left = $('[data-left]');
    if (left) {
      var items = $$('[data-left-item]', left);
      var total = 0;
      items.forEach(function (li) {
        var n = c[li.getAttribute('data-left-item')];
        var na = li.getAttribute('data-na-stage');
        var live = !(na && na.split(' ').indexOf(stage) >= 0) && n > 0;
        li.hidden = !live;
        if (live) { total += n; var cnt = $('[data-left-n]', li); if (cnt) { cnt.textContent = n; } var wd = $('[data-left-t]', li); if (wd) { wd.textContent = wd.getAttribute(n === 1 ? 'data-one' : 'data-many'); } }
      });
      var anyRound = stage === 'import' || stage === 'upload';
      var ready = $('[data-left-ready]');
      var nothing = (total === 0 && !anyRound);
      if (ready) { ready.hidden = !nothing; }
      var wrap = $('[data-left-wrap]');
      if (wrap) { wrap.hidden = nothing; }
    }
  }

  /* ---------- rows, panes ---------- */
  function activeView() { return $$('.app-view').filter(function (v) { return !v.hidden; })[0] || null; }
  function activePane() { return $$('.app-paneset').filter(function (v) { return !v.hidden; })[0] || null; }
  function rowsOf(view) {
    return $$('tbody tr[data-id]', view).filter(function (tr) { return rowVisibleByStage(tr) && !tr.classList.contains('app-filtered'); });
  }
  function rowFor(view, id) { return $$('tbody tr[data-id="' + id + '"]', view).filter(rowVisibleByStage)[0] || null; }
  var selected = null;
  function select(id, opts) {
    opts = opts || {};
    var view = activeView(), pane = activePane();
    if (!view || !pane) { return; }
    var tr = rowFor(view, id);
    if (!tr) { return; }
    $$('tbody tr.app-row-selected', view).forEach(function (r) { r.classList.remove('app-row-selected'); var b = $('[data-row]', r); if (b) { b.removeAttribute('aria-current'); } });
    tr.classList.add('app-row-selected');
    var rb = $('[data-row]', tr);
    if (rb) { rb.setAttribute('aria-current', 'true'); }
    selected = { view: view.getAttribute('data-view'), id: id };
    var found = null;
    $$('.app-item', pane).forEach(function (it) { var on = it.getAttribute('data-item') === id; it.hidden = !on; if (on) { found = it; } });
    var empty = $('[data-pane-empty]', pane);
    if (empty) { empty.hidden = !!found; }
    if (!found) { return; }
    var slot = $('[data-state-slot]', found), st = $('[data-state]', tr);
    if (slot && st) { slot.innerHTML = st.innerHTML; }
    var rows = rowsOf(view), idx = rows.indexOf(tr);
    var pos = $('[data-pos]', found);
    if (pos) { pos.textContent = 'Row ' + (idx + 1) + ' of ' + rows.length; }
    var cannotNow = !!(st && /Cannot start yet/.test(st.textContent));
    $$('[data-can]', found).forEach(function (x) { x.hidden = cannotNow; });
    $$('[data-cannot]', found).forEach(function (x) { x.hidden = !cannotNow; });
    renderViewer(pane, found.getAttribute('data-src'), found.getAttribute('data-label') || id, found);
    fitPane();
    if (found.getAttribute('data-src')) { post(found.getAttribute('data-src'), $('h2', found) ? $('h2', found).textContent : id); }
    if (opts.focus) { var h = $('h2', found); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    if (opts.nearest) { tr.scrollIntoView({ block: 'nearest' }); var rb3 = $('[data-row]', tr); if (rb3) { rb3.focus({ preventScroll: true }); } }
  }
  function next(delta, opts) {
    var view = activeView();
    if (!view || !selected) { return; }
    var rows = rowsOf(view), i = -1;
    rows.forEach(function (r, k) { if (r.getAttribute('data-id') === selected.id) { i = k; } });
    var j = i + delta;
    if (j < 0 || j >= rows.length) { say(delta > 0 ? 'That is the last row.' : 'That is the first row.'); return; }
    select(rows[j].getAttribute('data-id'), opts);
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-row]');
    if (b) { select(b.closest('tr').getAttribute('data-id'), { focus: true }); return; }
    var n = e.target.closest('[data-nav]');
    if (n) { next(n.getAttribute('data-nav') === 'next' ? 1 : -1, { focus: true }); }
  });

  /* ---------- router: a step is a client-side route with its own URL ---------- */
  function route(keep) {
    var shell = $('.app-ws[data-return]');
    if (!shell) { return; }
    var h = location.hash.replace(/^#\/?/, '') || 'checklist';
    var base = h.split('/')[0];
    var views = $$('.app-view'), want = views.filter(function (v) { return v.getAttribute('data-view') === h || v.getAttribute('data-also') === h; })[0] || views.filter(function (v) { return v.getAttribute('data-view') === base; })[0] || views[0];
    var key = want.getAttribute('data-view');
    views.forEach(function (v) { v.hidden = v !== want; });
    $$('.app-paneset').forEach(function (p) { p.hidden = p.getAttribute('data-view') !== key; });
    d.title = want.getAttribute('data-title') + ' - ' + (shell.getAttribute('data-return') || '') + ' - Ashbridge Tax';
    var h1 = $('#page-title');
    if (h1) { h1.textContent = want.getAttribute('data-title'); }
    $$('.app-steps a, .app-steps .app-steps__here').forEach(function (a) { /* current step */
      var on = a.getAttribute('data-step') === base;
      if (on) { a.setAttribute('aria-current', 'step'); } else { a.removeAttribute('aria-current'); }
      a.classList.toggle('app-steps__here', on);
    });
    recount();
    var pane = activePane();
    var first = null;
    if (pane) {
      var want2 = params.get('sel');
      var rows = rowsOf(want);
      if (want2 && rowFor(want, want2)) { first = want2; params.delete('sel'); }
      else {
        var cur = rows.filter(function (r) { return r.getAttribute('data-current') === '1'; })[0] || rows.filter(function (r) { return r.getAttribute('data-open') === '1'; })[0] || rows[0];
        first = cur ? cur.getAttribute('data-id') : null;
      }
      if (first) { select(first, { focus: false }); }
      else { var ps = pane; var vv = $('[data-viewer]', ps); if (vv) { vv.hidden = true; } }
    }
    if (/\/error$/.test(h)) { setTimeout(function () { var f = want.getAttribute('data-error-in') === 'pane' ? $('.app-item:not([hidden]) form[data-form]', pane) : $('form[data-form]', want); if (f) { var ta = $('textarea', f); if (ta) { ta.value = ''; } if (f.requestSubmit) { f.requestSubmit(); } } }, 60); }
    var src = want.getAttribute('data-src');
    if (src && !first) { post(src, want.getAttribute('data-title')); if (pane) { renderViewer(pane, src, ''); } }
    if (!keep && h1 && !route.first) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: false }); say(want.getAttribute('data-title')); }
    route.first = false;
    fitPane();
  }
  route.first = true;
  window.addEventListener('hashchange', function () { route(false); });
  d.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]');
    if (!g) { return; }
    e.preventDefault();
    var sel = g.getAttribute('data-select');
    if (sel) { params.set('sel', sel); }
    if (location.hash === '#/' + g.getAttribute('data-goto')) { route(false); } else { location.hash = '#/' + g.getAttribute('data-goto'); }
  });

  /* ---------- state changes in place ---------- */
  function applyState(tr, to, tag, closesOpen) {
    var cell = $('[data-state]', tr);
    if (cell) { cell.innerHTML = '<strong class="govuk-tag govuk-tag--' + tag + '">' + to + '</strong>'; }
    if (closesOpen) { tr.removeAttribute('data-open'); tr.classList.remove('app-row-flag'); }
    var cb = $('input[data-bulk]', tr);
    if (cb && closesOpen) { cb.checked = false; cb.closest('td,th').innerHTML = '<span class="govuk-visually-hidden">Done</span>'; }
    recount();
  }
  function setCurrent(tr) { $$('tr[data-current]', tr.closest('table')).forEach(function (r) { r.removeAttribute('data-current'); }); tr.setAttribute('data-current', '1'); }
  function finish(sayText, view, fromId) {
    /* move on to the next open row after this one, else stay; announce */
    var rows = rowsOf(view), i = 0;
    rows.forEach(function (r, k) { if (r.getAttribute('data-id') === fromId) { i = k; } });
    var nextOpen = null;
    for (var k = 1; k <= rows.length; k++) { var r = rows[(i + k) % rows.length]; if (r.getAttribute('data-open') === '1') { nextOpen = r; break; } }
    if (nextOpen) { select(nextOpen.getAttribute('data-id'), { focus: true }); say(sayText + ' Next row opened.'); }
    else { select(fromId, { focus: true }); say(sayText + ' Nothing open is left in this list.'); }
  }
  function doSet(btn, extraText) {
    var view = activeView();
    if (!view || !selected) { return; }
    var tr = rowFor(view, selected.id);
    if (!tr) { return; }
    var to = btn.getAttribute('data-to'), tag = btn.getAttribute('data-tag') || 'green';
    var closes = btn.getAttribute('data-closes') !== '0';
    applyState(tr, to, tag, closes);
    var un = btn.getAttribute('data-unlock'); if (un) { var utr = rowFor(view, un); if (utr) { applyState(utr, 'In progress', 'blue', false); setCurrent(utr); } }
    var go = null;
    finish((btn.getAttribute('data-say') || to) + '.', view, selected.id);
    if (extraText) { /* reserved */ }
    if (go) { var info = $('[data-after-link]', btn.closest('.app-item')); if (info) { info.hidden = false; } }
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="set"]');
    if (!b || b.closest('form')) { return; }
    doSet(b);
  });
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="download"]');
    if (!b) { return; }
    var t1 = $('#rt-table-import tr[data-id="s1"]'), t2 = $('#rt-table-import tr[data-id="s2"]');
    if (t1) { applyState(t1, 'Complete', 'green', true); }
    if (t1) { t1.removeAttribute('data-current'); }
    if (t2) { applyState(t2, 'In progress', 'blue', false); setCurrent(t2); }
    say('The import file is downloading. Step 1 is complete; step 2 is next.');
    var rv = b.closest('.app-view');
    if (!rv || rv.getAttribute('data-view') !== 'roundtrip') { setTimeout(function () { location.hash = '#/roundtrip'; }, 250); }
    else { setTimeout(function () { select('s2', { focus: true }); }, 250); }
  });

  /* forms: GOV.UK error pattern, in place */
  d.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) { return; }
    e.preventDefault();
    var errs = [];
    $$('[data-req]', f).forEach(function (inp) {
      var grp = inp.closest('.govuk-form-group'), msg = grp ? $('.govuk-error-message', grp) : null, bad = false;
      var cond = inp.getAttribute('data-req-if');
      if (cond) { var c = d.getElementById(cond); if (!c || !c.checked) { if (grp) { grp.classList.remove('govuk-form-group--error'); } if (msg) { msg.hidden = true; } return; } }
      if (inp.type === 'radio') { bad = !$('input[name="' + inp.name + '"]:checked', f); }
      else if (inp.type === 'checkbox') { bad = !inp.checked; }
      else if (inp.type === 'file') { var ok = inp.files && inp.files.length; bad = !ok; if (ok) { var ext = (inp.getAttribute('data-ext') || '').split(','); var nm = inp.files[0].name.toLowerCase(); if (ext[0] && !ext.some(function (x) { return nm.slice(-x.length) === x; })) { bad = true; inp.setAttribute('data-wrong', '1'); } } }
      else { bad = !inp.value.trim(); }
      if (grp) { grp.classList.toggle('govuk-form-group--error', bad); }
      if (msg) { msg.hidden = !bad; var text = inp.getAttribute(inp.getAttribute('data-wrong') ? 'data-msg-wrong' : 'data-msg') || 'Complete this field'; if (bad) { msg.innerHTML = '<span class="govuk-visually-hidden">Error:</span> ' + text; } }
      if (bad) { errs.push({ id: inp.id || inp.name, text: inp.getAttribute(inp.getAttribute('data-wrong') ? 'data-msg-wrong' : 'data-msg') || 'Complete this field' }); }
      inp.removeAttribute('data-wrong');
    });
    var sum = $('[data-summary]', f);
    if (errs.length) {
      var det = f.closest('details'); if (det) { det.open = true; }
      if (sum) { $('ul', sum).innerHTML = errs.map(function (x) { return '<li><a href="#' + x.id + '">' + x.text + '</a></li>'; }).join(''); sum.hidden = false; sum.focus({ preventScroll: true }); }
      d.title = d.title.replace(/^Error: /, '');
      d.title = 'Error: ' + d.title;
      say('There is a problem. ' + errs.length + (errs.length === 1 ? ' thing needs' : ' things need') + ' fixing.');
      return;
    }
    d.title = d.title.replace(/^Error: /, '');
    if (sum) { sum.hidden = true; }
    var btn = $('button[type="submit"]', f);
    var label = btn ? btn.textContent : '';
    if (btn) { btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Saving'; }
    setTimeout(function () {
      if (btn) { btn.removeAttribute('aria-busy'); btn.textContent = label; }
      var act = f.getAttribute('data-act');
      if (act === 'set') { doSet(f); }
      else if (act === 'sign') { f.hidden = true; var done = $('[data-signed]', f.parentNode); if (done) { done.hidden = false; done.setAttribute('tabindex', '-1'); done.focus(); } say('Signed. The return goes to the CPA.'); }
      else if (act === 'note') { var rs = $('[data-result]', f); if (rs) { rs.hidden = false; rs.focus(); } say('Mapping read.'); }
      else if (act === 'upload') { doSet(f); if (stage === 'upload') { stage = 'traced'; applyStage(); route(true); } say('Uploaded. The lock export and the printed return were read. Trace and Diagnostics are ready.'); }
    }, 300);
  });
  d.addEventListener('click', function (e) {
    var a = e.target.closest('.govuk-error-summary a');
    if (!a) { return; }
    var t = d.getElementById(a.getAttribute('href').slice(1));
    if (t) { e.preventDefault(); t.focus({ preventScroll: false }); }
  });

  /* bulk: unflagged rows only, count in a sticky bar */
  function bulkUpdate() {
    var bars = $$('[data-bulk-bar]');
    bars.forEach(function (bar) {
      var v = bar.closest('.app-view');
      var n = $$('input[data-bulk]:checked', v).length;
      bar.hidden = n === 0;
      $('[data-bulk-n]', bar).textContent = n + (n === 1 ? ' fact' : ' facts') + ' selected';
    });
  }
  d.addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-bulk],input[data-bulk-all]');
    if (!cb) { return; }
    if (cb.hasAttribute('data-bulk-all')) { $$('input[data-bulk]', cb.closest('.app-view')).forEach(function (x) { if (!x.closest('tr').classList.contains('app-filtered') && !x.closest('tr').classList.contains('app-row-flag')) { x.checked = cb.checked; } }); }
    bulkUpdate();
  });
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bulk-act]');
    if (!b) { return; }
    var view = b.closest('.app-view'), n = 0;
    $$('input[data-bulk]:checked', view).forEach(function (cb) { var tr = cb.closest('tr'); if (tr.classList.contains('app-row-flag')) { return; } applyState(tr, 'Verified', 'green', true); n++; });
    bulkUpdate();
    var all = $('input[data-bulk-all]', view); if (all) { all.checked = false; }
    var firstBtn = $('[data-row]', rowsOf(view)[0]);
    if (selected) { var tr = rowFor(view, selected.id); var st = $('[data-state]', tr); var sl = $('[data-state-slot]', activePane()); if (sl && st) { sl.innerHTML = st.innerHTML; } }
    if (firstBtn) { firstBtn.focus({ preventScroll: true }); }
    say(n + ' facts verified. Flagged facts are never verified in bulk.');
  });

  /* filters */
  function applyFilters(tableId) {
    var tbl = d.getElementById(tableId);
    if (!tbl) { return; }
    var ctr = $$('[data-filter-for="' + tableId + '"]');
    var shown = 0, total = 0;
    $$('tbody tr', tbl).forEach(function (tr) {
      total++;
      var ok = true;
      ctr.forEach(function (c) {
        var v = (c.value || '').trim().toLowerCase();
        if (!v || v === 'all') { return; }
        if (c.getAttribute('data-kind') === 'text') { if (tr.textContent.toLowerCase().indexOf(v) < 0) { ok = false; } }
        else { var a = tr.getAttribute('data-' + c.getAttribute('data-attr')) || ''; if (a.split(' ').indexOf(v) < 0) { ok = false; } }
      });
      tr.classList.toggle('app-filtered', !ok);
      if (ok) { shown++; }
    });
    var emp = $('[data-empty-for="' + tableId + '"]'); if (emp) { emp.hidden = shown !== 0; }
    var cl = $('[data-shown-for="' + tableId + '"]'); if (cl) { cl.textContent = 'Showing ' + shown + ' of ' + total; }
    say('Showing ' + shown + ' of ' + total + '.');
    store('ash.b.filter.' + tableId, JSON.stringify(ctr.map(function (c) { return c.value; })));
  }
  d.addEventListener('input', function (e) { var c = e.target.closest('[data-filter-for]'); if (c) { applyFilters(c.getAttribute('data-filter-for')); } });
  d.addEventListener('change', function (e) { var c = e.target.closest('select[data-filter-for]'); if (c) { applyFilters(c.getAttribute('data-filter-for')); } });
  d.addEventListener('submit', function (e) { var f = e.target.closest('form[data-filter-form]'); if (f) { e.preventDefault(); } });

  /* queue: restore filter, sort and scroll when you come Back (rule 21) */
  var qt = d.getElementById('queue-table');
  if (qt) {
    var saved = store('ash.b.filter.queue-table');
    var ctrs = $$('[data-filter-for="queue-table"]');
    if (saved && params.get('back')) { try { JSON.parse(saved).forEach(function (v, i) { if (ctrs[i]) { ctrs[i].value = v; } }); applyFilters('queue-table'); var sc = store('ash.b.scroll'); if (sc) { window.scrollTo(0, +sc); } var sortState = store('ash.b.sort'); if (sortState) { var th = $$('th[aria-sort]', qt)[+sortState.split(':')[0]]; if (th) { var bt = $('button', th); if (bt) { bt.click(); if (sortState.split(':')[1] === 'descending') { bt.click(); } } } } } catch (x) {} }
    d.addEventListener('click', function (e) { if (e.target.closest('[data-open-return]')) { store('ash.b.stage', 'import'); store('ash.b.scroll', String(window.scrollY)); var ths = $$('th[aria-sort]', qt); ths.forEach(function (th, i) { var s = th.getAttribute('aria-sort'); if (s !== 'none') { store('ash.b.sort', i + ':' + s); } }); store('ash.b.queue-order', JSON.stringify(rowsOf(qt.parentNode.parentNode).map(function (r) { return r.getAttribute('data-id'); }))); } });
    var sel0 = params.get('select');
    if (sel0) { /* from search */ }
  }

  /* gap list: add from the bank clones a row and its pane item */
  d.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-bank]');
    if (!f) { return; }
    e.preventDefault();
    var sel = $('select', f), text = sel.options[sel.selectedIndex].text;
    var tbody = $('#gaps-table tbody'), n = $$('tr', tbody).length + 1, id = 'g' + n;
    var tr = $('template[data-tpl="gap-row"]').innerHTML.replace(/__ID__/g, id).replace(/__N__/g, n).replace(/__TEXT__/g, text);
    tbody.insertAdjacentHTML('beforeend', tr);
    var pane = $('.app-paneset[data-view="gaps"]');
    pane.insertAdjacentHTML('afterbegin', $('template[data-tpl="gap-item"]').innerHTML.replace(/__ID__/g, id).replace(/__N__/g, n).replace(/__TEXT__/g, text));
    recount();
    layoutItem($('[data-item="' + id + '"]', pane));
    select(id, { focus: true });
    say('Question ' + n + ' added from the bank. It is open for review.');
  });

  /* ---------- keys: every single key repeats a visible control; keys that approve, send, unmark or delete only move focus ---------- */
  d.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (e.key === 'Escape' && selected) { var vv = activeView(); var tr = vv && rowFor(vv, selected.id); var rb = tr && $('[data-row]', tr); if (rb && !(tag === 'input' || tag === 'textarea')) { rb.focus(); } return; }
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) { return; }
    if (e.ctrlKey || e.metaKey || e.altKey || keysOff()) { return; }
    var k = e.key;
    if (k === '/') { var q = $('#site-search'); if (q) { e.preventDefault(); q.focus(); } return; }
    if (k === '?') { var kd = $('#keys-details'); if (kd) { kd.open = true; kd.scrollIntoView({ block: 'nearest' }); } return; }
    if ((k === 'n' || k === 'p') && $('.app-ws[data-return], #queue-table')) { e.preventDefault(); next(k === 'n' ? 1 : -1, { nearest: true }); return; }
    var el = $$('[data-key="' + k.toLowerCase() + '"]', activePane() || d).filter(function (x) { return x.offsetParent !== null; })[0];
    if (el) {
      e.preventDefault();
      if (el.getAttribute('data-key-mode') === 'focus') { el.focus(); } else { el.click(); }
    }
  });

  $$('.app-item').forEach(layoutItem);
  applyStage();
  applyHold();
  if ($('.app-ws[data-return]')) { route(true); }
  else if ($('#queue-table')) {
    /* the queue peek */
    var firstRow = $('#queue-table tbody tr[data-id]');
    var want = params.get('select');
    var pid = want || (firstRow && firstRow.getAttribute('data-id'));
    var view = $('.app-view');
    if (view && pid) { selected = null; var pane = $('.app-paneset'); if (pane) { /* queue uses same select() */ } select(pid, { focus: !!want }); }
  }
})();
