/* Telas */
'use strict';
(function (CA) {
  var esc = CA.esc, brl = CA.brl, brl0 = CA.brl0, ic = CA.icon, dbr = CA.dbr, $ = CA.$;

  var AREAS = CA.AREAS = [
    { id: 'painel', label: 'Painel', icon: 'home', subs: [['visao', 'Visão geral']] },
    { id: 'clientes', label: 'Clientes', icon: 'users', subs: [['base', 'Base de acadêmicos'], ['acessos', 'Acessos de portal']] },
    { id: 'mensalidades', label: 'Mensalidades', icon: 'repeat', subs: [['situacao', 'Situação dos mensalistas'], ['competencia', 'Competência do mês'], ['pagamentos', 'Pagamentos recebidos']] },
    { id: 'servicos', label: 'Serviços', icon: 'file', subs: [['andamento', 'Em andamento'], ['receber', 'A receber'], ['concluidos', 'Concluídos'], ['catalogo', 'Catálogo']] },
    { id: 'financeiro', label: 'Financeiro', icon: 'chart', subs: [['resumo', 'Resultado do mês'], ['evolucao', 'Evolução desde o início'], ['extrato', 'Extrato'], ['despesas', 'Despesas'], ['anual', 'Tabela ano a ano']] },
    { id: 'agenda', label: 'Agenda', icon: 'cal', subs: [['prazos', 'Prazos de entrega'], ['agendamentos', 'Agendamentos']] },
    { id: 'crm', label: 'CRM', icon: 'target', subs: [['funil', 'Funil'], ['contatos', 'Contatos']] }
  ];
  var MOBILE = ['painel', 'clientes', 'mensalidades', 'servicos', 'financeiro'];

  /* ---------- Roteamento ---------- */
  CA.parseRoute = function () {
    var h = (location.hash || '').replace(/^#\/?/, '').split('/');
    var a = AREAS.filter(function (x) { return x.id === h[0]; })[0] || AREAS[0];
    var sub = a.subs.some(function (s) { return s[0] === h[1]; }) ? h[1] : a.subs[0][0];
    CA.S.route = { area: a.id, sub: sub };
  };
  CA.go = function (area, sub) { location.hash = '#/' + area + (sub ? '/' + sub : ''); };
  window.addEventListener('hashchange', function () { CA.parseRoute(); CA.render(true); });

  function badges(M) {
    var hojeAtras = M.prazos.filter(function (p) { return p.dias !== null && p.dias < 0; }).length;
    return { mensalidades: M.atrasados.length, agenda: hojeAtras };
  }

  CA.render = function (scrollTop) {
    if (!CA.S.data) return;
    var M = CA.M(), R = CA.S.route, area = AREAS.filter(function (a) { return a.id === R.area; })[0], b = badges(M);
    $('areas').innerHTML = AREAS.map(function (a) {
      return '<a href="#/' + a.id + '"' + (a.id === R.area ? ' aria-current="page"' : '') + '>' + esc(a.label) + (b[a.id] ? '<span class="badge" title="Itens em atraso">' + b[a.id] + '</span>' : '') + '</a>';
    }).join('');
    $('bottomnav').innerHTML = AREAS.filter(function (a) { return MOBILE.indexOf(a.id) >= 0; }).map(function (a) {
      return '<a href="#/' + a.id + '"' + (a.id === R.area ? ' aria-current="page"' : '') + '>' + ic(a.icon) + '<span>' + esc(a.label === 'Mensalidades' ? 'Mensal.' : a.label) + '</span>' + (b[a.id] ? '<span class="badge">' + b[a.id] + '</span>' : '') + '</a>';
    }).join('');
    $('subtabs').innerHTML = area.subs.map(function (s) {
      return '<a href="#/' + area.id + '/' + s[0] + '"' + (s[0] === R.sub ? ' aria-current="page"' : '') + '>' + esc(s[1]) + '</a>';
    }).join('');
    var fn = VIEWS[R.area + '/' + R.sub] || VIEWS['painel/visao'];
    var keepOpen = {};
    document.querySelectorAll('#view details.grp[data-k]').forEach(function (dt) { if (dt.open) keepOpen[dt.getAttribute('data-k')] = 1; });
    var y = window.scrollY;
    $('view').innerHTML = fn(M);
    document.querySelectorAll('#view details.grp[data-k]').forEach(function (dt) { if (keepOpen[dt.getAttribute('data-k')]) dt.open = true; });
    bindView();
    CA.mountCharts($('view'));
    if (scrollTop) window.scrollTo(0, 0); else window.scrollTo(0, y);
    document.title = area.label + ' · Consultoria Acadêmica';
  };

  /* ---------- Peças ---------- */
  function head(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
  }
  function btn(label, act, cls, attrs) { return '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + '>' + label + '</button>'; }
  function lbtn(label, act, attrs, cls) { return '<button type="button" class="btn-ghost sm ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + '>' + label + '</button>'; }
  function grp(key, title, sub, count, tone, right, body) {
    return '<details class="grp" data-k="' + esc(key) + '"><summary><span class="tone ' + tone + '"></span>' + ic('chev').replace('<svg', '<svg class="chev"')
      + '<span class="t">' + esc(title) + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (right ? '<span class="s num">' + right + '</span>' : '') + '<span class="count">' + count + '</span></summary>' + body + '</details>';
  }
  function empty(t, s) { return '<div class="empty"><b>' + esc(t) + '</b>' + (s ? esc(s) : '') + '</div>'; }
  function when(iso, dias) {
    if (!CA.isISO(iso)) return '<div class="when"><b>–</b><span>sem data</span></div>';
    var cls = dias !== null && dias < 0 ? ' out' : dias !== null && dias <= 2 ? ' warn' : '';
    return '<div class="when' + cls + '"><b>' + iso.slice(8, 10) + '</b><span>' + CA.MES3[+iso.slice(5, 7) - 1] + '</span></div>';
  }
  function prazoTxt(d) { return d === null ? 'sem prazo' : d < 0 ? (-d) + (d === -1 ? ' dia' : ' dias') + ' de atraso' : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : 'em ' + d + ' dias'; }
  CA.prazoTxt = prazoTxt;
  function chipFaixa(x) {
    return { atraso: '<span class="chip out">Em atraso</span>', breve: '<span class="chip warn">Vence em breve</span>', emdia: '<span class="chip in">Em dia</span>', pausado: '<span class="chip mute">Pausado</span>', inativo: '<span class="chip mute">' + esc(x.status) + '</span>', semdata: '<span class="chip info">Sem vencimento</span>' }[x.faixa];
  }
  CA.chipFaixa = chipFaixa;
  function monthNav(key, ym) {
    return '<div class="month-nav"><button type="button" data-act="mes" data-k="' + key + '" data-d="-1" aria-label="Mês anterior">' + ic('left') + '</button><span>' + esc(CA.ymLabel(ym)) + '</span><button type="button" data-act="mes" data-k="' + key + '" data-d="1" aria-label="Próximo mês">' + ic('chev') + '</button></div>';
  }
  function uiMonth(key) { return CA.S.ui[key] || CA.today().slice(0, 7); }
  function delta(a, b) {
    if (!b) return '';
    var p = Math.round((a - b) / Math.abs(b) * 100);
    return (p >= 0 ? '+' : '') + p + '% sobre o mês anterior';
  }
  var TIPO = CA.TIPO = { mens: ['Mensalidades', 'var(--in)'], event: ['Serviços eventuais', 'var(--action)'], extra: ['Extras de mensalistas', '#E0922A'], outro: ['Outros recebimentos', 'var(--muted)'] };

  var C = CA.C = { rec: 'var(--in)', desp: 'var(--out)', res: 'var(--action)', trend: 'var(--gold)' };
  function lbl(ym) { return CA.MES3[+ym.slice(5, 7) - 1] + '/' + ym.slice(2, 4); }
  CA.lbl = lbl;
  function varPct(a, b) { if (!b) return ''; var p = Math.round((a - b) / Math.abs(b) * 100); return '<span class="' + (p >= 0 ? 'in' : 'out') + '">' + (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%</span>'; }
  CA.varPct = varPct;
  function monthTip(sr, i, curYm, extra) {
    var m = sr[i], prev = sr[i - 1], marg = m.rec ? Math.round(m.res / m.rec * 100) + '%' : '—';
    return CA.tipMonth(CA.ymLabel(m.ym) + (m.ym === curYm ? ' · parcial' : ''), [
      ['Receita', brl(m.rec), C.rec], ['Despesas', brl(m.desp), C.desp], ['Lucro líquido', '<b>' + brl(m.res) + '</b>', C.res]
    ].concat(extra || []), 'Margem ' + marg + (prev && prev.rec ? ' · receita ' + varPct(m.rec, prev.rec) + ' sobre ' + CA.MES3[+prev.ym.slice(5, 7) - 1] : ''));
  }
  /* Painel: últimos 12 meses com detalhe por mês */
  function chart12(M) {
    var end = M.hoje.slice(0, 7), sr = CA.monthSeries(M, CA.ymAdd(end, -11), end);
    var closed = sr.slice(0, -1), rec12 = sr.reduce(function (t, m) { return t + m.rec; }, 0), res12 = sr.reduce(function (t, m) { return t + m.res; }, 0);
    var media = closed.length ? closed.reduce(function (t, m) { return t + m.rec; }, 0) / closed.length : 0;
    var best = sr.reduce(function (b, m) { return m.rec > b.rec ? m : b; }, sr[0]);
    var tr = CA.movAvg(sr.map(function (m) { return m.rec; }), 3);
    var stats = '<div class="cstats"><div><span>Receita em 12 meses</span><b class="num pv">' + brl0(rec12) + '</b></div><div><span>Lucro em 12 meses</span><b class="num pv">' + brl0(res12) + '</b></div><div><span>Média mensal</span><b class="num pv">' + brl0(media) + '</b></div><div><span>Melhor mês</span><b class="num pv">' + brl0(best.rec) + '</b><small>' + esc(CA.ymShort(best.ym).toLowerCase()) + '</small></div></div>';
    return stats + CA.chart('painel12', {
      aria: 'Receita, despesas e lucro dos últimos 12 meses', height: 260, partialLast: true,
      labels: sr.map(function (m) { return m.ym; }), ticks: function (i) { return CA.MES3[+sr[i].ym.slice(5, 7) - 1]; },
      series: [{ type: 'bar', color: C.rec, values: sr.map(function (m) { return m.rec; }) }, { type: 'bar', color: C.desp, values: sr.map(function (m) { return m.desp; }) },
        { type: 'dash', color: C.trend, values: tr }, { type: 'line', color: C.res, values: sr.map(function (m) { return m.res; }) }],
      tip: function (i) { return monthTip(sr, i, end, tr[i] != null ? [['Tendência (3 meses)', brl(tr[i]), C.trend]] : []); }
    }) + '<div class="legend" style="margin-top:8px"><span><i style="background:var(--in)"></i>Receita</span><span><i style="background:var(--out)"></i>Despesas</span><span><i class="ln-i" style="background:var(--action)"></i>Lucro líquido</span><span><i class="ln-i dash-i"></i>Tendência da receita (média de 3 meses)</span><span>Mês atual em tom claro, ainda parcial</span></div>';
  }
  function mix(m) {
    var tot = m.mens + m.event + m.extra + m.outro;
    if (!tot) return empty('Sem recebimentos neste mês');
    var bar = '<div class="mix">' + ['mens', 'event', 'extra', 'outro'].map(function (k) { return m[k] ? '<i style="width:' + (m[k] / tot * 100) + '%;background:' + TIPO[k][1] + '"></i>' : ''; }).join('') + '</div>';
    var leg = '<div class="mix-l">' + ['mens', 'event', 'extra', 'outro'].filter(function (k) { return m[k]; }).map(function (k) {
      return '<span class="sw" style="background:' + TIPO[k][1] + '"></span><span>' + TIPO[k][0] + '</span><span class="v num">' + brl(m[k]) + '</span>';
    }).join('') + '</div>';
    return bar + leg;
  }

  /* ---------- Linhas reutilizadas ---------- */
  function prazoRow(p) {
    var sub = p.nome + (p.kind === 'sv' ? ' · ' + p.sid + (p.extra ? ' · extra de mensalista' : '') : ' · prazo avulso');
    var right = p.saldo > 0 ? '<div class="val num">' + brl(p.saldo) + '<small>a receber</small></div>' : '';
    return '<button type="button" class="row" data-act="' + (p.kind === 'sv' ? 'sv' : 'dl') + '" data-uid="' + esc(p.kind === 'sv' ? p.s.uid : p.x.uid) + '">' + when(p.prazo, p.dias)
      + '<div class="main"><b>' + esc(p.titulo) + '</b><span>' + esc(sub) + ' · ' + prazoTxt(p.dias) + '</span></div>' + right + '</button>';
  }
  function mensRow(x) {
    return '<button type="button" class="row" data-act="cli" data-cid="' + esc(x.cid) + '">' + when(x.prox, x.dias)
      + '<div class="main"><b>' + esc(x.nome) + '</b><span>' + (x.faixa === 'atraso' ? 'Venceu há ' + (-x.dias) + (x.dias === -1 ? ' dia' : ' dias') : prazoTxt(x.dias)) + (x.ult ? ' · último pagamento ' + CA.dshort(x.ult) : '') + '</span></div>'
      + '<div class="val num">' + brl(x.valor) + '</div></button>';
  }
  function finRow(f) {
    var isOut = f.tipo === 'desp';
    var t = isOut ? f.desc : (f.cliente || f.desc), s = isOut ? 'Despesa' + (f.grupo ? ' · ' + f.grupo : '') : (TIPO[f.tipo] ? TIPO[f.tipo][0].replace(/s$/, '').replace('Serviços eventuai', 'Serviço eventual').replace('Extras de mensalista', 'Extra de mensalista').replace('Outros recebimento', 'Outro recebimento') : '');
    if (!isOut && f.tipo !== 'mens') { var parts = f.desc.split(' · '); if (parts.length > 1) s += ' · ' + parts[parts.length - 1]; }
    if (!isOut && f.tipo === 'mens') { var pp = f.desc.split(' · '); if (pp.length > 1) s = 'Mensalidade · ' + pp[pp.length - 1]; }
    return '<div class="row">' + when(f.data, 0).replace(' warn', '')
      + '<div class="main"><b>' + esc(t) + '</b><span>' + esc(s) + (f.forma ? ' · ' + esc(f.forma) : '') + '</span></div>'
      + '<div class="val num ' + (isOut ? 'out' : 'in') + '">' + (isOut ? '− ' + brl(f.desp) : brl(f.rec)) + '</div></div>';
  }

  /* ---------- Painel ---------- */
  var VIEWS = {};
  VIEWS['painel/visao'] = function (M) {
    var h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    var nowYm = M.hoje.slice(0, 7);
    var out = head(saud + ', Moisés', esc(CA.ymLabel(nowYm)) + ' · ' + M.ativos.length + ' mensalistas ativos · ' + M.services.filter(function (s) { return !s.done; }).length + ' serviços em andamento', btn(ic('refresh') + 'Atualizar', 'refresh'));
    out += '<div class="grid">';
    out += '<section class="ledger" aria-label="Resultado acumulado">'
      + '<div><div class="lb">Receita acumulada</div><div class="vl num pv">' + brl0(M.acc.rec) + '</div><div class="ft">desde ' + esc(CA.ymShort(M.acc.desde).toLowerCase()) + ' até hoje</div></div>'
      + '<div><div class="lb">Despesas acumuladas</div><div class="vl sm num pv">' + brl0(M.acc.desp) + '</div><div class="ft">' + (M.acc.rec ? Math.round(M.acc.desp / M.acc.rec * 100) : 0) + '% da receita</div></div>'
      + '<div><div class="lb">Lucro líquido acumulado</div><div class="vl sm num pv ' + (M.acc.res >= 0 ? 'pos' : 'neg') + '">' + brl0(M.acc.res) + '</div><div class="ft">margem de ' + (M.acc.rec ? Math.round(M.acc.res / M.acc.rec * 100) : 0) + '%</div></div>'
      + '<div><div class="lb">Resultado de ' + esc(CA.MES[+nowYm.slice(5, 7) - 1].toLowerCase()) + '</div><div class="vl sm num pv gold">' + brl0(M.now.res) + '</div><div class="ft">' + brl0(M.now.rec) + ' recebidos, ' + brl0(M.now.desp) + ' de despesas</div></div>'
      + '</section>';
    var atrasoVal = M.atrasados.reduce(function (t, x) { return t + x.valor; }, 0);
    out += '<div class="panel c3"><button class="kpi" data-go="financeiro/resumo"><span class="lb"><span class="dot" style="background:var(--in)"></span>Recebido no mês</span><span class="vl num pv">' + brl(M.now.rec) + '</span><span class="ft">' + (delta(M.now.rec, M.prev.rec) || 'primeiro mês com dados') + '</span></button></div>';
    out += '<div class="panel c3"><button class="kpi" data-go="mensalidades/situacao"><span class="lb"><span class="dot" style="background:var(--action)"></span>Mensalidades previstas</span><span class="vl num pv">' + brl(M.mrr) + '</span><span class="ft">' + M.ativos.length + ' mensalistas ativos por mês</span></button></div>';
    out += '<div class="panel c3"><button class="kpi" data-go="servicos/receber"><span class="lb"><span class="dot" style="background:var(--warn)"></span>A receber de serviços</span><span class="vl num pv">' + brl(M.aReceber) + '</span><span class="ft">' + M.services.filter(function (s) { return s.saldo > 0; }).length + ' serviços com saldo</span></button></div>';
    out += '<div class="panel c3"><button class="kpi" data-go="mensalidades/situacao"><span class="lb"><span class="dot" style="background:var(--out)"></span>Mensalidades em atraso</span><span class="vl num pv ' + (M.atrasados.length ? 'out' : '') + '">' + M.atrasados.length + (M.atrasados.length ? ' · ' + brl(atrasoVal) : '') + '</span><span class="ft">' + (M.atrasados.length ? 'toque para ver quem' : 'ninguém em atraso') + '</span></button></div>';

    out += '<section class="panel c8"><div class="panel-h"><h2>Últimos 12 meses</h2>' + lbtn('Ver evolução desde o início', 'go', ' data-go="financeiro/evolucao"') + '</div><div class="panel-b">' + chart12(M) + '</div></section>';
    out += '<section class="panel c4"><div class="panel-h"><h2>De onde veio a receita</h2><span class="muted">' + esc(CA.MES[+nowYm.slice(5, 7) - 1]) + '</span></div><div class="panel-b">' + mix(M.now) + '</div></section>';

    var pz = M.prazos.slice(0, 6);
    out += '<section class="panel c6"><div class="panel-h"><h2>Próximas entregas</h2>' + lbtn('Ver todas', 'go', ' data-go="agenda/prazos"') + '</div><div class="panel-b"><div class="rows">' + (pz.length ? pz.map(prazoRow).join('') : empty('Nenhum serviço em andamento', 'Quando um serviço for lançado, a entrega aparece aqui.')) + '</div></div></section>';
    var mc = M.rcl.filter(function (x) { return x.faixa === 'atraso' || x.faixa === 'breve'; }).slice(0, 6);
    out += '<section class="panel c6"><div class="panel-h"><h2>Mensalidades a cobrar</h2>' + lbtn('Ver mensalistas', 'go', ' data-go="mensalidades/situacao"') + '</div><div class="panel-b"><div class="rows">' + (mc.length ? mc.map(mensRow).join('') : empty('Nada a cobrar nos próximos 7 dias')) + '</div></div></section>';
    var ag = M.schedules.filter(function (s) { return s.open; }).slice(0, 5);
    out += '<section class="panel c6"><div class="panel-h"><h2>Agenda</h2>' + lbtn('Abrir agenda', 'go', ' data-go="agenda/agendamentos"') + '</div><div class="panel-b"><div class="rows">' + (ag.length ? ag.map(schRow).join('') : empty('Sem agendamentos pendentes')) + '</div></div></section>';
    out += '<section class="panel c6"><div class="panel-h"><h2>Últimos lançamentos</h2>' + lbtn('Ver extrato', 'go', ' data-go="financeiro/extrato"') + '</div><div class="panel-b"><div class="rows">' + (M.fin.length ? M.fin.slice(0, 6).map(finRow).join('') : empty('Nenhum lançamento ainda')) + '</div></div></section>';
    out += '</div>';
    return out;
  };
  function schRow(s) {
    return '<button type="button" class="row" data-act="sch" data-uid="' + esc(s.uid) + '">' + when(s.data, s.dias)
      + '<div class="main"><b>' + esc(s.desc || s.tipo) + '</b><span>' + esc(s.nome) + (s.tipo ? ' · ' + esc(s.tipo) : '') + (s.hora ? ' · ' + esc(s.hora) : '') + ' · ' + prazoTxt(s.dias).replace('vence', 'é') + '</span></div>'
      + (s.open ? '<span class="chip warn">Pendente</span>' : '<span class="chip in">Resolvido</span>') + '</button>';
  }

  /* ---------- Clientes ---------- */
  VIEWS['clientes/base'] = function (M) {
    var q = CA.normS(CA.S.ui.cq || ''), f = CA.S.ui.cf || '';
    var list = M.clients.filter(function (c) {
      if (f && c.tipo !== f) return false;
      if (!q) return true;
      return CA.normS(c.nome + ' ' + c.id + ' ' + c.tel + ' ' + c.fac).indexOf(q) >= 0 || (CA.telDig(q).length >= 4 && CA.telDig(c.tel).indexOf(CA.telDig(q)) >= 0);
    });
    var out = head('Base de acadêmicos', M.clients.length + ' clientes cadastrados', btn(ic('plus') + 'Novo cliente', 'newClient', 'primary'));
    out += '<div class="toolbar"><div class="search">' + ic('search') + '<input type="search" id="cq" placeholder="Buscar por nome, telefone, ID ou faculdade" value="' + esc(CA.S.ui.cq || '') + '" aria-label="Buscar cliente"></div>'
      + '<select id="cf" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>' + ['Cliente recorrente', 'Cliente não recorrente', 'Contato comercial', 'Recorrente arquivado'].map(function (t) { return '<option' + (t === f ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>';
    var groups = [['Cliente recorrente', 'Mensalistas', 'in'], ['Cliente não recorrente', 'Eventuais', 'act'], ['Contato comercial', 'Contatos comerciais', 'info'], ['Recorrente arquivado', 'Mensalistas arquivados', 'mute']];
    var known = groups.map(function (g) { return g[0]; });
    var others = list.filter(function (c) { return known.indexOf(c.tipo) < 0; });
    out += '<div class="groups">';
    var any = false;
    groups.forEach(function (g) {
      var items = list.filter(function (c) { return c.tipo === g[0]; });
      if (!items.length) return; any = true;
      out += clientGroup(M, 'cli-' + g[0], g[1], items, g[2], q);
    });
    if (others.length) { any = true; out += clientGroup(M, 'cli-outros', 'Outros', others, 'mute', q); }
    if (!any) out += empty('Nenhum cliente encontrado', q ? 'Confira a grafia ou busque pelo telefone.' : '');
    out += '</div>';
    return out;
  };
  function clientGroup(M, key, title, items, tone, q) {
    var rows = items.map(function (c) {
      var rc = M.rcByCid[c.id], nsv = M.services.filter(function (s) { return s.cid === c.id; }).length;
      var sit = rc ? chipFaixa(rc) : (c.status !== 'Ativo' ? '<span class="chip mute">' + esc(c.status) + '</span>' : '');
      return '<tr class="click" data-act="cli" data-cid="' + esc(c.id) + '" data-uid="' + esc(c.uid) + '" tabindex="0"><td><span class="strong">' + esc(c.nome) + '</span><span class="sub">' + esc(c.id) + '</span></td><td class="hide-m num">' + esc(CA.telFmt(c.tel)) + '</td><td class="hide-m">' + esc(c.fac || '—') + '</td><td class="hide-m r">' + nsv + '</td><td class="r">' + sit + '</td></tr>';
    }).join('');
    var tbl = '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Faculdade</th><th class="r">Serviços</th><th class="r">Situação</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    var html = grp(key, title, '', items.length, tone, '', tbl);
    return q ? html.replace('<details class="grp"', '<details class="grp" open') : html;
  }
  VIEWS['clientes/acessos'] = function (M) {
    var out = head('Acessos de portal', 'Logins e senhas dos portais das faculdades. As senhas ficam ocultas até você pedir para ver.', btn(ic('plus') + 'Novo acesso', 'newAccess', 'primary'));
    if (!M.access.length) return out + '<div class="panel">' + empty('Nenhum acesso cadastrado') + '</div>';
    var rows = M.access.map(function (a) {
      return '<tr><td><span class="strong">' + esc(a.nome) + '</span><span class="sub">' + esc(a.fac || '—') + '</span></td><td class="num">' + esc(a.login || '—') + (a.login ? ' ' + lbtn(ic('copy'), 'copy', ' data-v="' + esc(a.login) + '" aria-label="Copiar login"') : '') + '</td>'
        + '<td class="num"><span data-pw="' + esc(a.uid) + '">' + (a.senha ? '••••••••' : '—') + '</span>' + (a.senha ? ' ' + lbtn(ic('eye'), 'showPw', ' data-uid="' + esc(a.uid) + '" aria-label="Mostrar senha"') + lbtn(ic('copy'), 'copy', ' data-v="' + esc(a.senha) + '" aria-label="Copiar senha"') : '') + '</td>'
        + '<td class="act">' + lbtn(ic('edit') + 'Editar', 'editAccess', ' data-uid="' + esc(a.uid) + '"') + '</td></tr>';
    }).join('');
    return out + '<div class="groups">' + grp('acessos', 'Acessos cadastrados', '', M.access.length, 'act', '', '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Aluno</th><th>Login</th><th>Senha</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>') + '</div>';
  };

  /* ---------- Mensalidades ---------- */
  VIEWS['mensalidades/situacao'] = function (M) {
    var out = head('Situação dos mensalistas', M.ativos.length + ' ativos · ' + brl(M.mrr) + ' previstos por mês', btn(ic('plus') + 'Novo mensalista', 'newMensalista') + btn(ic('coin') + 'Registrar mensalidade', 'payMens', 'primary'));
    var defs = [['atraso', 'Em atraso', 'out'], ['breve', 'Vencem nos próximos 7 dias', 'warn'], ['emdia', 'Em dia', 'in'], ['semdata', 'Sem vencimento definido', 'info'], ['pausado', 'Pausados', 'mute'], ['inativo', 'Cancelados', 'mute']];
    out += '<div class="groups">';
    defs.forEach(function (d) {
      var items = M.rcl.filter(function (x) { return x.faixa === d[0]; });
      if (!items.length) return;
      var tot = items.reduce(function (t, x) { return t + x.valor; }, 0);
      var rows = items.map(function (x) {
        var act = x.status === 'Ativo' ? lbtn(ic('coin') + 'Registrar', 'payMens', ' data-cid="' + esc(x.cid) + '"') : lbtn(ic('play') + 'Reativar', 'reactivate', ' data-uid="' + esc(x.uid) + '"');
        return '<tr class="click" data-act="cli" data-cid="' + esc(x.cid) + '" tabindex="0"><td><span class="strong">' + esc(x.nome) + '</span><span class="sub">' + esc(x.cid) + (x.dia ? ' · vence todo dia ' + x.dia : '') + '</span></td>'
          + '<td class="r num">' + brl(x.valor) + '</td><td class="hide-m num">' + (x.prox ? dbr(x.prox) : '—') + (x.status === 'Ativo' && x.dias !== null ? '<span class="sub">' + prazoTxt(x.dias) + '</span>' : '') + '</td><td class="hide-m num">' + (x.ult ? dbr(x.ult) : '—') + '</td><td class="act">' + act + '</td></tr>';
      }).join('');
      out += grp('rc-' + d[0], d[1], '', items.length, d[2], brl(tot), '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Mensalista</th><th class="r">Valor</th><th>Próximo vencimento</th><th>Último pagamento</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    if (!M.rcl.length) out += '<div class="panel">' + empty('Nenhum mensalista cadastrado', 'Cadastre um cliente como mensalista para acompanhar a cobrança.') + '</div>';
    return out + '</div>';
  };
  VIEWS['mensalidades/competencia'] = function (M) {
    var ym = uiMonth('mcomp');
    var pagos = M.rpay.filter(function (p) { return p.comp === ym; });
    var pagosCid = {}; pagos.forEach(function (p) { pagosCid[p.cid] = (pagosCid[p.cid] || 0) + p.valor; });
    var ativos = M.rcl.filter(function (x) { return x.status === 'Ativo'; });
    var pend = ativos.filter(function (x) { return !pagosCid[x.cid]; });
    var totPago = pagos.reduce(function (t, p) { return t + p.valor; }, 0), totPend = pend.reduce(function (t, x) { return t + x.valor; }, 0);
    var out = head('Competência do mês', 'Quem já pagou e quem falta pagar a mensalidade de ' + esc(CA.ymLabel(ym).toLowerCase()) + '.', monthNav('mcomp', ym));
    out += '<div class="grid" style="margin-bottom:16px"><div class="panel c4"><div class="kpi"><span class="lb">Pago nesta competência</span><span class="vl num pv in">' + brl(totPago) + '</span><span class="ft">' + pagos.length + ' pagamentos</span></div></div>'
      + '<div class="panel c4"><div class="kpi"><span class="lb">Falta receber</span><span class="vl num pv ' + (totPend ? 'warn' : '') + '">' + brl(totPend) + '</span><span class="ft">' + pend.length + ' mensalistas</span></div></div>'
      + '<div class="panel c4"><div class="kpi"><span class="lb">Adimplência</span><span class="vl num">' + (ativos.length ? Math.round((ativos.length - pend.length) / ativos.length * 100) : 0) + '%</span><span class="ft">dos mensalistas ativos</span></div></div></div>';
    var rowsP = pend.map(function (x) {
      var due = x.dia ? CA.dueIn(ym, x.dia) : '';
      return '<tr class="click" data-act="cli" data-cid="' + esc(x.cid) + '" tabindex="0"><td><span class="strong">' + esc(x.nome) + '</span><span class="sub">vence ' + (due ? dbr(due) : '—') + '</span></td><td class="r num">' + brl(x.valor) + '</td><td class="act">' + lbtn(ic('coin') + 'Registrar', 'payMens', ' data-cid="' + esc(x.cid) + '" data-comp="' + ym + '"') + '</td></tr>';
    }).join('');
    var rowsOk = pagos.map(function (p) {
      return '<tr><td><span class="strong">' + esc(CA.clientName(p.cid, p.nome)) + '</span><span class="sub">pago em ' + dbr(p.data) + ' · ' + esc(p.forma) + '</span></td><td class="r num">' + brl(p.valor) + '</td><td class="act">' + lbtn(ic('undo') + 'Estornar', 'undoMens', ' data-uid="' + esc(p.uid) + '"', 'danger') + '</td></tr>';
    }).join('');
    var th = '<thead><tr><th>Mensalista</th><th class="r">Valor</th><th></th></tr></thead>';
    return out + '<div class="groups">'
      + grp('comp-pend-' + ym, 'Ainda não pagaram', '', pend.length, 'warn', brl(totPend), pend.length ? '<div class="tbl-wrap"><table class="tbl stack">' + th + '<tbody>' + rowsP + '</tbody></table></div>' : empty('Todos os mensalistas ativos pagaram esta competência'))
      + grp('comp-ok-' + ym, 'Já pagaram', '', pagos.length, 'in', brl(totPago), pagos.length ? '<div class="tbl-wrap"><table class="tbl stack">' + th + '<tbody>' + rowsOk + '</tbody></table></div>' : empty('Nenhum pagamento nesta competência'))
      + '</div>';
  };
  VIEWS['mensalidades/pagamentos'] = function (M) {
    var ym = uiMonth('mpag');
    var list = M.rpay.filter(function (p) { return p.data.slice(0, 7) === ym; });
    var tot = list.reduce(function (t, p) { return t + p.valor; }, 0);
    var out = head('Pagamentos recebidos', 'Mensalidades pelo dia em que o dinheiro entrou.', monthNav('mpag', ym) + btn(ic('coin') + 'Registrar mensalidade', 'payMens', 'primary'));
    var rows = list.map(function (p) {
      return '<tr><td class="num">' + dbr(p.data) + '</td><td><span class="strong">' + esc(CA.clientName(p.cid, p.nome)) + '</span><span class="sub">competência ' + (p.comp ? esc(CA.ymShort(p.comp).toLowerCase()) : '—') + '</span></td><td class="hide-m">' + esc(p.status) + '</td><td class="hide-m">' + esc(p.forma) + '</td><td class="r num strong">' + brl(p.valor) + '</td><td class="act">' + lbtn(ic('undo') + 'Estornar', 'undoMens', ' data-uid="' + esc(p.uid) + '"', 'danger') + '</td></tr>';
    }).join('');
    return out + '<div class="groups">' + grp('mpag-' + ym, 'Mensalidades de ' + CA.ymLabel(ym).toLowerCase(), '', list.length, 'in', brl(tot), list.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Data</th><th>Mensalista</th><th>Situação</th><th>Forma</th><th class="r">Valor</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : empty('Nenhuma mensalidade recebida neste mês')) + '</div>';
  };

  /* ---------- Serviços ---------- */
  function svTable(items, mode) {
    var rows = items.map(function (s) {
      var acts = '';
      if (!s.done) acts += lbtn(ic('check') + 'Concluir', 'finish', ' data-uid="' + esc(s.uid) + '"');
      if (s.saldo > 0) acts += lbtn(ic('coin') + 'Receber', 'paySv', ' data-uid="' + esc(s.uid) + '"');
      var col3 = mode === 'done' ? (s.entregue ? dbr(s.entregue) : '—') : (s.prazo ? dbr(s.prazo) + '<span class="sub">' + prazoTxt(s.dias) + '</span>' : '—');
      return '<tr class="click" data-act="sv" data-uid="' + esc(s.uid) + '" tabindex="0"><td><span class="strong">' + esc(s.servico) + '</span><span class="sub">' + esc(s.sid) + ' · ' + esc(s.nome) + (s.extra ? ' · extra de mensalista' : '') + '</span></td>'
        + '<td class="hide-m num">' + col3 + '</td><td class="r num">' + brl(s.total) + '</td><td class="r num ' + (s.saldo > 0 ? 'warn strong' : '') + '">' + (s.saldo > 0 ? brl(s.saldo) : 'Quitado') + '</td><td class="act">' + acts + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Serviço</th><th>' + (mode === 'done' ? 'Entregue em' : 'Prazo') + '</th><th class="r">Total</th><th class="r">Saldo</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  VIEWS['servicos/andamento'] = function (M) {
    var open = M.services.filter(function (s) { return !s.done; });
    var out = head('Serviços em andamento', open.length + ' em produção · ' + brl(open.reduce(function (t, s) { return t + s.saldo; }, 0)) + ' ainda a receber deles', btn(ic('coin') + 'Registrar recebimento', 'paySv') + btn(ic('plus') + 'Novo serviço', 'newSv', 'primary'));
    var defs = [['Atrasados', 'out', function (s) { return s.dias !== null && s.dias < 0; }], ['Entregar nos próximos 7 dias', 'warn', function (s) { return s.dias !== null && s.dias >= 0 && s.dias <= 7; }], ['Entregar depois', 'act', function (s) { return s.dias !== null && s.dias > 7; }], ['Sem prazo definido', 'mute', function (s) { return s.dias === null; }]];
    out += '<div class="groups">';
    defs.forEach(function (d) {
      var items = open.filter(d[2]).sort(function (a, b) { return (a.prazo || '9').localeCompare(b.prazo || '9'); });
      if (items.length) out += grp('sva-' + d[0], d[0], '', items.length, d[1], '', svTable(items));
    });
    if (!open.length) out += '<div class="panel">' + empty('Nenhum serviço em andamento', 'Use Novo serviço para lançar um trabalho com prazo e valor.') + '</div>';
    return out + '</div>';
  };
  VIEWS['servicos/receber'] = function (M) {
    var items = M.services.filter(function (s) { return s.saldo > 0; });
    var out = head('A receber', brl(M.aReceber) + ' em saldos de serviços', btn(ic('coin') + 'Registrar recebimento', 'paySv', 'primary'));
    var ev = items.filter(function (s) { return !s.extra; }), ex = items.filter(function (s) { return s.extra; });
    out += '<div class="groups">';
    if (ev.length) out += grp('rcv-ev', 'Serviços eventuais', '', ev.length, 'act', brl(ev.reduce(function (t, s) { return t + s.saldo; }, 0)), svTable(ev));
    if (ex.length) out += grp('rcv-ex', 'Extras de mensalistas', '', ex.length, 'warn', brl(ex.reduce(function (t, s) { return t + s.saldo; }, 0)), svTable(ex));
    if (!items.length) out += '<div class="panel">' + empty('Nenhum saldo em aberto', 'Todos os serviços estão quitados.') + '</div>';
    return out + '</div>';
  };
  VIEWS['servicos/concluidos'] = function (M) {
    var done = M.services.filter(function (s) { return s.done; });
    var by = {};
    done.forEach(function (s) { var k = (s.entregue || s.dc || '').slice(0, 7) || 'sem-data'; (by[k] = by[k] || []).push(s); });
    var out = head('Serviços concluídos', done.length + ' entregues · ' + brl(done.reduce(function (t, s) { return t + s.total; }, 0)) + ' contratados');
    out += '<div class="groups">';
    Object.keys(by).sort().reverse().forEach(function (k) {
      var items = by[k].sort(function (a, b) { return (b.entregue || '').localeCompare(a.entregue || ''); });
      out += grp('svd-' + k, k === 'sem-data' ? 'Sem data de entrega' : CA.ymLabel(k), '', items.length, 'in', brl(items.reduce(function (t, s) { return t + s.total; }, 0)), svTable(items, 'done'));
    });
    if (!done.length) out += '<div class="panel">' + empty('Nenhum serviço concluído ainda') + '</div>';
    return out + '</div>';
  };
  VIEWS['servicos/catalogo'] = function (M) {
    var out = head('Catálogo de serviços', 'Valores de referência usados ao lançar serviços.', btn(ic('plus') + 'Novo item', 'newCat', 'primary'));
    var by = {};
    M.catalog.forEach(function (c) { (by[c.cat] = by[c.cat] || []).push(c); });
    out += '<div class="groups">';
    Object.keys(by).sort().forEach(function (k) {
      var rows = by[k].map(function (c) {
        return '<tr><td><span class="strong">' + esc(c.nome) + '</span><span class="sub">' + esc(c.id) + (c.obs ? ' · ' + esc(c.obs) : '') + '</span></td><td class="r num">' + (c.valor ? brl(c.valor) : '—') + '</td><td class="r num hide-m">' + (c.promo ? brl(c.promo) : '—') + '</td><td class="r">' + (c.status === 'Ativo' ? '<span class="chip in">Ativo</span>' : '<span class="chip mute">' + esc(c.status) + '</span>') + '</td><td class="act">' + lbtn(ic('edit') + 'Editar', 'editCat', ' data-uid="' + esc(c.uid) + '"') + '</td></tr>';
      }).join('');
      out += grp('cat-' + k, k, '', by[k].length, 'act', '', '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Serviço</th><th class="r">Referência</th><th class="r">Promocional</th><th class="r">Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    if (!M.catalog.length) out += '<div class="panel">' + empty('Catálogo vazio') + '</div>';
    return out + '</div>';
  };

  /* ---------- Financeiro ---------- */
  VIEWS['financeiro/resumo'] = function (M) {
    var ym = uiMonth('fres'), m = M.monthOf(ym), p = M.monthOf(CA.ymAdd(ym, -1));
    var desp = M.fin.filter(function (f) { return f.ym === ym && f.tipo === 'desp'; });
    var byG = {}; desp.forEach(function (f) { var g = f.grupo || 'Sem grupo'; byG[g] = (byG[g] || 0) + f.desp; });
    var accYm = { rec: 0, desp: 0 }; M.months.forEach(function (x) { if (x.ym <= ym) { accYm.rec += x.rec; accYm.desp += x.desp; } });
    var out = head('Resultado do mês', 'Receita recebida menos despesas pagas no mês.', monthNav('fres', ym) + btn(ic('receipt') + 'Lançar despesa', 'newDesp', 'primary'));
    out += '<div class="grid">';
    out += '<section class="ledger"><div><div class="lb">Receita de ' + esc(CA.MES[+ym.slice(5, 7) - 1].toLowerCase()) + '</div><div class="vl num pv">' + brl(m.rec) + '</div><div class="ft">' + (delta(m.rec, p.rec) || 'sem mês anterior para comparar') + '</div></div>'
      + '<div><div class="lb">Despesas</div><div class="vl sm num pv">' + brl(m.desp) + '</div><div class="ft">' + desp.length + ' lançamentos</div></div>'
      + '<div><div class="lb">Lucro líquido do mês</div><div class="vl sm num pv ' + (m.res >= 0 ? 'pos' : 'neg') + '">' + brl(m.res) + '</div><div class="ft">margem de ' + (m.rec ? Math.round(m.res / m.rec * 100) : 0) + '%' + (m.pl > 0 && m.rec ? ' · antes do pró-labore ' + Math.round((m.res + m.pl) / m.rec * 100) + '%' : '') + '</div></div>'
      + '<div><div class="lb">Lucro acumulado até este mês</div><div class="vl sm num pv gold">' + brl0(accYm.rec - accYm.desp) + '</div><div class="ft">receita acumulada de ' + brl0(accYm.rec) + '</div></div></section>';
    out += '<section class="panel c6"><div class="panel-h"><h2>Composição da receita</h2></div><div class="panel-b">' + mix(m) + '</div></section>';
    var gk = Object.keys(byG).sort(function (a, b) { return byG[b] - byG[a]; });
    out += '<section class="panel c6"><div class="panel-h"><h2>Despesas por grupo</h2></div><div class="panel-b">' + (gk.length ? '<div class="mix-l">' + gk.map(function (g) { return '<span class="sw" style="background:var(--out)"></span><span>' + esc(g) + '</span><span class="v num">' + brl(byG[g]) + '</span>'; }).join('') + '</div>' : empty('Sem despesas neste mês')) + '</div></section>';
    out += '</div>';
    return out;
  };

  /* ---------- Evolução desde o início ---------- */
  VIEWS['financeiro/evolucao'] = function (M) {
    var end = M.hoje.slice(0, 7);
    if (!M.months.length) return head('Evolução desde o início') + '<div class="panel">' + empty('Ainda não há lançamentos financeiros') + '</div>';
    var start = M.months[0].ym, sr = CA.monthSeries(M, start, end), n = sr.length, ui = CA.S.ui;
    var hide = ui.evoHide || {};
    var tr = CA.movAvg(sr.map(function (m) { return m.rec; }), 3);
    var acc = 0, accArr = sr.map(function (m) { acc += m.res; return Math.round(acc * 100) / 100; });
    var recAcc = sr.reduce(function (t, m) { return t + m.rec; }, 0), despAcc = sr.reduce(function (t, m) { return t + m.desp; }, 0), resAcc = recAcc - despAcc;
    var closed = sr.slice(0, -1), last12 = closed.slice(-12), prev12 = closed.slice(-24, -12);
    var s12 = last12.reduce(function (t, m) { return t + m.rec; }, 0), p12 = prev12.reduce(function (t, m) { return t + m.rec; }, 0);
    var best = sr.reduce(function (b, m) { return m.rec > b.rec ? m : b; }, sr[0]);
    var firstDesp = sr.filter(function (m) { return m.desp > 0; })[0];
    var out = head('Evolução desde o início', 'Desde ' + esc(CA.ymLabel(start).toLowerCase()) + ' · ' + n + ' meses de operação. Toque ou passe o mouse nos gráficos para ver cada mês.');
    out += '<div class="grid">';
    out += '<section class="ledger"><div><div class="lb">Receita acumulada</div><div class="vl num pv">' + brl0(recAcc) + '</div><div class="ft">' + n + ' meses</div></div>'
      + '<div><div class="lb">Despesas acumuladas</div><div class="vl sm num pv">' + brl0(despAcc) + '</div><div class="ft">' + (firstDesp ? 'lançadas desde ' + esc(CA.ymShort(firstDesp.ym).toLowerCase()) : 'nenhuma lançada') + '</div></div>'
      + '<div><div class="lb">Lucro líquido acumulado</div><div class="vl sm num pv pos">' + brl0(resAcc) + '</div><div class="ft">tudo o que a consultoria já gerou</div></div>'
      + '<div><div class="lb">Margem líquida</div><div class="vl sm num gold">' + (recAcc ? Math.round(resAcc / recAcc * 100) : 0) + '%</div><div class="ft">' + (M.acc.pl > 0 && recAcc ? 'antes do pró-labore: ' + Math.round((resAcc + M.acc.pl) / recAcc * 100) + '%' : 'no período todo') + '</div></div></section>';
    out += '<div class="panel c4"><div class="kpi"><span class="lb">Receita nos últimos 12 meses</span><span class="vl num pv">' + brl0(s12) + '</span><span class="ft">' + (p12 ? varPct(s12, p12) + ' sobre os 12 meses anteriores' : 'meses fechados') + '</span></div></div>';
    out += '<div class="panel c4"><div class="kpi"><span class="lb">Média mensal</span><span class="vl num pv">' + brl0(last12.length ? s12 / last12.length : 0) + '</span><span class="ft">nos últimos ' + last12.length + ' meses fechados</span></div></div>';
    out += '<div class="panel c4"><div class="kpi"><span class="lb">Melhor mês</span><span class="vl num pv">' + brl0(best.rec) + '</span><span class="ft">' + esc(CA.ymLabel(best.ym)) + '</span></div></div>';
    if (recAcc > 0 && despAcc / recAcc < 0.10) out += '<div class="note c12"><b>Margem provavelmente acima da real.</b> As despesas somam só ' + (Math.round(despAcc / recAcc * 1000) / 10).toString().replace('.', ',') + '% da receita. Para prestador de serviço, o comum é algo entre 10% e 40%. Confira se impostos, taxas de pagamento, ferramentas, internet e o seu pró-labore estão lançados. ' + lbtn('Lançar despesa', 'newDesp') + '</div>';
    else if (M.acc.pl <= 0) out += '<div class="note info c12">Nenhum pró-labore lançado: o lucro mostrado inclui a sua própria remuneração. Use o grupo "Pró-labore" em Lançar despesa para ver a margem depois da sua retirada.</div>';
    if (firstDesp && firstDesp.ym > start) out += '<div class="note info c12">As despesas passaram a ser lançadas em ' + esc(CA.ymLabel(firstDesp.ym).toLowerCase()) + '. Antes disso, o lucro de cada mês aparece igual à receita.</div>';

    // 1. mês a mês
    var tg = function (k, label, color) { return '<button type="button" class="tgl" data-act="evoToggle" data-k="' + k + '" aria-pressed="' + (!hide[k]) + '"><i style="background:' + color + '"></i>' + label + '</button>'; };
    out += '<section class="panel c12"><div class="panel-h"><div><h2>Receita, despesas e lucro mês a mês</h2><span class="muted">Desde ' + esc(CA.ymShort(start).toLowerCase()) + ' até hoje</span></div><div class="tgls">' + tg('rec', 'Receita', C.rec) + tg('desp', 'Despesas', C.desp) + tg('res', 'Lucro líquido', C.res) + tg('trend', 'Tendência', C.trend) + '</div></div><div class="panel-b">'
      + CA.chart('evoMes', {
        aria: 'Evolução mensal de receita, despesas e lucro desde o início', height: 320, yearBands: true,
        labels: sr.map(function (m) { return m.ym; }),
        ticks: function (i, every) { var ym = sr[i].ym; return i === 0 || ym.slice(5, 7) === '01' ? (ym.slice(5, 7) === '01' ? ym.slice(0, 4) : lbl(ym)) : (n <= 18 && i % every === 0 ? CA.MES3[+ym.slice(5, 7) - 1] : ''); },
        series: [
          { type: 'line', color: C.res, values: sr.map(function (m) { return m.res; }), hidden: hide.res, width: 2 },
          { type: 'line', color: C.desp, values: sr.map(function (m) { return m.desp; }), hidden: hide.desp, width: 2 },
          { type: 'dash', color: C.trend, values: tr, hidden: hide.trend },
          { type: 'area', color: C.rec, values: sr.map(function (m) { return m.rec; }), hidden: hide.rec, width: 2.5 }],
        tip: function (i) { return monthTip(sr, i, end, tr[i] != null ? [['Tendência (3 meses)', brl(tr[i]), C.trend]] : []); }
      }) + '</div></section>';

    // 2. lucro acumulado + marcos
    var steps = [5000, 10000, 20000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 300000, 500000], marks = [];
    steps.forEach(function (st) { for (var i = 0; i < n; i++) if (accArr[i] >= st) { marks.push({ i: i, v: accArr[i], st: st, label: CA.kfmt(st) }); break; } });
    var nextGoal = steps.filter(function (st) { return st > accArr[n - 1]; })[0];
    out += '<section class="panel c8"><div class="panel-h"><div><h2>Lucro líquido acumulado</h2><span class="muted">Somado mês a mês desde o início</span></div><b class="num pv in" style="font-size:var(--fs-l)">' + brl(accArr[n - 1]) + '</b></div><div class="panel-b">'
      + CA.chart('evoAcc', {
        aria: 'Lucro líquido acumulado desde o início', height: 280, yearBands: true,
        labels: sr.map(function (m) { return m.ym; }), ticks: function (i) { var ym = sr[i].ym; return i === 0 ? lbl(ym) : ym.slice(5, 7) === '01' ? ym.slice(0, 4) : ''; },
        series: [{ type: 'area', color: C.res, values: accArr }],
        markers: marks.map(function (mk) { return { i: mk.i, v: mk.v, label: 'R$ ' + mk.label }; }),
        tip: function (i) { return CA.tipMonth(CA.ymLabel(sr[i].ym), [['Lucro do mês', brl(sr[i].res), C.res], ['Acumulado até aqui', '<b>' + brl(accArr[i]) + '</b>', 'var(--in)']]); }
      }) + '</div></section>';
    out += '<section class="panel c4"><div class="panel-h"><h2>Marcos alcançados</h2></div><div class="panel-b"><div class="rows">'
      + (marks.length ? marks.slice().reverse().map(function (mk) { return '<div class="row"><div class="main"><b class="num">' + brl0(mk.st) + '</b></div><div class="val">' + esc(CA.ymLabel(sr[mk.i].ym)) + '</div></div>'; }).join('') : empty('Nenhum marco ainda'))
      + '</div>' + (nextGoal ? '<div class="goal"><span>Próximo marco: <b class="num">' + brl0(nextGoal) + '</b></span><div class="bar-o"><i style="width:' + Math.min(100, accArr[n - 1] / nextGoal * 100) + '%"></i></div><small class="num pv">faltam ' + brl0(nextGoal - accArr[n - 1]) + '</small></div>' : '') + '</div></section>';

    // 3. ano contra ano
    var years = {}; sr.forEach(function (m) { var y = m.ym.slice(0, 4); var o = years[y] || (years[y] = { y: y, rec: 0, desp: 0, res: 0, meses: 0, last: m.ym }); o.rec += m.rec; o.desp += m.desp; o.res += m.res; o.meses++; o.last = m.ym; });
    var ys = Object.keys(years).sort().map(function (k) { return years[k]; });
    var curY = end.slice(0, 4), curM = +end.slice(5, 7);
    out += '<section class="panel c7"><div class="panel-h"><div><h2>Ano contra ano</h2><span class="muted">Receita, despesas e lucro de cada ano' + (years[curY] ? ' · ' + curY + ' até ' + esc(CA.MES[curM - 1].toLowerCase()) : '') + '</span></div></div><div class="panel-b">'
      + CA.chart('yoyBars', {
        aria: 'Comparação anual de receita, despesas e lucro', height: 260, barMax: 120,
        labels: ys.map(function (o) { return o.y; }), ticks: function (i) { var o = ys[i]; return o.y + (o.meses < 12 ? ' (' + o.meses + ' meses)' : ''); },
        series: [{ type: 'bar', color: C.rec, values: ys.map(function (o) { return o.rec; }) }, { type: 'bar', color: C.desp, values: ys.map(function (o) { return o.desp; }) }, { type: 'bar', color: C.res, values: ys.map(function (o) { return o.res; }) }],
        tip: function (i) { var o = ys[i], p = ys[i - 1]; return CA.tipMonth(o.y + (o.meses < 12 ? ' · ' + o.meses + ' meses' : ''), [['Receita', brl(o.rec), C.rec], ['Despesas', brl(o.desp), C.desp], ['Lucro líquido', '<b>' + brl(o.res) + '</b>', C.res]], 'Margem ' + (o.rec ? Math.round(o.res / o.rec * 100) : 0) + '% · média de ' + brl0(o.rec / o.meses) + ' por mês' + (p ? ' · receita ' + varPct(o.rec, p.rec) + ' sobre ' + p.y : '')); }
      }) + '<div class="legend" style="margin-top:8px"><span><i style="background:var(--in)"></i>Receita</span><span><i style="background:var(--out)"></i>Despesas</span><span><i style="background:var(--action)"></i>Lucro líquido</span></div></div></section>';
    // tabela + mesmo período
    var prevY = String(+curY - 1), ytd = function (y) { var t = { rec: 0, res: 0 }; sr.forEach(function (m) { if (m.ym.slice(0, 4) === y && +m.ym.slice(5, 7) <= curM) { t.rec += m.rec; t.res += m.res; } }); return t; };
    var a = ytd(curY), b = ytd(prevY);
    out += '<section class="panel c5"><div class="panel-h"><h2>Resumo por ano</h2></div><div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Ano</th><th class="r">Receita</th><th class="r">Lucro</th><th class="r">Margem</th><th class="r">Var.</th></tr></thead><tbody>'
      + ys.slice().reverse().map(function (o) { var p = years[String(+o.y - 1)]; return '<tr><td class="strong">' + o.y + (o.meses < 12 ? '<span class="sub">' + o.meses + ' meses</span>' : '') + '</td><td class="r num pv">' + brl0(o.rec) + '</td><td class="r num pv strong">' + brl0(o.res) + '</td><td class="r num">' + (o.rec ? Math.round(o.res / o.rec * 100) : 0) + '%</td><td class="r num">' + (p ? varPct(o.rec, p.rec) : '—') + '</td></tr>'; }).join('')
      + '</tbody></table></div>' + (years[prevY] && years[curY] ? '<div class="panel-b"><div class="review"><span><b>Mesmo período (jan a ' + esc(CA.MES3[curM - 1]) + ')</b></span><span>Receita: <b class="num pv">' + brl0(a.rec) + '</b> em ' + curY + ' contra <b class="num pv">' + brl0(b.rec) + '</b> em ' + prevY + ' ' + varPct(a.rec, b.rec) + '</span><span>Lucro: <b class="num pv">' + brl0(a.res) + '</b> contra <b class="num pv">' + brl0(b.res) + '</b> ' + varPct(a.res, b.res) + '</span></div></div>' : '') + '</section>';

    // 4. mês a mês por ano
    var metric = ui.yoyMetric || 'rec', MET = { rec: 'Receita', res: 'Lucro líquido', desp: 'Despesas' };
    var palette = ['var(--line-strong)', 'var(--muted)', 'var(--gold)', 'var(--action)'];
    var yk = ys.map(function (o) { return o.y; }), colors = yk.map(function (y, i) { return palette[Math.max(0, palette.length - yk.length + i)] || palette[0]; });
    var yv = yk.map(function (y) { var arr = []; for (var mm = 1; mm <= 12; mm++) { var ym = y + '-' + (mm < 10 ? '0' : '') + mm; arr.push(ym < start || ym > end ? null : M.monthOf(ym)[metric]); } return arr; });
    out += '<section class="panel c12"><div class="panel-h"><div><h2>Cada mês comparado com o mesmo mês dos anos anteriores</h2><span class="muted">' + esc(MET[metric]) + ' de janeiro a dezembro, uma linha por ano</span></div><div class="seg" role="group" aria-label="Indicador">'
      + ['rec', 'res', 'desp'].map(function (k) { return '<button type="button" data-act="yoyMetric" data-k="' + k + '" aria-pressed="' + (metric === k) + '">' + MET[k] + '</button>'; }).join('') + '</div></div><div class="panel-b">'
      + CA.chart('yoyLines', {
        aria: 'Comparação mensal entre anos', height: 300,
        labels: CA.MES3, ticks: function (i) { return CA.MES3[i]; },
        series: yk.map(function (y, k) { return { type: k === yk.length - 1 ? 'area' : 'line', color: colors[k], values: yv[k], width: k === yk.length - 1 ? 3 : 2 }; }),
        tip: function (i) { return CA.tipMonth(CA.MES[i], yk.map(function (y, k) { var v = yv[k][i]; return [y, v == null ? '—' : brl(v), colors[k]]; }).reverse(), yk.length > 1 && yv[yk.length - 1][i] != null && yv[yk.length - 2][i] ? yk[yk.length - 1] + ' ' + varPct(yv[yk.length - 1][i], yv[yk.length - 2][i]) + ' sobre ' + yk[yk.length - 2] : ''); }
      }) + '<div class="legend" style="margin-top:8px">' + yk.map(function (y, k) { return '<span><i style="background:' + colors[k] + '"></i>' + y + '</span>'; }).join('') + '</div></div></section>';
    out += '</div>';
    return out;
  };
  VIEWS['financeiro/extrato'] = function (M) {
    var ym = uiMonth('fext'), list = M.fin.filter(function (f) { return f.ym === ym; });
    var ins = list.filter(function (f) { return f.tipo !== 'desp' && f.rec > 0; }), outs = list.filter(function (f) { return f.tipo === 'desp'; });
    var out = head('Extrato', 'Todas as entradas e saídas do mês, da mais recente para a mais antiga.', monthNav('fext', ym));
    function tbl(items, saida) {
      if (!items.length) return empty(saida ? 'Nenhuma despesa neste mês' : 'Nenhuma entrada neste mês');
      return '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th class="r">Valor</th><th></th></tr></thead><tbody>' + items.map(function (f) {
        var sub = saida ? (f.grupo || 'Despesa') : (TIPO[f.tipo] ? TIPO[f.tipo][0] : 'Recebimento');
        var undo = saida ? (f.link ? '' : lbtn(ic('undo') + 'Estornar', 'undoDesp', ' data-uid="' + esc(f.uid) + '"', 'danger'))
          : f.link === 'recurringPayments' ? lbtn(ic('undo') + 'Estornar', 'undoMens', ' data-uid="' + esc(f.linkUid) + '"', 'danger')
            : f.link === 'servicePayments' ? lbtn(ic('undo') + 'Estornar', 'undoSvPay', ' data-uid="' + esc(f.linkUid) + '"', 'danger') : '';
        return '<tr><td class="num">' + dbr(f.data) + '</td><td><span class="strong">' + esc(saida ? f.desc : (f.cliente || f.desc)) + '</span><span class="sub">' + esc(sub) + (saida ? '' : ' · ' + esc(f.desc)) + '</span></td><td class="hide-m">' + esc(f.forma) + '</td><td class="r num strong ' + (saida ? 'out' : 'in') + '">' + (saida ? '− ' + brl(f.desp) : brl(f.rec)) + '</td><td class="act">' + undo + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    var tIn = ins.reduce(function (t, f) { return t + f.rec; }, 0), tOut = outs.reduce(function (t, f) { return t + f.desp; }, 0);
    out += '<div class="grid" style="margin-bottom:16px"><div class="panel c4"><div class="kpi"><span class="lb">Entradas</span><span class="vl num pv in">' + brl(tIn) + '</span></div></div><div class="panel c4"><div class="kpi"><span class="lb">Saídas</span><span class="vl num pv out">' + brl(tOut) + '</span></div></div><div class="panel c4"><div class="kpi"><span class="lb">Saldo do mês</span><span class="vl num pv">' + brl(tIn - tOut) + '</span></div></div></div>';
    return out + '<div class="groups">' + grp('ext-in-' + ym, 'Entradas', '', ins.length, 'in', brl(tIn), tbl(ins)) + grp('ext-out-' + ym, 'Saídas', '', outs.length, 'out', '− ' + brl(tOut), tbl(outs, true)) + '</div>';
  };
  VIEWS['financeiro/despesas'] = function (M) {
    var desp = M.fin.filter(function (f) { return f.tipo === 'desp'; });
    var by = {}; desp.forEach(function (f) { (by[f.ym] = by[f.ym] || []).push(f); });
    var out = head('Despesas', 'Ferramentas, assinaturas e demais custos da consultoria.', btn(ic('receipt') + 'Lançar despesa', 'newDesp', 'primary'));
    out += '<div class="groups">';
    Object.keys(by).sort().reverse().forEach(function (k) {
      var items = by[k], tot = items.reduce(function (t, f) { return t + f.desp; }, 0);
      var rows = items.map(function (f) {
        return '<tr><td class="num">' + dbr(f.data) + '</td><td><span class="strong">' + esc(f.desc) + '</span><span class="sub">' + esc(f.grupo || 'Sem grupo') + '</span></td><td class="hide-m">' + esc(f.forma) + '</td><td class="r num strong out">− ' + brl(f.desp) + '</td><td class="act">' + (f.link ? '' : lbtn(ic('undo') + 'Estornar', 'undoDesp', ' data-uid="' + esc(f.uid) + '"', 'danger')) + '</td></tr>';
      }).join('');
      out += grp('desp-' + k, CA.ymLabel(k), '', items.length, 'out', '− ' + brl(tot), '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Data</th><th>Despesa</th><th>Forma</th><th class="r">Valor</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    if (!desp.length) out += '<div class="panel">' + empty('Nenhuma despesa lançada') + '</div>';
    return out + '</div>';
  };
  VIEWS['financeiro/anual'] = function (M) {
    var out = head('Ano a ano', 'Receita, despesas e lucro líquido de cada mês, com o acumulado desde o início.');
    var acc = 0, by = {};
    M.months.forEach(function (m) { acc += m.res; m.acc = Math.round(acc * 100) / 100; (by[m.ym.slice(0, 4)] = by[m.ym.slice(0, 4)] || []).push(m); });
    out += '<div class="groups">';
    Object.keys(by).sort().reverse().forEach(function (y) {
      var ms = by[y], tr = 0, td = 0;
      ms.forEach(function (m) { tr += m.rec; td += m.desp; });
      var rows = ms.slice().reverse().map(function (m) {
        return '<tr><td class="strong">' + esc(CA.MES[+m.ym.slice(5, 7) - 1]) + '</td><td class="r num in">' + brl(m.rec) + '</td><td class="r num out">' + brl(m.desp) + '</td><td class="r num strong">' + brl(m.res) + '</td><td class="r num hide-m">' + brl(m.acc) + '</td></tr>';
      }).join('');
      var tbl = '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Mês</th><th class="r">Receita</th><th class="r">Despesas</th><th class="r">Lucro líquido</th><th class="r">Acumulado</th></tr></thead><tbody>' + rows + '<tr><td class="strong">Total de ' + y + '</td><td class="r num strong in">' + brl(tr) + '</td><td class="r num strong out">' + brl(td) + '</td><td class="r num strong">' + brl(tr - td) + '</td><td class="hide-m"></td></tr></tbody></table></div>';
      out += grp('ano-' + y, String(y), '', ms.length + ' meses', 'act', brl(tr - td), tbl);
    });
    if (!M.months.length) out += '<div class="panel">' + empty('Sem lançamentos financeiros') + '</div>';
    return out + '</div>';
  };

  /* ---------- Agenda ---------- */
  VIEWS['agenda/prazos'] = function (M) {
    var out = head('Prazos de entrega', M.prazos.length + ' entregas em aberto', btn(ic('plus') + 'Novo serviço', 'newSv', 'primary'));
    var defs = [['Atrasados', 'out', function (p) { return p.dias !== null && p.dias < 0; }], ['Hoje e próximos 7 dias', 'warn', function (p) { return p.dias !== null && p.dias >= 0 && p.dias <= 7; }], ['Mais adiante', 'act', function (p) { return p.dias !== null && p.dias > 7; }], ['Sem prazo', 'mute', function (p) { return p.dias === null; }]];
    out += '<div class="groups">';
    defs.forEach(function (d) {
      var items = M.prazos.filter(d[2]);
      if (items.length) out += grp('pz-' + d[0], d[0], '', items.length, d[1], '', '<div class="panel-b"><div class="rows">' + items.map(prazoRow).join('') + '</div></div>');
    });
    if (!M.prazos.length) out += '<div class="panel">' + empty('Nenhuma entrega pendente') + '</div>';
    return out + '</div>';
  };
  VIEWS['agenda/agendamentos'] = function (M) {
    var open = M.schedules.filter(function (s) { return s.open; }), done = M.schedules.filter(function (s) { return !s.open; }).reverse();
    var out = head('Agendamentos', 'Provas, trabalhos e compromissos com data marcada.', btn(ic('plus') + 'Novo agendamento', 'newSch', 'primary'));
    return out + '<div class="groups">'
      + grp('sch-open', 'Pendentes', '', open.length, open.some(function (s) { return s.dias !== null && s.dias < 0; }) ? 'out' : 'warn', '', open.length ? '<div class="panel-b"><div class="rows">' + open.map(schRow).join('') + '</div></div>' : empty('Nenhum agendamento pendente'))
      + grp('sch-done', 'Resolvidos', '', done.length, 'in', '', done.length ? '<div class="panel-b"><div class="rows">' + done.map(schRow).join('') + '</div></div>' : empty('Nenhum agendamento resolvido'))
      + '</div>';
  };

  /* ---------- CRM ---------- */
  var FUNIL = CA.FUNIL = ['Novo contato', 'Em negociação', 'Aguardando retorno', 'Convertido/Fechado', 'Perdido'];
  VIEWS['crm/funil'] = function (M) {
    var cols = FUNIL.filter(function (f) { return f !== 'Convertido/Fechado' && f !== 'Perdido'; });
    var open = M.crm.filter(function (c) { return cols.indexOf(c.status) >= 0 || FUNIL.indexOf(c.status) < 0; });
    var fech = M.crm.filter(function (c) { return c.status === 'Convertido/Fechado'; });
    var conv = M.crm.length ? Math.round(fech.length / M.crm.length * 100) : 0;
    var out = head('Funil comercial', open.length + ' negociações abertas · ' + brl(open.reduce(function (t, c) { return t + c.valor; }, 0)) + ' em potencial · ' + conv + '% de conversão', btn(ic('plus') + 'Novo contato', 'newLead', 'primary'));
    out += '<div class="board">' + cols.concat(['Convertido/Fechado']).map(function (col) {
      var items = M.crm.filter(function (c) { return col === 'Novo contato' ? (c.status === col || FUNIL.indexOf(c.status) < 0) : c.status === col; });
      var shown = col === 'Convertido/Fechado' ? items.slice(0, 6) : items;
      return '<section class="col"><h3><span>' + esc(col === 'Convertido/Fechado' ? 'Fechados' : col) + '</span><span class="count">' + items.length + '</span></h3>'
        + (shown.length ? shown.map(function (c) {
          return '<button type="button" class="card-lead" data-act="lead" data-uid="' + esc(c.uid) + '"><b>' + esc(c.nome) + '</b><span>' + esc(c.servico || 'Interesse não informado') + (c.nivel ? ' · ' + esc(c.nivel.toLowerCase()) : '') + '</span>' + (c.follow ? '<span>Retornar em ' + dbr(c.follow) + '</span>' : '') + (c.valor ? '<div class="v num">' + brl(c.valor) + '</div>' : '') + '</button>';
        }).join('') + (items.length > shown.length ? '<a class="btn-ghost sm" href="#/crm/contatos">Ver todos os ' + items.length + '</a>' : '') : '<div class="empty">Vazio</div>') + '</section>';
    }).join('') + '</div>';
    return out;
  };
  VIEWS['crm/contatos'] = function (M) {
    var out = head('Contatos comerciais', M.crm.length + ' registros no CRM', btn(ic('plus') + 'Novo contato', 'newLead', 'primary'));
    out += '<div class="groups">';
    FUNIL.forEach(function (st) {
      var items = M.crm.filter(function (c) { return st === 'Novo contato' ? (c.status === st || FUNIL.indexOf(c.status) < 0) : c.status === st; });
      if (!items.length) return;
      var rows = items.map(function (c) {
        return '<tr class="click" data-act="lead" data-uid="' + esc(c.uid) + '" tabindex="0"><td><span class="strong">' + esc(c.nome) + '</span><span class="sub">' + esc(c.servico || '—') + '</span></td><td class="hide-m num">' + (c.contato ? dbr(c.contato) : '—') + '</td><td class="hide-m">' + esc(c.nivel || '—') + '</td><td class="r num">' + (c.valor ? brl(c.valor) : '—') + '</td></tr>';
      }).join('');
      out += grp('crm-' + st, st, '', items.length, st === 'Convertido/Fechado' ? 'in' : st === 'Perdido' ? 'mute' : 'act', brl(items.reduce(function (t, c) { return t + c.valor; }, 0)), '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Contato</th><th>Data do contato</th><th>Interesse</th><th class="r">Valor potencial</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
    if (!M.crm.length) out += '<div class="panel">' + empty('Nenhum contato no CRM') + '</div>';
    return out + '</div>';
  };

  /* ---------- Eventos da tela ---------- */
  function bindView() {
    var v = $('view');
    var cq = $('cq');
    if (cq) {
      var t;
      cq.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { CA.S.ui.cq = cq.value; var pos = cq.selectionStart; CA.render(); var n = $('cq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }, 180); });
    }
    var cf = $('cf');
    if (cf) cf.addEventListener('change', function () { CA.S.ui.cf = cf.value; CA.render(); });
    v.onclick = function (e) {
      var el = e.target.closest('[data-act],[data-go]');
      if (!el || !v.contains(el)) return;
      if (el.tagName === 'SUMMARY') return;
      e.stopPropagation();
      if (el.hasAttribute('data-go') && !el.hasAttribute('data-act')) { var g = el.getAttribute('data-go').split('/'); CA.go(g[0], g[1]); return; }
      CA.action(el.getAttribute('data-act'), el);
    };
    v.onkeydown = function (e) {
      if (e.key === 'Enter' && e.target.matches('tr[data-act]')) { e.preventDefault(); CA.action(e.target.getAttribute('data-act'), e.target); }
    };
  }
  CA.monthShift = function (key, d) { CA.S.ui[key] = CA.ymAdd(uiMonth(key), d); CA.render(); };
  CA.views = { when: when, prazoRow: prazoRow, empty: empty, lbtn: lbtn, finRow: finRow };
})(window.CA);
