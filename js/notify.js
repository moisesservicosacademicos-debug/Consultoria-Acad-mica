/* Central de notificações: avisa entregas, provas e trabalhos agendados
   que vencem em até 2 dias (ou já venceram) enquanto não forem resolvidos. */
'use strict';
(function (CA) {
  var esc = CA.esc, $ = CA.$;
  var JANELA = 2;                 // dias de antecedência
  var REAVISO_MS = 60 * 60 * 1000; // reaviso enquanto o sistema fica aberto
  var fechadoAssin = null, fechadoEm = 0, ultimaAssin = '';

  function itens() {
    if (!CA.S || !CA.S.data) return [];
    var M = CA.M(), hoje = CA.today(), out = [];
    M.prazos.forEach(function (p) {
      if (!CA.isISO(p.prazo)) return;
      var d = CA.days(hoje, p.prazo); if (d == null || d > JANELA) return;
      out.push({ k: (p.kind === 'sv' ? 'sv:' + p.s.uid : 'dl:' + p.x.uid), tipo: 'entrega', titulo: p.titulo || 'Entrega', nome: p.nome || '', data: p.prazo, dias: d,
        abrir: p.kind === 'sv' ? ['sv', p.s.uid] : ['dl', p.x.uid], resolver: p.kind === 'sv' ? ['finish', p.s.uid] : ['dl', p.x.uid], cod: p.sid || '' });
    });
    M.schedules.forEach(function (s) {
      if (!s.open || !CA.isISO(s.data)) return;
      var d = CA.days(hoje, s.data); if (d == null || d > JANELA) return;
      var prova = /prova|avalia|exame/i.test(s.tipo + ' ' + s.desc);
      out.push({ k: 'sch:' + s.uid, tipo: prova ? 'prova' : 'agenda', titulo: s.desc || s.tipo || 'Compromisso', nome: s.nome || '', data: s.data, hora: s.hora, dias: d,
        abrir: ['sch', s.uid], resolver: ['sch', s.uid], cod: s.tipo || '' });
    });
    out.sort(function (a, b) { return a.dias - b.dias || (a.tipo === 'prova' ? -1 : b.tipo === 'prova' ? 1 : 0) || a.data.localeCompare(b.data); });
    return out;
  }
  CA.notificacoes = itens;

  function quando(n) {
    if (n.dias < 0) return 'atrasado há ' + (-n.dias) + (n.dias === -1 ? ' dia' : ' dias');
    if (n.dias === 0) return 'vence hoje' + (n.hora ? ' às ' + esc(n.hora) : '');
    if (n.dias === 1) return 'vence amanhã' + (n.hora ? ' às ' + esc(n.hora) : '');
    return 'vence em ' + n.dias + ' dias';
  }
  function sev(n) { return n.dias < 0 ? 'late' : n.dias === 0 ? 'today' : 'soon'; }
  function rotulo(n) { return n.tipo === 'prova' ? 'Prova' : n.tipo === 'agenda' ? 'Agendamento' : 'Entrega'; }
  var ICO = {
    entrega: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    prova: '<svg viewBox="0 0 24 24"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/></svg>',
    agenda: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  function linha(n, compacta) {
    var acao = n.tipo === 'entrega' && n.abrir[0] === 'sv' ? 'Concluir' : 'Resolver';
    return '<div class="nt-i ' + sev(n) + '"><span class="nt-ic">' + ICO[n.tipo] + '</span><div class="nt-t">'
      + '<span class="nt-k">' + rotulo(n) + ' · <b>' + quando(n) + '</b></span>'
      + '<b class="nt-n">' + esc(n.titulo) + '</b><small>' + esc(n.nome) + ' · ' + CA.dbr(n.data) + (n.cod ? ' · ' + esc(n.cod) : '') + '</small>'
      + (compacta ? '' : '<div class="nt-a"><button type="button" class="btn sm" data-nact="' + n.abrir[0] + '" data-uid="' + esc(n.abrir[1]) + '">Abrir</button><button type="button" class="btn sm primary" data-nact="' + n.resolver[0] + '" data-uid="' + esc(n.resolver[1]) + '">' + acao + '</button></div>')
      + '</div></div>';
  }


  /* ---------- Notificações do aparelho (Web Push): celular e computador ---------- */
  var VAPID = 'BLpGy8MXTFSiiZUAyJIRj5o6wVvl0-hjojvHI7QwCS_UQDrGFcu7a_Yq3hugYZtnocaXryf-5jk48i60v5wp1i8';
  var OFF_KEY = 'ca2_push_off';
  var P = CA.push = { sub: null, busy: false, synced: false, diag: null };
  P.suportado = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; };
  P.ios = function () { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  P.movel = function () { return P.ios() || /android|mobile/i.test(navigator.userAgent); };
  P.mac = function () { return !P.ios() && /mac/i.test(navigator.platform || navigator.userAgent); };
  P.standalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  function b64(u) { var p = '='.repeat((4 - u.length % 4) % 4), s = atob((u + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function aparelho() { var u = navigator.userAgent; return (/iphone/i.test(u) ? 'iPhone' : /ipad/i.test(u) ? 'iPad' : /android/i.test(u) ? 'Android' : /windows/i.test(u) ? 'Windows' : /mac/i.test(u) ? 'Mac' : 'Navegador') + (P.standalone() ? ' (app)' : ''); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  var ondeTxt = function () { return P.movel() ? 'celular' : 'computador'; };

  var swReg = null, esperaTeste = null;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(function (r) {
      swReg = r; try { r.update(); } catch (e) {}
      return r.pushManager && r.pushManager.getSubscription();
    }).then(function (s) { P.sub = s || null; refreshPainel(); }).catch(function () {});
    // Mensagem do service worker a cada aviso recebido por este navegador
    try { navigator.serviceWorker.startMessages(); } catch (e) {}
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {}; if (d.type !== 'ca-push') return;
      if (d.tag === 'teste') { if (esperaTeste) esperaTeste(true); return; }
      try { CA.atualizarNotificacoes(); } catch (x) {}
      if (document.visibilityState === 'visible') CA.toast('🔔 ' + d.title);
    });
  }
  async function registro() { return swReg || await navigator.serviceWorker.ready; }
  async function salvar(sub) {
    var j = sub.toJSON(), sb = CA.api && CA.api.sb; if (!sb) throw new Error('Entre no sistema antes de ativar.');
    var r = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: aparelho() }, { onConflict: 'endpoint' });
    if (r.error) throw new Error(r.error.message);
  }
  async function inscrever(nova) {
    var reg = await registro(), s = await reg.pushManager.getSubscription();
    if (s && nova) { try { await s.unsubscribe(); } catch (e) {} s = null; }
    if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
    await salvar(s); P.sub = s; return s;
  }
  /* Ao entrar no sistema: se a permissão já foi dada neste aparelho, os avisos ficam
     ativos sozinhos (inscreve de novo se a inscrição tiver se perdido), sem clicar em nada. */
  P.sync = async function () {
    if (P.synced || !P.suportado() || Notification.permission !== 'granted' || !CA.api || lsGet(OFF_KEY) === '1') return;
    P.synced = true;
    try { await inscrever(false); refreshPainel(); } catch (e) { P.synced = false; }
  };
  P.ativar = async function () {
    if (!P.suportado()) throw new Error(P.ios() && !P.standalone() ? 'No iPhone, abra o sistema pelo ícone da tela de início e ative por lá.' : 'Este navegador não recebe notificações.');
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(P.movel() ? 'Permissão negada. Libere as notificações do sistema nos ajustes do celular e tente de novo.' : 'Permissão negada. Clique no cadeado ao lado do endereço do site › Notificações › Permitir e tente de novo.');
    lsSet(OFF_KEY, null);
    await inscrever(false); P.synced = true;
    return P.testar();
  };
  function enviarTeste() {
    return CA.api.sb.functions.invoke('push-notify', { body: { mode: 'test', endpoint: P.sub.endpoint } }).then(function (r) {
      if (r.error) throw new Error('Não foi possível enviar o teste agora. Confira a internet e tente de novo.');
      if (r.data && r.data.ok === 0) throw new Error('O servidor não conseguiu entregar o aviso a este aparelho.');
    });
  }
  function aguardarChegada(ms) {
    return new Promise(function (res) {
      var t = setTimeout(function () { esperaTeste = null; res(false); }, ms);
      esperaTeste = function (v) { clearTimeout(t); esperaTeste = null; res(v); };
    });
  }
  /* Envia o teste e confere se ele chegou de fato a este navegador.
     Retorna 'ok' quando chegou; se não chegar, refaz a inscrição uma vez e tenta de novo. */
  P.testar = async function () {
    if (!P.sub) throw new Error('Ative as notificações primeiro.');
    var chegou = aguardarChegada(12000);
    await enviarTeste();
    if (await chegou) { P.diag = 'ok'; return 'ok'; }
    await inscrever(true);
    chegou = aguardarChegada(12000);
    await enviarTeste();
    if (await chegou) { P.diag = 'ok'; return 'ok'; }
    P.diag = 'falhou';
    throw new Error('O aviso de teste não chegou a este navegador. Feche e abra o navegador e tente de novo.');
  };
  P.desativar = async function () {
    lsSet(OFF_KEY, '1'); P.diag = null;
    if (!P.sub) return;
    var ep = P.sub.endpoint;
    try { await P.sub.unsubscribe(); } catch (e) {}
    if (CA.api) await CA.api.sb.from('push_subscriptions').delete().eq('endpoint', ep);
    P.sub = null;
  };
  function ajudaSO() {
    if (P.movel()) return 'Não viu o aviso? Confira se as notificações do navegador estão liberadas nos ajustes do celular e se o modo Não perturbe está desligado.';
    if (P.mac()) return 'Não viu o balão no canto da tela? No Mac: Ajustes do Sistema › Notificações › Google Chrome › Permitir notificações, e desligue o Foco/Não perturbe.';
    return 'Não viu o balão no canto da tela? No Windows: Configurações › Sistema › Notificações › ative "Notificações" e "Google Chrome", e desligue o "Não perturbe". O Chrome precisa estar aberto (pode ser minimizado).';
  }
  function pushBox() {
    var onde = ondeTxt();
    if (!P.suportado()) {
      return '<div class="np np-off"><b>Notificações no ' + onde + '</b><span>' + (P.ios() && !P.standalone() ? 'No iPhone, abra o sistema pelo ícone da tela de início para ativar os avisos.' : 'Este navegador não recebe notificações. Use o Chrome ou o Edge no computador, o Chrome no Android ou o ícone da tela de início no iPhone.') + '</span></div>';
    }
    if (Notification.permission === 'denied') return '<div class="np np-off"><b>Notificações bloqueadas neste ' + onde + '</b><span>' + (P.movel() ? 'Libere nos ajustes do celular (Notificações › Consultoria) e toque em Tentar de novo.' : 'Clique no cadeado ao lado do endereço do site › Notificações › Permitir. Depois recarregue a página.') + '</span><button type="button" class="btn sm" data-np="on">Tentar de novo</button></div>';
    if (P.sub) return '<div class="np np-on"><b><i></i>Avisos ativos neste ' + onde + '</b><span>' + (P.diag === 'ok' ? 'Teste recebido por este navegador. ' + ajudaSO() : 'Os alertas chegam mesmo com o sistema fechado' + (P.movel() ? '.' : ', desde que o navegador esteja aberto (pode ser minimizado).')) + '</span><div><button type="button" class="btn sm" data-np="test">Enviar teste</button><button type="button" class="btn sm ghost" data-np="off">Desativar</button></div></div>';
    return '<div class="np"><b>Receba os alertas neste ' + onde + '</b><span>Avisos de entregas, provas e agendamentos aparecem mesmo com o sistema fechado. O navegador pede sua permissão só uma vez; depois fica ativo sozinho.</span><button type="button" class="btn sm primary" data-np="on">Ativar neste ' + onde + '</button></div>';
  }
  function refreshPainel() { var p = $('notifPanel'); if (p && !p.hidden) p.innerHTML = painelHTML(itens()); }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-np]'); if (!b || P.busy) return;
    e.stopPropagation();
    var k = b.getAttribute('data-np'); P.busy = true; b.disabled = true; var t0 = b.textContent; b.textContent = k === 'off' ? 'Aguarde…' : 'Testando…';
    try {
      if (k === 'on' || k === 'test') {
        if (k === 'on') await P.ativar(); else await P.testar();
        CA.toast(P.movel() ? 'Teste recebido. O aviso deve aparecer na tela do celular.' : 'Teste recebido pelo navegador. O balão deve aparecer no canto da tela.');
      }
      else if (k === 'off') { await P.desativar(); CA.toast('Avisos desativados neste ' + ondeTxt() + '.'); }
    } catch (err) { CA.toast(err.message || String(err), 'err'); }
    P.busy = false; b.disabled = false; b.textContent = t0; refreshPainel();
  }, true);

  /* ---------- Sino no cabeçalho + painel ---------- */
  function painelHTML(L) {
    var atr = L.filter(function (n) { return n.dias < 0; }).length;
    return pushBox() + '<div class="nt-h"><b>Notificações</b><span>' + (L.length ? L.length + (L.length === 1 ? ' pendência' : ' pendências') + (atr ? ' · ' + atr + ' em atraso' : '') : 'nenhuma pendência') + '</span></div>'
      + (L.length ? '<div class="nt-l">' + L.map(function (n) { return linha(n); }).join('') + '</div>'
        : '<div class="nt-e"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><b>Nenhuma notificação no momento</b><span>Você será avisado 2 dias antes de cada entrega, prova ou trabalho agendado.</span></div>')
      + '<div class="nt-f"><span>Avisos de entregas e agendamentos com prazo em até 2 dias. Somem ao marcar como resolvido.</span><a href="#/agenda/prazos" data-nclose>Ver agenda</a></div>';
  }
  function abrirPainel() {
    var p = $('notifPanel'), b = $('btnNotif');
    p.innerHTML = painelHTML(itens()); p.hidden = false; b.setAttribute('aria-expanded', 'true');
    fecharAlerta(true);
  }
  function fecharPainel() { var p = $('notifPanel'); if (!p || p.hidden) return; p.hidden = true; $('btnNotif').setAttribute('aria-expanded', 'false'); }
  CA.abrirNotificacoes = abrirPainel;

  /* ---------- Alerta automático ---------- */
  function fecharAlerta(lembrar) {
    var a = $('notifAlert'); if (!a || a.hidden) return;
    a.hidden = true; if (lembrar) { fechadoAssin = ultimaAssin; fechadoEm = Date.now(); }
  }
  function mostrarAlerta(L) {
    var a = $('notifAlert'), atr = L.filter(function (n) { return n.dias < 0; }).length, hoje = L.filter(function (n) { return n.dias === 0; }).length;
    var tit = atr ? (atr === 1 ? '1 pendência em atraso' : atr + ' pendências em atraso') : hoje ? (hoje === 1 ? '1 pendência vence hoje' : hoje + ' pendências vencem hoje') : (L.length === 1 ? '1 prazo vence nos próximos 2 dias' : L.length + ' prazos vencem nos próximos 2 dias');
    a.className = 'nt-alert ' + (atr || hoje ? 'late' : 'soon');
    a.innerHTML = '<div class="na-h"><span class="na-ic"><svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></span><div><b>Atenção: ' + tit + '</b><span>Confira e não deixe passar. O aviso continua até ser marcado como resolvido.</span></div>'
      + '<button type="button" class="na-x" data-nx aria-label="Fechar aviso"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
      + '<div class="na-l">' + L.slice(0, 4).map(function (n) { return linha(n, true); }).join('') + '</div>'
      + '<div class="na-f">' + (L.length > 4 ? '<span>e mais ' + (L.length - 4) + '</span>' : '<span></span>') + '<button type="button" class="btn sm primary" data-nall>Ver notificações</button></div>';
    a.hidden = false;
  }

  CA.atualizarNotificacoes = function () {
    var b = $('btnNotif'); if (!b || !CA.S.data) return;
    if (CA.push && !CA.push.synced) CA.push.sync();
    var L = itens(), c = $('notifCount');
    c.textContent = L.length > 99 ? '99+' : L.length; c.hidden = !L.length;
    b.classList.toggle('has', !!L.length);
    b.title = L.length ? L.length + ' notificações' : 'Nenhuma notificação';
    document.title = (L.length ? '(' + L.length + ') ' : '') + document.title.replace(/^\(\d+\+?\)\s*/, '');
    var p = $('notifPanel'); if (p && !p.hidden) p.innerHTML = painelHTML(L);
    ultimaAssin = L.map(function (n) { return n.k + '@' + n.dias; }).join('|');
    if (!L.length) { fecharAlerta(false); return; }
    // reaparece em cada entrada no sistema, quando surge pendência nova ou a cada hora
    var mudou = fechadoAssin !== null && L.some(function (n) { return fechadoAssin.indexOf(n.k + '@' + n.dias) < 0; });
    if (fechadoAssin === null || mudou || Date.now() - fechadoEm > REAVISO_MS) { if (p && !p.hidden) return; mostrarAlerta(L); }
    else { var a = $('notifAlert'); if (a && !a.hidden) mostrarAlerta(L); }
  };
  CA.resetNotificacoes = function () { fechadoAssin = null; fechadoEm = 0; fecharAlerta(false); fecharPainel(); };

  /* Chama a atualização a cada render da tela */
  var render0 = CA.render;
  CA.render = function () { var r = render0.apply(this, arguments); try { CA.atualizarNotificacoes(); } catch (e) { if (window.console) console.error(e); } return r; };
  setInterval(function () { try { CA.atualizarNotificacoes(); } catch (e) {} }, 5 * 60 * 1000);

  /* Eventos */
  function acao(el) {
    var act = el.getAttribute('data-nact'); if (!act) return;
    fecharPainel(); fecharAlerta(true);
    CA.action(act, el);
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#btnNotif')) { var p = $('notifPanel'); p.hidden ? abrirPainel() : fecharPainel(); return; }
    var inP = t.closest('#notifPanel'), inA = t.closest('#notifAlert');
    if (inP || inA) {
      var el = t.closest('[data-nact]'); if (el) return acao(el);
      if (t.closest('[data-nx]')) return fecharAlerta(true);
      if (t.closest('[data-nall]')) return abrirPainel();
      if (t.closest('[data-nclose]')) return fecharPainel();
      return;
    }
    fecharPainel();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fecharPainel(); } });
})(window.CA);
