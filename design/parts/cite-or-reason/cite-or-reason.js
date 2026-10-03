/*
  Part: cite-or-reason, behaviour (design/parts/cite-or-reason/). Plain script, no dependencies.
  Contract (the markup is in example.html):
    [data-cor]               the form, or any wrapper, that holds one cite-or-reason group
    [data-cor-reason]        the reason textarea
    [data-cor-reason-radio]  the radio "A written reason"
  Typing a reason (non-blank) checks the reason radio and clears a "choose" error for the group: never a "choose" error
  while a reason is typed. Choosing the reason radio by hand moves focus into the textarea. The box grows to 4 lines as you type (any textarea with data-grow does the same). Choosing a source keeps
  the typed text and the checked radio decides. Nothing is preselected and nothing is validated before a submit (rule 9).
  window.AshCiteOrReason.init(root = document) is safe to call twice.
*/
(function () {
  'use strict';
  var done = new WeakSet();
  function clearGroupError(group) {
    var fs = group.querySelector('fieldset');
    if (!fs) { return; }
    var grp = fs.closest('.govuk-form-group');
    if (grp) { grp.classList.remove('govuk-form-group--error'); }
    Array.prototype.slice.call(fs.querySelectorAll('.govuk-error-message')).forEach(function (m) { if (!m.closest('.app-cor__reason')) { m.hidden = true; } });
    var form = group.closest('form') || group;
    var sum = form.querySelector('.govuk-error-summary');
    if (sum && !sum.hidden) {
      var ids = Array.prototype.map.call(fs.querySelectorAll('input[type=radio]'), function (r) { return r.id; });
      Array.prototype.slice.call(sum.querySelectorAll('li')).forEach(function (li) {
        var a = li.querySelector('a');
        var id = a ? (a.getAttribute('href') || '').slice(1) : '';
        if (ids.indexOf(id) >= 0) { li.remove(); }
      });
      if (!sum.querySelector('li')) { sum.hidden = true; document.title = document.title.replace(/^Error: /, ''); }
    }
  }
  function grow(t) { t.rows = 1; while (t.scrollHeight > t.clientHeight + 1 && t.rows < 4) { t.rows += 1; } }
  function init(root) {
    root = root || document;
    if (done.has(root)) { return; }
    done.add(root);
    root.addEventListener('input', function (e) {
      var g = e.target.closest && e.target.closest('[data-grow]');
      if (g) { grow(g); return; }
      var t = e.target.closest && e.target.closest('[data-cor-reason]');
      if (!t) { return; }
      var group = t.closest('[data-cor]');
      var radio = group && group.querySelector('[data-cor-reason-radio]');
      grow(t);
      if (radio && t.value.trim() && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        clearGroupError(group);
      }
    });
    root.addEventListener('change', function (e) {
      var r = e.target.closest && e.target.closest('[data-cor-reason-radio]');
      if (!r || !e.isTrusted || !r.checked) { return; }
      var group = r.closest('[data-cor]');
      var ta = group && group.querySelector('[data-cor-reason]');
      if (ta) { ta.focus({ preventScroll: true }); }
    });
  }
  window.AshCiteOrReason = { init: init };
  init(document);
})();
