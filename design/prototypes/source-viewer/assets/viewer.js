/* The one source viewer (D03). Every page and every second window renders it from this file; no page draws its own.
   Plain script for the static prototypes; the React build wraps the same behaviour.
   Fix round 1: opening zoom that fits the box and keeps text readable, one row of chrome above the page, a decision slot
   (extra), selection in the URL, a two-way link to the second window with a heartbeat. */
(function () {
  'use strict'
  var D = window.SV_DATA
  var CHANNEL = 'ashbridge-source-viewer'
  var WIN_NAME = 'ashbridge-source-viewer-window'
  var RET = (D && D.client && D.client.name) || 'return'
  var PAGE_W = 612
  var MIN_TEXT_PX = 12
  var KIND = {
    page: ['Document page', 'govuk-tag--blue'], sheet: ['Sheet row', 'govuk-tag--green'], qbo: ['QBO line', 'govuk-tag--turquoise'],
    answer: ['Client answer', 'govuk-tag--purple'], cra: ['CRA capture', 'govuk-tag--orange'], lastyear: ['Last year\'s return', 'govuk-tag--pink'],
    reason: ['Written reason', 'govuk-tag--yellow']
  }
  var SHORT = { page: 'Page', sheet: 'Sheet', qbo: 'QBO', answer: 'Answer', cra: 'CRA', lastyear: 'Last year', reason: 'Reason' }

  function h(tag, attrs) {
    var el = document.createElement(tag)
    attrs = attrs || {}
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]
      if (v === null || v === undefined || v === false) return
      if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k === 'style') el.setAttribute('style', v)
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

  function dyn() { try { return JSON.parse(localStorage.getItem('sv-dyn') || '{}') } catch (e) { return {} } }
  function src(id) { return D.sources[id] || dyn()[id] }
  function itemOf(list, id) { return (D.lists[list] || []).filter(function (f) { return f.id === id })[0] }
  function srcIds(item, extra) { return (item.src || []).concat(extra || []) }

  /* ---------------- the viewer ---------------- */
  function Viewer(root, opts) {
    this.root = root
    this.o = opts
    this.list = opts.list
    this.layout = opts.layout || 'strip'
    this.role = opts.role || 'pane'
    this.itemId = null
    this.idx = 0
    this.zoom = 100
    this.extras = {}
    this.live = opts.live || document.getElementById('sv-live')
    this.render()
  }
  Viewer.prototype.item = function () { return this.itemId ? itemOf(this.list, this.itemId) : null }
  Viewer.prototype.ids = function () {
    var it = this.item()
    if (!it) return []
    var own = srcIds(it, this.extras[it.id])
    this.candMode = !own.length && !!(it.cand && it.cand.length)
    return this.candMode ? it.cand : own
  }
  Viewer.prototype.addSource = function (itemId, sid) {
    this.extras[itemId] = (this.extras[itemId] || []).concat([sid])
  }
  Viewer.prototype.announce = function (msg) { if (this.live) { this.live.textContent = ''; var l = this.live; setTimeout(function () { l.textContent = msg }, 30) } }

  Viewer.prototype.show = function (itemId, idx, o) {
    o = o || {}
    this.itemId = itemId
    this.idx = Math.max(0, Math.min(idx || 0, Math.max(0, this.ids().length - 1)))
    this.render(o)
    if (this.o.onChange && !o.silent) this.o.onChange(this.itemId, this.idx)
  }
  Viewer.prototype.step = function (d, o) {
    var n = this.ids().length
    if (!this.itemId || n < 2) { this.announce(n < 2 && this.itemId ? 'This figure has one source' : 'No figure selected'); return }
    var next = this.idx + d
    if (next < 0 || next >= n) { this.announce(d > 0 ? 'Last source reached: source ' + n + ' of ' + n : 'First source: source 1 of ' + n); return }
    this.show(this.itemId, next, o || { focusIn: true })
  }

  Viewer.prototype.render = function (o) {
    o = o || {}
    var root = this.root
    root.textContent = ''
    var it = this.item()
    var win = this.role === 'window'
    var section = h('div', { class: 'app-viewer' + (win ? ' app-viewer--window' : '') })
    root.appendChild(section)
    this._zoomCtl = null
    this.curSrc = null
    if (!it) {
      section.appendChild(h('div', { class: 'app-viewer__head' }, h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: 'Source viewer' })))
      section.appendChild(h('div', { class: 'app-viewer__empty' },
        h('p', { class: 'govuk-body', text: win ? 'No figure selected yet. This window shows the source of whatever is selected on the work page, and follows each change.' : 'No figure selected. Choose "Show sources" on a row to see its evidence here, beside the list.' }),
        this.o.onBack ? h('p', { class: 'govuk-body app-only-narrow' }, this.backButton()) : null))
      return
    }
    var ids = this.ids()
    var n = ids.length
    var titleText = it.name + (it.amount ? ', ' + it.amount : '')
    var head = h('div', { class: 'app-viewer__head' })
    head.appendChild(h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: titleText }))
    section.appendChild(head)
    if (this.o.onBack) head.appendChild(this.backButton(true))
    if (it.flag) {
      section.appendChild(h('p', { class: 'govuk-body-s app-flagnote' },
        h('strong', { class: 'govuk-tag govuk-tag--red', text: 'Flagged for a person' }), ' ' + it.flag.id + ': ' + it.flag.text + '.'))
    }

    if (!n) {
      section.appendChild(h('div', { class: 'app-viewer__stage', tabindex: '0', role: 'region', 'aria-label': 'Source for ' + it.name },
        h('div', { class: 'app-viewer__card', tabindex: '-1', id: 'sv-card-' + this.role },
          h('div', { class: 'govuk-warning-text' }, h('span', { class: 'govuk-warning-text__icon', 'aria-hidden': 'true', text: '!' }),
            h('strong', { class: 'govuk-warning-text__text' }, h('span', { class: 'govuk-visually-hidden', text: 'Warning' }), 'Not checked: no evidence')),
          h('p', { class: 'govuk-body', text: 'Nothing is attached to this figure: no document, sheet row, QBO line, client answer, CRA capture, last year\'s cell or written reason.' }),
          this.o.emptyHelp ? h('p', { class: 'govuk-body', text: this.o.emptyHelp }) : null)))
      if (this.o.extra) { var ex0 = this.o.extra(it, null, this); if (ex0) section.appendChild(ex0) }
      if (o.focusIn) this.focusCard()
      this.announce('Sources for ' + it.name + ': not checked, no evidence')
      return
    }

    var sid = ids[this.idx]
    var s = src(sid)
    this.curSrc = s
    var kind = KIND[s.kind]
    var card = this.renderCard(s, it)
    if (this._zoomCtl) head.appendChild(this._zoomCtl)

    // row 2: the steps (A) or the tabs (B); in the wide window the steps share row 1 with the title and the zoom
    var nav = this.layout === 'tabs' ? this.navTabs(ids) : this.navStrip(ids)
    if (win) { head.insertBefore(nav, this._zoomCtl) } else section.appendChild(nav)

    // row 3: which source; row 4: who added it and the words found inside the box
    var meta = h('p', { class: 'app-viewer__meta', id: 'sv-meta-' + this.role })
    meta.appendChild(h('strong', { text: (this.candMode ? 'Candidate source ' : 'Source ') + (this.idx + 1) + ' of ' + n + ': ' }))
    meta.appendChild(h('span', { class: 'govuk-tag ' + kind[1], text: kind[0] }))
    meta.appendChild(document.createTextNode(' ' + s.title + (s.page ? ', ' + s.page : '') + '.'))
    section.appendChild(meta)
    var who = h('p', { class: 'app-viewer__who' })
    who.appendChild(h('span', { class: 'app-meta-who', text: 'Added: ' + s.who + ', ' + s.when + '.' + (s.flagEvidence ? ' Evidence for the flag.' : '') }))
    if (s.kind === 'page' && !this._failedShown) who.appendChild(h('span', { class: 'app-meta-ocr' }, 'Words found inside the box: ', h('span', { class: 'app-ocr', text: s.ocr })))
    section.appendChild(who)

    var body = h('div', { class: 'app-viewer__body' })
    var stage = h('div', { class: 'app-viewer__stage', tabindex: '0', role: 'region', 'aria-label': 'Source ' + (this.idx + 1) + ' of ' + n + ': ' + kind[0] })
    stage.appendChild(card)
    body.appendChild(stage)
    section.appendChild(body)
    this.stage = stage

    if (this.o.extra) { var ex = this.o.extra(it, sid, this); if (ex) section.appendChild(ex) }

    this.announce('Source ' + (this.idx + 1) + ' of ' + n + ': ' + kind[0] + ', ' + s.title)
    if (s.kind === 'page') { this.applyZoom(); this.afterPage(o) }
    else if (s.kind === 'sheet') this.afterSheet(o)
    else if (o.focusIn) this.focusCard()
  }

  Viewer.prototype.backButton = function (inline) {
    var self = this
    return h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact' + (inline ? ' app-only-narrow' : ''), 'aria-keyshortcuts': 'Escape', onclick: function () { self.o.onBack() } }, 'Back to the list ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: 'Esc' }))
  }

  function stepBtn(label, hidden, key, fn) {
    return h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': key, onclick: fn }, label, h('span', { class: 'govuk-visually-hidden', text: hidden }))
  }
  Viewer.prototype.navStrip = function (ids) {
    var self = this
    var nav = h('nav', { 'aria-label': 'Sources of this figure', class: 'app-viewer__steps' })
    var ol = h('ol', { class: 'app-steps' })
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      var marked = self.o.isMarked && self.o.isMarked(self.itemId, id)
      var btn = h('button', { type: 'button', class: 'app-steps__btn' + (marked ? ' app-steps__marked' : ''), 'aria-current': i === self.idx ? 'step' : null, onclick: function () { self.show(self.itemId, i, { keepFocus: true }) } }, (i + 1) + ' ' + SHORT[s.kind], h('span', { class: 'govuk-visually-hidden', text: ': source ' + (i + 1) + ' of ' + ids.length + ', ' + k[0] + (marked ? ', marked as supporting' : '') }))
      ol.appendChild(h('li', {}, btn))
    })
    ol.appendChild(h('li', {}, stepBtn('Prev', 'ious source', '[', function () { self.step(-1) })))
    ol.appendChild(h('li', {}, stepBtn('Next', ' source', ']', function () { self.step(1) })))
    nav.appendChild(ol)
    return nav
  }

  Viewer.prototype.navTabs = function (ids) {
    var self = this
    var nav = h('nav', { class: 'moj-sub-navigation app-viewer__steps', 'aria-label': 'Sources of this figure' })
    var ul = h('ul', { class: 'moj-sub-navigation__list' })
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, h('button', { type: 'button', class: 'moj-sub-navigation__link app-reset-button', 'aria-current': i === self.idx ? 'page' : null, onclick: function () { self.show(self.itemId, i, { keepFocus: true }) } }, (i + 1) + ' ' + SHORT[s.kind], h('span', { class: 'govuk-visually-hidden', text: ': source ' + (i + 1) + ' of ' + ids.length + ', ' + k[0] }))))
    })
    ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, stepBtn('Prev', 'ious source', '[', function () { self.step(-1) })))
    ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, stepBtn('Next', ' source', ']', function () { self.step(1) })))
    nav.appendChild(ul)
    return nav
  }

  /* -------- cards, one per source kind (EV-5) -------- */
  Viewer.prototype.renderCard = function (s, it) {
    var self = this
    var card = h('div', { class: 'app-viewer__card', tabindex: '-1', id: 'sv-card-' + this.role })
    this._failedShown = false
    if (s.kind === 'page') {
      if (this.failedNow(s)) {
        this._failedShown = true
        card.appendChild(this.failedCard(s))
        return card
      }
      this._zoomCtl = h('div', { class: 'app-viewer__zoom', role: 'group', 'aria-label': 'Zoom the page' },
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '-', onclick: function () { self.setZoom(-25) } }, 'Zoom −'),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '+', onclick: function () { self.setZoom(25) } }, 'Zoom +'),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '0', onclick: function () { self.setZoom(0) } }, 'Fit box'),
        h('span', { class: 'app-zoom-level', id: 'sv-zoom-' + this.role, text: '' }))
      var slow = sstore('sv-slow') === '1'
      var page = h('div', { class: 'app-page is-loading', style: 'width:100%', id: 'sv-pagebox-' + this.role, 'data-min-text': s.minText || 11 })
      var img = h('img', { alt: s.alt, width: '612', height: '792' })
      var skel = h('div', { class: 'app-skeleton', role: 'status' }, h('span', { class: 'govuk-visually-hidden', text: 'Loading the page image' }))
      page.appendChild(skel)
      var b = s.box
      var below = b.y < 5
      var box = h('div', { class: 'app-box' + (below ? ' app-box--below' : ''), id: 'sv-box-' + this.role, tabindex: '-1', role: 'group', 'aria-label': 'Boxed figure. Words found inside the box: ' + s.ocr, style: 'left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%' },
        h('span', { class: 'app-box__label', text: 'Boxed figure' }))
      var stamp = ++this._stamp || (this._stamp = 1)
      img.addEventListener('load', function () {
        page.className = 'app-page is-loaded'
        page.appendChild(box)
        self.scrollToBox()
        if (self._pendingFocus) { self._pendingFocus = false; box.focus({ preventScroll: true }) }
        if (self.o.onLoaded) self.o.onLoaded(s)
      })
      img.addEventListener('error', function () { if (self._stamp !== stamp) return; self.markFailed(s) })
      page.insertBefore(img, skel)
      var load = function () { img.src = D.base + s.img }
      if (slow) setTimeout(load, 1500); else load()
      card.appendChild(page)
      card.appendChild(h('p', { class: 'govuk-hint govuk-!-margin-top-1 govuk-!-margin-bottom-1', text: 'Read from inside the box only. This is what the AI-4 check compares; the viewer shows no confidence score.' }))
      if (s.extracted) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: 'Extracted value: ' + s.extracted }))
      if (s.masked) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: 'Masked in the image: ' + s.masked + '.' }))
    } else if (s.kind === 'sheet') {
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: s.sheetNote + ' of ' + s.file + '. The outlined cell is the figure.' }))
      var tbl = h('table', { class: 'app-sheet' })
      tbl.appendChild(h('caption', { class: 'govuk-visually-hidden', text: s.file + ', rows ' + s.rows.filter(function (r) { return r > 1 }).join(', ') + ' and the header' }))
      var thead = h('thead', {})
      var hr = h('tr', {}, h('th', { scope: 'col', text: 'Row' }))
      var letters = 'ABCDEFGH'
      D.sheetHeader.forEach(function (c, i) { hr.appendChild(h('th', { scope: 'col' }, letters[i] + ': ' + c)) })
      thead.appendChild(hr)
      tbl.appendChild(thead)
      var tb = h('tbody', {})
      s.grid.forEach(function (r) {
        var tr = h('tr', {}, h('th', { scope: 'row', text: String(r.line) }))
        r.cells.forEach(function (c, ci) {
          var boxed = r.line === s.boxRow && ci === s.boxCol
          var td = h('td', { class: (ci >= 2 && r.line > 1 ? 'is-num' : '') + (boxed ? ' app-cell-boxed' : ''), id: boxed ? 'sv-box-' + self.role : null, tabindex: boxed ? '-1' : null, 'aria-label': boxed ? 'Boxed figure, row ' + r.line + ', column ' + letters[ci] + ': ' + c : null }, c)
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
    } else {
      if (s.snapshot) card.appendChild(h('p', { class: 'govuk-body-s', text: s.snapshot + '. A dated snapshot, not live.' }))
      card.appendChild(this.summary(s.fields))
    }
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
  }
  Viewer.prototype.failedCard = function (s) {
    var self = this
    var box = h('div', { class: 'govuk-error-summary', role: 'alert', 'data-module': 'govuk-error-summary' },
      h('div', { class: 'govuk-error-summary__body' },
        h('h3', { class: 'govuk-error-summary__title', text: 'The page image did not load' }),
        h('p', { class: 'govuk-body', text: 'The figure is not lost. Nothing was changed. Try again; if it fails twice, tell the Lead.' }),
        h('button', { type: 'button', class: 'govuk-button app-button-compact', onclick: function () { sstore('sv-failed-' + s.img, 'done'); self._retried = true; self.render({ focusIn: true }) } }, 'Try again')))
    return box
  }

  /* ---------------- zoom: opens readable with the box whole, never clips the box (fix 1) ---------------- */
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
  /* delta undefined: open (saved size for this kind, else readable); 0: back to automatic; else step */
  Viewer.prototype.applyZoom = function (delta) {
    var s = this.curSrc
    if (!s || s.kind !== 'page') return
    var cw = this.cardWidth()
    var pb = document.getElementById('sv-pagebox-' + this.role)
    if (!pb || cw <= 0) return
    var b = this.bounds(s, cw), pref = sstore('sv-zoom-page')
    var want
    if (delta === 0) { sstore('sv-zoom-page', ''); want = b.read }
    else if (typeof delta === 'number') { want = (this.zoom || b.read) + delta }
    else want = pref ? Number(pref) : b.read
    var z = Math.max(50, Math.min(b.max, want))
    var capped = typeof delta === 'number' && delta > 0 && want > b.max
    if (typeof delta === 'number' && delta !== 0) sstore('sv-zoom-page', String(z))
    this.zoom = z
    pb.style.width = z + '%'
    var lab = document.getElementById('sv-zoom-' + this.role)
    if (lab) lab.textContent = z + '%'
    if (typeof delta === 'number') this.announce(capped ? 'Zoom ' + z + ' percent, the largest size at which the whole box shows' : 'Zoom ' + z + ' percent')
    this.scrollToBox()
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
  Viewer.prototype.afterPage = function (o) {
    if (o.focusIn) this._pendingFocus = true
    // the failed card has no box: move focus to the card
    if (o.focusIn && document.getElementById('sv-card-' + this.role) && !document.getElementById('sv-pagebox-' + this.role)) { this._pendingFocus = false; this.focusCard() }
    if (o.focusIn && this._failedShown) { this._pendingFocus = false; this.focusCard() }
  }
  Viewer.prototype.afterSheet = function (o) {
    var self = this
    setTimeout(function () {
      var b = document.getElementById('sv-box-' + self.role)
      var stage = self.stage
      if (b && stage) {
        var wrap = b.closest('.app-sheet-wrap')
        if (wrap) { var br = b.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); wrap.scrollLeft += br.left - wr.left - (wrap.clientWidth - br.width) / 2 }
        if (o.focusIn) b.focus({ preventScroll: true })
      }
    }, 0)
  }
  Viewer.prototype.focusCard = function () {
    var c = document.getElementById('sv-card-' + this.role)
    if (c) c.focus({ preventScroll: true })
  }

  /* ---------------- shortcuts (rule 10, 22) ---------------- */
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
  function zoomKeys(get) {
    return { '+': function () { get().setZoom(25) }, '=': function () { get().setZoom(25) }, '-': function () { get().setZoom(-25) }, '0': function () { get().setZoom(0) } }
  }
  function wireKeysToggle() {
    var cb = document.getElementById('sv-keys-off')
    if (!cb) return
    cb.checked = keysOff()
    cb.addEventListener('change', function () { store('sv-keys-off', cb.checked ? '1' : '0') })
    var sl = document.getElementById('sv-slow')
    if (sl) { sl.checked = sstore('sv-slow') === '1'; sl.addEventListener('change', function () { sstore('sv-slow', sl.checked ? '1' : '0') }) }
  }

  /* ---------------- the second window (rule 20), a two-way link (fix 4) ----------------
     Every page announces itself on load (work-hello, win-hello) and answers the other's hello. Presence is a heartbeat
     (every 2 s, closed after 6 s of silence), never a window handle, so a reload of either page keeps the link.
     Every message carries the return id; another return's page never drives this window. */
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
        var was = self.alive
        self.alive = true; self.follow = m.follow !== false; self.lastBeat = Date.now()
        if (m.t === 'win-hello' || !was) self.push()
        self.setState('open')
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
    if (this.alive) { try { w = window.open('', WIN_NAME) } catch (e) {} if (w) { try { w.focus() } catch (e2) {} this.push(); return true } }
    w = window.open(this.o.url + '?ret=' + encodeURIComponent(RET), WIN_NAME, 'popup=yes,width=900,height=760') // no noopener: the link back is needed
    if (!w) { this.alive = false; this.setState('blocked'); return false }
    this.alive = true; this.follow = true; this.lastBeat = Date.now()
    this.setState('open')
    return true
  }
  SecondWindow.prototype.push = function () {
    var s = this.o.getState()
    if (this.ch) this.ch.postMessage({ t: 'select', ret: RET, tab: this.tab, item: s.item, idx: s.idx, list: s.list, extras: s.extras })
    store('sv-last', JSON.stringify(s))
  }
  SecondWindow.prototype.setState = function (st) { this.state = st; if (this.o.onState) this.o.onState(st, this.follow) }

  window.SV = { src: src, h: h, Viewer: Viewer, bindKeys: bindKeys, zoomKeys: zoomKeys, wireKeysToggle: wireKeysToggle, SecondWindow: SecondWindow, itemOf: itemOf, store: store, sstore: sstore, CHANNEL: CHANNEL, KIND: KIND, RET: RET, tabId: tabId }
})()
