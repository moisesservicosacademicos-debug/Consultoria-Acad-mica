// Aplica o tema antes da pintura para evitar piscar.
(function () {
  try {
    var t = localStorage.getItem('ca2_theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
