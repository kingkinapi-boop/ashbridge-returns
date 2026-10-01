/* Version C: window first, for two monitors. The work page keeps a one-line summary; the viewer lives in the second window.
   If the window is not open, the same viewer docks at the right as the laptop fallback. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var state = {}
  function refresh() {
    var left = 0
    D.lists.ops.forEach(function (it) {
      var st = state[it.id]
      if (!st) left++
      var c = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      var m = st === 'done' ? ['govuk-tag--green', 'Complete'] : st === 'chase' ? ['govuk-tag--blue', 'Chasing the client'] : (it.src.length ? ['govuk-tag--grey', 'Not checked'] : ['govuk-tag--orange', 'Not checked: no evidence'])
      if (c) { c.textContent = ''; c.appendChild(h('strong', { class: 'govuk-tag ' + m[0], text: m[1] })) }
    })
    var n = document.getElementById('sv-left'); if (n) n.textContent = String(left)
  }
  var split = document.getElementById('app-split')
  var winOpen = false
  function layoutPane() { split.classList.toggle('app-split--no-pane', winOpen) }
  var sum = document.getElementById('sv-summary')
  function summary(id, idx) {
    sum.textContent = ''
    if (!id) { sum.appendChild(h('p', { text: 'No item open. Choose "Show sources" on a row. It opens in the second window when that is open, and beside this list when it is not.' })); return }
    var it = SV.itemOf('ops', id), ids = it.src
    var s = ids.length ? SV.src(ids[idx]) : null
    sum.appendChild(h('p', {}, h('strong', { text: it.name + ': ' }), s ? 'source ' + (idx + 1) + ' of ' + ids.length + ', ' + SV.KIND[s.kind][0] + ', ' + s.title + (s.page ? ', ' + s.page : '') + '. ' + s.who + ', ' + s.when + '.' : 'Not checked: no evidence.'))
  }
  var api = SV.initWork({
    list: 'ops', layout: 'strip', windowUrl: 'window.html', figNav: true,
    openLabel: function (id, sel) { var it = SV.itemOf('ops', id); return (sel ? 'Showing sources (' : 'Show sources (') + it.src.length + ')' },
    onChange: function (id, idx) { summary(id, idx) },
    onWindowState: function (st) { winOpen = st === 'open'; layoutPane() },
    emptyHelp: 'Nothing was received for this item. Chase the client; the item stays unchecked until a file arrives.',
  })
  summary(api.viewer.itemId, api.viewer.idx)
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = b.closest('[data-item]'), id = row.getAttribute('data-item')
      var nxt = api.nextRow(id)
      state[id] = b.getAttribute('data-act')
      refresh()
      var verb = state[id] === 'done' ? 'marked complete' : 'set to chase the client'
      api.announce(row.querySelector('th').textContent + ' ' + verb + '.')
      if (nxt) { var ob = nxt.querySelector('[data-open]'); ob.focus() } else { document.getElementById('sv-done').hidden = false; document.getElementById('sv-done').focus() }
    })
  })
  refresh()
})()
