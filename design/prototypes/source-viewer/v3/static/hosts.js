/* The decision slots of the five record tabs, all inside the one viewer (version B+).
   B: cite a source or write a reason (Workbench), accept or reject an extracted value (Documents).
   A: the step mechanics and a UI-only "Supports this figure" tick that says it is "your place, not a review mark" (Review).
   C: Complete with Undo that asks for a reason, and Chase as a dated staff note (Ops); the same done row and Undo
   serve Documents and Exceptions. Exceptions: the CPA accepts an accepted risk with a reason, or comments.
   A single key never unmarks, approves, sends or deletes (rule 22); buttons do. */
(function () {
  'use strict'
  var SV = window.SV, h = SV.h, D = window.SV_DATA
  var P = SV.person(), WHO = P.name, TODAY = D.today.text
  var params = new URLSearchParams(location.search)
  var GROUPWORD = { exact: 'exact value', rounds: 'rounds to this value' }
  var api

  function load(k, d) { try { var v = JSON.parse(SV.sstore(k) || 'null'); return v || d } catch (e) { return d } }
  function save(k, v) { SV.sstore(k, JSON.stringify(v)) }
  function dynSave(id, s) { var m = {}; try { m = JSON.parse(localStorage.getItem('sv-dyn') || '{}') } catch (e) { m = {} } m[id] = s; localStorage.setItem('sv-dyn', JSON.stringify(m)) }
  var cited = load('sv-cited', {}), vstate = load('sv-verify', {}), ostate = load('sv-ops', {}), judged = load('sv-judged', {}), ticks = load('sv-ticks', {}), undoLog = load('sv-undo-log', [])
  var drafts = {} // reason text not yet recorded, so a redraw never loses what was typed
  function can(a) { return P.can.indexOf(a) >= 0 }
  function tag(cls, text) { return h('strong', { class: 'govuk-tag ' + cls, text: text }) }
  function setTags(cell, tags) { if (!cell) return; cell.textContent = ''; tags.forEach(function (t, i) { if (i) cell.appendChild(document.createTextNode(' ')); cell.appendChild(tag(t[0], t[1])) }) }
  function rowOf(id) { return document.querySelector('[data-item="' + id + '"]') }
  function cellOf(id, sel) { var r = rowOf(id); return r ? r.querySelector(sel) : null }
  function vis(s) { return h('span', { class: 'govuk-visually-hidden', text: s }) }
  function readOnly(text) { return h('div', { class: 'app-viewer__foot' }, h('p', { class: 'govuk-body-s app-foot-line', text: text })) }

  /* the demo state "done": every kind of finished row, so the panel can read them without clicking through */
  if (params.get('state') === 'done' && !SV.sstore('sv-seeded-done')) {
    SV.sstore('sv-seeded-done', '1')
    vstate.v1 = { st: 'ok', by: D.people.anita.name, on: TODAY }
    vstate.v2 = { st: 'no', by: D.people.anita.name, on: TODAY }
    ostate.o2 = { st: 'done', by: D.people.sam.name, on: TODAY }
    ostate.o3 = { st: 'chase', by: D.people.sam.name, on: TODAY }
    judged.x1 = { st: 'accepted', by: D.people.dev.name, on: TODAY, text: 'The client confirmed the Northwind terms in writing. I accept the risk and keep the flag for the filing note.' }
    cited.c8 = ['qbo-6100']
    cited.c1 = ['rs-new-c1']
    dynSave('rs-new-c1', { kind: 'reason', origin: 'judgment', dot: 'purple', title: 'Reason for Meals add-back', reason: 'Half of the meals and entertainment balance is added back on Schedule 1; Anita Rao decided.', who: 'Reason written by ' + D.people.anita.name, when: TODAY })
    ;['qbo-2050', 'cra-hst', 'ly-2680'].forEach(function (s) { ticks['f2:' + s] = true })
    ticks['f3:qbo-6020'] = true
    save('sv-verify', vstate); save('sv-ops', ostate); save('sv-judged', judged); save('sv-cited', cited); save('sv-ticks', ticks)
  }

  /* ---------------- Workbench: cite a source or write a reason (B) ---------------- */
  function isCited(it) { return (it.src && it.src.length > 0) || (cited[it.id] || []).length > 0 }
  function citedDone(id) { return isCited(SV.itemOf('prep', id)) }
  function prepTags(it) {
    var out = [isCited(it) ? ['govuk-tag--green', 'Cited'] : ['govuk-tag--orange', it.cand ? 'Not cited' : 'Needs a reason']]
    if (it.flag) out.push(['govuk-tag--red', 'Flagged for a person'])
    return out
  }
  function refreshPrep() {
    var left = 0
    D.lists.prep.forEach(function (it) { if (!isCited(it)) left++; setTags(cellOf(it.id, '[data-status]'), prepTags(it)) })
    var c = document.getElementById('sv-left-cite'); if (c) c.textContent = String(left)
    var d = document.getElementById('sv-done-workbench'); if (d && left === 0) d.hidden = false
  }

  function recorded(it, v, sid, what) {
    cited[it.id] = (cited[it.id] || []).concat([sid])
    save('sv-cited', cited)
    v.addSource(it.id, sid)
    delete drafts[it.id]
    var nowN = v.ids().length
    refreshAll()
    var nxt = api.nextUnhandled(it.id, citedDone)
    var msg = what + ' for ' + it.name + ' recorded as source ' + nowN + ' of ' + nowN + '. ' + (nxt ? 'Next to cite: ' + nxt.querySelector('th').firstChild.textContent + '.' : 'Nothing is left to cite.')
    var note = document.getElementById('sv-recorded')
    if (note) { note.textContent = msg; note.hidden = false }
    if (!api.advance(it.id, citedDone, { focusViewer: true })) {
      v.show(it.id, nowN - 1, { silent: true })
      if (note) note.focus({ preventScroll: true })
    }
    v.announce(msg)
  }

  /* The cite form is the shared cite-or-reason part (design/parts/cite-or-reason): typing a reason checks "A written reason",
     so there is never a "choose" error while a reason is typed (V8); nothing is preselected and no error shows before a submit.
     Candidates arrive in two groups, exact value first and "rounds to this value" apart, and none is chosen for the person (RT-16).
     An overridden or dropped cell has no candidate: it asks for the reason only (RT-14). */
  function citeForm(it, sid, v) {
    if (isCited(it)) return null
    var hasCand = !!(it.cand && it.cand.length)
    if (!hasCand && !it.facts) return null
    if (!can('cite')) return readOnly('Only the preparer cites a source or writes a reason. You are signed in as ' + P.role + ' and can read the candidates.')
    var dr = drafts[it.id] || {}
    var form = h('form', { class: 'app-viewer__foot app-viewer__foot--cite', novalidate: 'novalidate', id: 'sv-cite', 'data-cor': '' })
    form.setAttribute('aria-label', 'Cite ' + it.name)
    var errBox = h('div', { id: 'sv-cite-err', class: 'app-cite__sum' })
    form.appendChild(errBox)
    var group = h('div', { class: 'govuk-form-group app-cor' })
    var fs = h('fieldset', { class: 'govuk-fieldset' })
    var ta, radios, reasonRadio = null, reasonGroup
    var reasonMsg = 'Write the reason in a sentence: what supports ' + it.name + ' and who decided'
    if (hasCand) {
      fs.appendChild(h('legend', { class: 'govuk-fieldset__legend' }, vis('Source or reason for ' + it.name + ' (required)')))
      radios = h('div', { class: 'govuk-radios govuk-radios--small' })
      var g = it.cand[v.idx] ? it.cand[v.idx].group : 'exact'
      radios.appendChild(h('div', { class: 'govuk-radios__item' },
        h('input', { class: 'govuk-radios__input', id: 'sv-src-0', name: 'sv-src', type: 'radio', value: 'source' }),
        h('label', { class: 'govuk-label govuk-radios__label', for: 'sv-src-0' }, 'This candidate (' + (v.idx + 1) + ' of ' + it.cand.length + ', ' + GROUPWORD[g] + ')')))
      reasonRadio = h('input', { class: 'govuk-radios__input', id: 'sv-src-reason', name: 'sv-src', type: 'radio', value: 'reason', 'data-cor-reason-radio': '' })
      reasonGroup = h('div', { class: 'govuk-form-group app-cor__reason', id: 'sv-reason-group' })
      ta = h('textarea', { class: 'govuk-textarea', id: 'sv-reason', name: 'reason', rows: '1', 'data-cor-reason': '' })
      reasonGroup.appendChild(h('label', { class: 'govuk-label govuk-visually-hidden', for: 'sv-reason' }, 'Reason for the CPA (required if you chose a written reason)'))
      reasonGroup.appendChild(ta)
      radios.appendChild(h('div', { class: 'govuk-radios__item app-cor__row' }, reasonRadio, h('label', { class: 'govuk-label govuk-radios__label', for: 'sv-src-reason' }, 'A written reason'), reasonGroup))
      fs.appendChild(radios)
      group.appendChild(fs)
    } else {
      reasonGroup = h('div', { class: 'govuk-form-group app-cor__reason', id: 'sv-reason-group' })
      reasonGroup.appendChild(h('label', { class: 'govuk-label', for: 'sv-reason' }, 'Reason for the CPA ', h('span', { class: 'app-req', 'aria-hidden': 'true', text: '*' }), vis(' (required)')))
      ta = h('textarea', { class: 'govuk-textarea', id: 'sv-reason', name: 'reason', rows: '1', 'data-cor-reason': '' })
      reasonGroup.appendChild(ta)
      group.appendChild(reasonGroup)
    }
    if (dr.text) { ta.value = dr.text; if (reasonRadio) reasonRadio.checked = true }
    ta.addEventListener('input', function () { drafts[it.id] = { text: ta.value } })
    form.appendChild(group)
    form.appendChild(h('button', { type: 'submit', class: 'govuk-button app-button-compact app-cite__go', 'data-primary': '' }, 'Record', vis(' the source or reason for ' + it.name)))
    function fail(msg, field, linkTo) {
      var sum = h('div', { class: 'govuk-error-summary', role: 'alert', tabindex: '-1', id: 'sv-cite-sum' },
        h('div', { class: 'govuk-error-summary__body' }, h('h3', { class: 'govuk-error-summary__title', text: 'There is a problem' }),
          h('ul', { class: 'govuk-list govuk-error-summary__list' }, h('li', {}, h('a', { href: '#' + linkTo, onclick: function (ev) { ev.preventDefault(); form.querySelector('#' + linkTo).focus({ preventScroll: true }) } }, msg)))))
      errBox.appendChild(sum)
      if (field === 'reason') {
        reasonGroup.classList.add('govuk-form-group--error')
        reasonGroup.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-reason-err' }, vis('Error: '), msg), ta)
        ta.classList.add('govuk-textarea--error')
        ta.setAttribute('aria-describedby', 'sv-reason-err')
      } else {
        group.classList.add('govuk-form-group--error')
        fs.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-src-error' }, vis('Error: '), msg), radios)
        fs.setAttribute('aria-describedby', 'sv-src-error')
      }
      if (!/^Error: /.test(document.title)) document.title = 'Error: ' + document.title
      sum.focus({ preventScroll: true })
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      errBox.textContent = ''
      Array.prototype.forEach.call(form.querySelectorAll('.govuk-error-message'), function (m) { m.remove() })
      var picked = hasCand ? form.querySelector('input[name="sv-src"]:checked') : { value: 'reason' }
      if (!picked) { fail('Choose a source or write a reason', 'source', 'sv-src-0'); return }
      if (picked.value === 'reason') {
        var t = ta.value.trim()
        if (t.length < 15) { fail(reasonMsg, 'reason', 'sv-reason'); return }
        var id = 'rs-new-' + it.id
        dynSave(id, { kind: 'reason', origin: 'judgment', dot: 'purple', title: 'Reason for ' + it.name, reason: t, who: 'Reason written by ' + WHO, when: TODAY })
        document.title = document.title.replace(/^Error: /, '')
        recorded(it, v, id, 'Written reason')
      } else {
        var sid2 = v.ids()[v.idx]
        document.title = document.title.replace(/^Error: /, '')
        recorded(it, v, sid2, 'Source cited')
      }
    })
    return form
  }

  /* ---------------- Review: the "Supports" tick, a place-keeper only (A, K3) ---------------- */
  function tkey(item, sid) { return item + ':' + sid }
  function isMarked(item, sid) { return !!ticks[tkey(item, sid)] }
  function figDone(id) {
    var it = SV.itemOf('cpa', id)
    if (!it.src.length) return true // nothing to tick: it stays "Not checked: no evidence" and is skipped
    return it.src.every(function (s) { return isMarked(id, s) })
  }
  function cpaTags(it) {
    var n = it.src.length, m = it.src.filter(function (s) { return isMarked(it.id, s) }).length, out = []
    if (it.flag) out.push(['govuk-tag--red', 'Flagged for a person'])
    if (!n) { if (!it.flag) out.push(['govuk-tag--orange', 'Not checked: no evidence']); return out }
    if (m === n) out.push(['govuk-tag--green', 'All sources ticked'])
    else if (m > 0) out.push(['govuk-tag--blue', m + ' of ' + n + ' ticked'])
    else if (!it.flag) out.push(['govuk-tag--grey', 'Not started'])
    return out
  }
  function refreshCpa() {
    var full = 0
    D.lists.cpa.forEach(function (it) {
      if (it.src.length && figDone(it.id)) full++
      setTags(cellOf(it.id, '[data-status]'), cpaTags(it))
    })
    var c = document.getElementById('sv-ticked'); if (c) c.textContent = String(full)
    var d = document.getElementById('sv-done-review')
    if (d && D.lists.cpa.every(function (x) { return figDone(x.id) })) d.hidden = false
  }
  /* mark the source in view and go on (a button, no key this round): the next source (an entry's own sources included);
     on the last one the first source of this figure still unticked, else the next figure not fully ticked, else the done message. Never unticks. */
  function tickAndNext() {
    var v = api.viewer, it = v.item()
    if (!it) { api.announce('No figure selected'); return }
    var steps = v.steps(), cur = steps[v.idx]
    if (!cur || v.candMode) return
    var was = isMarked(it.id, cur.id)
    ticks[tkey(it.id, cur.id)] = true
    save('sv-ticks', ticks)
    refreshCpa()
    if (v.idx < steps.length - 1) { v.announce((was ? 'Already ticked. ' : 'Ticked. ') + 'Now step ' + (v.idx + 2) + ' of ' + steps.length); v.step(1, { focusIn: true }); return }
    var left = -1
    it.src.forEach(function (s, i) { if (left < 0 && !isMarked(it.id, s)) left = i })
    if (left >= 0) { v.announce('Ticked. Source ' + (left + 1) + ' of ' + it.src.length + ' is not ticked yet'); v.show(it.id, v.idxFromPos(String(left + 1)), { focusIn: true }); return }
    v.announce('Ticked. Every source of ' + it.name + ' is ticked.')
    api.advance(it.id, figDone, { focusViewer: true })
  }
  function tickSlot(it, sid, v) {
    if (!sid || v.candMode) return null
    var cur = v.steps()[v.idx]
    var marked = isMarked(it.id, cur.id)
    var foot = h('div', { class: 'app-viewer__foot app-viewer__foot--tick' })
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: tickAndNext }, marked ? 'Already ticked, next source' : 'Supports, next source', vis(' for ' + it.name)))
    foot.appendChild(h('span', { class: 'app-foot-note', text: 'Your place, not a review mark.' }))
    if (marked) foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { delete ticks[tkey(it.id, cur.id)]; save('sv-ticks', ticks); refreshCpa(); v.render({}); v.announce('Tick removed from this source') } }, 'Remove tick'))
    return foot
  }

  /* ---------------- shared done row and Undo that asks for a reason (C) ---------------- */
  var STORE = {
    verify: { get: function (id) { return vstate[id] }, clear: function (id) { delete vstate[id]; save('sv-verify', vstate) } },
    ops: { get: function (id) { return ostate[id] }, clear: function (id) { delete ostate[id]; save('sv-ops', ostate) } },
    risks: { get: function (id) { return judged[id] }, clear: function (id) { delete judged[id]; save('sv-judged', judged) } },
  }
  function undoForm(it, where, list) {
    var pre = 'undo-' + where + '-' + it.id
    var form = h('form', { class: 'app-undo', id: pre, novalidate: 'novalidate', hidden: true, 'aria-label': 'Undo the decision on ' + it.name })
    var box = h('div', { class: 'govuk-form-group' },
      h('label', { class: 'govuk-label', for: pre + '-why' }, 'Reason for undoing this decision ', h('span', { class: 'app-req', 'aria-hidden': 'true', text: '*' }), vis(' (required)')),
      h('textarea', { class: 'govuk-textarea', id: pre + '-why', name: 'reason', rows: '2' }))
    form.appendChild(box)
    form.appendChild(h('div', { class: 'app-actions' },
      h('button', { type: 'submit', class: 'govuk-button govuk-button--warning app-button-compact' }, 'Undo the decision', vis(' on ' + it.name)),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { closeUndo(form, where, it.id) } }, 'Cancel', vis(' undo'))))
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
        box.insertBefore(h('p', { class: 'govuk-error-message', id: pre + '-err' }, vis('Error: '), msg), ta)
        ta.classList.add('govuk-textarea--error')
        ta.setAttribute('aria-describedby', pre + '-err')
        if (!/^Error: /.test(document.title)) document.title = 'Error: ' + document.title
        sum.focus({ preventScroll: true })
        return
      }
      document.title = document.title.replace(/^Error: /, '')
      var was = STORE[list].get(it.id)
      STORE[list].clear(it.id)
      undoLog.push({ list: list, id: it.id, was: was && was.st, reason: why, by: WHO, on: TODAY })
      save('sv-undo-log', undoLog)
      refreshAll()
      var v = api.viewer
      if (v.itemId === it.id) v.show(it.id, v.idx, { silent: true })
      api.announce('Decision on ' + it.name + ' undone. The reason is kept. The item is not checked again.')
      var row = rowOf(it.id)
      var target = row && row.querySelector('[data-open]')
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
    var b = document.querySelector('[data-item="' + id + '"] [data-undo]')
    if (b) { b.setAttribute('aria-expanded', 'false'); b.focus({ preventScroll: true }) }
  }
  function openUndo(form, btn) {
    form.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    form.querySelector('textarea').focus({ preventScroll: true })
  }
  function undoButton(it, where, form) {
    var b = h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'data-undo': '', 'aria-expanded': 'false', onclick: function () { if (form.hidden) openUndo(form, b); else closeUndo(form, where, it.id) } }, 'Undo', vis(' the decision on ' + it.name))
    return b
  }
  /* a decided row: no live action button, an Undo and its reason form instead (V7: no second "Complete") */
  function rowActions(list, store) {
    D.lists[list].forEach(function (it) {
      var row = rowOf(it.id)
      var box = row && row.querySelector('.app-actions')
      if (!box) return
      var decided = !!store[it.id]
      var allowed = list === 'verify' ? can('verify') : list === 'ops' ? can('ops') : can('judge')
      var u = box.querySelector('[data-undo]')
      if (decided && allowed && !u) {
        var f = undoForm(it, 'row', list)
        box.appendChild(undoButton(it, 'row', f))
        box.parentNode.appendChild(f)
      } else if ((!decided || !allowed) && u) {
        var f2 = box.parentNode.querySelector('.app-undo')
        u.remove(); if (f2) f2.remove()
      }
    })
  }
  function doneLine(d, text) { return text + ' by ' + d.by + ', ' + d.on + '.' }
  function doneSlot(it, list, tagCls, tagText, line) {
    var foot = h('div', { class: 'app-viewer__foot app-viewer__foot--done' })
    foot.appendChild(tag(tagCls, tagText))
    foot.appendChild(h('span', { class: 'app-foot-note', text: line }))
    var canUndo = (list === 'verify' && can('verify')) || (list === 'ops' && can('ops')) || (list === 'risks' && can('judge'))
    if (canUndo) foot.appendChild(h('span', { class: 'app-foot-note', text: 'To undo it, use Undo on the row.' }))
    return foot
  }

  /* ---------------- Documents: accept or reject an extracted value (B) ---------------- */
  function vDone(id) { return !!vstate[id] }
  function vTags(id) {
    var d = vstate[id]
    return d ? (d.st === 'ok' ? [['govuk-tag--green', 'Accepted']] : [['govuk-tag--red', 'Rejected']]) : [['govuk-tag--grey', 'Not checked']]
  }
  function refreshVerify() {
    var left = 0
    D.lists.verify.forEach(function (it) { if (!vstate[it.id]) left++; setTags(cellOf(it.id, '[data-status]'), vTags(it.id)) })
    var c = document.getElementById('sv-left-verify'); if (c) c.textContent = String(left)
    var d = document.getElementById('sv-done-documents'); if (d && left === 0) d.hidden = false
    rowActions('verify', vstate)
  }
  function decideVerify(id, act) {
    vstate[id] = { st: act, by: WHO, on: TODAY }
    save('sv-verify', vstate)
    refreshAll()
    var it = SV.itemOf('verify', id), verb = act === 'ok' ? 'accepted' : 'rejected'
    api.announce('Value on ' + it.name + ' ' + verb + '.')
    var nxt = api.advance(id, vDone, { focusViewer: true })
    if (!nxt) api.announce('Value ' + verb + '. All values checked.')
  }
  function verifySlot(it, sid, v) {
    if (v.list !== 'verify' || !sid) return null
    var d = vstate[it.id]
    if (d) return doneSlot(it, 'verify', d.st === 'ok' ? 'govuk-tag--green' : 'govuk-tag--red', d.st === 'ok' ? 'Accepted' : 'Rejected', doneLine(d, d.st === 'ok' ? 'Accepted' : 'Rejected, goes back for extraction again'))
    if (!can('verify')) return readOnly('Only the preparer accepts or rejects an extracted value. You are signed in as ' + P.role + '.')
    var foot = h('div', { class: 'app-viewer__foot' })
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: function () { decideVerify(it.id, 'ok') } }, 'Accept', vis(' ' + it.name)))
    foot.appendChild(h('button', { type: 'button', class: 'govuk-button govuk-button--warning app-button-compact', onclick: function () { decideVerify(it.id, 'no') } }, 'Reject', vis(' ' + it.name)))
    foot.appendChild(h('span', { class: 'app-foot-note' }, 'Extracted value: ', h('strong', { text: it.amount }), '. Compare it with the words in the box.'))
    return foot
  }

  /* ---------------- Exceptions: the CPA judges an accepted risk with its source open (EX-1) ---------------- */
  function isAccepted(it) { return it.answer === 'accepted' }
  function judgedDone(id) { var it = SV.itemOf('risks', id); return !isAccepted(it) || !!judged[id] }
  function answerTag(it) { return it.answer === 'accepted' ? ['govuk-tag--yellow', 'Accepted risk'] : it.answer === 'fixed' ? ['govuk-tag--green', 'Fixed'] : ['govuk-tag--turquoise', 'Explained'] }
  function refreshRisks() {
    var left = 0
    D.lists.risks.forEach(function (it) {
      var d = judged[it.id], cell = cellOf(it.id, '[data-status]')
      if (isAccepted(it) && !d) left++
      var j = !isAccepted(it) ? ['govuk-tag--grey', 'Nothing to judge'] : !d ? ['govuk-tag--grey', 'Not judged'] : d.st === 'accepted' ? ['govuk-tag--green', 'Judged: accepted'] : ['govuk-tag--blue', 'Judged: commented']
      if (!cell) return
      var a = answerTag(it)
      cell.textContent = ''
      cell.appendChild(vis('Preparer\'s answer: ')); cell.appendChild(tag(a[0], a[1])); cell.appendChild(document.createTextNode(' '))
      cell.appendChild(vis('CPA judgment: ')); cell.appendChild(tag(j[0], j[1]))
    })
    var c = document.getElementById('sv-left-risks'); if (c) c.textContent = String(left)
    var d2 = document.getElementById('sv-done-exceptions'); if (d2 && left === 0) d2.hidden = false
    rowActions('risks', judged)
  }
  function judge(it, kind, ta, form, errBox) {
    var why = ta.value.trim()
    errBox.textContent = ''
    Array.prototype.forEach.call(form.querySelectorAll('.govuk-error-message'), function (m) { m.remove() })
    var grp = ta.closest('.govuk-form-group')
    if (why.length < 10) {
      var msg = kind === 'accepted' ? 'Write the reason you accept this risk' : 'Write your comment for the preparer'
      var sum = h('div', { class: 'govuk-error-summary', role: 'alert', tabindex: '-1', id: 'sv-judge-sum' },
        h('div', { class: 'govuk-error-summary__body' }, h('h3', { class: 'govuk-error-summary__title', text: 'There is a problem' }),
          h('ul', { class: 'govuk-list govuk-error-summary__list' }, h('li', {}, h('a', { href: '#sv-judge-why', onclick: function (ev) { ev.preventDefault(); ta.focus({ preventScroll: true }) } }, msg)))))
      errBox.appendChild(sum)
      grp.classList.add('govuk-form-group--error')
      grp.insertBefore(h('p', { class: 'govuk-error-message', id: 'sv-judge-err' }, vis('Error: '), msg), ta)
      ta.classList.add('govuk-textarea--error')
      ta.setAttribute('aria-describedby', 'sv-judge-err')
      if (!/^Error: /.test(document.title)) document.title = 'Error: ' + document.title
      sum.focus({ preventScroll: true })
      return
    }
    document.title = document.title.replace(/^Error: /, '')
    judged[it.id] = { st: kind, by: WHO, on: TODAY, text: why }
    save('sv-judged', judged)
    refreshAll()
    var verb = kind === 'accepted' ? 'accepted' : 'commented on'
    api.announce('Risk ' + it.flagId + ' ' + verb + '.')
    var nxt = api.advance(it.id, judgedDone, { focusViewer: true })
    if (!nxt) api.announce('Risk ' + it.flagId + ' ' + verb + '. Every accepted risk is judged.')
  }
  function judgeSlot(it, sid, v) {
    if (v.list !== 'risks') return null
    var d = judged[it.id]
    if (!isAccepted(it)) return readOnly((it.answer === 'fixed' ? 'Fixed' : 'Explained') + ' by ' + it.by + ', ' + it.on + '. Nothing to judge here; the CPA reads the source.')
    if (d) return doneSlot(it, 'risks', d.st === 'accepted' ? 'govuk-tag--green' : 'govuk-tag--blue', d.st === 'accepted' ? 'Judged: accepted' : 'Judged: commented', doneLine(d, d.st === 'accepted' ? 'Risk accepted with a reason' : 'Commented, not accepted'))
    if (!can('judge')) return readOnly('Only the CPA reviewer judges an accepted risk. You are signed in as ' + P.role + ' and can read the answer and its source.')
    var dr = drafts['judge-' + it.id] || ''
    var form = h('form', { class: 'app-viewer__foot app-viewer__foot--judge', novalidate: 'novalidate', id: 'sv-judge' })
    form.setAttribute('aria-label', 'Judge ' + it.flagId + ' ' + it.name)
    var errBox = h('div', { id: 'sv-judge-errbox', class: 'app-cite__sum' })
    form.appendChild(errBox)
    var grp = h('div', { class: 'govuk-form-group app-judge__field' },
      h('label', { class: 'govuk-label', for: 'sv-judge-why' }, 'Your reason or comment ', h('span', { class: 'app-req', 'aria-hidden': 'true', text: '*' }), vis(' (required)')))
    var ta = h('textarea', { class: 'govuk-textarea', id: 'sv-judge-why', name: 'why', rows: '2' })
    ta.value = dr
    ta.addEventListener('input', function () { drafts['judge-' + it.id] = ta.value })
    grp.appendChild(ta)
    form.appendChild(grp)
    form.appendChild(h('div', { class: 'app-judge__buttons' },
      h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: function () { judge(it, 'accepted', ta, form, errBox) } }, 'Accept the risk', vis(' ' + it.flagId)),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { judge(it, 'commented', ta, form, errBox) } }, 'Comment, do not accept', vis(' ' + it.flagId))))
    return form
  }

  /* ---------------- Ops: Complete with Undo, Chase as a dated staff note (C) ---------------- */
  function oDone(id) { return !!ostate[id] }
  function oTags(it) {
    var d = ostate[it.id]
    if (d) return d.st === 'done' ? [['govuk-tag--green', 'Complete']] : [['govuk-tag--blue', 'Chased on ' + d.on]]
    return it.src.length ? [['govuk-tag--grey', 'Not checked']] : [['govuk-tag--orange', 'Not checked: no evidence']]
  }
  function refreshOps() {
    var left = 0
    D.lists.ops.forEach(function (it) { if (!ostate[it.id]) left++; setTags(cellOf(it.id, '[data-status]'), oTags(it)) })
    var n = document.getElementById('sv-left-ops'); if (n) n.textContent = String(left)
    var d = document.getElementById('sv-done-ops'); if (d && left === 0) d.hidden = false
    rowActions('ops', ostate)
  }
  function decideOps(id, act) {
    var it = SV.itemOf('ops', id)
    ostate[id] = { st: act, by: WHO, on: TODAY }
    save('sv-ops', ostate)
    refreshAll()
    api.announce(it.name + (act === 'done' ? ' marked complete.' : ' chased on ' + TODAY + ' (a staff note, nothing was sent).'))
    var v = api.viewer
    if (!api.advance(id, oDone, { focusViewer: false }) && v.itemId === id) v.show(id, v.idx, { silent: true })
  }
  function opsSlot(it, sid, v) {
    if (v.list !== 'ops') return null
    var d = ostate[it.id]
    if (d) return doneSlot(it, 'ops', d.st === 'done' ? 'govuk-tag--green' : 'govuk-tag--blue', d.st === 'done' ? 'Complete' : 'Chased on ' + d.on, doneLine(d, d.st === 'done' ? 'Completed' : 'Staff note written'))
    if (!can('ops')) return readOnly('Only Operations completes or chases an item. You are signed in as ' + P.role + '.')
    var foot = h('div', { class: 'app-viewer__foot' })
    if (it.src.length) foot.appendChild(h('button', { type: 'button', class: 'govuk-button app-button-compact', 'data-primary': '', onclick: function () { decideOps(it.id, 'done') } }, 'Complete', vis(' ' + it.name)))
    foot.appendChild(h('button', { 'data-primary': it.src.length ? null : '', type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { decideOps(it.id, 'chase') } }, 'Chase', vis(' the client about ' + it.name)))
    foot.appendChild(h('span', { class: 'app-foot-note', text: 'Chase writes a dated staff note. It sends nothing to the client.' }))
    return foot
  }

  /* ---------------- all of it ---------------- */
  function refreshAll() { refreshPrep(); refreshCpa(); refreshVerify(); refreshRisks(); refreshOps() }

  function openLabel(list, id) {
    var it = SV.itemOf(list, id)
    if (!it) return 'Sources'
    if (list === 'prep') { var n = it.src.length + (cited[id] || []).length; return n ? 'Sources (' + n + ')' : it.cand ? 'Candidates (' + it.cand.length + ')' : 'Cell facts' }
    if (list === 'verify') return 'Show the box'
    if (list === 'changed') return 'Show the change'
    if (list === 'ops' && !it.src.length) return 'The item'
    return 'Sources (' + it.src.length + ')'
  }
  function slotFor(it, sid, v) {
    if (v.list === 'prep') return citeForm(it, sid, v)
    if (v.list === 'cpa') return tickSlot(it, sid, v)
    if (v.list === 'verify') return verifySlot(it, sid, v)
    if (v.list === 'risks') return judgeSlot(it, sid, v)
    if (v.list === 'ops') return opsSlot(it, sid, v)
    return null
  }
  var HELP = {
    cpa: 'The preparer\'s workbench holds the list of figures without a source; this figure shows there until a source or a written reason is cited.',
    ops: 'Nothing was received for this item. Chase the client: it writes a dated staff note. The item stays unchecked until a file arrives.',
    prep: 'Cite a source or write the reason in the box below.',
  }

  // the void state (TB-11): the approval alert and the changed cells, only when asked for with ?state=void
  var void_ = params.get('state') === 'void'
  Array.prototype.forEach.call(document.querySelectorAll('[data-void-only]'), function (n) { if (void_) n.hidden = false; else n.remove() })

  api = SV.initWork({
    defaultTab: 'workbench',
    tabs: {
      workbench: { list: 'prep', h1: 'Cite figures', noun: 'number', filterWhat: 'figures' },
      review: { list: 'cpa', h1: 'Review figures', noun: 'number', filterWhat: 'figures' },
      documents: { list: 'verify', h1: 'Verify extracted values', noun: 'value', filterWhat: 'values' },
      exceptions: { list: 'risks', h1: 'Judge accepted risks', noun: 'exception', filterWhat: 'exceptions' },
      ops: { list: 'ops', h1: 'Check items', noun: 'item', filterWhat: 'items' },
    },
    openLabel: openLabel, isMarked: isMarked,
    extra: function (it, sid, v) { return slotFor(it, sid, v) },
    emptyHelp: function (list) { return HELP[list] },
    restore: function (a) { Object.keys(cited).forEach(function (id) { cited[id].forEach(function (s) { a.viewer.addSource(id, s) }) }) },
    onRoute: function (name) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-void-note]'), function (s) { s.hidden = (s.getAttribute('data-void-note') === 'workbench') !== (name === 'workbench') })
      refreshAll()
    },
  })
  refreshAll()
})()
