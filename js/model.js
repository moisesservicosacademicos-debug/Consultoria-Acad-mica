/* Modelo: leitura e cálculo a partir da base oficial (sem gravar nada) */
'use strict';
(function (CA) {
  var num = CA.num, r2 = CA.r2, normS = CA.normS;
  var memo = null;
  CA.invalidate = function () { memo = null; };

  function arr(d, k) { return Array.isArray(d && d[k]) ? d[k] : []; }

  CA.M = function () {
    if (memo && memo.hoje === CA.today()) return memo; // recalcula sozinho na virada do dia
    var d = CA.S.data || {}, hoje = CA.today();
    var M = { hoje: hoje };

    /* Clientes */
    M.clients = arr(d, 'clients').map(function (c) {
      return { r: c, uid: c._uid, id: c['ID Cliente'] || c._clientId || '', nome: c.Nome || '(sem nome)', tel: c.WhatsApp || '', tipo: c.Tipo || 'Cliente não recorrente', status: c['Status Cadastro'] || 'Ativo', fac: c.Faculdade || '', key: c._clientKey || '', desde: c['Data Cadastro'] || '' };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    M.cById = {}; M.clients.forEach(function (c) { if (c.id) M.cById[c.id] = c; });

    /* Mensalistas */
    M.rpay = arr(d, 'recurringPayments').map(function (p) {
      var comp = CA.normDate(p['Competência']).slice(0, 7);
      return { r: p, uid: p._uid, cid: p._clientId || '', nome: p.Cliente || '', comp: /^\d{4}-\d{2}$/.test(comp) ? comp : '', data: CA.normDate(p['Data Recebimento']), valor: num(p['Valor Recebido']), forma: p['Forma Pagamento'] || '', status: p['Status da Mensalidade'] || p['Tipo de Lançamento'] || '', tipo: p['Tipo de Lançamento'] || '', fin: p._financeUid || '' };
    }).sort(function (a, b) { return (b.data + b.comp).localeCompare(a.data + a.comp); });
    M.rcl = arr(d, 'recurringClients').map(function (r) {
      var prox = CA.normDate(r['Próximo Vencimento'] || r['Ajuste Próximo Vencimento']);
      var dia = parseInt(r['Dia Vencimento'], 10);
      var st = r.Status || 'Ativo', dias = CA.isISO(prox) ? CA.days(hoje, prox) : null;
      var faixa = st !== 'Ativo' ? (st === 'Pausado' ? 'pausado' : 'inativo') : dias === null ? 'semdata' : dias < 0 ? 'atraso' : dias <= 7 ? 'breve' : 'emdia';
      var cid = r['ID Cliente'] || r._clientId || '';
      var c = M.cById[cid];
      return { r: r, uid: r._uid, cid: cid, nome: r.Cliente || (c && c.nome) || '', tel: r.WhatsApp || (c && c.tel) || '', status: st, valor: num(r['Valor Mensal']), dia: dia >= 1 && dia <= 31 ? dia : null, prox: prox, ult: CA.normDate(r['Último Pagamento']), dias: dias, faixa: faixa, key: r._clientKey || (c && c.key) || '', inicio: CA.normDate(r['Início do Plano']), forma: r['Forma Preferida'] || 'Pix', obs: r['Observações'] || '' };
    }).sort(function (a, b) { return (a.prox || '9999').localeCompare(b.prox || '9999') || a.nome.localeCompare(b.nome, 'pt-BR'); });
    M.rcByCid = {}; M.rcl.forEach(function (x) { if (x.cid) M.rcByCid[x.cid] = x; });

    /* Serviços */
    M.spay = arr(d, 'servicePayments').map(function (p) {
      return { r: p, uid: p._uid, sid: p['ID Serviço'] || '', cid: p._clientId || '', nome: p.Cliente || '', data: CA.normDate(p['Data Recebimento']), valor: num(p['Valor Recebido']), forma: p['Forma Pagamento'] || '', parcela: p['Tipo Parcela'] || '', fin: p._financeUid || '', servico: p['Serviço/Projeto'] || '' };
    }).sort(function (a, b) { return b.data.localeCompare(a.data); });
    M.services = arr(d, 'services').map(function (s) {
      var total = num(s['Valor Total Contratado']), rec = num(s['Total Recebido']);
      var saldoRaw = s['Saldo a Receber'], saldo = saldoRaw === '' || saldoRaw == null ? r2(total - rec) : num(saldoRaw);
      var ent = s['Status Entrega'] || 'Em produção', prazo = CA.normDate(s['Data Entrega Prevista']);
      var vinc = s['Vínculo do projeto'] || (s._serviceClassV438 === 'recurring-extra' ? 'Extra de recorrente' : 'Serviço eventual');
      var done = ent === 'Concluído' || ent === 'Cancelado';
      return { r: s, uid: s._uid, sid: s['ID Serviço'] || '', cid: s._clientId || '', nome: s.Cliente || '', servico: s['Serviço/Projeto'] || 'Serviço', total: total, rec: rec, saldo: Math.max(0, r2(saldo)), ent: ent, fin: s['Status Financeiro'] || '', vinc: vinc, extra: /recorrente/i.test(vinc), prazo: prazo, dc: CA.normDate(s['Data Contratação']), entregue: CA.normDate(s['Data Entrega Real'] || s['Entrega real']), done: done, dias: CA.isISO(prazo) ? CA.days(hoje, prazo) : null, proxPgto: CA.normDate(s['Data Prevista Próx. Pgto']), tel: s.WhatsApp || '' };
    }).sort(function (a, b) { return (b.dc || '').localeCompare(a.dc || '') || b.sid.localeCompare(a.sid); });
    M.svByUid = {}; M.services.forEach(function (s) { M.svByUid[s.uid] = s; });
    M.paysOf = function (s) { return M.spay.filter(function (p) { return p.sid === s.sid && (!s.cid || !p.cid || p.cid === s.cid); }); };

    /* Financeiro (mesma regra do artefato: Receita Recebida e Despesa/Custo por data) */
    M.fin = arr(d, 'financeEntries').map(function (f) {
      var rec = num(f['Receita Recebida']), desp = num(f['Despesa/Custo']), ds = f._linkDs || '', raw = String(f['Serviço'] || '');
      var tipo = desp > 0 && !rec ? 'desp' : ds === 'recurringPayments' ? 'mens' : ds === 'servicePayments' ? (/extra de recorrente/i.test(raw) ? 'extra' : 'event') : (rec > 0 ? 'outro' : 'zero');
      return { r: f, uid: f._uid, data: CA.normDate(f.Data), ym: CA.normDate(f.Data).slice(0, 7), rec: rec, desp: desp, tipo: tipo, desc: raw.replace(/\s*·\s*SV-\d+/g, ''), cliente: f.Cliente || '', forma: f['Forma de Pagamento'] || '', grupo: f['Grupo da Despesa'] || '', link: ds, linkUid: f._linkUid || '', id: f.ID };
    }).filter(function (f) { return /^\d{4}-\d{2}$/.test(f.ym); })
      .sort(function (a, b) { return b.data.localeCompare(a.data) || String(b.r._createdAt || '').localeCompare(String(a.r._createdAt || '')); });
    var byM = {};
    M.fin.forEach(function (f) {
      var m = byM[f.ym] || (byM[f.ym] = { ym: f.ym, rec: 0, desp: 0, pl: 0, mens: 0, event: 0, extra: 0, outro: 0, n: 0 });
      m.rec += f.rec; m.desp += f.desp; m.n++;
      if (f.tipo === 'desp' && f.grupo === 'Pró-labore') m.pl += f.desp;
      if (f.tipo in m) m[f.tipo] += f.rec;
    });
    M.months = Object.keys(byM).sort().map(function (k) { var m = byM[k]; m.rec = r2(m.rec); m.desp = r2(m.desp); m.pl = r2(m.pl); m.res = r2(m.rec - m.desp); return m; });
    M.monthOf = function (ym) { return byM[ym] || { ym: ym, rec: 0, desp: 0, pl: 0, res: 0, mens: 0, event: 0, extra: 0, outro: 0, n: 0 }; };
    var acc = { rec: 0, desp: 0, pl: 0 };
    M.fin.forEach(function (f) { if (f.data <= hoje) { acc.rec += f.rec; acc.desp += f.desp; if (f.tipo === 'desp' && f.grupo === 'Pró-labore') acc.pl += f.desp; } });
    M.acc = { rec: r2(acc.rec), desp: r2(acc.desp), pl: r2(acc.pl), res: r2(acc.rec - acc.desp), desde: M.months.length ? M.months[0].ym : hoje.slice(0, 7) };

    /* Prazos e agenda */
    M.deadlines = arr(d, 'deadlines').map(function (x) {
      var pr = CA.normDate(x['Prazo previsto']);
      return { r: x, uid: x._uid, nome: x['Cliente/Aluno'] || '', servico: x['Serviço'] || '', desc: x['Descrição / Etapa'] || '', prazo: pr, status: x.Status || '', link: x._linkDs === 'services' ? x._linkUid : '', open: !/conclu|cancel/i.test(x.Status || ''), dias: CA.isISO(pr) ? CA.days(hoje, pr) : null, cid: x._clientId || '' };
    });
    M.schedules = arr(d, 'schedules').map(function (s) {
      var dt = CA.normDate(s['Data agendada']), st = s['Situação do agendamento'] || s.Status || 'Pendente';
      return { r: s, uid: s._uid, id: s.ID || '', tipo: s.Tipo || '', nome: s['Cliente/Aluno'] || '', desc: s['Descrição'] || '', data: dt, hora: s['Horário'] || '', fac: s.Faculdade || '', status: st, open: !/resolvid|conclu|cancel/i.test(st), dias: CA.isISO(dt) ? CA.days(hoje, dt) : null, cid: s._clientId || '' };
    }).sort(function (a, b) { return (a.data || '9999').localeCompare(b.data || '9999'); });

    /* Fila de prazos: serviços em produção + prazos avulsos abertos */
    var linked = {};
    M.prazos = [];
    M.services.forEach(function (s) {
      if (s.done) return;
      M.prazos.push({ kind: 'sv', s: s, nome: s.nome, titulo: s.servico, prazo: s.prazo, dias: s.dias, saldo: s.saldo, extra: s.extra, sid: s.sid });
      linked[s.uid] = 1;
    });
    M.deadlines.forEach(function (x) {
      if (!x.open || x.link) return; // prazo ligado a serviço: o serviço já aparece (ou foi apagado)
      M.prazos.push({ kind: 'dl', x: x, nome: x.nome, titulo: x.servico || x.desc || 'Prazo', prazo: x.prazo, dias: x.dias, saldo: 0 });
    });
    M.prazos.sort(function (a, b) { return (a.prazo || '9999').localeCompare(b.prazo || '9999'); });

    /* CRM, catálogo e acessos */
    M.crm = arr(d, 'crm').map(function (c) {
      var st = c['Status comercial'] || (c['Etapa do funil'] === 'Fechado' ? 'Convertido/Fechado' : '') || 'Novo contato';
      return { r: c, uid: c._uid, nome: c.Nome || '', tel: c.WhatsApp || '', servico: c['Serviço de interesse'] || '', status: st, nivel: c['Nível de interesse'] || '', valor: num(c['Valor potencial']), follow: CA.normDate(c['Próximo follow-up']), contato: CA.normDate(c['Data do contato']), obs: c['Observações'] || '' };
    }).sort(function (a, b) { return (b.contato || '').localeCompare(a.contato || ''); });
    M.catalog = arr(d, 'serviceCatalog').map(function (c) {
      return { r: c, uid: c._uid, id: c['ID Serviço Catálogo'] || '', nome: c['Serviço'] || '', cat: c.Categoria || 'Outros', valor: num(c['Valor Referência']), promo: c['Preço Promocional'] === '' || c['Preço Promocional'] == null ? null : num(c['Preço Promocional']), status: c.Status || 'Ativo', obs: c['Observações'] || '' };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    M.access = arr(d, 'access').map(function (a) {
      return { r: a, uid: a._uid, nome: a['Nome do Aluno'] || '', fac: a.Faculdade || '', login: a['Login do Portal'] || '', senha: a['Senha do Portal'] || '', tel: a.WhatsApp || '', cid: a._clientId || '' };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    M.serviceNames = (function () {
      var set = {}, bad = /^(recarga|gemini ia|servi[cç]o|outros|assinatura claude|claude|recarga telef[oô]nica|cr[eé]dito antecipado.*)$/i;
      M.catalog.forEach(function (c) { if (c.status === 'Ativo' && c.nome && !bad.test(c.nome)) set[c.nome] = 1; });
      M.services.forEach(function (s) { if (s.servico && !bad.test(s.servico)) set[s.servico] = 1; });
      return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    })();

    /* Indicadores do painel */
    var ym = hoje.slice(0, 7);
    M.now = M.monthOf(ym);
    M.prev = M.monthOf(CA.ymAdd(ym, -1));
    M.aReceber = r2(M.services.reduce(function (t, s) { return t + (s.saldo > 0 ? s.saldo : 0); }, 0));
    M.atrasados = M.rcl.filter(function (x) { return x.faixa === 'atraso'; });
    M.ativos = M.rcl.filter(function (x) { return x.status === 'Ativo'; });
    M.mrr = r2(M.ativos.reduce(function (t, x) { return t + x.valor; }, 0));
    M.prazosSemana = M.prazos.filter(function (p) { return p.dias !== null && p.dias <= 7; });

    memo = M;
    return M;
  };

  CA.clientName = function (cid, fallback) { var c = CA.M().cById[cid]; return c ? c.nome : (fallback || cid || ''); };
  CA.normKey = function (s) { return normS(s).replace(/\s+/g, ' ').trim(); };
})(window.CA);
