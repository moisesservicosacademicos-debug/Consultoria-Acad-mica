/* Inicialização, login, conta e sincronização */
'use strict';
(function (CA) {
  var $ = CA.$, S = CA.S, ic = CA.icon, esc = CA.esc;
  var pollT = null;

  function showLogin(msg) {
    $('splash').hidden = true; $('app').hidden = true; $('login').hidden = false;
    var e = $('lgErr'); if (msg) { e.textContent = msg; e.hidden = false; } else e.hidden = true;
    setTimeout(function () { try { ($('lgEmail').value ? $('lgPass') : $('lgEmail')).focus(); } catch (x) {} }, 50);
  }
  async function enter(session) {
    S.user = session && session.user ? { id: session.user.id, email: session.user.email } : null;
    $('splash').hidden = false;
    try {
      await CA.pull(true);
    } catch (e) {
      var m = CA.errMsg(e);
      if (/administrativo|não autorizado|42501/i.test(m + (e.code || ''))) { await CA.api.signOut(); return showLogin('Este usuário não tem acesso de administrador ao sistema.'); }
      if (/sessão|expirou/i.test(m)) { await CA.api.signOut(); return showLogin('Sua sessão expirou. Entre novamente.'); }
      $('splash').hidden = true;
      return showLogin('Não consegui carregar a base: ' + m);
    }
    $('login').hidden = true; $('app').hidden = false; $('splash').hidden = true;
    CA.parseRoute(); CA.render(true);
    startPoll();
  }
  function startPoll() {
    clearInterval(pollT);
    pollT = setInterval(function () { if (document.visibilityState === 'visible' && !S.busy) refreshQuiet(); }, CA.CFG.poll);
  }
  function refreshQuiet() {
    var modalOpen = !$('modal').hidden;
    CA.pull(false).then(function (changed) {
      if (!changed) return;
      if (modalOpen) return; // não redesenha por baixo de um formulário aberto
      if (!$('drawer').hidden) return;
      CA.render();
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.data) refreshQuiet(); });
  window.addEventListener('online', function () { if (S.data) refreshQuiet(); });

  /* ---------- Login ---------- */
  $('lgShow').addEventListener('click', function () { var p = $('lgPass'); var show = p.type === 'password'; p.type = show ? 'text' : 'password'; this.textContent = show ? 'Ocultar' : 'Mostrar'; this.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); });
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = $('lgEmail').value.trim(), pass = $('lgPass').value, b = $('lgBtn'), er = $('lgErr');
    er.hidden = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { er.textContent = 'Informe um e-mail válido.'; er.hidden = false; return; }
    if (pass.length < 6) { er.textContent = 'Informe a senha.'; er.hidden = false; return; }
    b.disabled = true; b.textContent = 'Entrando…';
    try {
      var s = await CA.api.signIn(email, pass);
      $('lgPass').value = '';
      await enter(s);
    } catch (x) {
      var m = (x && x.message) || '';
      er.textContent = /invalid login|credentials/i.test(m) ? 'E-mail ou senha incorretos.' : /rate|too many/i.test(m) ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : CA.errMsg(x);
      er.hidden = false;
    } finally { b.disabled = false; b.textContent = 'Entrar'; }
  });

  /* ---------- Conta / tema / privacidade ---------- */
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('ca2_theme', t); } catch (e) {} }
  function setPriv(on) { document.documentElement.toggleAttribute('data-private', on); try { localStorage.setItem('ca2_priv', on ? '1' : '0'); } catch (e) {} }
  try { if (localStorage.getItem('ca2_priv') === '1') setPriv(true); } catch (e) {}
  function openMenu() {
    var mn = $('menu'), dark = document.documentElement.getAttribute('data-theme') === 'dark', priv = document.documentElement.hasAttribute('data-private');
    mn.innerHTML = '<div class="who"><b>' + esc((S.user && S.user.email) || 'Administrador') + '</b>Revisão da base ' + esc(S.revision == null ? '—' : S.revision) + ' · versão ' + CA.CFG.version + '</div>'
      + '<a href="#/agenda" class="m-only">' + ic('cal') + 'Agenda</a><a href="#/crm" class="m-only">' + ic('target') + 'CRM</a>'
      + '<button data-m="theme">' + ic(dark ? 'sun' : 'moon') + (dark ? 'Modo claro' : 'Modo escuro') + '</button>'
      + '<button data-m="priv">' + ic('eye') + (priv ? 'Mostrar valores' : 'Ocultar valores') + '</button>'
      + '<button data-m="refresh">' + ic('refresh') + 'Atualizar a base</button>'
      + '<button data-m="backup">' + ic('down') + 'Baixar cópia da base (JSON)</button>'
      + '<button data-m="out">' + ic('out') + 'Sair</button>';
    mn.hidden = false; $('btnMenu').setAttribute('aria-expanded', 'true');
    var f = mn.querySelector('button,a'); if (f) f.focus();
  }
  function closeMenu() { $('menu').hidden = true; $('btnMenu').setAttribute('aria-expanded', 'false'); }
  $('btnMenu').addEventListener('click', function (e) { e.stopPropagation(); if ($('menu').hidden) openMenu(); else closeMenu(); });
  document.addEventListener('click', function (e) { if (!$('menu').hidden && !e.target.closest('#menu') && !e.target.closest('#btnMenu')) closeMenu(); });
  $('menu').addEventListener('click', async function (e) {
    var b = e.target.closest('[data-m],a'); if (!b) return;
    var k = b.getAttribute('data-m'); closeMenu();
    if (k === 'theme') { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
    if (k === 'priv') { setPriv(!document.documentElement.hasAttribute('data-private')); }
    if (k === 'refresh') { CA.action('refresh'); }
    if (k === 'backup') { backup(); }
    if (k === 'out') { clearInterval(pollT); await CA.api.signOut(); S.data = null; S.revision = null; CA.invalidate(); $('view').innerHTML = ''; showLogin(); }
  });
  function backup() {
    if (!S.data) return;
    var blob = new Blob([JSON.stringify({ workspace: CA.CFG.ws, revision: S.revision, exportedAt: new Date().toISOString(), data: S.data }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'consultoria-base-rev' + S.revision + '-' + CA.today() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    CA.toast('Cópia da base baixada.');
  }

  $('btnLaunch').addEventListener('click', function () { if (S.data) CA.launch(); });
  $('btnSearch').addEventListener('click', function () { if (S.data) CA.search(); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S.data) { e.preventDefault(); CA.search(); }
  });

  /* ---------- Início ---------- */
  async function boot() {
    try { CA.initApi(); } catch (e) { $('splash').hidden = true; showLogin('Não foi possível iniciar a conexão com o banco.'); return; }
    CA.api.onAuth && CA.api.onAuth(function (ev) {
      if (ev === 'SIGNED_OUT' && S.data) { clearInterval(pollT); S.data = null; showLogin('Sua sessão foi encerrada.'); }
    });
    var s = null;
    try { s = await CA.api.getSession(); } catch (e) {}
    if (s) enter(s); else showLogin();
  }
  boot();
})(window.CA);
