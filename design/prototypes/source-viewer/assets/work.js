/* Work-page behaviour shared by every version: select a row, show its sources in the one viewer, keep the second window in
   step, resize the pane, keys, filter, record tabs as client routes, the selection in the URL, and one shared
   "decide and next" (fix round 1). Version scripts pass hooks. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA

  function initSplitter(split, sp, onChange) {
    var min = 360
    function maxW() { return Math.max(min, split.clientWidth - 24 - 240) }
    function set(w, quiet) {
      w = Math.max(min, Math.min(maxW(), w))
      split.style.setProperty('--app-pane-w', w + 'px')
      sp.setAttribute('aria-valuenow', String(Math.round(w)))
      sp.setAttribute('aria-valuemax', String(Math.round(maxW())))
      if (!quiet) SV.store('sv-pane-w', String(Math.round(w)))
      if (onChange) onChange()
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
    var work = document.querySelector('.app-split__work')
    var live = document.getElementById('sv-live')
    var narrow = window.matchMedia('(max-width: 600px)')
    var sp = document.getElementById('app-splitter')
    var q = new URLSearchParams(location.search) // read once, before any route rewrites the URL
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'))
    var routes = cfg.tabs || null
    var tab = routes ? (q.get('tab') || cfg.defaultTab) : null
    if (routes && !routes[tab]) tab = cfg.defaultTab
    var viewerRef = null
    var refitT
    if (sp) initSplitter(split, sp, function () { clearTimeout(refitT); refitT = setTimeout(function () { if (viewerRef) viewerRef.refit() }, 60) })
    SV.wireKeysToggle()

    var win = null
    var viewer = new SV.Viewer(document.getElementById('sv-root'), {
      list: routes ? routes[tab].list : cfg.list, layout: cfg.layout, role: 'pane',
      onBack: function () { backToList() },
      onChange: function (id, idx) { markRows(id); syncUrl(); if (win) win.push(); if (cfg.onChange) cfg.onChange(id, idx, viewer) },
      extra: cfg.extra ? function (it, sid, v) { return cfg.extra(it, sid, v, api) } : null,
      isMarked: cfg.isMarked, emptyHelp: cfg.emptyHelp,
    })
    viewerRef = viewer
    var origin = null
    var filterQ = ''

    function activeRoot() { return panels.length ? (panels.filter(function (p) { return !p.hidden })[0] || document) : document }
    function rowsNow() { return Array.prototype.slice.call(activeRoot().querySelectorAll('[data-item]')) }
    function visibleRows() { return rowsNow().filter(function (r) { return !r.hidden }) }
    function paneHidden() { return split.classList.contains('app-split--no-pane') }
    function markRows(id) {
      document.querySelectorAll('[data-item]').forEach(function (r) {
        var sel = r.getAttribute('data-item') === id
        r.classList.toggle('app-row--selected', sel)
        var b = r.querySelector('[data-open]')
        if (b) { if (sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') }
        if (b && cfg.openLabel && viewer.list === listOfRow(r)) b.firstChild.textContent = cfg.openLabel(r.getAttribute('data-item'), sel)
      })
    }
    function listOfRow(r) { var p = r.closest('[data-panel]'); return p && routes ? routes[p.getAttribute('data-panel')].list : cfg.list }

    /* the selection lives in the URL, by replaceState, so no history entry (rules 18, 21) */
    function urlFor(extra) {
      var q = new URLSearchParams()
      if (routes && extra.tab && extra.tab !== cfg.defaultTab) q.set('tab', extra.tab)
      if (extra.item) { q.set('item', extra.item); q.set('src', String((extra.idx || 0) + 1)) }
      if (extra.q) q.set('q', extra.q)
      var s = q.toString()
      return location.pathname + (s ? '?' + s : '')
    }
    function syncUrl() {
      try { history.replaceState({ tab: tab }, '', urlFor({ tab: tab, item: viewer.itemId, idx: viewer.idx, q: filterQ })) } catch (e) { /* file or sandbox: no URL state */ }
    }

    function select(id, o) {
      o = o || {}
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
      if (cfg.beforeSelect) cfg.beforeSelect(id)
      var want = o.focusIn !== false
      viewer.show(id, o.idx || 0, { focusIn: want && !paneHidden() })
      if (want && paneHidden()) { var it = SV.itemOf(viewer.list, id); announce('Showing the sources of ' + (it ? it.name : 'this figure') + ' in the second window.') }
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

    /* one shared next (rules 19 and 22): the next unhandled row after this one in list order, then the first unhandled
       above, else the "all done" message gets focus and is announced */
    function nextUnhandled(fromId, isDone) {
      var vis = visibleRows(), ids = vis.map(function (r) { return r.getAttribute('data-item') })
      var i = ids.indexOf(fromId), j
      for (j = i + 1; j < vis.length; j++) if (!isDone(ids[j])) return vis[j]
      for (j = 0; j < i; j++) if (!isDone(ids[j])) return vis[j]
      return null
    }
    function advance(fromId, isDone, o) {
      o = o || {}
      var nxt = nextUnhandled(fromId, isDone)
      if (nxt) {
        var b = nxt.querySelector('[data-open]')
        origin = b
        nxt.scrollIntoView({ block: 'nearest' })
        select(nxt.getAttribute('data-item'), { focusIn: !!o.focusViewer })
        if (!o.focusViewer || paneHidden()) b.focus()
        return nxt
      }
      var d = document.getElementById('sv-done')
      if (d) { d.hidden = false; d.focus(); announce(d.textContent) }
      return null
    }
    var api = { select: select, viewer: viewer, announce: announce, rows: rowsNow, visibleRows: visibleRows, markRows: markRows, nextUnhandled: nextUnhandled, advance: advance, backToList: backToList, paneHidden: paneHidden, syncUrl: syncUrl }

    document.querySelectorAll('[data-item]').forEach(function (r) {
      var b = r.querySelector('[data-open]')
      if (!b) return
      b.addEventListener('click', function () { origin = b; select(r.getAttribute('data-item'), { focusIn: true }) })
    })
    Array.prototype.forEach.call(document.querySelectorAll('[data-fig-nav]'), function (b) { b.addEventListener('click', function () { moveItem(parseInt(b.getAttribute('data-fig-nav'), 10), true) }) })

    // filter (rule 21), kept in the URL
    var f = document.getElementById('sv-filter')
    function applyFilter(value, quiet) {
      filterQ = value
      var q = value.trim().toLowerCase(), shown = 0, rows = rowsNow()
      rows.forEach(function (r) { var ok = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.hidden = !ok; if (ok) shown++ })
      var none = document.getElementById('sv-filter-none'), count = document.getElementById('sv-filter-count')
      if (none) none.hidden = shown !== 0
      if (count) count.textContent = 'Showing ' + shown + ' of ' + rows.length
      if (!quiet) announce('Showing ' + shown + ' of ' + rows.length)
      syncUrl()
    }
    if (f) f.addEventListener('input', function () { applyFilter(f.value) })

    // second window
    var status = document.getElementById('sv-win-status')
    var openBtn = document.getElementById('sv-open-window')
    var lastText = ''
    function setWinText(st, follow) {
      follow = follow !== false
      var hide = st === 'open' && follow && !narrow.matches
      var was = paneHidden()
      split.classList.toggle('app-split--no-pane', hide)
      if (was && !hide) viewer.show(viewer.itemId, viewer.idx, { silent: true }) // the pane comes back: fit it again
      var msg = {
        none: 'Second window: not open.',
        open: follow ? 'Second window: open, following. The list uses the full width.' : 'Second window: open, not following. The source shows here.',
        closed: 'Window closed, open again.',
        blocked: 'The browser blocked the second window. Allow pop-ups for this site, then open it again.',
      }[st]
      if (status && msg !== lastText) { status.textContent = msg; announce(msg) }
      lastText = msg
      if (cfg.onWindowState) cfg.onWindowState(st, follow)
    }
    if (cfg.windowUrl) {
      win = new SV.SecondWindow({
        url: cfg.windowUrl,
        getState: function () { return { item: viewer.itemId, idx: viewer.idx, list: viewer.list, extras: viewer.extras } },
        onState: setWinText,
        onWindowStep: function (id, idx) { if (id === viewer.itemId) { viewer.show(id, idx, { silent: true }); syncUrl() } },
      })
      setWinText('none')
      if (openBtn) openBtn.addEventListener('click', function () { win.open() })
    }

    // record tabs are client routes: 0 loads, own URL, the window gets the new list
    function route(name, o) {
      o = o || {}
      var t = routes[name]
      if (!t) return
      if (!o.pop && !o.init) { try { history.pushState({ tab: name }, '', urlFor({ tab: name })) } catch (e) { /* no URL state */ } } // first, so the entry we leave keeps its own URL
      tab = name
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name })
      var h1 = document.getElementById('sv-h1')
      if (h1) h1.textContent = t.h1
      var i = document.title.indexOf(', ')
      document.title = t.h1 + (i >= 0 ? document.title.slice(i) : '')
      document.querySelectorAll('[data-route]').forEach(function (a) { if (a.getAttribute('data-route') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') })
      viewer.list = t.list
      viewer.itemId = null
      viewer.idx = 0
      viewer.render()
      markRows(null)
      filterQ = ''
      if (f && !o.init) { f.value = ''; applyFilter('', true) }
      if (win) win.push()
      if (cfg.onRoute) cfg.onRoute(name)
      if (!o.init) announce(t.h1 + ' tab')
    }
    if (routes) {
      document.querySelectorAll('[data-route]').forEach(function (a) {
        a.addEventListener('click', function (e) { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); if (tab !== a.getAttribute('data-route')) route(a.getAttribute('data-route')) })
      })
      window.addEventListener('popstate', function (e) { route((e.state && e.state.tab) || cfg.defaultTab, { pop: true }) })
      route(tab, { init: true })
    }

    // keys (rule 10, 22): none of these approves, unmarks, sends or deletes
    var keys = SV.zoomKeys(function () { return viewer })
    keys[']'] = function () { viewer.step(1) }
    keys['['] = function () { viewer.step(-1) }
    keys.j = function () { if (cfg.figNav !== false) moveItem(1, true) }
    keys.k = function () { if (cfg.figNav !== false) moveItem(-1, true) }
    keys.o = function () { if (win) win.open() }
    keys.Escape = function () { backToList() }
    if (cfg.keys) { var more = cfg.keys(api); Object.keys(more).forEach(function (k) { keys[k] = more[k] }) }
    SV.bindKeys(keys)
    narrow.addEventListener('change', function () { if (win) setWinText(win.state || 'none', win.follow) })

    // restore: the URL first (item, source, filter), then the saved scroll of the list
    if (cfg.restore) cfg.restore(api)
    if (q.get('q') && f) { f.value = q.get('q'); applyFilter(q.get('q'), true) }
    if (q.get('item')) {
      var id = q.get('item')
      origin = document.querySelector('[data-item="' + id + '"] [data-open]')
      viewer.show(id, (parseInt(q.get('src') || '1', 10) || 1) - 1, { focusIn: false })
      markRows(id)
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
    }
    var skey = 'sv-scroll:' + location.pathname
    if (work) {
      var sv = parseInt(SV.sstore(skey) || '0', 10)
      if (sv) work.scrollTop = sv
      var st
      work.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { SV.sstore(skey, String(work.scrollTop)) }, 150) })
    }
    return api
  }

  window.SV.initWork = initWork
})()
