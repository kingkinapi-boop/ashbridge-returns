/* The second window: the same viewer as a full page, following the work page through a BroadcastChannel (rule 20).
   Opened only by a click or a key on the work page (window.open with a name, no noopener), never on load.
   Two-way link: it says hello on load, answers every work-hello, beats every 2 s, follows the last work page of the same
   return that sent a selection and ignores another return's. States in words: waiting, following, not following
   (Follow off), the work page closed, the second window turned off on the work page. Sign-out is handled by signout.js. */
(function () {
  'use strict'
  var SV = window.SV, D = window.SV_DATA, RET = SV.RET
  var TABNAME = { workbench: 'Workbench', review: 'Review', documents: 'Documents', exceptions: 'Exceptions', ops: 'Ops' }
  var WORK = { workbench: 'workbench.html', review: 'review.html', documents: 'documents.html', exceptions: 'exceptions.html', ops: 'ops.html' }

  var root = document.getElementById('sv-root')
  var msg = document.getElementById('sv-win-msg')
  var follow = document.getElementById('sv-follow')
  var viewer = null, curList = 'cpa', pending = null, gotAny = false, activeTab = null, lastWork = 0, closedMsg = false, recordTab = null
  var tabs = {}
  var ch = ('BroadcastChannel' in window) ? new BroadcastChannel(SV.CHANNEL) : null
  var q = new URLSearchParams(location.search)
  var ret = q.get('ret') || RET
  var P = SV.person()
  var base = ' - Ashbridge Tax'
  var who = document.querySelector('.app-bar-who')
  if (who) who.textContent = 'Signed in: ' + P.name + ', ' + P.role
  document.title = 'Source window, ' + D.client.name + ', year end ' + D.client.ye + base

  function workUrl() { return WORK[recordTab] || 'review.html' }
  function say(text, link) {
    var key = text + (link ? '|' + link[1] : '')
    if (msg.getAttribute('data-text') === key) return
    msg.setAttribute('data-text', key)
    msg.textContent = ''
    msg.appendChild(document.createTextNode(text))
    if (link) { msg.appendChild(document.createTextNode(' ')); msg.appendChild(SV.h('a', { class: 'govuk-link', href: link[1] }, link[0])) }
  }
  function followingText() { return 'Following the work page' + (recordTab ? ', ' + TABNAME[recordTab] + ' tab' : '') + '.' }
  function make(list) {
    curList = list
    viewer = new SV.Viewer(root, {
      list: list, role: 'window',
      onChange: function (id, idx) { if (ch && follow.checked && activeTab) ch.postMessage({ t: 'step', ret: ret, target: activeTab, item: id, idx: idx }) },
    })
  }
  function apply(m, focus) {
    if (!viewer || curList !== m.list) make(m.list)
    viewer.extras = m.extras || {}
    recordTab = m.recordTab || recordTab
    if (!m.item) {
      viewer.show(null, 0, { silent: true })
      document.title = 'Source window, ' + D.client.name + ', year end ' + D.client.ye + base
      say('Following the work page. No figure is selected there.')
      return
    }
    viewer.show(m.item, m.idx || 0, { silent: true, focusIn: !!focus })
    var it = SV.itemOf(m.list, m.item)
    document.title = 'Source window: ' + (it ? it.name : 'figure') + ', ' + D.client.name + ', year end ' + D.client.ye + base
    SV.syncErrorTitle() // the title was just rewritten: it starts "Error: " again while the failed page image shows
    say(followingText())
  }
  function onSelect(m) {
    gotAny = true; closedMsg = false; lastWork = Date.now()
    if (m.tab) { activeTab = m.tab; tabs[m.tab] = Date.now() }
    if (follow.checked) { apply(m, false); pending = null } else {
      pending = m
      var it = m.item ? SV.itemOf(m.list, m.item) : null
      say('Not following. The work page is now on ' + (it ? it.name : 'no figure') + '. Turn Follow on to catch up.')
    }
  }
  function hello() { if (ch) ch.postMessage({ t: 'win-hello', ret: ret, follow: follow.checked }) }
  function beat() { if (ch) ch.postMessage({ t: 'win-beat', ret: ret, follow: follow.checked }) }
  follow.checked = true
  follow.addEventListener('change', function () {
    if (ch) ch.postMessage({ t: 'win-follow', ret: ret, follow: follow.checked })
    if (follow.checked && pending) { apply(pending, false); pending = null } else if (follow.checked) say(followingText())
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
      if (m.t === 'work-beat') {
        lastWork = Date.now(); if (m.tab) tabs[m.tab] = Date.now()
        if (closedMsg && gotAny) { closedMsg = false; say(follow.checked ? followingText() : 'Not following. This window stays on the source it shows now.') }
      }
      if (m.t === 'work-detach') {
        // the work page turned the second window off: stop following, so its pane takes the source back
        follow.checked = false
        ch.postMessage({ t: 'win-follow', ret: ret, follow: false })
        say('The second window was turned off on the work page. This window keeps the last source and no longer follows.')
      }
      if (m.t === 'work-attach') {
        follow.checked = true
        ch.postMessage({ t: 'win-follow', ret: ret, follow: true })
        if (pending) { apply(pending, false); pending = null } else say(followingText())
      }
      if (m.t === 'workclosed') {
        delete tabs[m.tab]
        if (!Object.keys(tabs).length && gotAny) { closedMsg = true; say('The work page was closed. This window keeps the last source.', ['Open the work page again', workUrl()]) }
      }
    }
    hello()
    setInterval(function () {
      beat()
      if (gotAny && !closedMsg && Date.now() - lastWork > 6000) { closedMsg = true; say('The work page was closed. This window keeps the last source.', ['Open the work page again', workUrl()]) }
    }, 2000)
    window.addEventListener('pagehide', function () { ch.postMessage({ t: 'closing', ret: ret }) })
  }
  // opened by hand, or reloaded: the work page's last state, then the plain "no work page" words
  setTimeout(function () {
    if (gotAny) return
    var last = SV.store('sv-last')
    if (last) { try { var s = JSON.parse(last); if (s && s.list) onSelect(s) } catch (x) { /* ignore a bad saved state */ } }
    if (!gotAny) say('No work page found.', ['Open the work page', workUrl()])
  }, 900)

  SV.wireKeysToggle()
  var keys = {}
  keys[']'] = function () { if (viewer) viewer.step(1) }
  keys['['] = function () { if (viewer) viewer.step(-1) }
  keys.Escape = function () { follow.focus() }
  SV.bindKeys(keys)
  var rs
  window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { if (viewer) viewer.refit() }, 80) })
})()
