/* Version A: the CPA review. Docked pane with numbered steps; the CPA marks each source as supporting the figure. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h
  var marks = {}
  try { marks = JSON.parse(SV.sstore('sv-marks') || '{}') } catch (e) {}
  function key(item, sid) { return item + ':' + sid }
  function isMarked(item, sid) { return !!marks[key(item, sid)] }
  function save() { SV.sstore('sv-marks', JSON.stringify(marks)) }

  function status(it) {
    var n = it.src.length
    if (it.flag) return ['govuk-tag--red', 'Flagged for a person']
    if (!n) return ['govuk-tag--orange', 'Not checked: no evidence']
    var m = it.src.filter(function (s) { return isMarked(it.id, s) }).length
    if (m === n) return ['govuk-tag--green', 'Checked']
    if (m > 0) return ['govuk-tag--blue', 'Checking, ' + m + ' of ' + n + ' sources']
    return ['govuk-tag--grey', 'Not checked']
  }
  function refresh() {
    var checked = 0
    window.SV_DATA.lists.cpa.forEach(function (it) {
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

  var api = SV.initWork({
    list: 'cpa', layout: 'strip', windowUrl: 'window.html', isMarked: isMarked, openLabel: openLabel,
    emptyHelp: 'The preparer\'s workbench holds the orphan list; this figure shows on it until a source or a written reason is cited.',
    extra: function (it, sid, v) {
      if (!sid) return null
      var foot = h('div', { class: 'app-viewer__foot' })
      if (isMarked(it.id, sid)) {
        foot.appendChild(h('p', { class: 'govuk-body-s', text: 'Marked as supporting this figure by Dev Malhotra (Test), 1 Oct 2026.' }))
        foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { delete marks[key(it.id, sid)]; save(); refresh(); v.render({}); v.announce('Mark removed from this source') } }, 'Remove mark'))
      } else {
        foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', onclick: function () {
          marks[key(it.id, sid)] = true; save(); refresh()
          var n = v.ids().length
          if (v.idx < n - 1) { v.announce('Marked. Now source ' + (v.idx + 2) + ' of ' + n); v.step(1, { focusIn: true }) }
          else { v.render({ focusIn: true }); v.announce('Marked. That was the last source of ' + it.name + '. Status: ' + status(it)[1]) }
        } }, 'Supports this figure, next source'))
      }
      return foot
    },
  })
  refresh()
})()
