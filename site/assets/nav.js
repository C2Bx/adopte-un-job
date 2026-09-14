// Tiroir de navigation sur petit ecran. Sur grand ecran la barre est toujours la.
(function () {
  var nav = document.getElementById('topbar');
  var btn = document.getElementById('navToggle');
  var scrim = document.getElementById('navScrim');
  if (!nav || !btn || !scrim) return;

  function open(on) {
    nav.classList.toggle('open', on);
    scrim.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    document.body.style.overflow = on ? 'hidden' : '';
  }
  btn.addEventListener('click', function () {
    open(!nav.classList.contains('open'));
  });
  scrim.addEventListener('click', function () { open(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') open(false);
  });
  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
    a.addEventListener('click', function () { open(false); });
  });
  addEventListener('resize', function () {
    if (innerWidth > 900) open(false);
  });
})();
