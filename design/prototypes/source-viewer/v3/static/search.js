/* Header search results (rule 21): one table of everything the box searches, each result a link to the right tab with the
   figure selected and its source shown. Figures, values, exceptions, items and sources are searched in the format shown
   on the pages, so a value copied from a row finds it. Empty, results and no-results states, each in words. */
(function () {
  'use strict'
  var SV = window.SV, D = window.SV_DATA, h = SV.h
  var q = (new URLSearchParams(location.search).get('q') || '').trim()
  var input = document.getElementById('sv-search')
  var countEl = document.getElementById('sv-results-count')
  var box = document.getElementById('sv-results')
  if (input) input.value = q
  var base = ' - Ashbridge Tax'
  var ret = D.client.name + ', year end ' + D.client.ye

  var TAB = { prep: ['workbench', 'Workbench', 'Figure'], cpa: ['review', 'Review', 'Figure'], verify: ['documents', 'Documents', 'Value'], risks: ['exceptions', 'Exceptions', 'Exception'], ops: ['ops', 'Ops', 'Item'] }
  function url(list, id, pos) { return TAB[list][0] + '.html?item=' + id + '&src=' + pos }

  /* where a source is shown: the first figure, value, exception or item that uses it */
  function host(sid) {
    var order = ['cpa', 'risks', 'verify', 'ops', 'prep'], i, j, k
    for (k = 0; k < order.length; k++) {
      var list = order[k], items = D.lists[list]
      for (i = 0; i < items.length; i++) {
        var it = items[i], ids = (it.src || []).concat((it.cand || []).map(function (c) { return c.id }))
        for (j = 0; j < ids.length; j++) {
          if (ids[j] === sid) return { list: list, it: it, pos: String(j + 1) }
          var s = D.sources[ids[j]]
          if (s && s.children && s.children.indexOf(sid) >= 0) return { list: list, it: it, pos: (j + 1) + '.' + (s.children.indexOf(sid) + 1) }
        }
      }
    }
    var ch = D.lists.changed
    for (i = 0; i < ch.length; i++) if (ch[i].src.indexOf(sid) >= 0) return { list: 'changed', it: ch[i], pos: '1' }
    return null
  }

  var docs = []
  ;['cpa', 'prep', 'verify', 'risks', 'ops'].forEach(function (list) {
    D.lists[list].forEach(function (it) {
      var extra = [it.line, it.amount, it.flagId, it.what, it.cls, it.answer, it.flag && it.flag.id, it.flag && it.flag.text, it.effect].filter(Boolean).join(' ')
      docs.push({ kind: TAB[list][2], where: TAB[list][1] + ' tab', name: it.name + (it.amount ? ', ' + it.amount : ''), text: (it.name + ' ' + extra).toLowerCase(), href: url(list, it.id, '1'), key: list + it.id })
    })
  })
  Object.keys(D.sources).forEach(function (sid) {
    var s = D.sources[sid], hst = host(sid)
    if (!hst) return
    var parts = [s.title, s.page, s.ocr, s.extracted, s.answer, s.question, s.reason, s.compositeKey, s.file, s.snapshot]
    ;(s.fields || []).forEach(function (f) { parts.push(f[0] + ' ' + f[1]) })
    if (s.aje) parts.push(s.aje.type, s.aje.reason, s.aje.memo, s.aje.amount)
    docs.push({ kind: 'Source', where: hst.it.name + ' on the ' + TAB[hst.list === 'changed' ? 'prep' : hst.list][1] + ' tab', name: s.title, text: parts.filter(Boolean).join(' ').toLowerCase(), href: hst.list === 'changed' ? 'workbench.html?state=void&item=' + hst.it.id + '&src=1' : url(hst.list, hst.it.id, hst.pos), key: 'src' + sid })
  })

  function render() {
    box.textContent = ''
    /* a value is searched in the way it is shown: the comma or full stop that ends a word in a sentence is not part of the word */
    var terms = q.toLowerCase().split(/\s+/).map(function (t) { return t.replace(/[,.;:]+$/, '') }).filter(Boolean)
    if (!terms.length) {
      countEl.textContent = 'Type a figure, a value, an exception, an item or a source in the search box to see results.'
      countEl.removeAttribute('data-count'); countEl.removeAttribute('data-scope') // no number here: it is an instruction, not a count
      document.title = 'Search results, ' + ret + base
      box.appendChild(h('p', { class: 'govuk-body', text: 'Nothing has been searched yet. A value is found in the way it is shown on the page, for example 13,212 or 12,000.00.' }))
      return
    }
    var hits = docs.filter(function (d) { return terms.every(function (t) { return d.text.indexOf(t) >= 0 }) })
    document.title = 'Search results for ' + q + ', ' + ret + base
    if (!hits.length) {
      countEl.textContent = '0 results for "' + q + '".'
      countEl.setAttribute('data-scope', 'for "' + q + '"') // one search is one scope
      box.appendChild(h('p', { class: 'govuk-body', text: 'Nothing matches that search. Check the spelling, or search for a value in the way it is shown on the page, for example 13,212.' }))
      box.appendChild(h('p', { class: 'govuk-body' }, h('a', { class: 'govuk-link', href: 'review.html' }, 'Back to the return record')))
      return
    }
    countEl.textContent = hits.length + (hits.length === 1 ? ' result for "' : ' results for "') + q + '".'
    countEl.setAttribute('data-scope', 'for "' + q + '"')
    var tbl = h('table', { class: 'govuk-table app-table-dense' })
    tbl.appendChild(h('caption', { class: 'govuk-table__caption govuk-visually-hidden', text: 'Results for ' + q + ', figures, values, exceptions, items and sources' }))
    tbl.appendChild(h('thead', { class: 'govuk-table__head' }, h('tr', { class: 'govuk-table__row' },
      h('th', { scope: 'col', class: 'govuk-table__header', text: 'Kind' }), h('th', { scope: 'col', class: 'govuk-table__header', text: 'Result' }), h('th', { scope: 'col', class: 'govuk-table__header', text: 'Where it is' }))))
    var tb = h('tbody', { class: 'govuk-table__body' })
    hits.forEach(function (d) {
      tb.appendChild(h('tr', { class: 'govuk-table__row', 'data-result': '' },
        h('td', { class: 'govuk-table__cell' }, h('strong', { class: 'govuk-tag ' + (d.kind === 'Source' ? 'govuk-tag--grey' : 'govuk-tag--blue'), text: d.kind })),
        h('th', { scope: 'row', class: 'govuk-table__header' }, h('a', { class: 'govuk-link', href: d.href }, d.name, h('span', { class: 'govuk-visually-hidden', text: ' on the ' + d.where.replace(/ tab$/, '') + ' tab' }))),
        h('td', { class: 'govuk-table__cell', text: d.where })))
    })
    tbl.appendChild(tb)
    box.appendChild(h('div', { class: 'app-scroll', role: 'region', 'aria-label': 'Search results, scrolls sideways on a small screen', tabindex: '0' }, tbl))
  }
  render()
  SV.wireKeysToggle()
  SV.bindKeys({ s: function () { if (input) { input.focus(); input.select() } } })
})()
