/* Version B, second page: verify an extracted value (EV-6). The box and the words found inside it sit beside the list. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var state = {}
  function tag(st) {
    var m = { open: ['govuk-tag--grey', 'Not checked'], ok: ['govuk-tag--green', 'Accepted'], no: ['govuk-tag--red', 'Rejected'] }[st]
    return h('strong', { class: 'govuk-tag ' + m[0], text: m[1] })
  }
  function refresh() {
    var left = 0
    D.lists.verify.forEach(function (it) {
      var st = state[it.id] || 'open'
      if (st === 'open') left++
      var c = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      if (c) { c.textContent = ''; c.appendChild(tag(st)) }
    })
    var n = document.getElementById('sv-left'); if (n) n.textContent = String(left)
  }
  var api = SV.initWork({
    list: 'verify', layout: 'tabs', windowUrl: 'window.html', figNav: true,
    openLabel: function (id, sel) { return sel ? 'Showing the box' : 'Show the box' },
  })
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = b.closest('[data-item]'), id = row.getAttribute('data-item')
      state[id] = b.getAttribute('data-act')
      refresh()
      var nxt = null
      D.lists.verify.forEach(function (x) { if (!nxt && (state[x.id] || 'open') === 'open') nxt = x })
      var verb = state[id] === 'ok' ? 'accepted' : 'rejected'
      if (nxt) {
        var ob = document.querySelector('[data-item="' + nxt.id + '"] [data-open]')
        ob.focus(); ob.click()
        api.announce('Value on ' + row.querySelector('th').textContent + ' ' + verb + '. Now showing ' + nxt.name + '.')
      } else {
        var done = document.getElementById('sv-done'); if (done) { done.hidden = false; done.focus() }
        api.announce('Value ' + verb + '. All values checked.')
      }
    })
  })
  refresh()
})()
