/* Sign out from any window ends every same-origin page (fix 5). In the product the server ends the session and this
   channel is the second line; here it is the only line. Pages name the signed-out page in data-signed-out on body. */
(function () {
  'use strict'
  var url = document.body && document.body.getAttribute('data-signed-out')
  if (!url || !('BroadcastChannel' in window)) return
  var ch = new BroadcastChannel('ashbridge-sign-out')
  ch.onmessage = function (e) {
    if (!e.data || e.data.t !== 'signout') return
    try { if (window.opener) window.close() } catch (x) { /* a window that cannot close goes to the signed-out page */ }
    location.replace(url)
  }
  var link = document.getElementById('sv-signout')
  if (link) link.addEventListener('click', function () { ch.postMessage({ t: 'signout' }) })
})()
