/* Work-page behaviour shared by every version: select a row, show its sources in the one viewer, keep the
   second window in step, resize the pane, keys, filter. Version scripts pass hooks. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA

  function initSplitter(split, sp) {
    var min = 360
    function maxW() { return Math.max(min, split.clientWidth - 24 - 240) }
    function set(w, quiet) {
      w = Math.max(min, Math.min(maxW(), w))
      split.style.setProperty('--app-pane-w', w + 'px')
      sp.setAttribute('aria-valuenow', String(Math.round(w)))
      sp.setAttribute('aria-valuemax', String(Math.round(maxW())))
      if (!quiet) SV.store('sv-pane-w', String(Math.round(w)))
    }
    function cur() { return parseInt(sp.getAttribute('aria-valuenow'), 10) || 480 }
    var saved = parseInt(SV.store('sv-pane-w') || '', 10)
    sp.setAttribute('aria-valuemin', String(min))
    set(saved || 480, true)
    sp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(cur() + 24) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); set(cur() - 24) }
      else if (e.key === 'Home') { e.preventDefault(); set(min) }
      else if (e.key === 'End') { e.preventDefault(); set(maxW()) }
      else if (e.key === 'Enter') { e.preventDefault(); set(480) }
    })
    sp.addEventListener('pointerdown', function (e) {
      e.preventDefault(); sp.focus()
      function move(ev) { set(split.getBoundingClientRect().right - ev.clientX - 12) }
      function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up) }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up)
    })
    window.addEventListener('resize', function () { set(cur(), true) })
  }

  function initWork(cfg) {
    var split = document.getElementById('app-split')
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-item]'))
    var live = document.getElementById('sv-live')
    var narrow = window.matchMedia('(max-width: 600px)')
    var sp = document.getElementById('app-splitter')
    if (sp) initSplitter(split, sp)
    SV.wireKeysToggle()

    var win = null
    var viewer = new SV.Viewer(document.getElementById('sv-root'), {
      list: cfg.list, layout: cfg.layout, role: 'pane',
      openWindow: cfg.windowUrl ? function () { openWin() } : null,
      onBack: function () { backToList() },
      onChange: function (id, idx) { markRows(id); if (win) win.push(); if (cfg.onChange) cfg.onChange(id, idx, viewer) },
      extra: cfg.extra ? function (it, sid, v) { return cfg.extra(it, sid, v, api) } : null,
      isMarked: cfg.isMarked, emptyHelp: cfg.emptyHelp,
    })
    var origin = null

    function visibleRows() { return rows.filter(function (r) { return !r.hidden }) }
    function markRows(id) {
      rows.forEach(function (r) {
        var sel = r.getAttribute('data-item') === id
        r.classList.toggle('app-row--selected', sel)
        var b = r.querySelector('[data-open]')
        if (b) { if (sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') }
        if (b && cfg.openLabel) b.firstChild.textContent = cfg.openLabel(r.getAttribute('data-item'), sel)
      })
    }
    function select(id, o) {
      o = o || {}
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
      if (cfg.beforeSelect) cfg.beforeSelect(id)
      viewer.show(id, o.idx || 0, { focusIn: o.focusIn !== false })
      if (win) win.push()
    }
    function moveItem(d, focusIn) {
      var vis = visibleRows(), i = vis.map(function (r) { return r.getAttribute('data-item') }).indexOf(viewer.itemId)
      var n = i < 0 ? (d > 0 ? 0 : vis.length - 1) : i + d
      if (n < 0 || n >= vis.length) { announce(d > 0 ? 'Last figure in the list' : 'First figure in the list'); return }
      origin = vis[n].querySelector('[data-open]')
      select(vis[n].getAttribute('data-item'), { focusIn: focusIn })
      vis[n].scrollIntoView({ block: 'nearest' })
    }
    function announce(msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg }, 30) } }
    function backToList() {
      if (narrow.matches) split.setAttribute('data-view', 'list')
      if (origin) origin.focus()
    }
    var api = { select: select, viewer: viewer, announce: announce, rows: rows, visibleRows: visibleRows, markRows: markRows, nextRow: nextRow, backToList: backToList }

    function nextRow(fromId) {
      var vis = visibleRows(), i = vis.map(function (r) { return r.getAttribute('data-item') }).indexOf(fromId)
      return vis[i + 1] || vis[i - 1] || null
    }

    rows.forEach(function (r) {
      var b = r.querySelector('[data-open]')
      if (!b) return
      b.addEventListener('click', function () { origin = b; select(r.getAttribute('data-item'), { focusIn: true }) })
    })

    Array.prototype.forEach.call(document.querySelectorAll('[data-fig-nav]'), function (b) { b.addEventListener('click', function () { moveItem(parseInt(b.getAttribute('data-fig-nav'), 10), true) }) })

    // filter (rule 21)
    var f = document.getElementById('sv-filter')
    if (f) {
      var count = document.getElementById('sv-filter-count'), none = document.getElementById('sv-filter-none')
      f.addEventListener('input', function () {
        var q = f.value.trim().toLowerCase(), shown = 0
        rows.forEach(function (r) { var ok = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.hidden = !ok; if (ok) shown++ })
        if (none) none.hidden = shown !== 0
        if (count) count.textContent = 'Showing ' + shown + ' of ' + rows.length
        announce('Showing ' + shown + ' of ' + rows.length)
      })
    }

    // second window
    var status = document.getElementById('sv-win-status')
    var openBtn = document.getElementById('sv-open-window')
    function setWinText(st) {
      if (!status) return
      status.textContent = ''
      var msg = {
        none: 'Second window: not open.',
        open: 'Second window: open. It follows every selection.',
        closed: 'Window closed, open again.',
        blocked: 'The browser blocked the second window. Allow pop-ups for this site, then open it again.',
      }[st]
      status.appendChild(document.createTextNode(msg))
      if (cfg.onWindowState) cfg.onWindowState(st)
      announce(msg)
    }
    if (cfg.windowUrl) {
      win = new SV.SecondWindow({
        url: cfg.windowUrl,
        getState: function () { return { item: viewer.itemId, idx: viewer.idx, list: cfg.list, extras: viewer.extras } },
        onState: setWinText,
        onWindowStep: function (id, idx) { if (id === viewer.itemId) viewer.show(id, idx, { silent: true }) },
      })
      setWinText('none')
      if (openBtn) openBtn.addEventListener('click', function () { openWin() })
    }
    function openWin() { if (win) win.open() }

    // sign out closes the second window first
    var so = document.getElementById('sv-signout')
    if (so) so.addEventListener('click', function () { if (win) win.signOut() })

    // keys (rule 10, 22): none of these approves, unmarks, sends or deletes
    SV.bindKeys({
      ']': function () { viewer.step(1) },
      '[': function () { viewer.step(-1) },
      j: function () { if (cfg.figNav !== false) moveItem(1, true) },
      k: function () { if (cfg.figNav !== false) moveItem(-1, true) },
      o: function () { if (cfg.windowUrl) openWin() },
      Escape: function () { backToList() },
    })

    // deep link for states, read once, no history entry
    var q = new URLSearchParams(location.search)
    if (q.get('item')) {
      var id = q.get('item')
      origin = (document.querySelector('[data-item="' + id + '"] [data-open]'))
      viewer.show(id, parseInt(q.get('src') || '0', 10) - 1 || 0, { focusIn: false })
      markRows(id)
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
    }
    return api
  }

  window.SV.initWork = initWork
})()
