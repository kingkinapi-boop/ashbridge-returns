/* Version A: the CPA review. Docked pane with numbered steps; the CPA marks each source as supporting the figure.
   The decision slot (extra) holds "Supports this figure, next source"; the key m does the same and never unmarks. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var marks = {}
  try { marks = JSON.parse(SV.sstore('sv-marks') || '{}') } catch (e) { marks = {} }
  function key(item, sid) { return item + ':' + sid }
  function isMarked(item, sid) { return !!marks[key(item, sid)] }
  function save() { SV.sstore('sv-marks', JSON.stringify(marks)) }
  function figDone(id) {
    var it = SV.itemOf('cpa', id)
    if (!it.src.length) return true // nothing to mark: it stays "Not checked: no evidence" and is skipped
    return it.src.every(function (s) { return isMarked(id, s) })
  }

  function status(it) {
    var n = it.src.length
    if (it.flag) return ['govuk-tag--red', 'Flagged for a person'] // marking sources never clears a flag
    if (!n) return ['govuk-tag--orange', 'Not checked: no evidence']
    var m = it.src.filter(function (s) { return isMarked(it.id, s) }).length
    if (m === n) return ['govuk-tag--green', 'Checked']
    if (m > 0) return ['govuk-tag--blue', 'Checking, ' + m + ' of ' + n + ' sources']
    return ['govuk-tag--grey', 'Not checked']
  }
  function refresh() {
    var checked = 0
    D.lists.cpa.forEach(function (it) {
      var cell = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      var st = status(it)
      if (st[1] === 'Checked') checked++
      if (cell) { cell.textContent = ''; cell.appendChild(h('strong', { class: 'govuk-tag ' + st[0], text: st[1] })) }
    })
    var c = document.getElementById('sv-checked')
    if (c) c.textContent = String(checked)
  }
  function openLabel(id, sel) {
    var it = SV.itemOf('cpa', id)
    return (sel ? 'Showing sources (' : 'Show sources (') + it.src.length + ')'
  }

  var api
  /* Reviewed, next (rule 22): marks the source in view, never unmarks, then the next source; on the last source the first
     source of this figure still unmarked, else the next unmarked figure, else the done message. */
  function markAndNext() {
    var v = api.viewer, it = v.item()
    if (!it) { api.announce('No figure selected'); return }
    var ids = v.ids(), sid = ids[v.idx]
    if (!sid || v.candMode) return
    var was = isMarked(it.id, sid)
    marks[key(it.id, sid)] = true
    save(); refresh()
    var n = ids.length
    if (v.idx < n - 1) { v.announce((was ? 'Already marked. ' : 'Marked. ') + 'Now source ' + (v.idx + 2) + ' of ' + n); v.step(1, { focusIn: true }); return }
    var left = -1
    ids.forEach(function (s, i) { if (left < 0 && !isMarked(it.id, s)) left = i })
    if (left >= 0) { v.announce('Marked. Source ' + (left + 1) + ' of ' + n + ' is not marked yet'); v.show(it.id, left, { focusIn: true }); return }
    v.announce('Marked. ' + it.name + ' is checked.')
    api.advance(it.id, figDone, { focusViewer: true })
  }

  api = SV.initWork({
    list: 'cpa', layout: 'strip', windowUrl: 'window.html', isMarked: isMarked, openLabel: openLabel,
    emptyHelp: 'The preparer\'s workbench holds the orphan list; this figure shows on it until a source or a written reason is cited.',
    extra: function (it, sid, v) {
      if (!sid) return null
      var foot = h('div', { class: 'app-viewer__foot' })
      var marked = isMarked(it.id, sid)
      foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'aria-keyshortcuts': 'm', onclick: markAndNext },
        marked ? 'Already marked, next source ' : 'Supports this figure, next source ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: 'm' })))
      if (marked) {
        foot.appendChild(h('span', { class: 'govuk-body-s', text: 'Marked by Dev Malhotra (Test), 1 Oct 2026.' }))
        foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { delete marks[key(it.id, sid)]; save(); refresh(); v.render({}); v.announce('Mark removed from this source') } }, 'Remove mark'))
      }
      return foot
    },
    keys: function () { return { m: markAndNext } },
  })
  refresh()
})()
