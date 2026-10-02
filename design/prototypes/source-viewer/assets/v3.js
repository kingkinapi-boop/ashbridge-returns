/* Version C: window first, for two monitors. While the second window is open and following, the pane hides and the list
   takes the full width (done in work.js for every version), with a one-line summary of the source now open. With no window,
   the same viewer docks at the right. Complete and Chase sit in the viewer's decision slot and in the row. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var state = {}
  try { state = JSON.parse(SV.sstore('sv-ops') || '{}') } catch (e) { state = {} }
  function done(id) { return !!state[id] }
  var log = []
  try { log = JSON.parse(SV.sstore('sv-ops-log') || '[]') } catch (e) { log = [] }

  /* Undo asks for a reason, in place (rules 9, 19): one field, the summary at the top of the form, page scroll kept.
     The same form serves the row and the viewer's decision slot (fix round 2, D3). */
  function undoForm(it, where) {
    var pre = 'undo-' + where + '-' + it.id
    var form = h('form', { class: 'app-undo', id: pre, novalidate: 'novalidate', hidden: true, 'aria-label': 'Undo the decision on ' + it.name })
    var box = h('div', { class: 'govuk-form-group' },
      h('label', { class: 'govuk-label', for: pre + '-why' }, 'Reason for undoing this decision ', h('span', { class: 'app-req', 'aria-hidden': 'true', text: '*' }), h('span', { class: 'govuk-visually-hidden', text: ' (required)' })),
      h('textarea', { class: 'govuk-textarea', id: pre + '-why', name: 'reason', rows: '2' }))
    form.appendChild(box)
    var acts = h('div', { class: 'app-actions' },
      h('button', { type: 'submit', class: 'govuk-button govuk-button--warning app-button-compact' }, 'Undo the decision', h('span', { class: 'govuk-visually-hidden', text: ' on ' + it.name })),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { closeUndo(form, where, it.id) } }, 'Cancel', h('span', { class: 'govuk-visually-hidden', text: ' undo' })))
    form.appendChild(acts)
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var ta = form.querySelector('textarea'), why = ta.value.trim()
      var old = form.querySelector('.app-undo-sum'); if (old) old.remove()
      var oldm = box.querySelector('.govuk-error-message'); if (oldm) oldm.remove()
      if (why.length < 5) {
        var msg = 'Write the reason for undoing the decision on ' + it.name
        var sum = h('div', { class: 'govuk-error-summary app-undo-sum', role: 'alert', tabindex: '-1' },
          h('div', { class: 'govuk-error-summary__body' }, h('h3', { class: 'govuk-error-summary__title', text: 'There is a problem' }),
            h('ul', { class: 'govuk-list govuk-error-summary__list' }, h('li', {}, h('a', { href: '#' + pre + '-why', onclick: function (ev) { ev.preventDefault(); ta.focus({ preventScroll: true }) } }, msg)))))
        form.insertBefore(sum, box)
        box.classList.add('govuk-form-group--error')
        box.insertBefore(h('p', { class: 'govuk-error-message', id: pre + '-err' }, h('span', { class: 'govuk-visually-hidden', text: 'Error: ' }), msg), ta)
        ta.classList.add('govuk-textarea--error')
        ta.setAttribute('aria-describedby', pre + '-err')
        if (!/^Error: /.test(document.title)) document.title = 'Error: ' + document.title
        sum.focus({ preventScroll: true })
        return
      }
      document.title = document.title.replace(/^Error: /, '')
      var was = state[it.id]
      delete state[it.id]
      SV.sstore('sv-ops', JSON.stringify(state))
      log.push({ id: it.id, was: was, reason: why })
      SV.sstore('sv-ops-log', JSON.stringify(log))
      refresh()
      var v = api.viewer
      if (v.itemId === it.id) v.show(it.id, v.idx, { silent: true })
      api.announce((was === 'done' ? 'Complete' : 'Chasing') + ' undone for ' + it.name + '. The reason is kept. The item is not checked again.')
      var row = document.querySelector('[data-item="' + it.id + '"]')
      var target = (row && row.querySelector('[data-act="done"]:not([hidden])')) || (row && row.querySelector('[data-act="chase"]:not([hidden])')) || (row && row.querySelector('[data-open]'))
      if (target) target.focus({ preventScroll: true })
    })
    return form
  }
  function closeUndo(form, where, id) {
    form.hidden = true
    var ta = form.querySelector('textarea'); ta.value = ''
    var s = form.querySelector('.app-undo-sum'); if (s) s.remove()
    var m = form.querySelector('.govuk-error-message'); if (m) m.remove()
    form.querySelector('.govuk-form-group').classList.remove('govuk-form-group--error')
    ta.classList.remove('govuk-textarea--error')
    document.title = document.title.replace(/^Error: /, '')
    var b = document.querySelector((where === 'row' ? '[data-item="' + id + '"] ' : '#sv-root ') + '[data-undo]')
    if (b) { b.setAttribute('aria-expanded', 'false'); b.focus({ preventScroll: true }) }
  }
  function openUndo(form, btn) {
    form.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    form.querySelector('textarea').focus({ preventScroll: true })
  }
  function undoButton(it, where, form) {
    var b = h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'data-undo': '', 'aria-expanded': 'false', onclick: function () { if (form.hidden) openUndo(form, b); else closeUndo(form, where, it.id) } }, 'Undo', h('span', { class: 'govuk-visually-hidden', text: ' the decision on ' + it.name }))
    return b
  }
  /* a decided row: no live Complete or Chase, a Undo and its reason form instead (V7: no second "Complete") */
  function rowActions() {
    D.lists.ops.forEach(function (it) {
      var row = document.querySelector('[data-item="' + it.id + '"]')
      var box = row && row.querySelector('.app-actions')
      if (!box) return
      var decided = !!state[it.id]
      Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (b) { b.hidden = decided })
      var u = box.querySelector('[data-undo]')
      if (decided && !u) {
        var f = undoForm(it, 'row')
        var ub = undoButton(it, 'row', f)
        box.appendChild(ub)
        box.parentNode.appendChild(f)
      } else if (!decided && u) {
        var f2 = box.parentNode.querySelector('.app-undo')
        u.remove(); if (f2) f2.remove()
      }
    })
  }
  function refresh() {
    rowActions()
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
      if (state[it.id]) {
        var uf = undoForm(it, 'slot')
        foot.appendChild(h('strong', { class: 'govuk-tag ' + (state[it.id] === 'done' ? 'govuk-tag--green' : 'govuk-tag--blue'), text: state[it.id] === 'done' ? 'Complete' : 'Chasing the client' }))
        foot.appendChild(undoButton(it, 'slot', uf))
        foot.appendChild(uf)
        return foot
      }
      if (it.src.length) foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: function () { decide(it.id, 'done') } }, 'Complete', h('span', { class: 'govuk-visually-hidden', text: ' ' + it.name })))
      foot.appendChild(h('button', { 'data-primary': it.src.length ? null : '', type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { decide(it.id, 'chase') } }, 'Chase', h('span', { class: 'govuk-visually-hidden', text: ' the client about ' + it.name })))
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
