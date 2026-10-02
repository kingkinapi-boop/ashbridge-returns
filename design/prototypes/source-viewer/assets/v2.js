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
  /* fix round 2 (D2): after Cite or Record the shared advance moves on to the next figure that still needs a source or a
     reason and puts focus in its box; with none left the notice itself takes focus. */
  function recorded(it, v, sid, what) {
    cited[it.id] = (cited[it.id] || []).concat([sid])
    SV.sstore('sv-cited', JSON.stringify(cited))
    v.addSource(it.id, sid)
    var nowN = v.ids().length
    refresh()
    var nxt = api.nextUnhandled(it.id, citedDone)
    var msg = what + ' for ' + it.name + ' recorded as source ' + nowN + ' of ' + nowN + '. ' + (nxt ? 'Next to cite: ' + nxt.querySelector('th').textContent.replace(/\s*\(tax choice\)/, '') + '.' : 'Nothing is left to cite.')
    var note = document.getElementById('sv-recorded')
    if (note) { note.textContent = msg; note.hidden = false }
    var b = document.getElementById('sv-next-orphan')
    if (b) {
      if (nxt) { b.textContent = 'Go to ' + nxt.querySelector('th').textContent.replace(/\s*\(tax choice\)/, ''); b.hidden = false; b.setAttribute('data-go', nxt.getAttribute('data-item')) }
      else b.hidden = true
    }
    if (!api.advance(it.id, citedDone, { focusViewer: true })) {
      v.show(it.id, nowN - 1, { silent: true })
      if (note) note.focus({ preventScroll: true })
    }
    v.announce(msg)
  }

  /* The cite form is the shared cite-or-reason part (design/parts/cite-or-reason): typing a reason checks "A written reason",
     so there is never a "choose" error while a reason is typed (V8); nothing is preselected and no error shows before a submit. */
  function citeForm(it, sid, v) {
    if (isCited(it) || !it.cand) return null
    var form = h('form', { class: 'app-viewer__foot app-viewer__foot--cite', novalidate: 'novalidate', id: 'sv-cite', 'data-cor': '' })
    form.setAttribute('aria-label', 'Cite ' + it.name)
    var errBox = h('div', { id: 'sv-cite-err', class: 'app-cite__sum' })
    form.appendChild(errBox)
    var group = h('div', { class: 'govuk-form-group app-cor' })
    var fs = h('fieldset', { class: 'govuk-fieldset' },
      h('legend', { class: 'govuk-fieldset__legend' }, h('span', { class: 'govuk-visually-hidden', text: 'Source or reason for ' + it.name + ' (required)' })))
    var radios = h('div', { class: 'govuk-radios govuk-radios--small' })
    radios.appendChild(h('div', { class: 'govuk-radios__item' },
      h('input', { class: 'govuk-radios__input', id: 'sv-src-0', name: 'sv-src', type: 'radio', value: 'source', 'data-req': '', 'data-msg': 'Choose a source or write a reason' }),
      h('label', { class: 'govuk-label govuk-radios__label', for: 'sv-src-0' }, 'The candidate shown (' + (v.idx + 1) + ' of ' + it.cand.length + ')')))
    radios.appendChild(h('div', { class: 'govuk-radios__item app-cor__row' },
      h('input', { class: 'govuk-radios__input', id: 'sv-src-reason', name: 'sv-src', type: 'radio', value: 'reason', 'data-cor-reason-radio': '' }),
      h('label', { class: 'govuk-label govuk-radios__label', for: 'sv-src-reason' }, 'A written reason'),
      h('div', { class: 'govuk-form-group app-cor__reason', id: 'sv-reason-group' },
        h('label', { class: 'govuk-label govuk-visually-hidden', for: 'sv-reason' }, 'Reason for the CPA (required if you chose a written reason)'),
        h('textarea', { class: 'govuk-textarea', id: 'sv-reason', name: 'reason', rows: '1', 'data-cor-reason': '', 'data-req': '', 'data-msg': 'Write the reason in a sentence: what supports ' + it.name + ' and who decided', 'data-req-if': 'sv-src-reason' }))))
    fs.appendChild(radios)
    group.appendChild(fs)
    form.appendChild(group)
    form.appendChild(h('button', { type: 'submit', class: 'govuk-button app-button-compact app-cite__go', 'data-primary': '' }, 'Record', h('span', { class: 'govuk-visually-hidden', text: ' the source or reason for ' + it.name })))
    function fail(msg, field, linkTo) {
      var sum = h('div', { class: 'govuk-error-summary', role: 'alert', tabindex: '-1', id: 'sv-cite-sum' },
        h('div', { class: 'govuk-error-summary__body' }, h('h3', { class: 'govuk-error-summary__title', text: 'There is a problem' }),
          h('ul', { class: 'govuk-list govuk-error-summary__list' }, h('li', {}, h('a', { href: '#' + linkTo, onclick: function (ev) { ev.preventDefault(); form.querySelector('#' + linkTo).focus({ preventScroll: true }) } }, msg)))))
      errBox.appendChild(sum)
      var grp = field === 'reason' ? form.querySelector('#sv-reason-group') : group
      grp.classList.add('govuk-form-group--error')
      var ta = form.querySelector('#sv-reason')
      if (field === 'reason') {
        grp.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-reason-err' }, h('span', { class: 'govuk-visually-hidden', text: 'Error: ' }), msg), ta)
        ta.classList.add('govuk-textarea--error')
        ta.setAttribute('aria-describedby', 'sv-reason-err')
      } else {
        fs.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-src-error' }, h('span', { class: 'govuk-visually-hidden', text: 'Error: ' }), msg), radios)
        fs.setAttribute('aria-describedby', 'sv-src-error')
      }
      if (!/^Error: /.test(document.title)) document.title = 'Error: ' + document.title
      sum.focus({ preventScroll: true })
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      errBox.textContent = ''
      var old = form.querySelectorAll('.govuk-error-message'); Array.prototype.forEach.call(old, function (m) { m.remove() })
      var picked = form.querySelector('input[name="sv-src"]:checked')
      if (!picked) { fail('Choose a source or write a reason', 'source', 'sv-src-0'); return }
      if (picked.value === 'reason') {
        var t = form.querySelector('#sv-reason').value.trim()
        if (t.length < 15) { fail('Write the reason in a sentence: what supports ' + it.name + ' and who decided', 'reason', 'sv-reason'); return }
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
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: function () { decide(it.id, 'ok') } }, 'Accept', h('span', { class: 'govuk-visually-hidden', text: ' ' + it.name })))
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
