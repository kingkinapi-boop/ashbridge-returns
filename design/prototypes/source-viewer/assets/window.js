/* The second window: the same viewer, following the work page through a BroadcastChannel (rule 20).
   States: waiting, following, not following (Follow off), work page closed, signed out. */
(function () {
  'use strict'
  var SV = window.SV, D = window.SV_DATA

  function initWindow(cfg) {
    var root = document.getElementById('sv-root')
    var msg = document.getElementById('sv-win-msg')
    var follow = document.getElementById('sv-follow')
    var title = cfg.title
    var viewer = null, curList = cfg.list, pending = null, gotAny = false
    var ch = ('BroadcastChannel' in window) ? new BroadcastChannel(SV.CHANNEL) : null

    function say(text, link) {
      msg.textContent = ''
      msg.appendChild(document.createTextNode(text))
      if (link) { msg.appendChild(document.createTextNode(' ')); msg.appendChild(SV.h('a', { class: 'govuk-link', href: link[1] }, link[0])) }
    }
    function make(list) {
      curList = list
      viewer = new SV.Viewer(root, {
        list: list, layout: cfg.layout, role: 'window',
        onChange: function (id, idx) { if (ch && follow.checked) ch.postMessage({ t: 'step', item: id, idx: idx }) },
      })
    }
    function apply(m, focus) {
      if (!viewer || curList !== m.list) make(m.list)
      viewer.extras = m.extras || {}
      if (!m.item) { viewer.show(null, 0, { silent: true }); return }
      viewer.show(m.item, m.idx || 0, { silent: true, focusIn: !!focus })
      var it = SV.itemOf(m.list, m.item)
      document.title = 'Source window: ' + it.name + ', ' + title
      say('Following the work page. Showing: ' + it.name + '.')
    }
    function onSelect(m) {
      gotAny = true
      if (follow.checked) { apply(m, false); pending = null }
      else { pending = m; var it = m.item ? SV.itemOf(m.list, m.item) : null; say('Not following. The work page is now on ' + (it ? it.name : 'no figure') + '. Turn Follow on to catch up.') }
    }
    follow.checked = true
    follow.addEventListener('change', function () {
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
        if (m.t === 'select') onSelect(m)
        if (m.t === 'signout') { try { window.close() } catch (x) {} location.replace(cfg.signedOut) }
        if (m.t === 'workclosed') say('The work page was closed. This window keeps the last source.', ['Open the work page again', cfg.workUrl])
      }
      ch.postMessage({ t: 'hello' })
      window.addEventListener('pagehide', function () { ch.postMessage({ t: 'closing' }) })
    }
    setTimeout(function () {
      if (gotAny) return
      var last = SV.store('sv-last')
      if (last) { try { onSelect(JSON.parse(last)) } catch (x) {} }
      if (!gotAny) say('No work page found.', ['Open the work page', cfg.workUrl])
    }, 900)

    SV.wireKeysToggle()
    SV.bindKeys({
      ']': function () { if (viewer) viewer.step(1) },
      '[': function () { if (viewer) viewer.step(-1) },
      Escape: function () { follow.focus() },
    })
  }
  window.SV.initWindow = initWindow
})()
