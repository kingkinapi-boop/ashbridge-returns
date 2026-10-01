/* The one source viewer (D03). Every page and every second window renders it from this file; no page draws its own.
   Plain script for the static prototypes; the React build wraps the same behaviour. */
(function () {
  'use strict'
  var D = window.SV_DATA
  var CHANNEL = 'ashbridge-source-viewer'
  var WIN_NAME = 'ashbridge-source-viewer-window'
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
    this.zoom = 100
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
    var self = this
    var root = this.root
    root.textContent = ''
    var it = this.item()
    var win = this.role === 'window'
    var section = h('section', { class: 'app-viewer' + (win ? ' app-viewer--window' : ''), 'aria-labelledby': 'sv-title-' + this.role })
    root.appendChild(section)
    if (!it) {
      section.appendChild(h('div', { class: 'app-viewer__head' }, h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: 'Source viewer' })))
      section.appendChild(h('div', { class: 'app-viewer__empty' },
        h('p', { class: 'govuk-body', text: win ? 'No figure selected yet. This window shows the source of whatever is selected on the work page, and follows each change.' : 'No figure selected. Choose "Show sources" on a row to see its evidence here, beside the list.' }),
        this.o.onBack ? h('p', { class: 'govuk-body app-only-narrow' }, this.backButton()) : null))
      return
    }
    var ids = this.ids()
    var n = ids.length
    var head = h('div', { class: 'app-viewer__head' })
    head.appendChild(h('h2', { class: 'app-viewer__title', id: 'sv-title-' + this.role, text: it.name + (it.amount ? ', ' + it.amount : '') }))
    var hb = h('p', { class: 'govuk-body-s app-flagnote' })
    if (it.flag) {
      hb.appendChild(h('strong', { class: 'govuk-tag govuk-tag--red', text: 'Flagged for a person' }))
      hb.appendChild(document.createTextNode(' ' + it.flag.id + ': ' + it.flag.text + '.'))
    }
    if (it.flag) head.appendChild(hb)
    var ctl = h('div', { class: 'app-viewer__controls' })
    if (this.o.onBack) ctl.appendChild(this.backButton(true))
    if (ctl.childNodes.length) head.appendChild(ctl)
    section.appendChild(head)

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
    var kind = KIND[s.kind]
    // step navigation, by layout
    var nav
    if (this.layout === 'tabs') nav = this.navTabs(ids)
    if (this.layout === 'strip') nav = this.navStrip(ids)
    if (nav) section.appendChild(nav)
    this._toolbar = null
    var card = this.renderCard(s, it)

    var meta = h('p', { class: 'app-viewer__meta', id: 'sv-meta-' + this.role })
    meta.appendChild(h('strong', { text: (this.candMode ? 'Candidate source ' : 'Source ') + (this.idx + 1) + ' of ' + n + ': ' }))
    meta.appendChild(h('span', { class: 'govuk-tag ' + kind[1], text: kind[0] }))
    var role = s.flagEvidence ? ' Evidence for the flag.' : ''
    meta.appendChild(document.createTextNode(' ' + s.title + (s.page ? ', ' + s.page : '') + '.'))
    meta.appendChild(h('span', { class: 'app-meta-who', text: 'Added: ' + s.who + ', ' + s.when + '.' + role }))
    section.appendChild(meta)
    if (this._toolbar) section.appendChild(this._toolbar)

    var body = h('div', { class: 'app-viewer__body' })
    if (this.layout === 'rail') body.appendChild(this.navRail(ids))
    var stage = h('div', { class: 'app-viewer__stage', tabindex: '0', role: 'region', 'aria-label': 'Source ' + (this.idx + 1) + ' of ' + n + ': ' + kind[0] })
    stage.appendChild(card)
    body.appendChild(stage)
    section.appendChild(body)
    this.stage = stage

    if (this.o.extra) { var ex = this.o.extra(it, sid, this); if (ex) section.appendChild(ex) }

    this.announce('Source ' + (this.idx + 1) + ' of ' + n + ': ' + kind[0] + ', ' + s.title)
    if (s.kind === 'page') this.afterPage(o)
    else if (s.kind === 'sheet') this.afterSheet(o)
    else if (o.focusIn) this.focusCard()
  }

  Viewer.prototype.backButton = function (inline) {
    var self = this
    return h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact' + (inline ? ' app-only-narrow' : ''), 'aria-keyshortcuts': 'Escape', onclick: function () { self.o.onBack() } }, 'Back to the list ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: 'Esc' }))
  }

  Viewer.prototype.navStrip = function (ids) {
    var self = this
    var nav = h('nav', { 'aria-label': 'Sources of this figure', class: 'app-viewer__meta' })
    var ol = h('ol', { class: 'app-steps' })
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      var marked = self.o.isMarked && self.o.isMarked(self.itemId, id)
      var btn = h('button', { type: 'button', class: 'app-steps__btn' + (marked ? ' app-steps__marked' : ''), 'aria-current': i === self.idx ? 'step' : null, onclick: function () { self.show(self.itemId, i, { keepFocus: true }) } }, (i + 1) + ' ' + SHORT[s.kind], h('span', { class: 'govuk-visually-hidden', text: ': source ' + (i + 1) + ' of ' + ids.length + ', ' + k[0] + (marked ? ', marked as supporting' : '') }))
      ol.appendChild(h('li', {}, btn))
    })
    ol.appendChild(h('li', {}, h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '[', onclick: function () { self.step(-1) } }, 'Prev', h('span', { class: 'govuk-visually-hidden', text: 'ious source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: '[' }))))
    ol.appendChild(h('li', {}, h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': ']', onclick: function () { self.step(1) } }, 'Next', h('span', { class: 'govuk-visually-hidden', text: ' source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: ']' }))))
    nav.appendChild(ol)
    return nav
  }

  Viewer.prototype.navTabs = function (ids) {
    var self = this
    var nav = h('nav', { class: 'moj-sub-navigation app-viewer__meta', 'aria-label': 'Sources of this figure' })
    var ul = h('ul', { class: 'moj-sub-navigation__list' })
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, h('button', { type: 'button', class: 'moj-sub-navigation__link app-reset-button', 'aria-current': i === self.idx ? 'page' : null, onclick: function () { self.show(self.itemId, i, { keepFocus: true }) } }, (i + 1) + ' ' + SHORT[s.kind], h('span', { class: 'govuk-visually-hidden', text: ': source ' + (i + 1) + ' of ' + ids.length + ', ' + k[0] }))))
    })
    ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '[', onclick: function () { self.step(-1) } }, 'Prev', h('span', { class: 'govuk-visually-hidden', text: 'ious source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: '[' }))))
    ul.appendChild(h('li', { class: 'moj-sub-navigation__item' }, h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': ']', onclick: function () { self.step(1) } }, 'Next', h('span', { class: 'govuk-visually-hidden', text: ' source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: ']' }))))
    nav.appendChild(ul)
    return nav
  }

  Viewer.prototype.navRail = function (ids) {
    var self = this
    var ol = h('ol', { class: 'app-rail', 'aria-label': 'Sources of this figure' })
    ol.appendChild(h('li', { class: 'app-rail__step' },
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': '[', onclick: function () { self.step(-1) } }, 'Prev', h('span', { class: 'govuk-visually-hidden', text: 'ious source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: '[' })), ' ',
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', 'aria-keyshortcuts': ']', onclick: function () { self.step(1) } }, 'Next', h('span', { class: 'govuk-visually-hidden', text: ' source' }), ' ', h('span', { class: 'app-key', 'aria-hidden': 'true', text: ']' }))))
    ids.forEach(function (id, i) {
      var s = src(id), k = KIND[s.kind]
      ol.appendChild(h('li', {}, h('button', { type: 'button', class: 'app-rail__btn', 'aria-current': i === self.idx ? 'step' : null, onclick: function () { self.show(self.itemId, i, { keepFocus: true }) } },
        h('span', { class: 'app-rail__kind', text: 'Source ' + (i + 1) + ' of ' + ids.length + ': ' + k[0] }), s.title)))
    })
    return ol
  }

  /* -------- cards, one per source kind (EV-5) -------- */
  Viewer.prototype.renderCard = function (s, it) {
    var self = this
    var card = h('div', { class: 'app-viewer__card', tabindex: '-1', id: 'sv-card-' + this.role })
    if (s.kind === 'page') {
      var zoom = h('div', { class: 'app-viewer__zoom', role: 'group', 'aria-label': 'Zoom the page' },
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { self.setZoom(-25) } }, 'Zoom out'),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { self.setZoom(25) } }, 'Zoom in'),
        h('button', { type: 'button', class: 'govuk-button govuk-button--secondary app-button-compact', onclick: function () { self.setZoom(0) } }, 'Fit width'),
        h('span', { class: 'govuk-body-s govuk-!-margin-bottom-0', id: 'sv-zoom-' + this.role, text: this.zoom + '%' }))
      if (this.failedNow(s)) {
        card.appendChild(this.failedCard(s))
        return card
      }
      this._toolbar = h('div', { class: 'app-viewer__toolbar' }, zoom, h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0' }, 'Words found inside the box: ', h('span', { class: 'app-ocr', text: s.ocr })))
      var slow = sstore('sv-slow') === '1'
      var page = h('div', { class: 'app-page is-loading', style: 'width:' + this.zoom + '%', id: 'sv-pagebox-' + this.role })
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
      card.appendChild(h('p', { class: 'govuk-hint govuk-!-margin-bottom-1', text: 'Read from inside the box only. This is what the AI-4 check compares; the viewer shows no confidence score.' }))
      if (s.extracted) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-1', text: 'Extracted value: ' + s.extracted }))
      if (s.masked) card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: 'Masked in the image: ' + s.masked + '.' }))
    } else if (s.kind === 'sheet') {
      card.appendChild(h('p', { class: 'govuk-body-s', text: s.sheetNote + ' of ' + s.file + '. The outlined cell is the figure.' }))
      var tbl = h('table', { class: 'app-sheet' })
      tbl.appendChild(h('caption', { text: s.file + ', rows ' + s.rows.filter(function (r) { return r > 1 }).join(', ') + ' and the header' }))
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
      card.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-0', text: s.who + ', ' + s.when + '.' }))
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
    var self = this
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

  Viewer.prototype.setZoom = function (d) {
    this.zoom = d === 0 ? 100 : Math.max(50, Math.min(300, this.zoom + d))
    var pb = document.getElementById('sv-pagebox-' + this.role)
    if (pb) pb.style.width = this.zoom + '%'
    var z = document.getElementById('sv-zoom-' + this.role)
    if (z) z.textContent = this.zoom + '%'
    this.announce('Zoom ' + this.zoom + ' percent')
    this.scrollToBox()
  }
  Viewer.prototype.scrollToBox = function () {
    var stage = this.stage, box = document.getElementById('sv-box-' + this.role)
    if (!stage || !box) return
    var sr = stage.getBoundingClientRect(), br = box.getBoundingClientRect()
    stage.scrollTop += (br.top - sr.top) - (stage.clientHeight - br.height) / 3
    stage.scrollLeft += (br.left - sr.left) - (stage.clientWidth - br.width) / 2
  }
  Viewer.prototype.afterPage = function (o) {
    if (o.focusIn) this._pendingFocus = true
    if (o.keepFocus) { /* the user is on a step button: leave focus there */ }
    var self = this
    // the failed card has no box: move focus to the card
    if (o.focusIn && document.getElementById('sv-card-' + this.role) && !document.getElementById('sv-pagebox-' + this.role)) { this._pendingFocus = false; this.focusCard() }
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
  function wireKeysToggle() {
    var cb = document.getElementById('sv-keys-off')
    if (!cb) return
    cb.checked = keysOff()
    cb.addEventListener('change', function () { store('sv-keys-off', cb.checked ? '1' : '0') })
    var sl = document.getElementById('sv-slow')
    if (sl) { sl.checked = sstore('sv-slow') === '1'; sl.addEventListener('change', function () { sstore('sv-slow', sl.checked ? '1' : '0') }) }
  }

  /* ---------------- the second window (rule 20) ---------------- */
  function SecondWindow(o) {
    // o: url, getState() -> {item, idx}, onState(text, kind)
    this.o = o
    this.win = null
    this.ch = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL) : null
    this.opened = false
    var self = this
    if (this.ch) this.ch.onmessage = function (e) {
      var m = e.data || {}
      if (m.t === 'hello') { self.push(); self.setState('open') }
      if (m.t === 'step' && self.o.onWindowStep) self.o.onWindowStep(m.item, m.idx)
      if (m.t === 'closing') { self.opened = false; self.setState('closed') }
    }
    setInterval(function () { if (self.opened && self.win && self.win.closed) { self.opened = false; self.setState('closed') } }, 1000)
    window.addEventListener('pagehide', function () { if (self.ch) self.ch.postMessage({ t: 'workclosed' }) })
  }
  SecondWindow.prototype.open = function () {
    var w = window.open(this.o.url, WIN_NAME, 'popup=yes,width=900,height=760') // no noopener: the link back is needed
    if (!w) { this.setState('blocked'); return false }
    this.win = w
    this.opened = true
    this.setState('open')
    var self = this
    setTimeout(function () { self.push() }, 600)
    return true
  }
  SecondWindow.prototype.push = function () {
    var s = this.o.getState()
    if (this.ch) this.ch.postMessage({ t: 'select', item: s.item, idx: s.idx, list: s.list, extras: s.extras })
    store('sv-last', JSON.stringify(s))
  }
  SecondWindow.prototype.signOut = function () {
    if (this.ch) this.ch.postMessage({ t: 'signout' })
    try { if (this.win && !this.win.closed) this.win.close() } catch (e) {}
  }
  SecondWindow.prototype.setState = function (st) { this.state = st; if (this.o.onState) this.o.onState(st) }

  window.SV = { src: src, h: h, Viewer: Viewer, bindKeys: bindKeys, wireKeysToggle: wireKeysToggle, SecondWindow: SecondWindow, itemOf: itemOf, store: store, sstore: sstore, CHANNEL: CHANNEL, KIND: KIND }
})()
