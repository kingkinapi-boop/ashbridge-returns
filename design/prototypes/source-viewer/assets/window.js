/* The second window: the same viewer, following the work page through a BroadcastChannel (rule 20).
   One layout (the numbered strip) for every family. Two-way link: it says hello on load, answers every work-hello, beats
   every 2 s, follows the last work page of the same return that sent a selection, and ignores another return.
   States: waiting, following, not following (Follow off), work page closed. Sign-out is handled by signout.js. */
(function () {
  'use strict'
  var SV = window.SV, RET = SV.RET

  function initWindow(cfg) {
    var root = document.getElementById('sv-root')
    var msg = document.getElementById('sv-win-msg')
    var follow = document.getElementById('sv-follow')
    var title = cfg.title
    var viewer = null, curList = cfg.list, pending = null, gotAny = false, activeTab = null, lastWork = 0, closedMsg = false
    var tabs = {}
    var ch = ('BroadcastChannel' in window) ? new BroadcastChannel(SV.CHANNEL) : null
    var q = new URLSearchParams(location.search)
    var ret = q.get('ret') || RET

    function say(text, link) {
      if (msg.getAttribute('data-text') === text && !link) return
      msg.setAttribute('data-text', text)
      msg.textContent = ''
      msg.appendChild(document.createTextNode(text))
      if (link) { msg.appendChild(document.createTextNode(' ')); msg.appendChild(SV.h('a', { class: 'govuk-link', href: link[1] }, link[0])) }
    }
    function make(list) {
      curList = list
      viewer = new SV.Viewer(root, {
        list: list, layout: 'strip', role: 'window',
        onChange: function (id, idx) { if (ch && follow.checked && activeTab) ch.postMessage({ t: 'step', ret: ret, target: activeTab, item: id, idx: idx }) },
      })
    }
    function apply(m, focus) {
      if (!viewer || curList !== m.list) make(m.list)
      viewer.extras = m.extras || {}
      if (!m.item) { viewer.show(null, 0, { silent: true }); say('Following the work page. No figure is selected there.'); return }
      viewer.show(m.item, m.idx || 0, { silent: true, focusIn: !!focus })
      var it = SV.itemOf(m.list, m.item)
      document.title = 'Source window: ' + it.name + ', ' + title
      say('Following the work page.')
    }
    function onSelect(m) {
      gotAny = true; closedMsg = false; lastWork = Date.now()
      if (m.tab) { activeTab = m.tab; tabs[m.tab] = Date.now() }
      if (follow.checked) { apply(m, false); pending = null }
      else { pending = m; var it = m.item ? SV.itemOf(m.list, m.item) : null; say('Not following. The work page is now on ' + (it ? it.name : 'no figure') + '. Turn Follow on to catch up.') }
    }
    function hello() { if (ch) ch.postMessage({ t: 'win-hello', ret: ret, follow: follow.checked }) }
    follow.checked = true
    follow.addEventListener('change', function () {
      if (ch) ch.postMessage({ t: 'win-follow', ret: ret, follow: follow.checked })
      if (follow.checked && pending) { apply(pending, false); pending = null }
      else if (follow.checked) say('Following the work page.')
      else say('Not following. This window stays on the source it shows now.')
    })

    make(curList)
    viewer.show(null, 0, { silent: true })
    say('Waiting for the work page.')

    if (ch) {
      ch.onmessage = function (e) {
        var m = e.data || {}
        if (m.ret !== ret) return // another return's page never drives this window
        if (m.t === 'select') onSelect(m)
        if (m.t === 'work-hello') { lastWork = Date.now(); if (m.tab) tabs[m.tab] = Date.now(); hello() }
        if (m.t === 'work-beat') { lastWork = Date.now(); if (m.tab) tabs[m.tab] = Date.now(); if (closedMsg && gotAny) { closedMsg = false; say(follow.checked ? 'Following the work page.' : 'Not following. This window stays on the source it shows now.') } }
        if (m.t === 'workclosed') {
          delete tabs[m.tab]
          if (!Object.keys(tabs).length && gotAny) { closedMsg = true; say('The work page was closed. This window keeps the last source.', ['Open the work page again', cfg.workUrl]) }
        }
      }
      hello()
      setInterval(function () {
        hello2()
        if (gotAny && !closedMsg && Date.now() - lastWork > 6000) { closedMsg = true; say('The work page was closed. This window keeps the last source.', ['Open the work page again', cfg.workUrl]) }
      }, 2000)
      window.addEventListener('pagehide', function () { ch.postMessage({ t: 'closing', ret: ret }) })
    }
    function hello2() { if (ch) ch.postMessage({ t: 'win-beat', ret: ret, follow: follow.checked }) }
    setTimeout(function () {
      if (gotAny) return
      var last = SV.store('sv-last')
      if (last) { try { onSelect(JSON.parse(last)) } catch (x) { /* ignore a bad saved state */ } }
      if (!gotAny) say('No work page found.', ['Open the work page', cfg.workUrl])
    }, 900)

    SV.wireKeysToggle()
    var keys = SV.zoomKeys(function () { return viewer })
    keys[']'] = function () { if (viewer) viewer.step(1) }
    keys['['] = function () { if (viewer) viewer.step(-1) }
    keys.Escape = function () { follow.focus() }
    SV.bindKeys(keys)
    var rs
    window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { if (viewer) viewer.refit() }, 80) })
  }
  window.SV.initWindow = initWindow
})()
