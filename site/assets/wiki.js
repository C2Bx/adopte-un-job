(function () {
  // Sommaire lateral construit depuis les h2 de la page
  var col = document.querySelector('.col');
  var rail = document.querySelector('.rail ol');
  if (col && rail) {
    var hs = col.querySelectorAll('h2[id]');
    Array.prototype.forEach.call(hs, function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      rail.appendChild(li);
    });
    var links = rail.querySelectorAll('a');
    if (links.length) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            Array.prototype.forEach.call(links, function (l) {
              l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id);
            });
          }
        });
      }, { rootMargin: '-10% 0px -80% 0px' });
      Array.prototype.forEach.call(hs, function (h) { io.observe(h); });
    }
  }

  // Theme
  var key = 'aj.theme';
  var saved = null;
  try { saved = localStorage.getItem(key); } catch (e) {}
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('tt');
  if (btn) {
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light'
        : cur === 'light' ? 'dark'
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(key, next); } catch (e) {}
    });
  }

  // Copie du prompt
  var cp = document.getElementById('copyPrompt');
  if (cp) {
    cp.addEventListener('click', function () {
      var t = document.getElementById('promptText').innerText;
      navigator.clipboard.writeText(t).then(function () {
        cp.textContent = 'Copie';
        setTimeout(function () { cp.textContent = 'Copier le prompt'; }, 2000);
      }, function () {
        cp.textContent = 'Copie impossible, selectionne le texte';
      });
    });
  }
})();
