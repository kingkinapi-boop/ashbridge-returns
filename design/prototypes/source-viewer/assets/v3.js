/* Version C: window first, for two monitors. While the second window is open and following, the pane hides and the list
   takes the full width (done in work.js for every version), with a one-line summary of the source now open. With no window,
   the same viewer docks at the right. Complete and Chase sit in the viewer's decision slot and in the row. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var state = {}
  try { state = JSON.parse(SV.sstore('sv-ops') || '{}') } catch (e) { state = {} }
  function done(id) { return !!state[id] }
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
  var sum = document.getElementById('sv-summary')
  function summary(id, idx) {
    sum.textContent = ''
    if (!id) { sum.appendChild(h('p', { text: 'No item open. Choose "Show sources" on a row. It opens in the second window when that is open, and beside this list when it is not.' })); return }
    var it = SV.itemOf('ops', id), ids = it.src
    var s = ids.length ? SV.src(ids[idx]) : null
    sum.appendChild(h('p', {}, h('strong', { text: it.name + ': ' }), s ? 'source ' + (idx + 1) + ' of ' + ids.length + ', ' + SV.KIND[s.kind][0] + ', ' + s.title + (s.page ? ', ' + s.page : '') + '. ' + s.who + ', ' + s.when + '.' : 'Not checked: no evidence.'))
  }
  var api
  function decide(id, act) {
    var it = SV.itemOf('ops', id)
    state[id] = act
    SV.sstore('sv-ops', JSON.stringify(state))
    refresh()
    api.announce(it.name + (act === 'done' ? ' marked complete.' : ' set to chase the client.'))
    var v = api.viewer
    if (!api.advance(id, done, { focusViewer: false }) && v.itemId === id) v.show(id, v.idx, { silent: true })
  }
  api = SV.initWork({
    list: 'ops', layout: 'strip', windowUrl: 'window.html', figNav: true,
    openLabel: function (id, sel) { var it = SV.itemOf('ops', id); return (sel ? 'Showing sources (' : 'Show sources (') + it.src.length + ')' },
    onChange: function (id, idx) { summary(id, idx) },
    emptyHelp: 'Nothing was received for this item. Chase the client; the item stays unchecked until a file arrives.',
    extra: function (it, sid, v) {
      var foot = h('div', { class: 'app-viewer__foot' })
      if (state[it.id]) { foot.appendChild(h('span', { class: 'govuk-body-s', text: 'Decision: ' + (state[it.id] === 'done' ? 'Complete.' : 'Chasing the client.') })); return foot }
      if (it.src.length) foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', onclick: function () { decide(it.id, 'done') } }, 'Complete', h('span', { class: 'govuk-visually-hidden', text: ' ' + it.name })))
      foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { decide(it.id, 'chase') } }, 'Chase', h('span', { class: 'govuk-visually-hidden', text: ' the client about ' + it.name })))
      return foot
    },
  })
  summary(api.viewer.itemId, api.viewer.idx)
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () { decide(b.closest('[data-item]').getAttribute('data-item'), b.getAttribute('data-act')) })
  })
  if (D.lists.ops.every(function (x) { return done(x.id) })) { var d = document.getElementById('sv-done'); if (d) d.hidden = false }
  refresh()
})()
