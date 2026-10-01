/* CPA review prototypes: the clickable behaviour (marks, keys, trace, source, comments).
   Prototype code only: made-up data, state kept in this browser (localStorage) so a task can be
   clicked through. Never product code. */
(function () {
  'use strict';
  var P = window.CPA_PAGE || {};
  var DATA = window.CPA_RETURNS || {};
  var R = DATA[P.ret];
  var CPA_NAME = 'Zo (Test)';
  var DOT_WORDS = { green: 'Agrees', grey: 'Single source', amber: 'Client only', purple: 'Judgment', none: 'Not checked' };
  var PARTY = { third: 'Third party', client: 'Client', judgment: 'Judgment', books: 'Our books', lastyear: "Last year, assessed" };

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function now() {
    var d = new Date(); var h = d.getHours(); var m = d.getMinutes();
    return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear() + ', ' + ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }

  // ---------- state (per version and return, kept in this browser) ----------
  var KEY = 'cpaProto.' + P.version + '.' + P.ret;
  function store(k, v) { try { if (v === undefined) return JSON.parse(window.localStorage.getItem(k)); window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return null; }
  var S = (R && store(KEY)) || null;
  if (R && !S) S = { marks: JSON.parse(JSON.stringify(R.seedReviewed || {})), removed: JSON.parse(JSON.stringify(R.removedMarks || {})), comments: [], opened: {}, timeOn: {}, approved: false };
  function save() { if (R) store(KEY, S); }
  var shortcutsOff = !!store('cpaProto.shortcutsOff');

  function sections() { return R ? R.sections : []; }
  function allLines() { var a = []; sections().forEach(function (s) { s.lines.forEach(function (l) { a.push(l); }); }); return a; }
  function lineByKey(k) { var f = null; allLines().forEach(function (l) { if (l.key === k) f = l; }); return f; }
  function sectionOf(k) { var f = null; sections().forEach(function (s) { s.lines.forEach(function (l) { if (l.key === k) f = s; }); }); return f; }
  function flagById(id) { var f = null; (R.flags || []).forEach(function (x) { if (x.id === id) f = x; }); return f; }
  function sortedFlags() {
    var rank = { red: 0, amber: 1 };
    return (R.flags || []).slice().sort(function (a, b) {
      if (rank[a.sev] !== rank[b.sev]) return rank[a.sev] - rank[b.sev];
      var da = parseFloat(String(a.dollar).replace(/[,()]/g, '')) || -1; var db = parseFloat(String(b.dollar).replace(/[,()]/g, '')) || -1;
      return db - da;
    });
  }
  function allComments() { return (R.comments || []).concat(S.comments || []); }
  function href(sid, frag) { return sid + '.html' + (frag ? '#' + frag : ''); }

  // ---------- coverage (RV-5 as changed: an explicit Reviewed mark per section) ----------
  function statusOf(sid) { if (S.marks[sid]) return 'reviewed'; if (S.removed[sid]) return 'removed'; return 'not'; }
  var STATUS_WORD = { reviewed: 'Reviewed', removed: 'Mark removed', not: 'Not reviewed' };
  var STATUS_TAG = { reviewed: 'govuk-tag--green', removed: 'govuk-tag--orange', not: 'govuk-tag--grey' };
  function renderCoverage() {
    if (!R) return;
    var secs = sections(); var left = secs.filter(function (s) { return statusOf(s.id) !== 'reviewed'; });
    $all('[data-nav-status]').forEach(function (el) {
      var st = statusOf(el.getAttribute('data-nav-status'));
      el.className = 'govuk-tag ' + STATUS_TAG[st]; el.textContent = STATUS_WORD[st];
    });
    var MARK = { reviewed: ['\u2713', 'reviewed'], removed: ['\u26A0', 'mark removed'], not: ['\u25CB', 'not reviewed'] };
    $all('[data-nav-mark]').forEach(function (el) {
      var st = statusOf(el.getAttribute('data-nav-mark'));
      el.innerHTML = '<span aria-hidden="true">' + MARK[st][0] + '</span><span class="govuk-visually-hidden">, ' + MARK[st][1] + '</span>';
    });
    $all('[data-coverage]').forEach(function (el) {
      if (S.approved) { el.innerHTML = '<p class="govuk-body govuk-!-margin-0"><strong>Approved.</strong> <a class="govuk-link" href="approved.html">See what was approved</a></p>'; return; }
      if (!left.length) {
        el.innerHTML = '<p class="govuk-body govuk-!-margin-0"><strong>All ' + secs.length + ' sections reviewed.</strong></p>' +
          '<a href="approved.html" role="button" draggable="false" class="govuk-button" data-module="govuk-button" aria-keyshortcuts="a" data-approve>Approve return <span class="app-key" aria-hidden="true">a</span></a>';
      } else {
        el.innerHTML = '<p class="govuk-body govuk-!-margin-0"><strong>' + (secs.length - left.length) + ' of ' + secs.length + ' sections reviewed.</strong> Approve appears when every section is marked. Sections left: ' +
          left.map(function (s) { return '<a class="govuk-link" href="' + href(s.id) + '">' + esc(s.title) + (statusOf(s.id) === 'removed' ? ' (mark removed)' : '') + '</a>'; }).join(', ') + '.</p>';
      }
    });
    $all('[data-task-status]').forEach(function (el) {
      var st = statusOf(el.getAttribute('data-task-status'));
      el.innerHTML = '<strong class="govuk-tag ' + STATUS_TAG[st] + '">' + STATUS_WORD[st] + '</strong>';
    });
    var box = $('[data-section-status]');
    if (box && P.section) {
      var st = statusOf(P.section); var m = S.marks[P.section];
      var html = '';
      if (st === 'reviewed') {
        html = '<p class="govuk-body govuk-!-margin-0"><strong class="govuk-tag govuk-tag--green">Reviewed</strong> by ' + esc(m.by) + ', ' + esc(m.at) + '. The mark comes off if a number in this section changes.</p>' +
          '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-mark aria-keyshortcuts="m">Remove my mark <span class="app-key" aria-hidden="true">m</span></button>';
      } else {
        html += '<p class="govuk-body govuk-!-margin-0"><strong class="govuk-tag ' + STATUS_TAG[st] + '">' + STATUS_WORD[st] + '</strong></p>' +
          '<button type="button" class="govuk-button" data-module="govuk-button" data-mark aria-keyshortcuts="m">Mark section reviewed <span class="app-key" aria-hidden="true">m</span></button>';
      }
      box.innerHTML = html;
      var al = $('[data-mark-alert]');
      if (al) al.innerHTML = st === 'removed' ? '<div class="moj-alert moj-alert--warning govuk-!-margin-bottom-2" role="region" aria-label="Warning: reviewed mark removed"><div><svg class="moj-alert__icon" role="presentation" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" height="30" width="30"><path fill-rule="evenodd" clip-rule="evenodd" d="M15 2.44922L28.75 26.1992H1.25L15 2.44922ZM13.5107 9.49579H16.4697L16.2431 17.7678H13.7461L13.5107 9.49579ZM15 19.9645C16.0 19.9645 16.87 20.82 16.87 21.82C16.87 22.82 16.0 23.695 15 23.695C14.0 23.695 13.13 22.82 13.13 21.82C13.13 20.82 14.0 19.9645 15 19.9645Z" fill="currentColor"/></svg></div><div class="moj-alert__content">' + esc(S.removed[P.section]) + ' <a class="govuk-link" href="changes.html">See the changed cells</a></div></div>' : '';
    }
  }
  function toggleMark() {
    if (!P.section) return;
    if (S.marks[P.section]) delete S.marks[P.section];
    else { S.marks[P.section] = { by: CPA_NAME, at: now() }; delete S.removed[P.section]; }
    save(); renderCoverage();
    announce(S.marks[P.section] ? 'Section marked reviewed.' : 'Your mark was removed.');
    var b = $('[data-mark]'); if (b) b.focus();
  }

  function announce(msg) { var a = $('#app-announce'); if (a) { a.textContent = ''; setTimeout(function () { a.textContent = msg; }, 30); } }

  // ---------- dots, trace and source ----------
  function dot(d) { return '<span class="app-dot app-dot--' + d + '">' + DOT_WORDS[d] + '</span>'; }
  function lineLink(l, text) {
    var s = sectionOf(l.key);
    var here = s && s.id === P.section;
    return '<a class="govuk-link" href="' + (here ? '#l=' + l.key : href(s.id, 'l=' + l.key)) + '"' + (here ? ' data-goto="' + l.key + '"' : '') + '>' + esc(text || (l.code + ' ' + l.label)) + '</a>';
  }

  function traceHtml(l) {
    var h = '';
    h += '<h2 class="govuk-heading-s govuk-!-margin-bottom-2">' + esc(l.code) + ' ' + esc(l.label) + '</h2>';
    h += '<dl class="govuk-summary-list govuk-summary-list--no-border govuk-!-margin-bottom-3">';
    h += '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">This year</dt><dd class="govuk-summary-list__value app-num"><strong>' + esc(l.v) + '</strong> ' + dot(l.dot) + '</dd></div>';
    if (l.changedFrom) h += '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Before rework</dt><dd class="govuk-summary-list__value app-num">' + esc(l.changedFrom) + '</dd></div>';
    h += '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Last year</dt><dd class="govuk-summary-list__value app-num">' + esc(l.lyv) + '</dd></div>';
    h += '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Change</dt><dd class="govuk-summary-list__value app-num">' + esc(l.ch) + '</dd></div>';
    if (l.hi && l.hi.length) h += '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Highlighted</dt><dd class="govuk-summary-list__value">' + esc(l.hi.join(', ')) + '</dd></div>';
    h += '</dl>';
    (l.flags || []).forEach(function (id) {
      var f = flagById(id); if (!f) return;
      h += '<div class="govuk-inset-text govuk-!-margin-top-0 govuk-!-margin-bottom-3"><p class="govuk-body govuk-!-margin-bottom-1"><span class="app-flag">Flag ' + esc(f.sev === 'red' ? 'red' : 'amber') + '</span> <strong>' + esc(f.id) + '</strong> ' + esc(f.title) + '</p>' +
        '<p class="govuk-body govuk-!-margin-bottom-1">Dollar effect: <span class="app-num">' + esc(f.dollar) + '</span>' + (f.est ? ' (estimate)' : '') + '</p>' +
        '<p class="govuk-body govuk-!-margin-bottom-0">Preparer: ' + esc(f.answer) + ' <span class="govuk-hint govuk-!-display-inline">Source: ' + esc(f.source) + '</span></p></div>';
    });
    h += '<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Built from</h3><table class="govuk-table govuk-!-margin-bottom-3"><caption class="govuk-table__caption govuk-visually-hidden">How ' + esc(l.label) + ' is built</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Part</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Amount</th></tr></thead><tbody class="govuk-table__body">';
    (l.built || []).forEach(function (b) { h += '<tr class="govuk-table__row"><td class="govuk-table__cell">' + esc(b[0]) + '</td><td class="govuk-table__cell govuk-table__cell--numeric">' + esc(b[1]) + '</td></tr>'; });
    h += '</tbody></table>';
    if (l.feedLinks && l.feedLinks.length) {
      h += '<p class="govuk-body govuk-!-margin-bottom-3">Lines that feed it: ' + l.feedLinks.map(function (f) { var fl = lineByKey(f.key); return fl ? lineLink(fl, f.code + ' ' + f.label + ' ' + f.v) : esc(f.label); }).join('; ') + '.</p>';
    }
    h += '<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Sources</h3>';
    if (!l.sources.length) {
      h += l.noEvidence ? '<p class="govuk-body"><strong>Not checked: no evidence.</strong> No document, answer or entry backs this figure.</p>' : '<p class="govuk-body">Computed from the lines that feed it. No document of its own.</p>';
    } else {
      h += '<ol class="govuk-list govuk-list--number govuk-!-margin-bottom-3">';
      l.sources.forEach(function (s, i) {
        h += '<li><button type="button" class="govuk-link app-link-button" data-src="' + i + '">' + esc(s.caption) + '</button> <strong class="govuk-tag ' + (s.type === 'failed' ? 'govuk-tag--red' : 'govuk-tag--grey') + '">' + (s.type === 'failed' ? 'Could not be read' : esc(PARTY[s.party] || s.kind)) + '</strong></li>';
      });
      h += '</ol>';
    }
    h += '<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Agrees with</h3><ul class="govuk-list govuk-list--bullet govuk-!-margin-bottom-3">' + ((l.agrees && l.agrees.length) ? l.agrees.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') : '<li>Nothing yet</li>') + '</ul>';
    h += '<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Notes</h3><p class="govuk-body">' + ((l.notes && l.notes.length) ? esc(l.notes.join(' ')) : 'None') + '</p>';
    var cs = allComments().filter(function (c) { return c.line === l.key; });
    h += '<h3 class="govuk-heading-s govuk-!-margin-bottom-1">Comments</h3>';
    h += cs.length ? cs.map(commentCard).join('') : '<p class="govuk-body">None on this number.</p>';
    h += '<div data-comment-slot><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-comment aria-keyshortcuts="c">Comment on this number <span class="app-key" aria-hidden="true">c</span></button></div>';
    return h;
  }

  function commentCard(c) {
    return '<div class="govuk-summary-card govuk-!-margin-bottom-3"><div class="govuk-summary-card__title-wrapper"><h4 class="govuk-summary-card__title">Comment ' + esc(c.n) + ': ' + esc(c.type) + ', ' + esc(c.sev) + '</h4></div><div class="govuk-summary-card__content"><dl class="govuk-summary-list">' +
      '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">From</dt><dd class="govuk-summary-list__value">' + esc(c.by) + ', ' + esc(c.at) + '</dd></div>' +
      '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Comment</dt><dd class="govuk-summary-list__value">' + esc(c.text || '(no text, presentation)') + '</dd></div>' +
      '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Answer</dt><dd class="govuk-summary-list__value">' + (c.reply ? esc(c.reply) + ' (' + esc(c.replyBy) + ')' : 'Waiting for the preparer') + '</dd></div>' +
      '</dl></div></div>';
  }

  function sheetHtml(s) {
    var h = '<table class="app-sheet"><caption class="govuk-visually-hidden">' + esc(s.caption) + '</caption><thead><tr><th scope="col"><span class="govuk-visually-hidden">Row</span></th>';
    s.columns.forEach(function (c, i) { h += '<th scope="col">' + esc(c) + (s.header[i] && s.header[i] !== 'Column ' + c ? ': ' + esc(s.header[i]) : '') + '</th>'; });
    h += '</tr></thead><tbody>';
    s.rows.forEach(function (r) {
      var boxed = r.n === s.boxRow;
      h += '<tr class="' + (boxed ? 'app-sheet__row--boxed' : '') + '"><th scope="row">' + r.n + '</th>';
      s.columns.forEach(function (c, i) {
        var cell = r.cells[i] === undefined ? '' : r.cells[i];
        if (boxed && i === s.boxCol) h += '<td class="app-sheet__cell--boxed" id="app-boxed">' + esc(cell) + ' <span class="app-box-label">Figure</span></td>';
        else h += '<td>' + esc(cell) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  function sourceBodyHtml(l, i) {
    if (!l.sources.length) {
      if (l.noEvidence) return '<div class="app-source-card app-source-card--none"><h3 class="govuk-heading-s">Not checked: no evidence</h3><p class="govuk-body">No document, client answer or entry backs ' + esc(l.v) + '. This counts as a number with no source on the brief.</p><p class="govuk-body govuk-!-margin-bottom-0">Comment with type "Missing evidence" to send it back.</p></div>';
      return '<div class="app-source-card"><h3 class="govuk-heading-s">Computed, no document</h3><p class="govuk-body">' + esc(l.v) + ' is computed from other lines.</p>' +
        (l.feedLinks ? '<ul class="govuk-list">' + l.feedLinks.map(function (f) { var fl = lineByKey(f.key); return '<li>' + (fl ? lineLink(fl, f.code + ' ' + f.label + ': ' + f.v) : esc(f.label)) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }
    var s = l.sources[i];
    if (s.type === 'failed') return '<div class="app-source-card app-source-card--failed"><h3 class="govuk-heading-s">This source could not be shown</h3><p class="govuk-body">' + esc(s.caption) + '. ' + esc(s.reason) + '</p><p class="govuk-body govuk-!-margin-bottom-0"><button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-retry>Try again</button></p></div>';
    if (s.type === 'csv') return '<p class="govuk-body govuk-!-margin-bottom-2">' + esc(s.note) + '. Figure <strong class="app-num">' + esc(s.figure) + '</strong> in row ' + s.boxRow + ', column ' + esc(s.columns[s.boxCol]) + '.</p>' + sheetHtml(s);
    if (s.type === 'doc') {
      return '<div class="app-page"><p class="govuk-body govuk-!-margin-bottom-1"><strong>' + esc(s.title) + '</strong></p><p class="govuk-hint">' + esc(s.pageLabel) + '</p>' +
        s.lines.map(function (ln, j) { return '<div class="app-page__line' + (j === s.box ? ' app-page__line--boxed' : '') + '"' + (j === s.box ? ' id="app-boxed"' : '') + '><span>' + esc(ln[0]) + '</span><span class="app-num">' + esc(ln[1]) + (j === s.box ? ' <span class="app-box-label">Figure</span>' : '') + '</span></div>'; }).join('') + '</div>';
    }
    var h = '<div class="app-source-card"><p class="govuk-caption-m govuk-!-margin-bottom-1">' + esc(s.kind) + '</p><h3 class="govuk-heading-s">' + esc(s.title) + '</h3>';
    if (s.quote) h += '<div class="govuk-inset-text govuk-!-margin-top-0">' + esc(s.quote) + '</div>';
    if (s.fields) h += '<dl class="govuk-summary-list">' + s.fields.map(function (f) { return '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">' + esc(f[0]) + '</dt><dd class="govuk-summary-list__value">' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (s.table) {
      h += '<table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--s">Entry lines</caption><thead class="govuk-table__head"><tr class="govuk-table__row">' + s.table.head.map(function (x, k) { return '<th scope="col" class="govuk-table__header' + (k ? ' govuk-table__header--numeric' : '') + '">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody class="govuk-table__body">' +
        s.table.rows.map(function (r, j) { return '<tr class="govuk-table__row' + (j === s.table.box ? ' app-sheet__row--boxed' : '') + '">' + r.map(function (c, k) { return '<td class="govuk-table__cell' + (k ? ' govuk-table__cell--numeric' : '') + (j === s.table.box && k > 0 && c ? ' app-sheet__cell--boxed' : '') + '">' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    return h + '</div>';
  }

  function sourceHeadHtml(l, i, opts) {
    var n = l.sources.length;
    var cap = n ? esc(l.sources[i].caption) + ' (source ' + (i + 1) + ' of ' + n + ')' : (l.noEvidence ? 'No source' : 'Computed line');
    var h = '<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Source</h2><p class="govuk-body govuk-!-margin-bottom-2" id="app-source-caption">' + cap + '</p><div class="app-toolbar">';
    if (n > 1) h += '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-prev-src aria-keyshortcuts="p">Previous source <span class="app-key" aria-hidden="true">p</span></button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-next-src aria-keyshortcuts="n">Next source <span class="app-key" aria-hidden="true">n</span></button>';
    if (opts && opts.popout) h += '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-popout aria-keyshortcuts="w">Open in a second window <span class="app-key" aria-hidden="true">w</span></button>';
    return h + '</div>';
  }

  // ---------- selection ----------
  var cur = { key: null, src: 0 }; var popup = null; var channel = null; var seenSrc = {};
  try { channel = new window.BroadcastChannel('cpaProto-source'); } catch (e) { channel = null; }

  function postSource() {
    var msg = { ret: P.ret, key: cur.key, src: cur.src };
    store('cpaProto.lastSource', msg);
    try { if (popup && !popup.closed) popup.postMessage(msg, '*'); } catch (e) { /* second window gone */ }
    try { if (channel) channel.postMessage(msg); } catch (e) { /* no channel on file:// */ }
  }

  function renderSourceInto(el, l, i, opts) {
    if (!el) return;
    var popped = popup && !popup.closed;
    if (popped && P.layout === 'walk') {
      el.innerHTML = '<h2 class="govuk-heading-s">Source</h2><p class="govuk-body">Showing in the second window: ' + esc(l.sources.length ? l.sources[i].caption : 'computed line') + '.</p><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-popin>Show it here instead</button>';
      return;
    }
    var keyId = l.key + ':' + i;
    el.innerHTML = sourceHeadHtml(l, i, opts) + '<div class="app-pane__body" tabindex="0" role="region" aria-label="Source document" data-source-body></div>';
    var body = $('[data-source-body]', el);
    if (!seenSrc[keyId] && l.sources.length && l.sources[i].type === 'csv') {
      body.innerHTML = '<p class="govuk-body" aria-live="polite">Loading source</p>';
      setTimeout(function () { seenSrc[keyId] = 1; body.innerHTML = sourceBodyHtml(l, i); scrollBox(body); }, 120);
    } else { body.innerHTML = sourceBodyHtml(l, i); scrollBox(body); }
  }
  function scrollBox(body) {
    var b = $('#app-boxed', body); if (!b) return;
    var br = b.getBoundingClientRect(); var pr = body.getBoundingClientRect();
    body.scrollTop += br.top - pr.top - 60;
    if (br.right > pr.right) body.scrollLeft += br.right - pr.right + 24;
  }

  function select(key, opts) {
    var l = lineByKey(key); if (!l) return;
    cur.key = key; cur.src = 0;
    $all('tr[data-row]').forEach(function (tr) { tr.classList.toggle('app-row--current', tr.getAttribute('data-row') === key); });
    var a = $('a[data-line="' + key + '"]'); if (a && !(opts && opts.noFocus)) a.focus();
    S.opened[key + ':0'] = 1; save();
    if (P.layout === 'walk') {
      $all('.app-trace-row').forEach(function (r) { r.parentNode.removeChild(r); });
      var tr = $('tr[data-row="' + key + '"]');
      if (tr) {
        var row = document.createElement('tr'); row.className = 'app-trace-row govuk-table__row';
        row.innerHTML = '<td class="govuk-table__cell" colspan="7"><div id="trace" role="region" aria-label="Trace for ' + esc(l.label) + '">' + traceHtml(l) + '</div></td>';
        tr.parentNode.insertBefore(row, tr.nextSibling);
      }
    } else { var t = $('#trace'); if (t) { t.innerHTML = traceHtml(l); } }
    renderSourceInto($('#source'), l, 0, { popout: P.layout !== 'rail' });
    postSource();
    // keep the flag being stepped through, if this line carries it
    var fm = window.location.hash.match(/f=([^&]+)/); var fo = fm && flagById(fm[1]);
    var keep = fo && fo.on.indexOf(key) !== -1;
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#l=' + key + (keep ? '&f=' + fm[1] : ''));
  }
  function showSrc(i) {
    var l = lineByKey(cur.key); if (!l || !l.sources.length) return;
    cur.src = (i + l.sources.length) % l.sources.length; S.opened[cur.key + ':' + cur.src] = 1; save();
    renderSourceInto($('#source'), l, cur.src, { popout: P.layout !== 'rail' });
    postSource();
    announce('Source ' + (cur.src + 1) + ' of ' + l.sources.length);
  }
  function numberLinks() { return $all('a[data-line]'); }
  function step(dir) {
    var links = numberLinks(); if (!links.length) return;
    var idx = links.map(function (a) { return a.getAttribute('data-line'); }).indexOf(cur.key);
    var next = idx === -1 ? (dir > 0 ? 0 : links.length - 1) : idx + dir;
    if (next < 0 || next >= links.length) { announce(dir > 0 ? 'Last number in this section. Press ] for the next section.' : 'First number in this section.'); return; }
    select(links[next].getAttribute('data-line'));
  }
  function nextFlag(dir) {
    var fl = sortedFlags(); if (!fl.length) return;
    var curFlag = (window.location.hash.match(/f=([^&]+)/) || [])[1];
    var i = fl.map(function (f) { return f.id; }).indexOf(curFlag);
    var n = i === -1 ? 0 : i + dir;
    if (n < 0 || n >= fl.length) { announce('No more flags.'); return; }
    var f = fl[n]; var k = f.on[0]; var s = sectionOf(k);
    if (s && s.id === P.section) { select(k); if (window.history.replaceState) window.history.replaceState(null, '', '#l=' + k + '&f=' + f.id); announce('Flag ' + (n + 1) + ' of ' + fl.length + ': ' + f.title); }
    else if (s) window.location.href = href(s.id, 'l=' + k + '&f=' + f.id);
  }
  function nextSection(dir) {
    var ids = sections().map(function (s) { return s.id; });
    var i = P.section ? ids.indexOf(P.section) : -1;
    var n = i + dir;
    if (n < 0) { window.location.href = 'brief.html'; return; }
    if (n >= ids.length) { window.location.href = 'brief.html#coverage'; return; }
    window.location.href = href(ids[n]);
  }

  // ---------- comments (RV-7) ----------
  function openCommentForm() {
    var slot = $('[data-comment-slot]'); var l = lineByKey(cur.key); if (!slot || !l) return;
    var r = function (name, vals) { return vals.map(function (v, i) { var id = name + '-' + i; return '<div class="govuk-radios__item"><input class="govuk-radios__input" id="' + id + '" name="' + name + '" type="radio" value="' + v + '"><label class="govuk-label govuk-radios__label" for="' + id + '">' + v + '</label></div>'; }).join(''); };
    slot.innerHTML = '<form novalidate data-comment-form><div data-errors></div>' +
      '<div class="govuk-form-group" id="grp-type"><fieldset class="govuk-fieldset" aria-describedby="type-error"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Type <span class="govuk-visually-hidden">required</span></legend><p class="govuk-error-message" id="type-error" hidden></p><div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">' + r('type', ['Error', 'Question', 'Missing evidence', 'Presentation']) + '</div></fieldset></div>' +
      '<div class="govuk-form-group" id="grp-sev"><fieldset class="govuk-fieldset" aria-describedby="sev-error"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Severity <span class="govuk-visually-hidden">required</span></legend><p class="govuk-error-message" id="sev-error" hidden></p><div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">' + r('sev', ['High', 'Medium', 'Low']) + '</div></fieldset></div>' +
      '<div class="govuk-form-group" id="grp-text"><label class="govuk-label govuk-label--s" for="ctext">What should the preparer do?</label><div class="govuk-hint" id="ctext-hint">Optional for a presentation comment. Goes to ' + esc(R.preparer) + ' with ' + esc(l.code) + ' ' + esc(l.label) + ', ' + esc(l.v) + '.</div><p class="govuk-error-message" id="text-error" hidden></p><textarea class="govuk-textarea" id="ctext" name="text" rows="3" aria-describedby="ctext-hint text-error"></textarea></div>' +
      '<div class="govuk-button-group"><button type="submit" class="govuk-button" data-module="govuk-button">Send to preparer</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-cancel-comment>Cancel</button></div></form>';
    var first = $('#type-0'); if (first) first.focus();
  }
  function submitComment(form) {
    var type = (form.querySelector('input[name=type]:checked') || {}).value;
    var sev = (form.querySelector('input[name=sev]:checked') || {}).value;
    var text = form.querySelector('#ctext').value.trim();
    var errs = [];
    if (!type) errs.push(['type-0', 'type-error', 'grp-type', 'Select the type of comment']);
    if (!sev) errs.push(['sev-0', 'sev-error', 'grp-sev', 'Select how serious this is']);
    if (type && type !== 'Presentation' && !text) errs.push(['ctext', 'text-error', 'grp-text', 'Enter what the preparer should do']);
    ['type-error', 'sev-error', 'text-error'].forEach(function (id) { var e = $('#' + id); e.hidden = true; e.innerHTML = ''; });
    ['grp-type', 'grp-sev', 'grp-text'].forEach(function (id) { $('#' + id).classList.remove('govuk-form-group--error'); });
    if (errs.length) {
      var box = $('[data-errors]', form);
      box.innerHTML = '<div class="govuk-error-summary" data-module="govuk-error-summary" tabindex="-1"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">' + errs.map(function (e) { return '<li><a href="#' + e[0] + '">' + e[3] + '</a></li>'; }).join('') + '</ul></div></div></div>';
      errs.forEach(function (e) { var m = $('#' + e[1]); m.hidden = false; m.innerHTML = '<span class="govuk-visually-hidden">Error:</span> ' + e[3]; $('#' + e[2]).classList.add('govuk-form-group--error'); });
      if (document.title.indexOf('Error: ') !== 0) document.title = 'Error: ' + document.title;
      $('.govuk-error-summary', box).focus();
      return;
    }
    document.title = document.title.replace(/^Error: /, '');
    var n = allComments().length + 1;
    S.comments.push({ n: n, line: cur.key, type: type, sev: sev, by: CPA_NAME, at: now(), text: text, status: 'Sent' });
    save(); select(cur.key);
    announce('Comment ' + n + ' sent to ' + R.preparer + '.');
    renderCommentsList();
  }
  function renderCommentsList() {
    var el = $('[data-comments-list]'); if (!el) return;
    var cs = allComments();
    if (!cs.length) { el.innerHTML = '<p class="govuk-body">No comments yet. Press <span class="app-key">c</span> on any number to comment.</p>'; return; }
    el.innerHTML = cs.map(function (c) { var l = lineByKey(c.line); return '<h2 class="govuk-heading-s govuk-!-margin-bottom-1">' + (l ? lineLink(l, l.code + ' ' + l.label + ', ' + l.v) : esc(c.line)) + '</h2>' + commentCard(c); }).join('');
  }

  // ---------- approve (RV-5): only when every section is marked ----------
  function renderApproved() {
    var el = $('[data-approved]'); if (!el) return;
    var left = sections().filter(function (s) { return statusOf(s.id) !== 'reviewed'; });
    if (left.length) {
      el.innerHTML = '<h1 class="govuk-heading-l">Not approved yet</h1><p class="govuk-body">Approve appears when every section is marked reviewed. Sections left:</p><ul class="govuk-list">' + left.map(function (s) { return '<li><a class="govuk-link" href="' + href(s.id) + '">' + esc(s.title) + '</a></li>'; }).join('') + '</ul>';
      document.title = 'Not approved yet - ' + R.name + ' - Ashbridge Tax';
      return;
    }
    if (!S.approved) { S.approved = { by: CPA_NAME, at: now() }; save(); }
    var opened = Object.keys(S.opened).length;
    el.innerHTML = '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="ok-title" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="ok-title">Success</h2></div><div class="govuk-notification-banner__content"><h3 class="govuk-notification-banner__heading">Return approved by ' + esc(S.approved.by) + ', ' + esc(S.approved.at) + '</h3></div></div>' +
      '<h1 class="govuk-heading-l">What you approved</h1><table class="govuk-table"><caption class="govuk-table__caption govuk-table__caption--m">Sections, in order</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Section</th><th scope="col" class="govuk-table__header">Reviewed by</th><th scope="col" class="govuk-table__header govuk-table__header--numeric">Time on section</th></tr></thead><tbody class="govuk-table__body">' +
      sections().map(function (s) { var m = S.marks[s.id]; var t = Math.round((S.timeOn[s.id] || 0) / 60); return '<tr class="govuk-table__row"><th scope="row" class="govuk-table__header">' + esc(s.title) + '</th><td class="govuk-table__cell">' + esc(m.by) + ', ' + esc(m.at) + '</td><td class="govuk-table__cell govuk-table__cell--numeric">' + t + ' min</td></tr>'; }).join('') +
      '</tbody></table><p class="govuk-body">Sources you opened: ' + opened + '. The approval record keeps the sections, the time on each and every source opened.</p>' +
      '<div class="govuk-button-group"><a href="../queue.html" role="button" draggable="false" class="govuk-button" data-module="govuk-button">Open the next return</a><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-withdraw>Withdraw approval</button></div>';
  }

  // ---------- keys (RV-6; WCAG 2.1.4: single keys can be turned off) ----------
  var KEYS = {
    j: function () { step(1); }, k: function () { step(-1); }, f: function () { nextFlag(1); }, F: function () { nextFlag(-1); },
    o: function () { var a = document.activeElement; if (a && a.getAttribute && a.getAttribute('data-line')) select(a.getAttribute('data-line')); },
    n: function () { showSrc(cur.src + 1); }, p: function () { showSrc(cur.src - 1); }, c: function () { if (cur.key) openCommentForm(); },
    m: toggleMark, ']': function () { nextSection(1); }, '[': function () { nextSection(-1); }, w: function () { popOut(); },
    a: function () { var b = $('[data-approve]'); if (b) b.click(); }, '?': function () { var d = $('#app-keys'); if (d) { d.open = true; d.querySelector('summary').focus(); } },
  };
  document.addEventListener('keydown', function (e) {
    if (shortcutsOff || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    var fn = KEYS[e.key]; if (!fn) return;
    e.preventDefault(); fn();
  });

  function popOut() {
    if (!P.viewer) return;
    popup = window.open(P.viewer + '?ret=' + encodeURIComponent(P.ret) + '&version=' + encodeURIComponent(P.version), 'ashbridge-source', 'popup,width=1000,height=1100');
    setTimeout(postSource, 400);
    if (cur.key) renderSourceInto($('#source'), lineByKey(cur.key), cur.src, { popout: true });
    announce('Source opened in a second window. It follows your clicks.');
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('a,button') : null; if (!t) return;
    if (t.hasAttribute('data-line')) { e.preventDefault(); select(t.getAttribute('data-line'), { noFocus: true }); return; }
    if (t.hasAttribute('data-goto')) { e.preventDefault(); select(t.getAttribute('data-goto')); return; }
    if (t.hasAttribute('data-src')) { showSrc(parseInt(t.getAttribute('data-src'), 10)); return; }
    if (t.hasAttribute('data-next-src')) { showSrc(cur.src + 1); return; }
    if (t.hasAttribute('data-prev-src')) { showSrc(cur.src - 1); return; }
    if (t.hasAttribute('data-retry')) { showSrc(cur.src); return; }
    if (t.hasAttribute('data-mark')) { toggleMark(); return; }
    if (t.hasAttribute('data-comment')) { openCommentForm(); return; }
    if (t.hasAttribute('data-cancel-comment')) { select(cur.key); return; }
    if (t.hasAttribute('data-popout')) { popOut(); return; }
    if (t.hasAttribute('data-popin')) { try { popup.close(); } catch (x) { /* already closed */ } popup = null; select(cur.key); return; }
    if (t.hasAttribute('data-step')) { step(parseInt(t.getAttribute('data-step'), 10)); return; }
    if (t.hasAttribute('data-flag-step')) { nextFlag(parseInt(t.getAttribute('data-flag-step'), 10)); return; }
    if (t.hasAttribute('data-section-step')) { nextSection(parseInt(t.getAttribute('data-section-step'), 10)); return; }
    if (t.hasAttribute('data-withdraw')) { S.approved = false; save(); window.location.href = 'brief.html'; return; }
    if (t.hasAttribute('data-reset')) { e.preventDefault(); try { Object.keys(window.localStorage).forEach(function (k) { if (k.indexOf('cpaProto.' + P.version) === 0) window.localStorage.removeItem(k); }); } catch (x) { /* storage blocked */ } window.location.reload(); }
  });
  document.addEventListener('submit', function (e) { if (e.target.hasAttribute('data-comment-form')) { e.preventDefault(); submitComment(e.target); } });
  document.addEventListener('change', function (e) { if (e.target.id === 'app-shortcuts-off') { shortcutsOff = e.target.checked; store('cpaProto.shortcutsOff', shortcutsOff); announce(shortcutsOff ? 'Single-key shortcuts off.' : 'Single-key shortcuts on.'); } });

  // time on each section, for the approval record
  if (P.section && R) {
    var t0 = Date.now();
    window.addEventListener('pagehide', function () { S.timeOn[P.section] = (S.timeOn[P.section] || 0) + (Date.now() - t0) / 1000; save(); });
  }

  // ---------- the second-window viewer ----------
  function viewer() {
    var q = new URLSearchParams(window.location.search);
    var el = $('#viewer');
    function show(msg) {
      if (!msg || !DATA[msg.ret]) { el.innerHTML = '<p class="govuk-body">Nothing selected yet. Click a number in the review window; this window follows.</p>'; return; }
      R = DATA[msg.ret]; var l = lineByKey(msg.key); if (!l) return;
      cur = { key: msg.key, src: msg.src || 0 };
      $('#viewer-line').textContent = R.name + ', ' + l.code + ' ' + l.label + ', ' + l.v;
      renderSourceInto(el, l, cur.src, {});
    }
    window.addEventListener('message', function (e) { if (e.data && e.data.key) show(e.data); });
    if (channel) channel.onmessage = function (e) { show(e.data); };
    var last = store('cpaProto.lastSource');
    show(last && (!q.get('ret') || last.ret === q.get('ret')) ? last : null);
  }

  // ---------- states page: every state the brief names, side by side ----------
  function states() {
    var r1 = DATA.r01; if (!r1) return;
    R = r1; S = { marks: {}, removed: {}, comments: [], opened: {}, timeOn: {}, approved: false };
    var find = function (k) { return lineByKey(k); };
    var put = function (sel, html) { var e = $(sel); if (e) e.innerHTML = html; };
    var travel = find('s125-9200'); var fi = 0; travel.sources.forEach(function (s, i) { if (s.type === 'failed') fi = i; });
    put('#st-failed', sourceHeadHtml(travel, fi, {}) + sourceBodyHtml(travel, fi));
    var del = find('s125-9275');
    put('#st-none', sourceHeadHtml(del, 0, {}) + sourceBodyHtml(del, 0));
    put('#st-loading', '<h2 class="govuk-heading-s">Source</h2><p class="govuk-body">' + esc(travel.sources[0].caption) + '</p><p class="govuk-body" aria-live="polite">Loading source</p>');
    put('#st-computed', sourceHeadHtml(find('s125-9999'), 0, {}) + sourceBodyHtml(find('s125-9999'), 0));
    var ret = find('s100-1301');
    put('#st-doc', sourceHeadHtml(find('s3-3-paid'), 2, {}) + sourceBodyHtml(find('s3-3-paid'), 2));
    put('#st-trace', traceHtml(ret));
  }

  // ---------- start ----------
  function start() {
    if (window.GOVUKFrontend && window.GOVUKFrontend.initAll) { try { window.GOVUKFrontend.initAll(); } catch (e) { /* prototype */ } }
    if (window.MOJFrontend && window.MOJFrontend.initAll) { try { window.MOJFrontend.initAll(); } catch (e) { /* prototype */ } }
    var off = $('#app-shortcuts-off'); if (off) off.checked = shortcutsOff;
    if (P.page === 'viewer') { viewer(); return; }
    if (P.page === 'states') { states(); return; }
    if (!R) return;
    renderCoverage(); renderCommentsList(); renderApproved();
    if (P.section) {
      var m = window.location.hash.match(/l=([^&]+)/);
      var first = numberLinks()[0];
      if (m && lineByKey(decodeURIComponent(m[1]))) select(decodeURIComponent(m[1]));
      else if (first) select(first.getAttribute('data-line'), { noFocus: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.CPA = { select: select };
})();
