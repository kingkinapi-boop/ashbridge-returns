/* Version B: the preparer's workbench. Sources as MOJ sub navigation tabs with previous and next; a figure with no source
   shows candidate sources and the picker beside them (RV-22), or a written reason. Two record tabs, Cite figures and Verify
   values, are client routes on this one page (0 loads). The decision slot (extra) holds the cite form, or Accept and Reject. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var cited = {}
  try { cited = JSON.parse(SV.sstore('sv-cited') || '{}') } catch (e) { cited = {} }
  var vstate = {}
  try { vstate = JSON.parse(SV.sstore('sv-verify') || '{}') } catch (e) { vstate = {} }
  var WHO = 'Anita Rao (Test)', TODAY = '1 Oct 2026'

  function dynSave(id, s) {
    var m = {}
    try { m = JSON.parse(localStorage.getItem('sv-dyn') || '{}') } catch (e) { m = {} }
    m[id] = s
    localStorage.setItem('sv-dyn', JSON.stringify(m))
  }
  function isCited(it) { return it.src.length > 0 || (cited[it.id] || []).length > 0 }
  function citedDone(id) { return isCited(SV.itemOf('prep', id)) }
  function refresh() {
    var left = 0
    D.lists.prep.forEach(function (it) {
      var cell = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      var ok = isCited(it)
      if (!ok) left++
      if (cell) { cell.textContent = ''; cell.appendChild(h('strong', { class: 'govuk-tag ' + (ok ? 'govuk-tag--green' : 'govuk-tag--orange'), text: ok ? 'Cited' : 'Needs a source or a reason' })) }
    })
    var c = document.getElementById('sv-left-cite')
    if (c) c.textContent = String(left)
    var vleft = 0
    D.lists.verify.forEach(function (it) {
      var st = vstate[it.id] || 'open'
      if (st === 'open') vleft++
      var cell = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      var m = { open: ['govuk-tag--grey', 'Not checked'], ok: ['govuk-tag--green', 'Accepted'], no: ['govuk-tag--red', 'Rejected'] }[st]
      if (cell) { cell.textContent = ''; cell.appendChild(h('strong', { class: 'govuk-tag ' + m[0], text: m[1] })) }
    })
    var vl = document.getElementById('sv-left-verify')
    if (vl) vl.textContent = String(vleft)
  }
  function openLabel(id, sel) {
    var it = SV.itemOf('prep', id) || SV.itemOf('verify', id)
    if (!it.cand && !D.lists.prep.some(function (x) { return x.id === id })) return sel ? 'Showing the box' : 'Show the box'
    var n = it.src.length + (cited[id] || []).length
    return (sel ? 'Showing ' : 'Show ') + (n ? 'sources (' + n + ')' : 'candidates (' + it.cand.length + ')')
  }

  var api
  function recorded(it, v, sid, what) {
    cited[it.id] = (cited[it.id] || []).concat([sid])
    SV.sstore('sv-cited', JSON.stringify(cited))
    v.addSource(it.id, sid)
    var nowN = v.ids().length
    refresh()
    var nxt = api.nextUnhandled(it.id, citedDone)
    var msg = what + ' for ' + it.name + ' recorded as source ' + nowN + ' of ' + nowN + '. ' + (nxt ? 'Next to cite: ' + nxt.querySelector('th').textContent.replace(/\s*\(tax choice\)/, '') + '.' : 'Nothing is left to cite.')
    v.show(it.id, nowN - 1, { focusIn: true, silent: false })
    v.announce(msg)
    var note = document.getElementById('sv-recorded')
    if (note) { note.textContent = msg; note.hidden = false }
    var b = document.getElementById('sv-next-orphan')
    if (b) {
      if (nxt) { b.textContent = 'Go to ' + nxt.querySelector('th').textContent.replace(/\s*\(tax choice\)/, ''); b.hidden = false; b.setAttribute('data-go', nxt.getAttribute('data-item')) }
      else b.hidden = true
    }
  }

  function citeForm(it, sid, v) {
    if (isCited(it) || !it.cand) return null
    var form = h('form', { class: 'app-viewer__foot app-viewer__foot--block', novalidate: 'novalidate', id: 'sv-cite' })
    form.setAttribute('aria-label', 'Cite ' + it.name)
    var errBox = h('div', { id: 'sv-cite-err' })
    form.appendChild(errBox)
    var row = h('div', { class: 'app-actions' })
    row.appendChild(h('button', { type: 'submit', class: 'govuk-button app-button-compact', name: 'cite', value: 'source' }, 'Cite the source shown (candidate ' + (v.idx + 1) + ' of ' + it.cand.length + ')'))
    row.appendChild(h('span', { class: 'govuk-body-s', text: 'Look at each candidate in the tabs first.' }))
    form.appendChild(row)
    var det = h('details', { class: 'govuk-details govuk-!-margin-top-2 govuk-!-margin-bottom-0', id: 'sv-reason-details' },
      h('summary', { class: 'govuk-details__summary' }, h('span', { class: 'govuk-details__summary-text', text: 'Write a reason instead' })),
      h('div', { class: 'govuk-details__text' },
        h('div', { class: 'govuk-form-group', id: 'sv-reason-group' },
          h('label', { class: 'govuk-label', for: 'sv-reason' }, 'Reason (required)'),
          h('div', { class: 'govuk-hint', id: 'sv-reason-hint', text: 'Say what supports this figure and who decided. It is shown in the viewer as "Reason written by ' + WHO + '".' }),
          h('textarea', { class: 'govuk-textarea', id: 'sv-reason', name: 'reason', rows: '3', 'aria-describedby': 'sv-reason-hint' })),
        h('button', { type: 'submit', class: 'govuk-button govuk-button--secondary app-button-compact', name: 'cite', value: 'reason' }, 'Record the reason')))
    form.appendChild(det)
    var kind = null
    form.addEventListener('click', function (e) { var b = e.target.closest('button[name="cite"]'); if (b) kind = b.value })
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var which = kind || 'source'
      kind = null
      errBox.textContent = ''
      if (which === 'reason') {
        var t = form.querySelector('#sv-reason').value.trim()
        if (t.length < 15) {
          var msg = 'Write the reason in a sentence: what supports ' + it.name + ' and who decided'
          var sum = h('div', { class: 'govuk-error-summary', role: 'alert', tabindex: '-1', id: 'sv-cite-sum' },
            h('div', { class: 'govuk-error-summary__body' }, h('h3', { class: 'govuk-error-summary__title', text: 'There is a problem' }),
              h('ul', { class: 'govuk-list govuk-error-summary__list' }, h('li', {}, h('a', { href: '#sv-reason', onclick: function (ev) { ev.preventDefault(); form.querySelector('#sv-reason').focus() } }, msg)))))
          errBox.appendChild(sum)
          var grp = form.querySelector('#sv-reason-group')
          grp.classList.add('govuk-form-group--error')
          var old = grp.querySelector('.govuk-error-message'); if (old) old.remove()
          grp.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-reason-err' }, h('span', { class: 'govuk-visually-hidden', text: 'Error: ' }), msg), grp.querySelector('textarea'))
          form.querySelector('#sv-reason').classList.add('govuk-textarea--error')
          form.querySelector('#sv-reason').setAttribute('aria-describedby', 'sv-reason-hint sv-reason-err')
          document.getElementById('sv-reason-details').open = true
          document.title = 'Error: ' + document.title.replace(/^Error: /, '')
          sum.focus()
          return
        }
        var id = 'rs-new-' + it.id
        dynSave(id, { kind: 'reason', title: 'Reason for ' + it.name, reason: t, who: 'Reason written by ' + WHO, when: TODAY })
        document.title = document.title.replace(/^Error: /, '')
        recorded(it, v, id, 'Written reason')
      } else {
        var sid2 = it.cand[v.idx]
        document.title = document.title.replace(/^Error: /, '')
        recorded(it, v, sid2, 'Source cited')
      }
    })
    return form
  }

  /* Verify values: Accept or Reject in the slot beside the box and in the row; one shared next */
  function vDone(id) { return (vstate[id] || 'open') !== 'open' }
  function decide(id, act) {
    vstate[id] = act
    SV.sstore('sv-verify', JSON.stringify(vstate))
    refresh()
    var it = SV.itemOf('verify', id)
    var verb = act === 'ok' ? 'accepted' : 'rejected'
    api.announce('Value on ' + it.name + ' ' + verb + '.')
    var nxt = api.advance(id, vDone, { focusViewer: true })
    if (!nxt) api.announce('Value ' + verb + '. All values checked.')
  }
  function verifySlot(it, sid, v) {
    if (v.list !== 'verify' || !sid) return null
    var foot = h('div', { class: 'app-viewer__foot' })
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', onclick: function () { decide(it.id, 'ok') } }, 'Accept', h('span', { class: 'govuk-visually-hidden', text: ' ' + it.name })))
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--warning app-button-compact', onclick: function () { decide(it.id, 'no') } }, 'Reject', h('span', { class: 'govuk-visually-hidden', text: ' ' + it.name })))
    return foot
  }

  api = SV.initWork({
    list: 'prep', layout: 'tabs', windowUrl: 'window.html', openLabel: openLabel,
    defaultTab: 'cite',
    tabs: { cite: { list: 'prep', h1: 'Cite figures' }, verify: { list: 'verify', h1: 'Verify extracted values' } },
    extra: function (it, sid, v) { return v.list === 'verify' ? verifySlot(it, sid, v) : citeForm(it, sid, v) },
    emptyHelp: 'Choose a figure that needs a source or a reason.',
    restore: function (a) { Object.keys(cited).forEach(function (id) { cited[id].forEach(function (s) { a.viewer.addSource(id, s) }) }) },
  })
  // recorded notice and the "go to next" control live in the work column
  var go = document.getElementById('sv-next-orphan')
  if (go) go.addEventListener('click', function () {
    var id = go.getAttribute('data-go')
    var b = document.querySelector('[data-item="' + id + '"] [data-open]')
    if (b) { b.focus(); b.click() }
  })
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () { decide(b.closest('[data-item]').getAttribute('data-item'), b.getAttribute('data-act')) })
  })
  var allDone = D.lists.verify.every(function (x) { return vDone(x.id) })
  var dn = document.getElementById('sv-done')
  if (dn && allDone) dn.hidden = false
  refresh()
})()
