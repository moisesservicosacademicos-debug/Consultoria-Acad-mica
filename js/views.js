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
  var HERO_G = [['Ferramentas e sistemas', 'var(--st-g1)'], ['Operacional', 'var(--st-g2)'], ['Impostos e taxas', 'var(--st-g3)'], ['Pró-labore', 'var(--st-g4)'], ['Marketing', 'var(--st-g5)'], ['Outros', 'var(--st-g6)'], ['Sem grupo', 'var(--st-g7)']];
  function chart12(M, sr, used) {
    var end = M.hoje.slice(0, 7), nM = sr.length;
    var leg = '<div class="hero-leg"><span><i class="sq" style="background:var(--st-lucro)"></i>Lucro líquido</span>' + used.map(function (g) { return '<span><i class="sq" style="background:' + g[1] + '"></i>' + esc(g[0]) + '</span>'; }).join('') + '<span><i class="ln-r"></i>Receita</span></div>';
    var tip = function (i) {
      var m = sr[i], rows = [['Receita', '<b>' + brl(m.rec) + '</b>', 'var(--st-line)']];
      used.forEach(function (g) { if (m.g[g[0]]) rows.push([g[0], brl(m.g[g[0]]), g[1]]); });
      rows.push(['Lucro líquido', '<b>' + brl(m.res) + '</b>', 'var(--st-lucro)']);
      var prev = sr[i - 1];
      return CA.tipMonth(CA.ymLabel(m.ym) + (m.ym === end ? ' · em andamento' : ''), rows, 'Margem ' + (m.rec ? Math.round(m.res / m.rec * 100) + '%' : '—') + (prev && prev.rec ? ' · receita ' + varPct(m.rec, prev.rec) + ' sobre ' + CA.MES3[+prev.ym.slice(5, 7) - 1] : ''));
    };
    return CA.chart('painel12', { kind: 'hero', months: sr, groups: used, partialLast: true, height: CA.S.ui.chartH || 262, tip: tip,
      aria: 'Receita, despesas por grupo e lucro líquido mês a mês', tick: function (i) { return CA.MES3[+sr[i].ym.slice(5, 7) - 1] + (nM === 6 ? '/' + sr[i].ym.slice(2, 4) : ''); } }) + '<div class="hero-legm">' + leg + '</div>';
  }
  function pctTxt(v) { return (Math.round(v * 10) / 10).toString().replace('.', ',') + '%'; }
  function periodData(M) {
    var nM = CA.S.ui.heroN || 12, end = M.hoje.slice(0, 7), sr = CA.monthSeries(M, CA.ymAdd(end, -(nM - 1)), end), pv = CA.monthSeries(M, CA.ymAdd(end, -(2 * nM - 1)), CA.ymAdd(end, -nM));
    var byG = {}; M.fin.forEach(function (f) { if (f.tipo !== 'desp') return; var g = HERO_G.some(function (x) { return x[0] === f.grupo; }) ? f.grupo : 'Sem grupo'; var o = byG[f.ym] || (byG[f.ym] = {}); o[g] = (o[g] || 0) + f.desp; });
    sr.forEach(function (m) { m.g = byG[m.ym] || {}; });
    var used = HERO_G.filter(function (g) { return sr.some(function (m) { return m.g[g[0]] > 0; }); });
    var sum = function (a, k) { return a.reduce(function (t, m) { return t + (m[k] || 0); }, 0); };
    var rec = sum(sr, 'rec'), desp = sum(sr, 'desp'), res = sum(sr, 'res'), recP = sum(pv, 'rec'), pl = sum(sr, 'pl');
    var mens = sum(sr, 'mens'), ev = sum(sr, 'event'), ex = sum(sr, 'extra'), ou = sum(sr, 'outro');
    var gTot = {}; used.forEach(function (g) { gTot[g[0]] = sr.reduce(function (t, m) { return t + (m.g[g[0]] || 0); }, 0); });
    var closed = sr.slice(0, -1), best = closed.reduce(function (b, m) { return m.rec > b.rec ? m : b; }, closed[0] || sr[0]);
    var media = closed.length ? sum(closed, 'rec') / closed.length : 0, cur = sr[sr.length - 1];
    var marg = rec ? res / rec * 100 : null, opx = rec ? desp / rec * 100 : null, recor = rec ? mens / rec * 100 : null, cresc = recP ? (rec - recP) / recP * 100 : null;
    var per = 'nos últimos ' + nM + ' meses';
    var P = { nM: nM, sr: sr, used: used };
    var out = '<div class="dash-h c12"><div><h2>Resultado da consultoria</h2><p class="muted">Receita, despesas e lucro líquido ' + per + ', com o mês atual em andamento.</p></div>'
      + '<div class="seg hero-seg" role="group" aria-label="Período">' + [[6, '6 meses'], [12, '12 meses']].map(function (o) { return '<button type="button" data-act="heroN" data-k="' + o[0] + '" aria-pressed="' + (nM === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    out += '<div class="dash c12"><div class="dash-main">';
    // medidores
    P.gauges = CA.gauge(marg, 'Margem líquida', 'lucro de <span class="pv">' + brl(res) + '</span>')
      + CA.gauge(opx, 'Despesas sobre a receita', '<span class="pv">' + brl(desp) + '</span> no período')
      + CA.gauge(recor, 'Receita recorrente', 'vinda de mensalidades')
      + CA.gauge(cresc, 'Crescimento da receita', recP ? 'sobre os ' + nM + ' meses anteriores' : 'sem período anterior', 'signed');
    // gráfico principal
    P.chart = chart12(M, sr, used);
    // DRE
    var row = function (lbl, v, cls, pctOf) { return '<tr class="' + (cls || '') + '"><td>' + lbl + '</td><td class="r num pv">' + (cls && cls.indexOf('neg') >= 0 && v ? '− ' : '') + brl(v) + '</td><td class="r num">' + (rec ? pctTxt(v / rec * 100) : '—') + '</td></tr>'; };
    var dre = '<table class="dre"><thead><tr><th>Demonstrativo ' + per.replace('nos ', 'dos ') + '</th><th class="r">Valor</th><th class="r">% receita</th></tr></thead><tbody>'
      + row('Receita bruta', rec, 'tot')
      + row('Mensalidades', mens, 'sub') + row('Serviços eventuais', ev, 'sub') + (ex ? row('Extras de mensalistas', ex, 'sub') : '') + (ou ? row('Outros recebimentos', ou, 'sub') : '')
      + row('Despesas', desp, 'tot neg')
      + (used.length ? used.map(function (g) { return row(esc(g[0]), gTot[g[0]], 'sub'); }).join('') : '<tr class="sub"><td colspan="3" class="muted">Nenhuma despesa lançada no período</td></tr>')
      + (pl > 0 ? row('Lucro antes do pró-labore', res + pl, 'tot') : '')
      + row('Lucro líquido', res, 'net') + '</tbody></table>';
    P.dre = dre;
    // margem mês a mês
    var mg = sr.map(function (m) { return m.rec ? Math.round(m.res / m.rec * 1000) / 10 : null; }), mgOk = mg.filter(function (v) { return v != null; });
    var mMed = marg != null ? Math.round(marg * 10) / 10 : null;
    P.marg = (mgOk.length ? CA.chart('painelMarg', {
      aria: 'Margem líquida mês a mês', height: 178, partialLast: true, yfmt: function (v) { return Math.round(v) + '%'; },
      labels: sr.map(function (m) { return m.ym; }), ticks: function (i) { return CA.MES3[+sr[i].ym.slice(5, 7) - 1]; },
      hlines: mMed != null ? [{ v: mMed, label: 'Margem do período ' + pctTxt(mMed) }] : [],
      series: [{ type: 'area', color: 'var(--st-lucro)', values: mg }],
      tip: function (i) { var m = sr[i]; return CA.tipMonth(CA.ymLabel(m.ym), [['Margem líquida', '<b>' + (mg[i] == null ? '—' : pctTxt(mg[i])) + '</b>', 'var(--st-lucro)'], ['Receita', brl(m.rec), 'var(--st-line)'], ['Despesas', brl(m.desp), 'var(--out)']], m.ym === end ? 'Mês em andamento' : ''); }
    }) : empty('Sem receita no período'));
    // leituras
    var maiorG = used.slice().sort(function (a, b) { return gTot[b[0]] - gTot[a[0]]; })[0];
    var tk = [];
    tk.push('Receita de <b class="pv">' + brl(rec) + '</b> ' + per + (recP ? ', ' + (rec >= recP ? 'alta' : 'queda') + ' de <b>' + pctTxt(Math.abs(cresc)) + '</b> sobre os ' + nM + ' meses anteriores.' : '.'));
    tk.push('De cada R$ 100,00 recebidos, <b>' + brl(rec ? res / rec * 100 : 0) + '</b> viraram lucro líquido.');
    if (recor != null) tk.push('Mensalidades respondem por <b>' + pctTxt(recor) + '</b> da receita' + (ev ? '; serviços eventuais, por <b>' + pctTxt(ev / rec * 100) + '</b>.' : '.'));
    if (maiorG) tk.push('Maior despesa: <b>' + esc(maiorG[0]) + '</b>, com <b class="pv">' + brl(gTot[maiorG[0]]) + '</b> (' + pctTxt(gTot[maiorG[0]] / desp * 100) + ' das despesas).');
    if (best && best.rec) tk.push('Melhor mês: <b>' + esc(CA.ymLabel(best.ym).toLowerCase()) + '</b>, com <b class="pv">' + brl(best.rec) + '</b>.');
    tk.push(CA.MES[+cur.ym.slice(5, 7) - 1] + ' até agora: <b class="pv">' + brl(cur.rec) + '</b> recebidos' + (media ? ', <b>' + pctTxt(cur.rec / media * 100) + '</b> da média mensal.' : '.'));
    P.tk = tk; P.tkNote = opx != null && opx < 10;
    P.rec = rec; P.res = res; P.desp = desp; P.margP = marg; P.opxP = opx; P.recorP = recor; P.cresc = cresc;
    return P;
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
    var hoje = M.hoje, nowYm = hoje.slice(0, 7), nM = CA.S.ui.heroN || 12, P = periodData(M);
    var mesNome = CA.MES[+nowYm.slice(5, 7) - 1];
    var dia = +hoje.slice(8, 10), diasMes = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7), 0).getDate();
    // média dos meses fechados (12 anteriores ao atual)
    var fech = CA.monthSeries(M, CA.ymAdd(nowYm, -12), CA.ymAdd(nowYm, -1)).filter(function (m, i, a) { return a.slice(0, i + 1).some(function (x) { return x.rec > 0; }); });
    var media = fech.length ? fech.reduce(function (t, m) { return t + m.rec; }, 0) / fech.length : 0;
    var rec = M.now.rec, proj = dia ? rec / dia * diasMes : rec, pctMed = media ? rec / media * 100 : 0, ritmo = dia / diasMes * 100;
    var out = '<div class="pa"><div class="pa-r1">';
    // cartão do mês
    out += '<section class="pa-hero"><div class="l"><span>' + esc(mesNome) + ' de ' + hoje.slice(0, 4) + '</span><span>dia ' + dia + ' de ' + diasMes + '</span></div>'
      + '<div class="big"><b class="num pv">' + brl(rec) + '</b><small>recebidos até hoje</small></div>'
      + '<div class="pbar" title="Receita do mês em relação à média mensal"><i style="width:' + Math.min(100, pctMed).toFixed(1) + '%"></i><span class="mk" style="left:' + Math.min(100, ritmo).toFixed(1) + '%" title="Ritmo do mês"></span></div>'
      + '<div class="ft"><span><b>' + Math.round(pctMed) + '%</b> da média mensal (<span class="pv">' + brl(media) + '</span>)</span><span>ritmo do mês: ' + Math.round(ritmo) + '%</span></div>'
      + '<div class="r2"><div>Lucro do mês<b class="num pv">' + brl(M.now.res) + '</b></div><div>Despesas<b class="num pv">' + brl(M.now.desp) + '</b></div><div>Projeção<b class="num pv">' + brl(proj) + '</b></div></div></section>';
    // cartões
    var recM = M.now.mens, falta = Math.max(0, M.mrr - recM), pm = M.mrr ? Math.min(100, recM / M.mrr * 100) : 0;
    var atrasoVal = M.atrasados.reduce(function (t, x) { return t + x.valor; }, 0), emDia = M.ativos.length - M.atrasados.length;
    var nSaldo = M.services.filter(function (s) { return s.saldo > 0; }).length;
    var tile = function (dot, lb, vl, ft, bottom, go, cls) { return '<button type="button" class="pa-tile' + (cls ? ' ' + cls : '') + '" data-go="' + go + '"><span class="lb"><i style="background:' + dot + '"></i>' + lb + '</span><b class="vl num pv">' + vl + '</b><span class="ft">' + ft + '</span><span class="bt">' + bottom + '</span></button>'; };
    out += tile('var(--action)', 'Mensalidades do mês', brl(recM), 'de <span class="pv">' + brl(M.mrr) + '</span> previstos' + (falta ? ' · faltam <span class="pv">' + brl(falta) + '</span>' : ''), '<span class="pbar2"><i style="width:' + pm.toFixed(1) + '%"></i></span>', 'mensalidades/competencia');
    out += tile('var(--warn)', 'A receber de serviços', brl(M.aReceber), nSaldo ? nSaldo + (nSaldo === 1 ? ' serviço com saldo' : ' serviços com saldo') : 'nenhum saldo em aberto', '<span class="lnk">Ver serviços</span>', 'servicos/receber');
    out += tile(M.atrasados.length ? 'var(--out)' : 'var(--in)', 'Mensalidades em atraso', M.atrasados.length ? M.atrasados.length + ' · ' + brl(atrasoVal) : 'Nenhuma', M.atrasados.length ? emDia + ' mensalistas em dia' : M.ativos.length + ' mensalistas em dia', M.atrasados.length ? '<span class="chip out">cobrar agora</span>' : '<span class="chip in">tudo em dia</span>', 'mensalidades/situacao', M.atrasados.length ? 'bad' : 'ok');
    out += tile('var(--gold)', 'Lucro acumulado', brl(M.acc.res), 'desde ' + esc(CA.ymShort(M.acc.desde).toLowerCase()) + ' · margem de ' + (M.acc.rec ? Math.round(M.acc.res / M.acc.rec * 100) : 0) + '%', '<span class="lnk">Ver evolução</span>', 'financeiro/evolucao', 'gold');
    out += '</div><div class="pa-r2">';
    // gráfico
    var sr = CA.monthSeries(M, CA.ymAdd(nowYm, -(nM - 1)), nowYm);
    var seg = '<div class="seg hero-seg" role="group" aria-label="Período">' + [[6, '6 meses'], [12, '12 meses']].map(function (o) { return '<button type="button" data-act="heroN" data-k="' + o[0] + '" aria-pressed="' + (nM === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var tip = function (i) {
      var m = sr[i], part = m.ym === nowYm, prev = sr[i - 1];
      var rows = [['Receita', '<b>' + brl(m.rec) + '</b>', 'var(--bar-c)'], ['Despesas', brl(m.desp), 'var(--out)'], ['Lucro líquido', brl(m.res), 'var(--in)']];
      if (part) rows.push(['Projeção do mês', brl(proj), 'var(--bar-c)']);
      return CA.tipMonth(CA.ymLabel(m.ym) + (part ? ' · em andamento' : ''), rows, 'Margem ' + (m.rec ? Math.round(m.res / m.rec * 100) + '%' : '—') + (media ? ' · ' + Math.round(m.rec / media * 100) + '% da média' : '') + (prev && prev.rec ? ' · ' + varPct(m.rec, prev.rec) + ' sobre ' + CA.MES3[+prev.ym.slice(5, 7) - 1] : ''));
    };
    var g = P; // indicadores do período
    var pill = function (lb, vl, sm, cls) { return '<div><span>' + lb + '</span><b class="' + (cls || '') + '">' + vl + '</b><small>' + sm + '</small></div>'; };
    var pc = function (v) { return v == null ? '—' : Math.round(v) + '%'; };
    var cresc = g.cresc;
    out += '<section class="panel pa-ch"><div class="panel-h"><h2>Receita por mês <span class="muted">· despesas em vermelho no topo da coluna</span></h2>' + seg + '</div>'
      + '<div class="plot">' + CA.chart('painelBars', { kind: 'bars', fill: true, months: sr, avg: media, proj: proj, partialLast: true, tip: tip, aria: 'Receita e despesas por mês',
        tick: function (i) { return CA.MES3[+sr[i].ym.slice(5, 7) - 1]; } }) + '</div>'
      + '<div class="pa-pills">' + pill('Margem líquida', pc(g.margP), nM + ' meses') + pill('Despesas sobre a receita', pc(g.opxP), '<span class="pv">' + brl(g.desp) + '</span>') + pill('Receita recorrente', pc(g.recorP), 'mensalidades')
      + pill('Crescimento', cresc == null ? '—' : (cresc >= 0 ? '+' : '−') + Math.abs(Math.round(cresc)) + '%', 'sobre ' + nM + ' anteriores', cresc == null ? '' : cresc >= 0 ? 'up' : 'dn')
      + '<div class="act"><button type="button" class="lnk" data-act="pnDre">Demonstrativo completo</button></div></div></section>';
    // compromissos
    out += timeline(M);
    return out + '</div></div>';
  };
  function timeline(M) {
    var ev = [];
    M.prazos.forEach(function (p) { if (!CA.isISO(p.prazo)) return; ev.push({ t: 'ent', d: p.prazo, dias: p.dias, nome: p.nome, tit: p.titulo, sub: p.kind === 'sv' ? p.sid : 'entrega', act: p.kind === 'sv' ? 'sv' : 'dl', uid: p.kind === 'sv' ? p.s.uid : p.x.uid }); });
    M.schedules.forEach(function (s) { if (!s.open || !CA.isISO(s.data)) return; ev.push({ t: 'ag', d: s.data, dias: s.dias, nome: s.nome, tit: s.desc || s.tipo || 'Compromisso', sub: (s.tipo || 'agenda').toLowerCase() + (s.hora ? ' · ' + s.hora : ''), act: 'sch', uid: s.uid }); });
    M.rcl.forEach(function (x) { if (x.faixa !== 'atraso' && x.faixa !== 'breve') return; ev.push({ t: 'cob', d: x.prox, dias: x.dias, nome: x.nome, tit: 'Mensalidade de ' + x.nome, sub: (x.faixa === 'atraso' ? 'venceu ' : 'vence ') + CA.dshort(x.prox).replace(' ', '/') + ' · cobrança', valor: x.valor, act: 'cli', cid: x.cid }); });
    // agrupa entregas e agenda da mesma pessoa no mesmo dia
    var grp = {}, list = [];
    ev.forEach(function (e) {
      if (e.t === 'cob') { list.push(e); return; }
      var k = (e.nome || '').toLowerCase() + '|' + e.d;
      if (grp[k]) { var G = grp[k]; G.n++; if (G.tits.indexOf(e.tit) < 0) G.tits.push(e.tit); if (e.t === 'ag') G.t = G.t === 'ent' ? 'mix' : G.t; return; }
      grp[k] = Object.assign({ n: 1, tits: [e.tit] }, e); list.push(grp[k]);
    });
    list.sort(function (a, b) { return a.d.localeCompare(b.d) || (a.t === 'cob' ? -1 : 1); });
    var max = 14;
    var cor = { ent: 'var(--info)', ag: 'var(--warn)', mix: 'var(--info)', cob: 'var(--action)' };
    var html = '', sec = '', shown = 0;
    list.forEach(function (e) {
      if (shown >= max) return;
      var s2 = e.dias < 0 ? 'Atrasado' : e.dias <= 7 ? 'Próximos 7 dias' : CA.MES[+e.d.slice(5, 7) - 1] + (e.d.slice(0, 4) !== M.hoje.slice(0, 4) ? ' de ' + e.d.slice(0, 4) : '');
      if (s2 !== sec) { html += '<div class="tl-d">' + esc(s2) + '</div>'; sec = s2; }
      var tit = e.tits ? e.tits.join(' + ') : e.tit;
      var sub = e.t === 'cob' ? e.sub : esc(e.nome) + ' · ' + CA.dshort(e.d).replace(' ', '/') + ' · ' + (e.n > 1 ? e.n + ' itens' : esc(e.sub));
      var right = e.t === 'cob' ? '<span class="r num pv">' + brl(e.valor) + '</span>'
        : e.dias < 0 ? '<span class="chip out">' + (-e.dias) + (e.dias === -1 ? ' dia' : ' dias') + '</span>'
        : '<span class="chip ' + (e.t === 'ag' ? 'warn' : 'act') + '">' + (e.dias === 0 ? 'hoje' : e.dias === 1 ? 'amanhã' : 'em ' + e.dias + ' dias') + '</span>';
      html += '<button type="button" class="tl-i" data-act="' + e.act + '"' + (e.uid ? ' data-uid="' + esc(e.uid) + '"' : '') + (e.cid ? ' data-cid="' + esc(e.cid) + '"' : '') + '><i style="background:' + (e.dias < 0 ? 'var(--out)' : cor[e.t]) + '"></i><span class="m"><b>' + esc(tit) + '</b><span>' + sub + '</span></span>' + right + '</button>';
      shown++;
    });
    if (!list.length) html = '<div class="pn-empty">Nenhum compromisso pela frente.</div>';
    var lastF = M.fin[0];
    return '<section class="panel pa-tl"><div class="panel-h"><h2>Próximos compromissos' + (list.length ? ' <span class="cnt">' + list.length + '</span>' : '') + '</h2>' + lbtn('Agenda', 'go', ' data-go="agenda/prazos"') + '</div><div class="tl">' + html + '</div>'
      + '<div class="tl-f"><span class="tl-more" hidden></span><span class="tl-last">' + (lastF ? 'Último lançamento: ' + esc(lastF.tipo === 'desp' ? lastF.desc : (lastF.cliente || lastF.desc)) + ', <span class="pv">' + (lastF.tipo === 'desp' ? '− ' + brl(lastF.desp) : brl(lastF.rec)) + '</span> em ' + CA.dshort(lastF.data).replace(' ', '/') : 'Nenhum lançamento ainda') + '</span>' + lbtn('Extrato', 'go', ' data-go="financeiro/extrato"') + '</div></section>';
  }
  CA.painelDrawer = function (kind) {
    var M = CA.M(), P = periodData(M), per = 'últimos ' + P.nM + ' meses';
    if (kind === 'dre') {
      CA.drawer({ title: 'Demonstrativo de resultado', sub: per, body: '<section class="panel dre-p">' + P.dre + '</section><section class="panel" style="margin-top:12px"><div class="panel-h"><h2>Margem líquida por mês</h2></div><div class="panel-b">' + P.marg + '</div></section><div class="takeaways" style="margin-top:12px"><h3>Leituras do período</h3><ul>' + P.tk.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>',
        mount: function (d) { setTimeout(function () { CA.mountCharts(d); }, 30); } });
    } else {
      CA.drawer({ title: 'Leituras do período', sub: per, body: '<div class="takeaways"><ul>' + P.tk.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' + (P.tkNote ? '<p class="tk-note">Despesas abaixo de 10% da receita costumam indicar custos não lançados (impostos, ferramentas, pró-labore).</p>' : '') + '</div>' });
    }
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
        markers: marks.map(function (mk) { return { i: mk.i, v: mk.v, label: mk.label }; }),
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
