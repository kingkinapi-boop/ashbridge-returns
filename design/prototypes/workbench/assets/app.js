/* Prototype behaviour: initialise MOJ, key shortcuts, loading state. Nothing here is needed to read the pages. */
(function () {
  if (window.MOJFrontend && window.MOJFrontend.initAll) { window.MOJFrontend.initAll(); }

  var KEY_OFF = 'ashbridge.keys.off';
  function keysOff() { try { return localStorage.getItem(KEY_OFF) === '1'; } catch (e) { return false; } }

  var toggle = document.getElementById('keys-off');
  if (toggle) {
    toggle.checked = keysOff();
    toggle.addEventListener('change', function () {
      try { localStorage.setItem(KEY_OFF, toggle.checked ? '1' : '0'); } catch (e) {}
    });
  }

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) { return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (keysOff()) { return; }
    var k = e.key;
    if (k === '/') {
      var q = document.getElementById('site-search');
      if (q) { e.preventDefault(); q.focus(); }
      return;
    }
    if (k === '?') {
      var d = document.getElementById('keys-details');
      if (d) { d.open = true; d.scrollIntoView(); }
      return;
    }
    var el = document.querySelector('[data-key="' + k.toLowerCase() + '"]');
    if (el) { e.preventDefault(); el.click(); }
  });

  document.addEventListener('submit', function (e) {
    var b = e.target.querySelector('button[type="submit"], button:not([type])');
    if (b) { b.setAttribute('aria-busy', 'true'); b.textContent = 'Saving'; }
  });
})();
