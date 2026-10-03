/* Prototype behaviour only: pick a number, show its trace and source, step sources, follow on a second window,
   single-key shortcuts that repeat a visible control (rule 10). No data leaves the page. */
(function () {
  document.documentElement.classList.add('js-enabled');
  var channel = ('BroadcastChannel' in window) ? new BroadcastChannel('ashbridge-source') : null;
  var current = null, srcIndex = 0;

  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function sourcesFor(id) { return all('[data-source^="' + id + ':"]'); }

  function showSource(id, k, fromRemote) {
    var list = sourcesFor(id);
    all('[data-source]').forEach(function (el) { el.hidden = true; });
    all('[data-nosource]').forEach(function (el) { el.hidden = (el.getAttribute('data-nosource') !== id); });
    if (!list.length) { srcIndex = 0; } else {
      if (k < 0) k = list.length - 1; if (k >= list.length) k = 0;
      srcIndex = k;
      var el = document.querySelector('[data-source="' + id + ':' + k + '"]');
      if (el) el.hidden = false;
    }
    var capEl = list.length ? document.querySelector('[data-source="' + id + ':' + srcIndex + '"] .app-caption') : null;
    all('[data-caption-target]').forEach(function (t) { t.textContent = 'Current source: ' + (capEl ? capEl.textContent : 'Not checked: no evidence'); });
    if (!fromRemote && channel) channel.postMessage({ id: id, k: srcIndex });
  }

  function select(id, fromRemote) {
    current = id;
    all('[data-row]').forEach(function (r) {
      var on = r.getAttribute('data-row') === id;
      r.classList.toggle('is-selected', on);
      var b = r.querySelector('[data-pick]');
      if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    all('[data-trace]').forEach(function (t) { t.hidden = (t.getAttribute('data-trace') !== id); });
    showSource(id, 0, fromRemote);
    var live = document.getElementById('app-live');
    var row = document.querySelector('[data-row="' + id + '"]');
    if (live && row) live.textContent = 'Selected ' + (row.getAttribute('data-label') || id);
  }

  function step(dir) {
    var rows = all('[data-row]');
    if (!rows.length) return;
    var i = rows.findIndex(function (r) { return r.getAttribute('data-row') === current; });
    i = Math.max(0, Math.min(rows.length - 1, i + dir));
    select(rows[i].getAttribute('data-row'));
    var b = rows[i].querySelector('[data-pick]'); if (b) b.focus();
  }
  function curSection() { var r = current && document.querySelector('[data-row="' + current + '"]'); return r ? r.getAttribute('data-section') : null; }
  function markFor() { var s = curSection(); return (s && document.querySelector('[data-mark][data-section="' + s + '"]')) || document.querySelector('[data-mark]'); }
  function nextSection() {
    var rows = all('[data-row][data-section]'); var s = curSection();
    var nxt = rows.find(function (r) { return r.getAttribute('data-section') !== s && rows.indexOf(r) > rows.findIndex(function (x) { return x.getAttribute('data-row') === current; }); });
    if (!nxt) return;
    select(nxt.getAttribute('data-row')); var b = nxt.querySelector('[data-pick]'); if (b) b.focus();
  }
  function nextFlag() {
    var rows = all('[data-row][data-flagged]');
    if (!rows.length) return;
    var order = all('[data-row]');
    var ci = order.findIndex(function (r) { return r.getAttribute('data-row') === current; });
    var nxt = rows.find(function (r) { return order.indexOf(r) > ci; }) || rows[0];
    select(nxt.getAttribute('data-row'));
    var b = nxt.querySelector('[data-pick]'); if (b) b.focus();
  }

  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]');
    if (p) { select(p.closest('[data-row]').getAttribute('data-row')); }
    var n = e.target.closest('[data-src-next]'); if (n && current) showSource(current, srcIndex + 1);
    var pr = e.target.closest('[data-src-prev]'); if (pr && current) showSource(current, srcIndex - 1);
    var m = e.target.closest('[data-mark]');
    if (m) {
      var on = m.getAttribute('aria-pressed') !== 'true';
      m.setAttribute('aria-pressed', on ? 'true' : 'false');
      m.textContent = on ? 'Reviewed by Zo. Take mark off' : 'Mark section Reviewed';
      var secName = m.getAttribute('data-section');
      var tag = document.querySelector('[data-mark-state]' + (secName ? '[data-section="' + secName + '"]' : ''));
      if (tag) { tag.textContent = on ? 'Reviewed by Zo, just now' : 'Not reviewed'; tag.className = 'govuk-tag ' + (on ? 'govuk-tag--green' : 'govuk-tag--grey'); }
    }
    var g = e.target.closest('[data-goto]'); if (g && current) showSource(current, +g.getAttribute('data-goto'));
    if (e.target.closest('[data-step-next]')) step(1);
    if (e.target.closest('[data-step-prev]')) step(-1);
    if (e.target.closest('[data-next-flag]')) nextFlag();
    if (e.target.closest('[data-next-section]')) nextSection();
    var o = e.target.closest('[data-open-source]');
    if (o) { e.preventDefault(); window.open(o.getAttribute('href') + (current ? '#' + current + ':' + srcIndex : ''), 'ashbridge-source', 'popup=yes,width=900,height=900'); }
  });

  var off = document.getElementById('keys-off');
  if (off) {
    off.checked = sessionStorage.getItem('keysOff') === '1';
    off.addEventListener('change', function () { sessionStorage.setItem('keysOff', off.checked ? '1' : '0'); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (off && off.checked) return;
    var key = e.key, link;
    if (key === 'j') step(1);
    else if (key === 'k') step(-1);
    else if (key === 'f') nextFlag();
    else if (key === ']' && current) showSource(current, srcIndex + 1);
    else if (key === '[' && current) showSource(current, srcIndex - 1);
    else if (key === 'o') { link = document.querySelector('[data-open-source]'); if (link) link.click(); }
    else if (key === 'c') { link = document.querySelector('[data-key="c"]'); if (link) link.click(); }
    else if (key === 'n') { link = document.querySelector('[data-key="n"]'); if (link) link.click(); else nextSection(); }
    else if (key === 'r') { link = markFor(); if (link) link.click(); }
    else if (key === 'a') { link = document.querySelector('[data-key="a"]'); if (link) link.click(); }
    else return;
    e.preventDefault();
  });

  /* Second window: follow the main window */
  var follow = document.getElementById('follow');
  if (channel && document.body.hasAttribute('data-source-window')) {
    channel.onmessage = function (m) {
      if (follow && !follow.checked) return;
      current = m.data.id; showSource(m.data.id, m.data.k, true);
      var live = document.getElementById('app-live'); if (live) live.textContent = 'Source updated';
    };
  }
  if (channel && !document.body.hasAttribute('data-source-window')) {
    channel.onmessage = function (m) { /* source window pressed Next or Previous */
      if (m.data.from === 'window' && current === m.data.id) showSource(m.data.id, m.data.k, true);
    };
  }
  if (document.body.hasAttribute('data-source-window')) {
    document.addEventListener('click', function (e) {
      if ((e.target.closest('[data-src-next]') || e.target.closest('[data-src-prev]')) && channel && current) {
        channel.postMessage({ id: current, k: srcIndex, from: 'window' });
      }
    });
    var fromHash = function () { var h = location.hash.slice(1).split(':'); if (h[0] && document.querySelector('[data-source^="' + h[0] + ':"]')) { current = h[0]; showSource(current, +h[1] || 0, true); return true; } return false; };
    if (!fromHash()) { var first = document.querySelector('[data-source]'); if (first) { current = first.getAttribute('data-source').split(':')[0]; showSource(current, 0, true); } }
    window.addEventListener('hashchange', fromHash);
  } else {
    var hashRow = location.hash && document.querySelector('[data-row="' + location.hash.slice(1) + '"]');
    var sel = hashRow || document.querySelector('[data-row].is-selected') || document.querySelector('[data-row]');
    if (sel) select(sel.getAttribute('data-row'), true);
  }
})();
