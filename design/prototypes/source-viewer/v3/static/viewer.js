/* The one source viewer (D03, version B+). Every work page and the second window render it from this file; no page draws its own.
   Plain script for the static prototype; the React build wraps the same behaviour.
   B+ = B (sources as tabs, the decision slot) + A's step mechanics and keys + C's done row with Undo. New in this round:
   origin word and dot in words on every source header (EV-10, EV-11), an adjusting entry whose own sources are steps
   (TB-2, TB-9), QBO states (with id, without id, changed since the snapshot), candidates in two groups (RT-16), one
   second-window preference per signed-in person. */
(function () {
  'use strict'
  var D = window.SV_DATA
  var CHANNEL = 'ashbridge-source-viewer'
  var WIN_NAME = 'ashbridge-source-viewer-window'
  var RET = (D && D.client && D.client.name) || 'return'
  var PAGE_W = 612
  var MIN_TEXT_PX = 12
  var KIND = {
    page: ['Document page', 'govuk-tag--blue'], sheet: ['Sheet row', 'govuk-tag--green'], qbo: ['QBO line', 'govuk-tag--turquoise'], aje: ['Adjusting entry', 'govuk-tag--pink'],
    answer: ['Client answer', 'govuk-tag--purple'], cra: ['CRA capture', 'govuk-tag--orange'], lastyear: ['Last year\'s return', 'govuk-tag--grey'], reason: ['Written reason', 'govuk-tag--yellow']
  }
  var SHORT = { page: 'Page', sheet: 'Sheet', qbo: 'QBO', aje: 'Entry', answer: 'Answer', cra: 'CRA', lastyear: 'Last year', reason: 'Reason' }
  var ORIGIN = { third: 'Third party', filed: 'Client filed with CRA', prepared: 'Client prepared', said: 'Client said', judgment: 'Judgment' }
  var DOT = { green: 'a third party agrees', grey: 'single third-party source', amber: 'client only', purple: 'judgment' }
  var DOTNAME = { green: 'Green', grey: 'Grey', amber: 'Amber', purple: 'Purple' }
  var GROUP = { exact: 'exact value', rounds: 'rounds to this value' }

  function h(tag, attrs) {
    var el = document.createElement(tag)
    attrs = attrs || {}
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]
      if (v === null || v === undefined || v === false) return
      if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v)
      else el.setAttribute(k, v === true ? '' : v)
    })
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i]
      if (c === null || c === undefined || c === false) continue
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    }
    return el
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v) } catch (e) { return null } }
  function tabId() { var t = sstore('sv-tab-id'); if (!t) { t = 't' + Math.random().toString(36).slice(2, 8); sstore('sv-tab-id', t) } return t }

  /* ---------------- the signed-in person (per tab session), and what is remembered for them ---------------- */
  function person() {
    if (person._p) return person._p
    var q = new URLSearchParams(location.search), id = q.get('as')
    if (id && D.people[id]) sstore('sv-as', id)
    id = sstore('sv-as') || (document.body && document.body.getAttribute('data-person')) || 'anita'
    person._p = D.people[id] || D.people.anita
    return person._p
  }
  function winPrefAll() { try { return JSON.parse(store('sv-winpref') || '{}') } catch (e) { return {} } }
  function winPref() { return !!winPrefAll()[person().id] }
  function setWinPref(v) { var m = winPrefAll(); m[person().id] = !!v; store('sv-winpref', JSON.stringify(m)) }

  function dyn() { try { return JSON.parse(localStorage.getItem('sv-dyn') || '{}') } catch (e) { return {} } }
  function src(id) { return D.sources[id] || dyn()[id] }
  function itemOf(list, id) { return (D.lists[list] || []).filter(function (f) { return f.id === id })[0] }

  function dotNode(dot, note) {
    return h('span', { class: 'app-dot app-dot--' + dot },
      h('span', { class: 'app-dot__mark', 'aria-hidden': 'true' }),
      h('span', { class: 'govuk-visually-hidden', text: 'Dot: ' }),
      h('span', { text: DOTNAME[dot] + ': ' + (note || DOT[dot]) }))
  }

  /* ---------------- the viewer ---------------- */
  function Viewer(root, opts) {
    this.root = root
    this.o = opts
    this.list = opts.list
    this.role = opts.role || 'pane'
    this.itemId = null
    this.idx = 0 // index in the flat list of steps (an adjusting entry is followed by its own sources)
    this.zoom = 100
    this.extras = {}
    this.live = opts.live || document.getElementById('sv-live')
    this.render()
  }
  Viewer.prototype.helpText = function (it) { var e = this.o.emptyHelp; return typeof e === 'function' ? e(this.list, it) : e }
  Viewer.prototype.item = function () { return this.itemId ? itemOf(this.list, this.itemId) : null }
  Viewer.prototype.ids = function () {
    var it = this.item()
    if (!it) return []
    var own = (it.src || []).concat(this.extras[it.id] || [])
    this.candMode = !own.length && !!(it.cand && it.cand.length)
    return this.candMode ? it.cand.map(function (c) { return c.id }) : own
  }
  Viewer.prototype.steps = function () {
    var ids = this.ids(), out = [], cand = this.candMode
    ids.forEach(function (id, i) {
      out.push({ id: id, top: i, sub: -1 })
      var s = src(id)
      if (!cand && s && s.children) s.children.forEach(function (c, j) { out.push({ id: c, top: i, sub: j }) })
    })
    return out
  }
  function flatIndex(steps, top, sub) { for (var i = 0; i < steps.length; i++) if (steps[i].top === top && steps[i].sub === sub) return i; return 0 }
  /* the position written in the URL: "3" for the third source, "2.3" for the third source of the entry that is source 2 */
  Viewer.prototype.pos = function () {
    var st = this.steps(), c = st[this.idx]
    if (!c) return '1'
    return (c.top + 1) + (c.sub >= 0 ? '.' + (c.sub + 1) : '')
  }
  Viewer.prototype.idxFromPos = function (txt) {
    var m = String(txt || '1').split('.'), st = this.steps()
    var top = (parseInt(m[0], 10) || 1) - 1, sub = m[1] ? (parseInt(m[1], 10) || 1) - 1 : -1
    return flatIndex(st, top, sub)
  }
  Viewer.prototype.addSource = function (itemId, sid) { this.extras[itemId] = (this.extras[itemId] || []).concat([sid]) }
  Viewer.prototype.announce = function (msg) { if (this.live) { this.live.textContent = ''; var l = this.live; setTimeout(function () { l.textContent = msg }, 30) } }

  Viewer.prototype.show = function (itemId, idx, o) {
    o = o || {}
    this.itemId = itemId
    this.idx = Math.max(0, Math.min(idx || 0, Math.max(0, this.steps().length - 1)))
    this.render(o)
    if (this.o.onChange && !o.silent) this.o.onChange(this.itemId, this.idx)
  }
  Viewer.prototype.step = function (d, o) {
    var n = this.steps().length
    if (!this.itemId || n < 2) { this.announce(n < 2 && this.itemId ? 'This figure has one source' : 'No figure selected'); return }
    var next = this.idx + d
    if (next < 0 || next >= n) { this.announce(d > 0 ? 'Last source reached' : 'First source reached'); return }
    this.show(this.itemId, next, o || { focusIn: true })
  }
  Viewer.prototype.dotOf = function (s, it) { return (it && it.dots && it.dots[s._id]) || s.dot }

  /* a redraw never drops the field a person is typing in: when the page redraws (a step from the other window, a tab
     change), the slot field that had focus gets it back */
  Viewer.prototype.render = function (o) {
    o = o || {}
    var ae = document.activeElement
    var keep = (!o.focusIn && ae && ae.id && ae.closest && ae.closest('.app-viewer__foot')) ? ae.id : null
    this._render(o)
    if (keep) { var again = document.getElementById(keep); if (again) again.focus({ preventScroll: true }) }
    if (this.o.afterRender) this.o.afterRender(this)
    syncErrorTitle()
  }
  /* rule 4: the title starts "Error: " exactly while an error summary shows, whichever part drew it (a form, the failed page image) */
  function syncErrorTitle() {
    var shown = Array.prototype.some.call(document.querySelectorAll('.govuk-error-summary'), function (e) { return e.getClientRects().length > 0 })
    var plain = document.title.replace(/^Error: /, '')
    var want = shown ? 'Error: ' + plain : plain
    if (want !== document.title) document.title = want
  }
  Viewer.prototype._render = function (o) {
    var root = this.root
    root.textContent = ''
    var host = this.o.slotHost ? this.o.slotHost() : null
    if (host) host.textContent = ''
    var it = this.item()
    var win = this.role === 'window'
    var section = h('div', { class: 'app-viewer' + (win ? ' app-viewer--window' : '') })
    root.appendChild(section)
    this._zoomCtl = null
    this.curSrc = null
    this.stage = null
    if (!it) {
      section.appendChild(h('div', { class: 'app-viewer__head' }, h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: 'Source viewer' })))
      section.appendChild(h('div', { class: 'app-viewer__empty' },
        h('p', { class: 'govuk-body', text: win ? 'No figure selected yet. This window shows the source of whatever is selected on the work page, and follows each change.' : 'No figure selected. Choose "Show sources" on a row to see its evidence here, beside the list.' }),
        this.o.onBack ? h('p', { class: 'govuk-body app-only-narrow' }, this.backButton()) : null))
      return
    }
    var steps = this.steps(), ids = this.ids(), n = ids.length, total = steps.length
    var titleText = it.title || (it.name + (it.amount ? ', ' + it.amount : ''))
    var head = h('div', { class: 'app-viewer__head' })
    head.appendChild(h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: titleText }))
    section.appendChild(head)
    if (this.o.onBack) head.appendChild(this.backButton(true))
    var note = this.o.noteFor ? this.o.noteFor(it, this) : null
    if (!note && it.flag) note = h('p', { class: 'app-viewer__note' }, h('strong', { class: 'govuk-tag govuk-tag--red', text: 'Flagged for a person' }), ' ' + it.flag.id + ' ' + it.flag.text)
    if (note) section.appendChild(note)

    if (!total) {
      var facts = it.facts ? this.summary(it.facts) : null
      section.appendChild(h('div', { class: 'app-viewer__body' }, h('div', { class: 'app-viewer__stage', 'data-evidence': '', tabindex: '0', role: 'region', 'aria-label': 'Evidence for ' + it.name },
        h('div', { class: 'app-viewer__card', tabindex: '-1', id: 'sv-card-' + this.role },
          facts,
          h('div', { class: 'govuk-warning-text app-warning' }, h('span', { class: 'govuk-warning-text__icon', 'aria-hidden': 'true', text: '!' }),
            h('strong', { class: 'govuk-warning-text__text' }, h('span', { class: 'govuk-visually-hidden', text: 'Warning' }), 'Not checked: no evidence')),
          h('p', { class: 'govuk-body', text: it.note || 'Nothing is attached to this item: no document, sheet row, QBO line, client answer, CRA capture, last year\'s cell or written reason.' }),
          (it.facts || !this.helpText(it)) ? null : h('p', { class: 'govuk-body', text: this.helpText(it) })))))
      this.mountSlot(section, host, it, null)
      if (o.focusIn) this.focusCard()
      this.announce('Sources for ' + it.name + ': not checked, no evidence')
      return
    }

    var cur = steps[Math.min(this.idx, total - 1)]
    var sid = cur.id
    var s = src(sid)
    s._id = sid
    this.curSrc = s
    var kind = KIND[s.kind]
    var card = this.renderCard(s, it)
    if (this._zoomCtl) head.appendChild(this._zoomCtl)

    // the steps (MOJ sub navigation) and, inside an adjusting entry, the entry's own sources one level down
    if (total > 1) {
      var nav = this.navSteps(steps, it)
      if (win) head.insertBefore(nav, this._zoomCtl); else section.appendChild(nav)
      var sub = this.navSub(steps)
      if (sub) section.appendChild(sub)
    }

    // which source (its place in the steps is said in words for a screen reader), its kind, then origin and dot in words (EV-10, EV-11)
    var meta = h('p', { class: 'app-viewer__meta', id: 'sv-meta-' + this.role })
    meta.appendChild(h('span', { class: 'govuk-visually-hidden', text: this.countText(cur, n) + ': ' }))
    if (this.candMode) { var gw = GROUP[it.cand[cur.top].group]; meta.appendChild(h('strong', { class: 'app-meta-group', text: gw.charAt(0).toUpperCase() + gw.slice(1) + '. ' })) }
    meta.appendChild(document.createTextNode(s.title + (s.page ? ', ' + s.page : '') + '.'))
    section.appendChild(meta)
    var prov = h('p', { class: 'app-viewer__prov' })
    prov.appendChild(h('strong', { class: 'govuk-tag ' + kind[1] }, h('span', { class: 'govuk-visually-hidden', text: 'Kind: ' }), kind[0]))
    prov.appendChild(h('strong', { class: 'govuk-tag govuk-tag--grey app-tag-origin' }, h('span', { class: 'govuk-visually-hidden', text: 'Origin: ' }), ORIGIN[s.origin]))
    prov.appendChild(dotNode(this.dotOf(s, it), s.dotNote))
    if (s.flagEvidence) prov.appendChild(h('strong', { class: 'govuk-tag govuk-tag--red', text: 'Evidence for the flag' }))
    section.appendChild(prov)

    var stage = h('div', { class: 'app-viewer__stage', 'data-evidence': '', tabindex: '0', role: 'region', 'aria-label': this.countText(cur, n) + ': ' + kind[0] })
    stage.appendChild(card)
    section.appendChild(h('div', { class: 'app-viewer__body' }, stage))
    this.stage = stage
    this.mountSlot(section, host, it, sid)

    this.announce(this.countText(cur, n) + ': ' + kind[0] + ', ' + s.title)
    if (s.kind === 'page') { this.applyZoom(); this.afterPage(o) }
    else if (s.kind === 'sheet') this.afterSheet(o)
    else if (o.focusIn) this.focusCard()
  }
  /* the decision slot: inside the pane, or in the work column while the second window shows the source */
  Viewer.prototype.mountSlot = function (section, host, it, sid) {
    if (!this.o.extra) return
    var ex = this.o.extra(it, sid, this)
    if (!ex) return
    if (host) host.appendChild(ex); else section.appendChild(ex)
  }
  Viewer.prototype.countText = function (cur, n) {
    var base = (this.candMode ? 'Candidate ' : 'Source ') + (cur.top + 1) + ' of ' + n
    if (cur.sub >= 0) base += ', entry source ' + (cur.sub + 1) + ' of ' + src(this.ids()[cur.top]).children.length
    return base
  }

  Viewer.prototype.backButton = function (inline) {
    var self = this
    return h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact' + (inline ? ' app-only-narrow' : ''), 'aria-keyshortcuts': 'Escape', onclick: function () { self.o.onBack() } }, 'Back to the list ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: 'Esc' }))
  }
  function stepBtn(glyph, name, key, fn) {
    return h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact app-button-glyph', 'aria-keyshortcuts': key, onclick: fn }, h('span', { 'aria-hidden': 'true', text: glyph }), h('span', { class: 'govuk-visually-hidden', text: name }))
  }
  Viewer.prototype.navSteps = function (steps, it) {
    var self = this, ids = this.ids(), cur = steps[this.idx]
    var nav = h('nav', { class: 'moj-sub-navigation app-viewer__steps', 'aria-label': (this.candMode ? 'Candidate sources' : 'Sources') + ' of this figure' })
    var ul = h('ul', { class: 'moj-sub-navigation__list' })
    var groups = this.candMode ? it.cand.map(function (c) { return c.group }) : []
    var mixed = groups.indexOf('exact') >= 0 && groups.indexOf('rounds') >= 0
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      // the two candidate groups sit apart (RT-16): exact value first, then a divider; each header names its group in words
      if (mixed && i > 0 && groups[i] !== groups[i - 1]) ul.appendChild(h('li', { class: 'moj-sub-navigation__item app-steps__sep', 'aria-hidden': 'true' }))
      var label = (i + 1) + ' ' + SHORT[s.kind]
      var hidden = h('span', { class: 'govuk-visually-hidden', text: ': ' + (self.candMode ? 'candidate ' : 'source ') + (i + 1) + ' of ' + ids.length + ', ' + k[0] + (self.candMode ? ', ' + GROUP[groups[i]] : '') + (self.o.isMarked && self.o.isMarked(self.itemId, id) ? ', ticked' : '') })
      var tick = self.o.isMarked && self.o.isMarked(self.itemId, id) ? ' ✓' : ''
      var el
      if (cur.top === i) el = h('span', { class: 'moj-sub-navigation__link app-steps__current', 'aria-current': 'step' }, label + tick, hidden)
      else el = h('button', { type: 'button', class: 'moj-sub-navigation__link app-reset-button', onclick: function () { self.show(self.itemId, flatIndex(steps, i, -1), { focusIn: true }) } }, label + tick, hidden)
      ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, el))
    })
    // a step that cannot run is absent, not disabled (rule 8); the keys still announce the end
    if (this.idx > 0) ul.appendChild(h('li', { class: 'moj-sub-navigation__item app-steps__go' }, stepBtn('‹', 'Previous source', '[', function () { self.step(-1) })))
    if (this.idx < steps.length - 1) ul.appendChild(h('li', { class: 'moj-sub-navigation__item app-steps__go' }, stepBtn('›', 'Next source', ']', function () { self.step(1) })))
    nav.appendChild(ul)
    return nav
  }
  /* an adjusting entry shows its own sources as a second row of steps (TB-2, TB-9); stepping with ] runs through them */
  Viewer.prototype.navSub = function (steps) {
    var self = this, cur = steps[this.idx]
    if (this.candMode) return null
    var top = src(this.ids()[cur.top])
    if (!top || !top.children) return null
    var nav = h('nav', { class: 'moj-sub-navigation app-viewer__steps app-viewer__steps--sub', 'aria-label': 'Sources of ' + top.title })
    var ul = h('ul', { class: 'moj-sub-navigation__list' })
    function item(label, hiddenText, active, to) {
      var hid = h('span', { class: 'govuk-visually-hidden', text: hiddenText })
      var el = active ? h('span', { class: 'moj-sub-navigation__link app-steps__current', 'aria-current': 'step' }, label, hid)
        : h('button', { type: 'button', class: 'moj-sub-navigation__link app-reset-button', onclick: function () { self.show(self.itemId, flatIndex(steps, cur.top, to), { focusIn: true }) } }, label, hid)
      ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, el))
    }
    item('Entry', ': the entry itself, with its type, reason and lines', cur.sub === -1, -1)
    top.children.forEach(function (cid, j) {
      var c = src(cid)
      item(c.kind === 'sheet' ? String(j + 1) : 'List', ': entry source ' + (j + 1) + ' of ' + top.children.length + ', ' + KIND[c.kind][0] + (c.kind === 'sheet' ? ', row ' + c.boxRow : ''), cur.sub === j, j)
    })
    nav.appendChild(ul)
    return nav
  }

  /* -------- cards, one per source kind (EV-5) -------- */
  Viewer.prototype.renderCard = function (s, it) {
    var self = this
    var card = h('div', { class: 'app-viewer__card', tabindex: '-1', id: 'sv-card-' + this.role })
    this._failedShown = false
    if (s.kind === 'page') {
      if (this.failedNow(s)) { this._failedShown = true; card.appendChild(this.failedCard(s)); return card }
      this._zoomCtl = h('div', { class: 'app-viewer__zoom', role: 'group', 'aria-label': 'Zoom the page' },
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact app-button-glyph', onclick: function () { self.setZoom(-25) } }, h('span', { 'aria-hidden': 'true', text: '−' }), h('span', { class: 'govuk-visually-hidden', text: 'Zoom out' })),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact app-button-glyph', onclick: function () { self.setZoom(25) } }, h('span', { 'aria-hidden': 'true', text: '+' }), h('span', { class: 'govuk-visually-hidden', text: 'Zoom in' })),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { self.setZoom(0) } }, 'Fit box'),
        h('span', { class: 'app-zoom-level', id: 'sv-zoom-' + this.role, text: '' }))
      var slow = sstore('sv-slow') === '1'
      var page = h('div', { class: 'app-page app-page--loading', id: 'sv-pagebox-' + this.role, 'data-min-text': s.minText || 11 })
      var img = h('img', { alt: s.alt, width: '612', height: '792' })
      var skel = h('div', { class: 'app-skeleton', role: 'status' }, h('span', { class: 'govuk-visually-hidden', text: 'Loading the page image' }))
      page.appendChild(skel)
      var b = s.box
      var below = b.y < 5
      var box = h('div', { class: 'app-box' + (below ? ' app-box--below' : ''), id: 'sv-box-' + this.role, tabindex: '-1', role: 'group', 'aria-label': 'Boxed figure. Words found inside the box: ' + s.ocr, 'data-box': b.x + ',' + b.y + ',' + b.w + ',' + b.h },
        h('span', { class: 'app-box__label', text: 'Boxed figure' }))
      var stamp = ++this._stamp || (this._stamp = 1)
      img.addEventListener('load', function () {
        if (self._stamp !== stamp) return
        page.className = 'app-page app-page--loaded'
        page.appendChild(box)
        self.placeBox(box)
        self.scrollToBox()
        // focus went to the card at once; once the box exists it moves to the box, unless the person has moved on
        if (self._pendingFocus) {
          self._pendingFocus = false
          var ae = document.activeElement
          if (!ae || ae === document.body || ae.id === 'sv-card-' + self.role) box.focus({ preventScroll: true })
        }
      })
      img.addEventListener('error', function () { if (self._stamp !== stamp) return; self.markFailed(s) })
      page.insertBefore(img, skel)
      var load = function () { img.src = D.base + s.img }
      if (slow) setTimeout(load, 1500); else load()
      card.appendChild(page)
      card.appendChild(h('p', { class: 'govuk-hint govuk-!-margin-top-1 govuk-!-margin-bottom-1', text: 'Read from inside the box only: these are the words the extracted value is checked against. No confidence score is shown.' }))
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1' }, 'Words inside the box: ', h('span', { class: 'app-ocr', text: s.ocr })))
      if (s.extracted) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: 'Extracted value: ' + s.extracted }))
      if (s.masked) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: 'Masked in the image: ' + s.masked + '.' }))
    } else if (s.kind === 'sheet') {
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: s.note + ' of ' + s.file + '. The outlined cell is the figure.' }))
      var tbl = h('table', { class: 'app-sheet' })
      tbl.appendChild(h('caption', { class: 'govuk-visually-hidden', text: s.file + ', rows ' + s.rows.filter(function (r) { return r > 1 }).join(', ') + ' and the header' }))
      var letters = 'ABCDEFGH'
      var hr = h('tr', {}, h('th', { scope: 'col', text: 'Row' }))
      s.header.forEach(function (c, i) { hr.appendChild(h('th', { scope: 'col' }, letters[i] + ': ' + c)) })
      tbl.appendChild(h('thead', {}, hr))
      var tb = h('tbody', {})
      s.grid.forEach(function (r) {
        var tr = h('tr', {}, h('th', { scope: 'row', text: String(r.line) }))
        r.cells.forEach(function (c, ci) {
          var boxed = r.line === s.boxRow && ci === s.boxCol
          var td = h('td', { class: (s.numCols.indexOf(ci) >= 0 ?'app-num' : '') + (boxed ? ' app-cell-boxed' : ''), id: boxed ? 'sv-box-' + self.role : null, tabindex: boxed ? '-1' : null, 'aria-label': boxed ? 'Boxed figure, row ' + r.line + ', column ' + letters[ci] + ': ' + c : null }, c)
          if (boxed) td.appendChild(h('span', { class: 'govuk-visually-hidden', text: ' (Boxed figure)' }))
          tr.appendChild(td)
        })
        tb.appendChild(tr)
      })
      tbl.appendChild(tb)
      card.appendChild(h('div', { class: 'app-sheet-wrap', role: 'region', 'aria-label': 'Sheet grid, scrolls sideways', tabindex: '0' }, tbl))
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-top-2 govuk-!-margin-bottom-0' }, 'Boxed cell: ', h('span', { class: 'app-ocr', text: s.grid.filter(function (r) { return r.line === s.boxRow })[0].cells[s.boxCol] })))
    } else if (s.kind === 'answer') {
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: 'Question asked' }))
      card.appendChild(h('p', { class: 'govuk-body govuk-!-margin-bottom-2', text: s.question }))
      card.appendChild(h('div', { class: 'govuk-inset-text govuk-!-margin-top-0' }, h('span', { class: 'govuk-visually-hidden', text: 'The client wrote: ' }), s.answer))
    } else if (s.kind === 'reason') {
      card.appendChild(h('div', { class: 'govuk-inset-text govuk-!-margin-top-0' }, s.reason))
    } else if (s.kind === 'aje') {
      var a = s.aje
      card.appendChild(this.summary([['Type', a.type], ['Date', a.date], ['Amount', a.amount], ['Reason', a.reason]]))
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-top-2 govuk-!-margin-bottom-1', text: 'Memo in QBO (the type, reason and sources are written there)' }))
      card.appendChild(h('div', { class: 'govuk-inset-text govuk-!-margin-top-0 govuk-!-margin-bottom-2 app-memo' }, a.memo))
      var lt = h('table', { class: 'govuk-table app-table-dense app-lines' })
      lt.appendChild(h('caption', { class: 'govuk-table__caption govuk-table__caption--s', text: 'Lines of the entry, 31 Dec 2025' }))
      lt.appendChild(h('thead', { class: 'govuk-table__head' }, h('tr', { class: 'govuk-table__row' },
        h('th', { scope: 'col', class: 'govuk-table__header', text: 'Account' }), h('th', { scope: 'col', class: 'govuk-table__header govuk-table__header--numeric', text: 'Debit' }), h('th', { scope: 'col', class: 'govuk-table__header govuk-table__header--numeric', text: 'Credit' }))))
      var ltb = h('tbody', { class: 'govuk-table__body' })
      a.lines.forEach(function (l) { ltb.appendChild(h('tr', { class: 'govuk-table__row' }, h('th', { scope: 'row', class: 'govuk-table__header', text: l[0] }), h('td', { class: 'govuk-table__cell govuk-table__cell--numeric', text: l[1] }), h('td', { class: 'govuk-table__cell govuk-table__cell--numeric', text: l[2] }))) })
      ltb.appendChild(h('tr', { class: 'govuk-table__row' }, h('th', { scope: 'row', class: 'govuk-table__header', text: 'Total' }), h('td', { class: 'govuk-table__cell govuk-table__cell--numeric', text: a.debits }), h('td', { class: 'govuk-table__cell govuk-table__cell--numeric', text: a.credits })))
      lt.appendChild(ltb)
      card.appendChild(lt)
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: 'Debits equal credits, so the lines net to zero. The entry has ' + s.children.length + ' sources of its own: press ] or use the next source button to step through them.' }))
    } else {
      // a QBO line, a CRA capture, last year's cell
      if (s.snapshot) card.appendChild(h('p', { class: 'govuk-body-s', text: s.snapshot + '.' }))
      if (s.kind === 'cra' && s.pulled) card.appendChild(h('p', { class: 'govuk-body-s', text: 'Auto-fill figures are stored with the date they were pulled: ' + s.pulled + '.' }))
      if (s.noId) {
        card.appendChild(h('div', { class: 'app-noid' },
          h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1' }, h('strong', { class: 'govuk-tag govuk-tag--red', text: s.flag }), ' No QBO id: matched by date, type, number, account and amount.'),
          h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0' }, 'Composite key: ', h('span', { class: 'app-ocr', text: s.compositeKey }))))
      }
      if (s.changed) {
        var c = s.changed
        card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1' }, h('strong', { class: 'govuk-tag govuk-tag--red', text: 'Books changed after approval' }), ' ' + c.item + ': changed by ' + c.change + '.'))
        var ct = h('table', { class: 'govuk-table app-table-dense' })
        ct.appendChild(h('caption', { class: 'govuk-table__caption govuk-visually-hidden', text: 'Before and after: ' + c.item }))
        ct.appendChild(h('thead', { class: 'govuk-table__head' }, h('tr', { class: 'govuk-table__row' },
          h('th', { scope: 'col', class: 'govuk-table__header' }, h('span', { class: 'govuk-visually-hidden', text: 'Measure' })), h('th', { scope: 'col', class: 'govuk-table__header', text: 'Snapshot used for the approval' }), h('th', { scope: 'col', class: 'govuk-table__header', text: 'Read again' }))))
        var cb = h('tbody', { class: 'govuk-table__body' })
        ;[['Read on', c.snapBefore, c.snapAfter], ['Fingerprint', c.fpBefore, c.fpAfter], [c.measure, c.before, c.after]].forEach(function (r) {
          cb.appendChild(h('tr', { class: 'govuk-table__row' }, h('th', { scope: 'row', class: 'govuk-table__header', text: r[0] }), h('td', { class: 'govuk-table__cell', text: r[1] }), h('td', { class: 'govuk-table__cell', text: r[2] })))
        })
        ct.appendChild(cb)
        card.appendChild(ct)
        card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: 'The approval is void and the return is back in trace. Nothing to decide on this screen.' }))
      } else card.appendChild(this.summary(s.fields))
    }
    // who added it and when: kept with the source, below the evidence (the origin and the dot are in the header)
    card.appendChild(h('p', { class: 'govuk-body-s app-card__added', text: 'Added: ' + s.who + ', ' + s.when + '.' + (s.flagEvidence ? ' It is the evidence for the flag.' : '') }))
    return card
  }
  Viewer.prototype.summary = function (fields) {
    var dl = h('dl', { class: 'govuk-summary-list govuk-summary-list--no-border' })
    fields.forEach(function (f) { dl.appendChild(h('div', { class: 'govuk-summary-list__row' }, h('dt', { class: 'govuk-summary-list__key', text: f[0] }), h('dd', { class: 'govuk-summary-list__value', text: f[1] }))) })
    return dl
  }

  /* failed state with a retry (brief budgets) */
  Viewer.prototype.failedNow = function (s) {
    if (!s.failFirst) return false
    if (sstore('sv-failed-' + s.img) === 'done') return false
    return !this._retried
  }
  Viewer.prototype.markFailed = function (s) {
    var card = document.getElementById('sv-card-' + this.role)
    if (!card) return
    this._retried = false
    card.textContent = ''
    card.appendChild(this.failedCard(s))
    syncErrorTitle()
  }
  Viewer.prototype.failedCard = function (s) {
    var self = this
    return h('div', { class: 'govuk-error-summary', role: 'alert', 'data-module': 'govuk-error-summary' },
      h('div', { class: 'govuk-error-summary__body' },
        h('h3', { class: 'govuk-error-summary__title', text: 'The page image did not load' }),
        h('p', { class: 'govuk-body', text: 'The figure is not lost. Nothing was changed. Try again; if it fails twice, tell the Lead.' }),
        h('button', { type: 'button', class: 'govuk-button app-button-compact', onclick: function () { sstore('sv-failed-' + s.img, 'done'); self._retried = true; self.render({ focusIn: true }) } }, 'Try again')))
  }

  /* ---------------- zoom: opens readable with the box whole, never clips the box ---------------- */
  Viewer.prototype.cardWidth = function () {
    var c = document.getElementById('sv-card-' + this.role)
    if (!c || !c.clientWidth) return 0
    var cs = getComputedStyle(c)
    return c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  }
  Viewer.prototype.bounds = function (s, cw) {
    var mt = s.minText || 11, bw = s.box.w / 100
    var read = Math.max(100, Math.ceil(PAGE_W * MIN_TEXT_PX / mt / cw * 100))
    var fit = Math.floor((cw - 6) * 100 / (cw * bw))
    return { read: Math.min(300, read), fit: fit, max: Math.min(300, Math.max(fit, read)) }
  }
  /* delta undefined: open (saved size, else readable); 0: back to readable; else step. The page width and the box position
     are the two inline styles the rules allow, and they are set here by script (rule 1). */
  Viewer.prototype.applyZoom = function (delta) {
    var s = this.curSrc
    if (!s || s.kind !== 'page') return
    var cw = this.cardWidth()
    var pb = document.getElementById('sv-pagebox-' + this.role)
    if (!pb || cw <= 0) return
    var b = this.bounds(s, cw), pref = sstore('sv-zoom-page')
    var want
    if (delta === 0) { sstore('sv-zoom-page', ''); want = b.read }
    else if (typeof delta === 'number') want = (this.zoom || b.read) + delta
    else want = pref ? Number(pref) : b.read
    var z = Math.max(50, Math.min(b.max, want))
    var capped = typeof delta === 'number' && delta > 0 && want > b.max
    if (typeof delta === 'number' && delta !== 0) sstore('sv-zoom-page', String(z))
    this.zoom = z
    pb.style.width = z + '%'
    var lab = document.getElementById('sv-zoom-' + this.role)
    if (lab) lab.textContent = z + '%' + (z >= b.max ? ' largest' : z <= 50 ? ' smallest' : '')
    if (typeof delta === 'number') this.announce(capped ? 'Zoom ' + z + ' percent, the largest size at which the whole box shows' : delta === 0 ? 'Back to the readable size, zoom ' + z + ' percent' : 'Zoom ' + z + ' percent')
    this.scrollToBox()
  }
  Viewer.prototype.placeBox = function (box) {
    var p = (box.getAttribute('data-box') || '').split(',')
    if (p.length === 4) { box.style.left = p[0] + '%'; box.style.top = p[1] + '%'; box.style.width = p[2] + '%'; box.style.height = p[3] + '%' }
  }
  Viewer.prototype.setZoom = function (d) { this.applyZoom(d) }
  Viewer.prototype.refit = function () { if (this.curSrc && this.curSrc.kind === 'page') this.applyZoom() }
  Viewer.prototype.scrollToBox = function () {
    var stage = this.stage, box = document.getElementById('sv-box-' + this.role)
    if (!stage || !box) return
    var sr = stage.getBoundingClientRect(), br = box.getBoundingClientRect()
    stage.scrollTop += (br.top - sr.top) - (stage.clientHeight - br.height) / 3
    if (br.width <= stage.clientWidth - 16) stage.scrollLeft += (br.left - sr.left) - (stage.clientWidth - br.width) / 2
    else stage.scrollLeft += (br.left - sr.left) - 8 // wider than the pane: its left edge, never both edges clipped
  }
  /* focus goes into the card at once (never to the body), and on to the box when the page image has loaded */
  Viewer.prototype.afterPage = function (o) {
    this._pendingFocus = false
    if (!o.focusIn) return
    this.focusCard()
    if (!this._failedShown) this._pendingFocus = true
  }
  Viewer.prototype.afterSheet = function (o) {
    var self = this
    if (o.focusIn) this.focusCard()
    setTimeout(function () {
      var b = document.getElementById('sv-box-' + self.role)
      if (b && self.stage) {
        var wrap = b.closest('.app-sheet-wrap')
        if (wrap) { var br = b.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); wrap.scrollLeft += br.left - wr.left - (wrap.clientWidth - br.width) / 2 }
        var ae = document.activeElement
        if (o.focusIn && (!ae || ae === document.body || ae.id === 'sv-card-' + self.role)) b.focus({ preventScroll: true })
      }
    }, 0)
  }
  Viewer.prototype.focusCard = function () {
    var c = document.getElementById('sv-card-' + this.role)
    if (c) c.focus({ preventScroll: true })
  }

  /* ---------------- shortcuts (rules 10, 22) ---------------- */
  function keysOff() { return store('sv-keys-off') === '1' }
  function inField(t) { return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) }
  function bindKeys(handlers) {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (inField(e.target)) return
      if (e.key === 'Escape') { if (handlers.Escape) handlers.Escape(e); return }
      if (keysOff()) return
      var f = handlers[e.key]
      if (f) { e.preventDefault(); f(e) }
    })
  }
  function wireKeysToggle() {
    var cb = document.getElementById('sv-keys-off')
    if (!cb) return
    cb.checked = keysOff()
    cb.addEventListener('change', function () { store('sv-keys-off', cb.checked ? '1' : '0') })
    var sl = document.getElementById('sv-slow')
    if (sl) { sl.checked = sstore('sv-slow') === '1'; sl.addEventListener('change', function () { sstore('sv-slow', sl.checked ? '1' : '0') }) }
  }

  /* ---------------- the second window (rule 20), a two-way link ----------------
     Every page announces itself on load (work-hello, win-hello) and answers the other's hello. Presence is a heartbeat
     (every 2 s, closed after 6 s of silence), never a window handle, so a reload of either page keeps the link.
     Every message carries the return id; another return's page never drives this window. The window opens only on a
     user gesture (a click or a key press), never on load. */
  function SecondWindow(o) {
    // o: url, getState() -> {item, idx, list, extras}, onState(state, follow), onWindowStep(item, idx)
    this.o = o
    this.tab = tabId()
    this.alive = false
    this.follow = true
    this.lastBeat = 0
    this.ch = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL) : null
    var self = this
    if (this.ch) this.ch.onmessage = function (e) {
      var m = e.data || {}
      if (m.ret !== RET) return
      if (m.t === 'win-hello' || m.t === 'win-beat' || m.t === 'win-follow') {
        var was = self.alive, wasFollow = self.follow
        self.alive = true; self.follow = m.follow !== false; self.lastBeat = Date.now()
        if (m.t === 'win-hello' || !was) self.push()
        if (!was || m.t === 'win-follow' || wasFollow !== self.follow) self.setState('open')
      }
      if (m.t === 'step' && m.target === self.tab && self.o.onWindowStep) self.o.onWindowStep(m.item, m.idx)
      if (m.t === 'closing') { self.alive = false; self.setState('closed') }
    }
    setInterval(function () {
      if (!self.ch) return
      self.ch.postMessage({ t: 'work-beat', ret: RET, tab: self.tab })
      if (self.alive && Date.now() - self.lastBeat > 6000) { self.alive = false; self.setState('closed') }
    }, 2000)
    window.addEventListener('pagehide', function () { if (self.ch) self.ch.postMessage({ t: 'workclosed', ret: RET, tab: self.tab }) })
    window.addEventListener('focus', function () { if (self.alive) self.push() })
    if (this.ch) this.ch.postMessage({ t: 'work-hello', ret: RET, tab: this.tab })
  }
  SecondWindow.prototype.open = function () {
    var w = null
    if (this.alive) { try { w = window.open('', WIN_NAME) } catch (e) { w = null } if (w) { try { w.focus() } catch (e2) { /* focus refused */ } this.push(); return true } }
    w = window.open(this.o.url + '?ret=' + encodeURIComponent(RET), WIN_NAME, 'popup=yes,width=900,height=760') // no noopener: the link back is needed
    if (!w) { this.alive = false; this.setState('blocked'); return false }
    this.alive = true; this.follow = true; this.lastBeat = Date.now()
    this.setState('open')
    return true
  }
  SecondWindow.prototype.push = function () {
    var s = this.o.getState()
    var msg = { t: 'select', ret: RET, tab: this.tab, item: s.item, idx: s.idx, list: s.list, extras: s.extras, recordTab: s.recordTab }
    if (this.ch) this.ch.postMessage(msg)
    store('sv-last', JSON.stringify(msg))
  }
  /* the person turned the second window off: the window is told, turns Follow off and the pane comes back here */
  SecondWindow.prototype.detach = function () { if (this.ch && this.alive) this.ch.postMessage({ t: 'work-detach', ret: RET, tab: this.tab }) }
  /* the person turned the second window back on while it is still open: it follows again */
  SecondWindow.prototype.attach = function () { if (this.ch && this.alive) this.ch.postMessage({ t: 'work-attach', ret: RET, tab: this.tab }) }
  SecondWindow.prototype.setState = function (st) { this.state = st; if (this.o.onState) this.o.onState(st, this.follow) }

  window.SV = { src: src, h: h, Viewer: Viewer, bindKeys: bindKeys, wireKeysToggle: wireKeysToggle, SecondWindow: SecondWindow, itemOf: itemOf, store: store, sstore: sstore, CHANNEL: CHANNEL, KIND: KIND, ORIGIN: ORIGIN, RET: RET, tabId: tabId, person: person, winPref: winPref, setWinPref: setWinPref, dotNode: dotNode, inField: inField, syncErrorTitle: syncErrorTitle }
})()
