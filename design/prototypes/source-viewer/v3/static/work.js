/* Work-page behaviour shared by every record tab: select a row and show its sources in the one viewer, keep the second
   window in step (a checkbox remembers the choice for each person), resize the pane, keys from D01's one list, filter,
   record tabs as client routes (0 loads, own URL, scroll and filter kept per tab), the selection in the URL, and one
   shared "decide and next". The hooks come from hosts.js. */
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
    var band = document.getElementById('sv-winslot')
    var q = new URLSearchParams(location.search) // read once, before any route rewrites the URL
    var stateParam = q.get('state')
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'))
    var tabs = cfg.tabs
    var home = document.body.getAttribute('data-tab')
    var tab = tabs[home] ? home : cfg.defaultTab
    var viewerRef = null, refitT
    var memory = {} // per tab: the filter and the scroll, so Back returns to the list as it was (rule 21)
    if (sp) initSplitter(split, sp, function () { clearTimeout(refitT); refitT = setTimeout(function () { if (viewerRef) viewerRef.refit() }, 60) })
    SV.wireKeysToggle()

    var win = null
    var origin = null
    var filterQ = ''
    function paneHidden() { return split.classList.contains('app-split--no-pane') }
    var viewer = new SV.Viewer(document.getElementById('sv-root'), {
      list: tabs[tab].list, role: 'pane',
      onBack: function () { backToList() },
      onChange: function (id, idx) { markRows(id); syncUrl(); if (win) win.push(); if (cfg.onChange) cfg.onChange(id, idx, viewer) },
      extra: cfg.extra ? function (it, sid, v) { return cfg.extra(it, sid, v, api) } : null,
      noteFor: cfg.noteFor ? function (it, v) { return cfg.noteFor(it, v, api) } : null,
      slotHost: function () { if (band) band.textContent = ''; return paneHidden() ? band : null },
      afterRender: function () { if (band) band.hidden = !paneHidden() || !band.firstChild },
      isMarked: cfg.isMarked, emptyHelp: cfg.emptyHelp,
    })
    viewerRef = viewer
    var h1 = document.getElementById('sv-h1')
    var f = document.getElementById('sv-filter')

    function activePanel() { return panels.filter(function (p) { return !p.hidden })[0] || document }
    /* the list the filter, the caption and the keys work on: the changed cells of the void state are their own small table */
    function rowsNow() { return Array.prototype.slice.call(activePanel().querySelectorAll('[data-item]')).filter(function (r) { return !r.closest('[data-nofilter]') }) }
    function visibleRows() { return rowsNow().filter(function (r) { return !r.hidden }) }
    function rowById(id) { return document.querySelector('[data-item="' + id + '"]') }
    function markRows(id) {
      document.querySelectorAll('[data-item]').forEach(function (r) {
        var sel = r.getAttribute('data-item') === id
        r.classList.toggle('app-row--selected', sel)
        var b = r.querySelector('[data-open]')
        if (b) { if (sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') }
        if (b && cfg.openLabel) b.firstChild.textContent = cfg.openLabel(r.getAttribute('data-list'), r.getAttribute('data-item'), sel)
      })
    }
    function rowName(r) { var th = r.querySelector('th'); return th ? th.firstChild.textContent.replace(/\s+/g, ' ').trim() : 'this row' }

    /* the selection lives in the URL, by replaceState, so no history entry (rules 18, 21) */
    function urlFor(x) {
      var p = new URLSearchParams()
      if (stateParam) p.set('state', stateParam)
      if (x.item) { p.set('item', x.item); p.set('src', x.pos || '1') }
      if (x.q) p.set('q', x.q)
      var s = p.toString()
      return x.tab + '.html' + (s ? '?' + s : '')
    }
    function syncUrl() {
      try { history.replaceState({ tab: tab }, '', urlFor({ tab: tab, item: viewer.itemId, pos: viewer.pos(), q: filterQ })) } catch (e) { /* no URL state in this sandbox */ }
    }
    function announce(msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg }, 30) } }

    function select(id, o) {
      o = o || {}
      var row = rowById(id)
      if (row) viewer.list = row.getAttribute('data-list')
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
      if (cfg.beforeSelect) cfg.beforeSelect(id)
      var want = o.focusIn !== false
      // the remembered choice: the first source shown in this page session opens the window, on this click or key (a user gesture, never on load)
      if (want && win && SV.winPref() && !narrow.matches && (win.state === undefined || win.state === 'none')) win.open()
      viewer.show(id, o.idx || 0, { focusIn: want && !paneHidden() })
      if (want && paneHidden()) { var it = SV.itemOf(viewer.list, id); announce('Showing the sources of ' + (it ? it.name : 'this figure') + ' in the second window.') }
    }
    function moveRow(rows, d, noun) {
      var ids = rows.map(function (r) { return r.getAttribute('data-item') })
      var i = ids.indexOf(viewer.itemId)
      var n = i < 0 ? (d > 0 ? 0 : rows.length - 1) : i + d
      if (!rows.length) { announce('No ' + noun + ' in this list'); return false }
      if (n < 0 || n >= rows.length) { announce(d > 0 ? 'Last ' + noun + ' in the list' : 'First ' + noun + ' in the list'); return false }
      origin = rows[n].querySelector('[data-open]')
      select(ids[n], { focusIn: true })
      rows[n].scrollIntoView({ block: 'nearest' })
      if (paneHidden() && origin) origin.focus({ preventScroll: true })
      return true
    }
    function nounOf() { return (tabs[tab] || {}).noun || 'number' }
    function moveItem(d) { return moveRow(visibleRows(), d, nounOf()) }
    /* the next flag after the number in hand, in list order, even when that number is not flagged itself */
    function moveFlag(d) {
      var all = visibleRows(), at = -1, i
      for (i = 0; i < all.length; i++) if (all[i].getAttribute('data-item') === viewer.itemId) at = i
      var flags = all.filter(function (r, k) { return r.hasAttribute('data-flagged') && (at < 0 || (d > 0 ? k > at : k < at)) })
      if (!flags.length) { announce(d > 0 ? 'Last flag in the list' : 'First flag in the list'); return false }
      return moveRow([d > 0 ? flags[0] : flags[flags.length - 1]], 0, 'flag')
    }
    function backToList() {
      if (narrow.matches) split.setAttribute('data-view', 'list')
      if (origin) origin.focus()
    }
    /* o: open the source of the number in hand: the row with focus, else the selected row, else the first */
    function openSource() {
      var ae = document.activeElement, row = ae && ae.closest ? ae.closest('[data-item]') : null
      var vis = visibleRows()
      if (!row || row.hidden) row = (viewer.itemId && rowById(viewer.itemId) && !rowById(viewer.itemId).hidden) ? rowById(viewer.itemId) : vis[0]
      if (!row) { announce('No number to open'); return }
      origin = row.querySelector('[data-open]')
      select(row.getAttribute('data-item'), { focusIn: true })
      // the key is a user gesture: with the second window turned on for this person it opens again, even after it was closed
      if (win && win.state === 'closed' && SV.winPref() && !narrow.matches) win.open()
      if (win && win.alive) { win.open(); announce('Second window brought forward, showing the source of ' + rowName(row) + '.') }
      else if (paneHidden() && origin) origin.focus({ preventScroll: true })
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
        if (!o.focusViewer || paneHidden()) b.focus({ preventScroll: true })
        return nxt
      }
      var d = document.getElementById('sv-done-' + tab)
      if (d) { d.hidden = false; d.focus(); announce(d.textContent.trim()) }
      return null
    }
    var api = {
      select: select, viewer: viewer, announce: announce, rows: rowsNow, visibleRows: visibleRows, rowById: rowById, markRows: markRows, nextUnhandled: nextUnhandled,
      advance: advance, backToList: backToList, paneHidden: paneHidden, syncUrl: syncUrl, tab: function () { return tab }, state: stateParam, route: function (n) { route(n) },
      win: function () { return win },
    }

    document.querySelectorAll('[data-item]').forEach(function (r) {
      var b = r.querySelector('[data-open]')
      if (!b) return
      b.addEventListener('click', function () {
        origin = b
        var id = r.getAttribute('data-item')
        var nm = rowName(r)
        // the source of this row is already shown: go straight to it (no redraw, so the click always has a visible effect)
        var shown = viewer.itemId === id && !paneHidden() && (document.getElementById('sv-box-pane') || document.getElementById('sv-card-pane'))
        // the window follows and already shows it: bring the second window to the front, and say so
        if (viewer.itemId === id && paneHidden() && win) { win.open(); announce('Second window brought forward, showing the source of ' + nm + '.'); return }
        if (shown) { shown.focus({ preventScroll: true }); announce('The source of ' + nm + ' is in view'); return }
        select(id, { focusIn: true })
      })
    })
    document.querySelectorAll('[data-fig-nav]').forEach(function (b) { b.addEventListener('click', function () { moveItem(parseInt(b.getAttribute('data-fig-nav'), 10)) }) })
    document.querySelectorAll('[data-flag-nav]').forEach(function (b) { b.addEventListener('click', function () { moveFlag(parseInt(b.getAttribute('data-flag-nav'), 10)) }) })

    // filter (rule 21), kept in the URL, with a caption that always says "Showing N of M"
    function applyFilter(value, quiet) {
      filterQ = value
      var qv = value.trim().toLowerCase(), shown = 0, rows = rowsNow()
      rows.forEach(function (r) { var ok = !qv || r.textContent.toLowerCase().indexOf(qv) >= 0; r.hidden = !ok; if (ok) shown++ })
      var none = document.getElementById('sv-filter-none'), count = document.getElementById('sv-filter-count')
      if (none) none.hidden = shown !== 0
      if (count) { count.textContent = 'Showing ' + shown + ' of ' + rows.length; count.setAttribute('data-count', 'shown-' + tab) }
      if (!quiet) announce('Showing ' + shown + ' of ' + rows.length)
      syncUrl()
    }
    if (f) f.addEventListener('input', function () { applyFilter(f.value) })

    // second window (rule 20): opened only by a click or a key, remembered per signed-in person
    var status = document.getElementById('sv-win-status')
    var openBtn = document.getElementById('sv-open-window')
    var pref = document.getElementById('sv-win-pref')
    var lastText = '', quietUntil = 0 // after the person changes the choice, the sentence about it is the one announced
    function setWinText(st, follow) {
      follow = follow !== false
      var hide = st === 'open' && follow && !narrow.matches
      var was = paneHidden()
      split.classList.toggle('app-split--no-pane', hide)
      if (was !== hide) viewer.show(viewer.itemId, viewer.idx, { silent: true }) // the decision slot moves between the pane and the work column
      var msg = {
        none: SV.winPref() ? 'Second window: on for you. It opens when you show a source or press o.' : 'Second window: off.',
        open: follow ? 'Second window: open, following. The list uses the full width.' : 'Second window: open, not following. Sources show here.',
        closed: 'Window closed, open again.',
        blocked: 'The browser blocked the second window. Allow pop-ups for this site, then open it again.',
      }[st || 'none']
      if (status && msg !== lastText) { status.textContent = msg; if (Date.now() > quietUntil) announce(msg) }
      lastText = msg
      if (cfg.onWindowState) cfg.onWindowState(st, follow)
    }
    win = new SV.SecondWindow({
      url: 'window.html',
      getState: function () { return { item: viewer.itemId, idx: viewer.idx, list: viewer.list, extras: viewer.extras, recordTab: tab } },
      onState: setWinText,
      onWindowStep: function (id, idx) { if (id === viewer.itemId) { viewer.show(id, idx, { silent: true }); syncUrl() } },
    })
    setWinText('none')
    if (openBtn) openBtn.addEventListener('click', function () { win.open() })
    if (pref) {
      pref.checked = SV.winPref()
      pref.addEventListener('change', function () {
        SV.setWinPref(pref.checked)
        quietUntil = Date.now() + 2500
        if (pref.checked) { if (win.alive) win.attach(); win.open() } // a click is a user gesture: turning it on opens it now, or brings it forward
        else win.detach()
        setWinText(win.state || 'none', win.follow)
        var said = pref.checked ? 'Second window turned on for ' + SV.person().name + ', and remembered.' : 'Second window turned off for ' + SV.person().name + ', and remembered.'
        announce(said)
        setTimeout(function () { announce(said) }, 700) // the source change that follows is quiet; this sentence is the one left in the live region
      })
    }

    // record tabs are client routes: 0 loads, own URL, the window gets the new list
    function setNouns(t) {
      document.querySelectorAll('[data-noun]').forEach(function (n) { n.textContent = t.noun })
      var anyFlag = !!activePanel().querySelector('[data-flagged]')
      document.querySelectorAll('[data-flag-nav]').forEach(function (b) { b.hidden = !anyFlag })
      document.querySelectorAll('[data-fig-nav]').forEach(function (b) { b.hidden = rowsNow().length < 2 })
      var lab = document.getElementById('sv-filter-label'); if (lab && lab.lastChild) lab.lastChild.textContent = ' ' + t.filterWhat
    }
    function route(name, o) {
      o = o || {}
      var t = tabs[name]
      if (!t) return
      if (tab && !o.init) memory[tab] = { q: filterQ, scroll: work ? work.scrollTop : 0 }
      if (!o.pop && !o.init) { try { history.pushState({ tab: name }, '', urlFor({ tab: name, q: (memory[name] || {}).q })) } catch (e) { /* no URL state in this sandbox */ } } // first, so the entry we leave keeps its own URL
      tab = name
      document.body.setAttribute('data-tab', name)
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name })
      if (h1) h1.textContent = t.h1
      var i = document.title.indexOf(', ')
      document.title = t.h1 + (i >= 0 ? document.title.slice(i) : '')
      document.querySelectorAll('[data-route]').forEach(function (a) { if (a.getAttribute('data-route') === name && a.closest('.moj-sub-navigation')) a.setAttribute('aria-current', 'page'); else if (a.closest('.moj-sub-navigation')) a.removeAttribute('aria-current') })
      viewer.list = t.list
      viewer.itemId = null
      viewer.idx = 0
      viewer.render()
      markRows(null)
      setNouns(t)
      var mem = memory[name] || { q: o.init ? (q.get('q') || '') : '', scroll: 0 }
      if (f) f.value = mem.q
      applyFilter(mem.q, true)
      if (work) work.scrollTop = mem.scroll
      if (win) win.push()
      if (cfg.onRoute) cfg.onRoute(name, api)
      if (!o.init) announce(t.h1 + ' tab')
    }
    document.querySelectorAll('[data-route]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return
        e.preventDefault()
        var name = a.getAttribute('data-route')
        if (tab !== name) { route(name); return }
        // the tab you are on: back to the top of its list, focus on its heading (a link never does nothing, rule 8)
        if (work) work.scrollTop = 0
        if (h1) h1.focus({ preventScroll: true })
        announce(tabs[name].h1 + ' tab, top of the list')
      })
    })
    window.addEventListener('popstate', function (e) { route((e.state && e.state.tab) || home, { pop: true }) })
    route(tab, { init: true })

    // keys (rules 10, 22): from D01's one list; none of these approves, unmarks, sends or deletes
    var keys = {}
    keys[']'] = function () { viewer.step(1) }
    keys['['] = function () { viewer.step(-1) }
    keys.m = function () { moveItem(1) }
    keys.n = function () { moveFlag(1) }
    keys.p = function () { moveFlag(-1) }
    keys.o = openSource
    keys.s = function () { var s = document.getElementById('sv-search'); if (s) { s.focus(); s.select() } }
    keys.Escape = function () { backToList() }
    if (cfg.keys) { var more = cfg.keys(api); Object.keys(more).forEach(function (k) { keys[k] = more[k] }) }
    SV.bindKeys(keys)
    narrow.addEventListener('change', function () { setWinText(win.state || 'none', win.follow) })

    // restore: the URL first (item, source, filter), then the saved scroll of the list
    if (cfg.restore) cfg.restore(api)
    if (q.get('item') && rowById(q.get('item'))) {
      var id = q.get('item'), row = rowById(id)
      origin = row.querySelector('[data-open]')
      viewer.list = row.getAttribute('data-list')
      viewer.itemId = id
      viewer.show(id, viewer.idxFromPos(q.get('src')), { focusIn: false })
      markRows(id)
      if (narrow.matches) split.setAttribute('data-view', 'viewer')
    }
    var skey = 'sv-scroll:' + home
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
