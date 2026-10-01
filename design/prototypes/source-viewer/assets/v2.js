/* Version B: the preparer's workbench. Sources as MOJ sub navigation tabs with previous and next;
   a figure with no source shows candidate sources and the picker beside them (RV-22), or a written reason. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var cited = {}
  var WHO = 'Anita Rao (Test)', TODAY = '1 Oct 2026'

  function dynSave(id, s) {
    var m = {}
    try { m = JSON.parse(localStorage.getItem('sv-dyn') || '{}') } catch (e) {}
    m[id] = s
    localStorage.setItem('sv-dyn', JSON.stringify(m))
  }
  function isCited(it) { return it.src.length > 0 || (cited[it.id] || []).length > 0 }
  function refresh() {
    var left = 0
    D.lists.prep.forEach(function (it) {
      var cell = document.querySelector('[data-item="' + it.id + '"] [data-status]')
      var ok = isCited(it)
      if (!ok) left++
      if (cell) { cell.textContent = ''; cell.appendChild(h('strong', { class: 'govuk-tag ' + (ok ? 'govuk-tag--green' : 'govuk-tag--orange'), text: ok ? 'Cited' : 'Needs a source or a reason' })) }
    })
    var c = document.getElementById('sv-left')
    if (c) c.textContent = String(left)
  }
  function openLabel(id, sel) {
    var it = SV.itemOf('prep', id)
    var n = it.src.length + (cited[id] || []).length
    return (sel ? 'Showing ' : 'Show ') + (n ? 'sources (' + n + ')' : 'candidates (' + it.cand.length + ')')
  }

  var api
  function recorded(it, v, sid, what) {
    cited[it.id] = (cited[it.id] || []).concat([sid])
    v.addSource(it.id, sid)
    var nowN = v.ids().length
    refresh()
    var nxt = null
    D.lists.prep.forEach(function (x) { if (!nxt && !isCited(x) && x.id !== it.id) nxt = x })
    var msg = what + ' for ' + it.name + ' recorded as source ' + nowN + ' of ' + nowN + '. ' + (nxt ? 'Next to cite: ' + nxt.name + '.' : 'Nothing is left to cite.')
    v.show(it.id, nowN - 1, { focusIn: true, silent: false })
    v.announce(msg)
    var note = document.getElementById('sv-recorded')
    if (note) { note.textContent = msg; note.hidden = false }
    if (nxt) { var b = document.getElementById('sv-next-orphan'); if (b) { b.textContent = 'Go to ' + nxt.name; b.hidden = false; b.setAttribute('data-go', nxt.id) } }
    else { var b2 = document.getElementById('sv-next-orphan'); if (b2) b2.hidden = true }
  }

  function citeForm(it, sid, v) {
    if (isCited(it) || !it.cand) return null
    var form = h('form', { class: 'app-viewer__foot app-viewer__foot--block', novalidate: 'novalidate', id: 'sv-cite' })
    form.setAttribute('aria-label', 'Cite ' + it.name)
    var errBox = h('div', { id: 'sv-cite-err' })
    form.appendChild(errBox)
    form.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-2', text: 'Nothing is cited yet. Look at each candidate in the tabs, then cite one or write a reason.' }))
    var row = h('div', { class: 'app-actions' })
    row.appendChild(h('button', { type: 'submit', class: 'govuk-button app-button-compact', name: 'cite', value: 'source' }, 'Cite the source shown (candidate ' + (v.idx + 1) + ' of ' + it.cand.length + ')'))
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

  api = SV.initWork({
    list: 'prep', layout: 'tabs', windowUrl: 'window.html', openLabel: openLabel, extra: citeForm,
    emptyHelp: 'Choose a figure that needs a source or a reason.',
  })
  // recorded notice and the "go to next" control live in the work column
  var go = document.getElementById('sv-next-orphan')
  if (go) go.addEventListener('click', function () {
    var id = go.getAttribute('data-go')
    var b = document.querySelector('[data-item="' + id + '"] [data-open]')
    if (b) { b.focus(); b.click() }
  })
  refresh()
})()
