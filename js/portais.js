/* Controle de portais acadêmicos: conferências, eventos previstos e agendamento automático.
   Os dados ficam no conjunto "portals" da base oficial (um registro por aluno + portal).
   Tudo é calculado por regras fixas a partir do que foi gravado; nada depende da memória do navegador. */
'use strict';
(function (CA) {
  var esc = CA.esc, ic = CA.icon, dbr = CA.dbr, $ = CA.$;
  var DS = 'portals';
  var ANTEC_PADRAO = 7;       // dias de antecedência do aviso de cada portal
  var HIST_MAX = 120;          // conferências guardadas por portal

  /* ---------- Data e hora no fuso operacional (America/Bahia) ---------- */
  var fmtD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' });
  var fmtH = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit', hour12: false });
  function hoje() { return fmtD.format(new Date()); }
  function agora() { var d = new Date(); return fmtD.format(d) + 'T' + fmtH.format(d).replace(/^24/, '00'); }
  CA.hojeBA = hoje; CA.agoraBA = agora;
  function isDT(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || '')); }
  function dtBr(s) { s = String(s || ''); return isDT(s) ? dbr(s.slice(0, 10)) + ' às ' + s.slice(11, 16) : CA.isISO(s.slice(0, 10)) ? dbr(s.slice(0, 10)) : '—'; }
  function sane(iso) { return CA.isISO(iso) && +iso.slice(0, 4) >= 2020 && +iso.slice(0, 4) <= 2040; }
  function dd(iso) { return CA.dshort(iso).replace(' ', '/'); }

  /* ---------- Tipos de evento ---------- */
  var TIPOS = CA.PT_TIPOS = {
    disciplina: { nome: 'Disciplina', campos: { inicio: 'Liberação', fim: 'Término (opcional)' }, ph: 'Nome da disciplina' },
    atividade: { nome: 'Atividade', campos: { inicio: 'Liberação (opcional)', fim: 'Prazo de entrega' }, ph: 'Disciplina ou descrição' },
    trabalho: { nome: 'Trabalho acadêmico', campos: { inicio: 'Liberação (opcional)', fim: 'Prazo de entrega' }, ph: 'Disciplina ou descrição' },
    prova: { nome: 'Prova', campos: { prova: 'Data da prova' }, ph: 'Disciplina da prova' },
    outro: { nome: 'Outro evento', campos: { inicio: 'Data' }, ph: 'Descrição' }
  };
  var SIT = CA.PT_SIT = { em_dia: 'Em dia', pendencias: 'Com pendências', recesso: 'Em recesso acadêmico', sem_calendario: 'Sem calendário definido' };
  function stLabel(e) {
    if (e.status === 'cancelado') return 'Cancelado';
    if (e.status === 'concluido') return e.tipo === 'prova' ? 'Realizada' : e.tipo === 'disciplina' ? 'Concluída' : e.tipo === 'outro' ? 'Concluído' : 'Concluída';
    if (e.status === 'disponivel') return e.tipo === 'disciplina' ? 'Liberada' : 'Disponível';
    if (e.tipo === 'prova') return e.prova ? 'Prova agendada' : 'Prova sem data';
    if (e.tipo === 'disciplina') return e.inicio ? 'Aguardando liberação' : 'Liberação sem data';
    if (e.tipo === 'atividade' || e.tipo === 'trabalho') return e.inicio && e.status === 'previsto' ? 'Aguardando liberação' : e.fim ? 'Pendente' : 'Sem prazo definido';
    return 'Previsto';
  }
  /* Data que gera o aviso de um evento ainda aberto e a natureza dela. */
  function refOf(e) {
    if (e.status === 'concluido' || e.status === 'cancelado') return null;
    if (e.tipo === 'prova') return sane(e.prova) ? { d: e.prova, k: 'prova', t: 'Prova' } : null;
    if (e.tipo === 'disciplina') {
      if (e.status === 'previsto') return sane(e.inicio) ? { d: e.inicio, k: 'liberacao', t: 'Liberação' } : null;
      return sane(e.fim) ? { d: e.fim, k: 'termino', t: 'Término' } : null;
    }
    if (e.tipo === 'atividade' || e.tipo === 'trabalho') {
      if (e.status === 'previsto' && sane(e.inicio)) return { d: e.inicio, k: 'liberacao', t: 'Liberação' };
      return sane(e.fim) ? { d: e.fim, k: 'prazo', t: 'Prazo de entrega' } : null;
    }
    var d = sane(e.inicio) ? e.inicio : sane(e.fim) ? e.fim : '';
    return d ? { d: d, k: 'data', t: 'Data' } : null;
  }
  function evNome(e) { var t = TIPOS[e.tipo] || TIPOS.outro; var n = e.disciplina || e.descricao || t.nome; return (e.tipo === 'prova' && !/prova/i.test(n) ? 'Prova de ' : '') + n; }
  function refTxt(e, r) { r = r || refOf(e); return r ? r.t + ' em ' + dbr(r.d) : stLabel(e); }

  /* ---------- Contagem e cores (verde > 5, amarelo 3 a 5, vermelho até 2, hoje, atraso) ---------- */
  function faixa(dias) { return dias == null ? 'late' : dias < 0 ? 'late' : dias === 0 ? 'today' : dias <= 2 ? 'soon' : dias <= 5 ? 'mid' : 'ok'; }
  function falta(dias) {
    if (dias == null) return 'Sem data';
    if (dias < 0) return 'Atrasado há ' + (-dias) + (dias === -1 ? ' dia' : ' dias');
    if (dias === 0) return 'Hoje';
    return 'Faltam ' + dias + (dias === 1 ? ' dia' : ' dias');
  }
  CA.ptFaixa = faixa; CA.ptFalta = falta;
  function chip(dias, txt) { var f = faixa(dias); return '<span class="pt-chip ' + f + '">' + esc(txt || falta(dias)) + '</span>'; }

  /* ---------- Modelo ---------- */
  var memo = null;
  var inv0 = CA.invalidate;
  CA.invalidate = function () { memo = null; return inv0.apply(this, arguments); };
  function arr(d, k) { return Array.isArray(d && d[k]) ? d[k] : []; }
  function parseEv(e) {
    e = e && typeof e === 'object' ? e : {};
    return { id: String(e.id || ''), tipo: TIPOS[e.tipo] ? e.tipo : 'outro', disciplina: String(e.disciplina || ''), descricao: String(e.descricao || ''), inicio: CA.normDate(e.inicio || ''), fim: CA.normDate(e.fim || ''), prova: CA.normDate(e.prova || ''), status: /^(previsto|disponivel|concluido|cancelado)$/.test(e.status) ? e.status : 'previsto', obs: String(e.obs || ''), criado: e.criado || '', atualizado: e.atualizado || '' };
  }
  CA.PT = function () {
    var h = hoje();
    if (memo && memo.hoje === h) return memo;
    var M = CA.M(), d = CA.S.data || {};
    var P = { hoje: h, list: [], byUid: {}, byCid: {} };
    arr(d, DS).forEach(function (r) {
      if (!r || !r._uid) return;
      var c = M.cById[r._clientId] || null, rc = M.rcByCid[r._clientId] || null;
      var st = r['Status do acompanhamento'] || 'Ativo', ativo = st === 'Ativo';
      var evs = (Array.isArray(r.Eventos) ? r.Eventos : []).map(parseEv);
      var abertos = evs.filter(function (e) { return e.status !== 'concluido' && e.status !== 'cancelado'; });
      var rec = r.Recesso && typeof r.Recesso === 'object' ? { inicio: CA.normDate(r.Recesso.inicio || ''), fim: CA.normDate(r.Recesso.fim || ''), retorno: CA.normDate(r.Recesso.retorno || '') } : null;
      var prox = CA.normDate(r['Próxima conferência'] || ''), ult = String(r['Última conferência'] || '');
      var antec = parseInt(r['Antecedência do aviso'], 10); if (!(antec >= 1 && antec <= 60)) antec = ANTEC_PADRAO;
      var p = {
        r: r, uid: r._uid, cid: r._clientId || '', nome: (c && c.nome) || r['Cliente/Aluno'] || '(sem nome)', tel: (c && c.tel) || r.WhatsApp || '',
        c: c, rc: rc, mens: !!(rc && rc.status === 'Ativo'), contratacao: rc ? 'Mensalista' + (rc.status !== 'Ativo' ? ' (' + rc.status.toLowerCase() + ')' : '') : c ? (c.tipo === 'Cliente recorrente' ? 'Mensalista' : 'Eventual') : '—',
        inst: r['Instituição'] || '', curso: r.Curso || '', matr: r['Matrícula'] || '', url: r['Endereço do portal'] || '',
        st: st, ativo: ativo, constatada: r['Situação constatada'] || '', ult: ult, ultD: ult.slice(0, 10), prox: sane(prox) ? prox : '', antec: antec,
        recesso: rec && (rec.inicio || rec.fim || rec.retorno) ? rec : null, eventos: evs, abertos: abertos,
        hist: (Array.isArray(r['Histórico']) ? r['Histórico'] : []).slice().sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); })
      };
      p.diasConf = p.prox ? CA.days(h, p.prox) : null;
      /* itens com data: conferência, eventos abertos e retorno do recesso */
      var it = [];
      if (ativo && p.prox) it.push({ k: 'conf', d: p.prox, t: 'Conferência do portal' });
      abertos.forEach(function (e) { var rf = refOf(e); if (rf) it.push({ k: 'ev', d: rf.d, t: rf.t + ': ' + evNome(e), ev: e, kind: rf.k }); });
      if (p.recesso && sane(p.recesso.retorno)) it.push({ k: 'ret', d: p.recesso.retorno, t: 'Retorno das aulas após o recesso' });
      it.forEach(function (x) { x.dias = CA.days(h, x.d); });
      it.sort(function (a, b) { return a.d.localeCompare(b.d) || (a.k === 'conf' ? -1 : b.k === 'conf' ? 1 : 0); });
      p.itens = it;
      p.atrasados = it.filter(function (x) { return x.k === 'ev' && x.dias < 0; });
      p.semProg = ativo && !p.prox;
      p.situacao = situacao(p, h);
      P.list.push(p); P.byUid[p.uid] = p; (P.byCid[p.cid] = P.byCid[p.cid] || []).push(p);
    });
    P.list.sort(function (a, b) { return (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1) || (a.prox || '9999').localeCompare(b.prox || '9999') || a.nome.localeCompare(b.nome, 'pt-BR'); });
    P.ativos = P.list.filter(function (p) { return p.ativo; });
    P.confAtrasadas = P.ativos.filter(function (p) { return p.diasConf !== null && p.diasConf < 0; });
    P.mensSemPortal = M.rcl.filter(function (x) { return x.status === 'Ativo' && !(P.byCid[x.cid] || []).some(function (p) { return p.st !== 'Encerrado'; }); });
    memo = P;
    return P;
  };
  /* Situação atual (calculada) — separada da situação constatada na última conferência */
  function situacao(p, h) {
    if (p.st === 'Suspenso') return { t: 'Acompanhamento suspenso', c: 'mute' };
    if (p.st === 'Encerrado') return { t: 'Acompanhamento encerrado', c: 'mute' };
    if (!p.ult) return { t: 'Ainda não conferido', c: 'info' };
    if (p.recesso) { var ini = p.recesso.inicio || p.ultD, fim = p.recesso.retorno || p.recesso.fim; if (ini <= h && (!fim || fim > h)) return { t: 'Em recesso acadêmico', c: 'info' }; }
    var late = p.abertos.some(function (e) { var r = refOf(e); return r && r.d < h; });
    if (late || (p.constatada === 'pendencias' && p.abertos.length)) return { t: 'Com pendências', c: 'out' };
    var fut = p.abertos.map(function (e) { return { e: e, r: refOf(e) }; }).filter(function (x) { return x.r; }).sort(function (a, b) { return a.r.d.localeCompare(b.r.d); });
    if (fut.length) {
      var k = fut[0].r.k, tp = fut[0].e.tipo;
      if (k === 'prova') return { t: 'Aguardando realização de provas', c: 'warn' };
      if (k === 'liberacao') return { t: tp === 'disciplina' ? 'Aguardando liberação de disciplinas' : 'Aguardando liberação de atividades', c: 'warn' };
      return { t: 'Atividades em andamento', c: 'act' };
    }
    if (p.constatada === 'sem_calendario') return { t: 'Sem calendário definido', c: 'warn' };
    return { t: 'Em dia', c: 'in' };
  }

  /* ---------- Notificações (entram na central existente) ---------- */
  CA.portalNotifs = function () {
    if (!CA.S.data) return [];
    var P = CA.PT(), out = [];
    P.ativos.forEach(function (p) {
      if (p.semProg) {
        out.push({ k: 'pt:' + p.uid + ':semprog', tipo: 'portal', titulo: 'Portal sem acompanhamento programado', nome: p.nome, inst: p.inst, data: '', dias: -1, semProg: true, linhas: ['Registre uma conferência para programar o próximo acompanhamento.'], abrir: ['ptOpen', p.uid], resolver: ['ptCheck', p.uid], cod: p.inst });
        return;
      }
      var g = {};
      p.itens.forEach(function (x) { (g[x.d] = g[x.d] || []).push(x); });
      Object.keys(g).forEach(function (d) {
        var L = g[d], dias = L[0].dias;
        if (dias > (CA.JANELA_NOTIF || 2)) return; // mesma regra de toda a central: só a partir de 2 dias antes
        var conf = L.some(function (x) { return x.k === 'conf'; }), evs = L.filter(function (x) { return x.k !== 'conf'; });
        var titulo;
        if (conf) titulo = dias < 0 ? 'Conferência atrasada há ' + (-dias) + (dias === -1 ? ' dia' : ' dias') : dias === 0 ? 'Conferência programada para hoje' : 'Conferência do portal em ' + dbr(d);
        else if (evs.length === 1) titulo = evs[0].t;
        else titulo = evs.length + ' eventos acadêmicos em ' + dbr(d);
        out.push({ k: 'pt:' + p.uid + ':' + d, tipo: 'portal', titulo: titulo, nome: p.nome, inst: p.inst, data: d, dias: dias, conf: conf,
          linhas: (conf || evs.length > 1) ? evs.map(function (x) { return x.t; }) : [], abrir: ['ptOpen', p.uid], resolver: ['ptCheck', p.uid], cod: p.inst });
      });
    });
    return out;
  };
  CA.portalLateCount = function () { try { return CA.PT().ativos.filter(function (p) { return p.semProg || (p.diasConf !== null && p.diasConf < 0); }).length; } catch (e) { return 0; } };

  /* ---------- Peças de formulário ---------- */
  function opts(list, s) { return list.map(function (v) { var a = Array.isArray(v) ? v[0] : v, l = Array.isArray(v) ? v[1] : v; return '<option value="' + esc(a) + '"' + (String(a) === String(s) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }
  function field(id, label, input, cls, hint) { return '<div class="field ' + (cls || '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</div>'; }
  function inp(id, type, v, extra) { return '<input id="' + id + '" type="' + type + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>'; }
  function val(m, id) { var el = m.querySelector('#' + id); return el ? el.value.trim() : ''; }
  var ERR = '<p class="form-err" role="alert" hidden></p>';
  function fail(msg) { throw new Error(msg); }
  function recordOf(data, uid) { var x = arr(data, DS).filter(function (r) { return r._uid === uid; })[0]; return x ? JSON.parse(JSON.stringify(x)) : null; }
  function instOptions(cid) {
    var M = CA.M(), set = {};
    M.clients.forEach(function (c) { if (c.fac) set[c.fac.trim()] = 1; });
    M.access.forEach(function (a) { if (a.fac) set[a.fac.trim()] = 1; });
    CA.PT().list.forEach(function (p) { if (p.inst) set[p.inst.trim()] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
  }
  function accessOf(p) { var n = CA.normS(p.inst); return CA.M().access.filter(function (a) { return a.cid === p.cid && a.fac && (CA.normS(a.fac).indexOf(n) >= 0 || n.indexOf(CA.normS(a.fac)) >= 0); })[0] || null; }
  function safeUrl(u) { u = String(u || '').trim(); if (!u || /\s/.test(u)) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { var x = new URL(u); return /^https?:$/.test(x.protocol) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(x.hostname) ? x.href : ''; } catch (e) { return ''; } }

  /* ================= ADICIONAR / EDITAR PORTAL ================= */
  function formPortal(uid, cidPre) {
    var M = CA.M(), P = CA.PT(), p = uid ? P.byUid[uid] : null;
    var mens = M.rcl.filter(function (x) { return x.status === 'Ativo'; }).map(function (x) { return M.cById[x.cid] || { id: x.cid, nome: x.nome, tel: x.tel }; }).filter(function (c) { return c && c.id; });
    var mensIds = {}; mens.forEach(function (c) { mensIds[c.id] = 1; });
    var outros = M.clients.filter(function (c) { return !mensIds[c.id] && c.status === 'Ativo'; });
    var cOpt = '<option value="">Escolha o aluno…</option><optgroup label="Mensalistas ativos">' + mens.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === cidPre ? ' selected' : '') + '>' + esc(c.nome + ' · ' + c.id) + '</option>'; }).join('') + '</optgroup>'
      + (outros.length ? '<optgroup label="Outros clientes (habilitar individualmente)">' + outros.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === cidPre ? ' selected' : '') + '>' + esc(c.nome + ' · ' + c.id) + '</option>'; }).join('') + '</optgroup>' : '');
    var body = '<div class="form-grid">'
      + (p ? '<div class="full review"><span><b>' + esc(p.nome) + '</b> · ' + esc(p.cid) + ' · ' + esc(p.contratacao) + '</span></div>' : field('pC', 'Aluno', '<select id="pC">' + cOpt + '</select>', 'full', 'Os dados do cadastro (nome, WhatsApp, tipo de contratação) vêm da Base de acadêmicos.'))
      + '<div class="full" id="pInfo"></div>'
      + (p ? field('pI', 'Instituição', '<input id="pI" list="pIList" autocomplete="off" value="' + esc(p ? p.inst : '') + '"><datalist id="pIList">' + instOptions() + '</datalist>', '')
      + field('pCu', 'Curso (opcional)', inp('pCu', 'text', p ? p.curso : ''), '')
      + field('pM', 'Matrícula (opcional)', inp('pM', 'text', p ? p.matr : '', ' autocomplete="off"'), '')
      + field('pU', 'Endereço do portal (opcional)', inp('pU', 'url', p ? p.url : '', ' placeholder="https://…" inputmode="url"'), '', 'Só o link de acesso. Login e senha continuam em Acessos de portal.')
      : '<div class="full pt-insts" id="pInsts"></div><datalist id="pIList">' + instOptions() + '</datalist>'
        + '<div class="full"><button type="button" class="btn sm" id="pAddInst">' + ic('plus') + 'Adicionar outra instituição</button><small class="pt-ih">Para aluno com mais de uma instituição: cada uma vira um portal separado, com o próprio link e as próprias conferências.</small></div>')
      + (p ? field('pS', 'Acompanhamento', '<select id="pS">' + opts([['Ativo', 'Ativo'], ['Suspenso', 'Suspenso'], ['Encerrado', 'Encerrado']], p.st) + '</select>', '')
        + '<div class="full" id="pReat" hidden>' + field('pR', 'Próxima conferência', inp('pR', 'date', p.prox && p.prox >= hoje() ? p.prox : hoje(), ' min="' + hoje() + '"'), '', 'Obrigatória para reativar o acompanhamento.') + '</div>'
        : field('pP', 'Primeira conferência', inp('pP', 'date', hoje(), ' min="' + hoje() + '"'), '', 'Hoje, se você vai conferir agora. O sistema avisa na data escolhida.'))
      + '</div>' + ERR;
    CA.modal({
      title: p ? 'Editar portal' : 'Adicionar portal acadêmico', sub: p ? p.inst : 'Um aluno pode ter quantos portais precisar, um para cada instituição.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }].concat(p ? [] : [{ label: 'Salvar e conferir agora', id: 'bNow' }]).concat([{ label: p ? 'Salvar' : 'Adicionar portal', cls: 'primary', id: 'bOk' }]),
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        var info = function () {
          var box = m.querySelector('#pInfo'), cid = p ? p.cid : val(m, 'pC'), c = M.cById[cid];
          if (!c) { box.innerHTML = ''; return; }
          var rc = M.rcByCid[cid], ps = (P.byCid[cid] || []).filter(function (x) { return x.st !== 'Encerrado' && (!p || x.uid !== p.uid); });
          var h = '<div class="review"><span><b>' + esc(c.nome) + '</b> · ' + esc(c.id) + ' · ' + (rc && rc.status === 'Ativo' ? 'Mensalista ativo' : esc(c.tipo)) + ' · ' + esc(c.status) + '</span>'
            + '<span>WhatsApp ' + esc(CA.telFmt(c.tel) || '—') + ' · Faculdade no cadastro: ' + esc(c.fac || '—') + '</span>'
            + (ps.length ? '<span>Já acompanhado em: <b>' + ps.map(function (x) { return esc(x.inst); }).join(', ') + '</b></span>' : '') + '</div>';
          if (!p && !(rc && rc.status === 'Ativo')) h += '<div class="note" style="margin-top:8px">Cliente eventual: o acompanhamento contínuo fica habilitado só para este aluno, por escolha sua.</div>';
          box.innerHTML = h;
        };
        var rowsBox = m.querySelector('#pInsts');
        var renum = function () {
          var rows = rowsBox.querySelectorAll('.pt-inst'), many = rows.length > 1;
          [].forEach.call(rows, function (r, i) { r.querySelector('.pt-inst-n').textContent = many ? 'Instituição ' + (i + 1) : 'Instituição'; r.querySelector('[data-rmi]').hidden = !many; });
        };
        var addRow = function (nome) {
          var w = document.createElement('div'); w.innerHTML = instRow(nome || ''); var r = w.firstChild; rowsBox.appendChild(r);
          r.querySelector('[data-rmi]').onclick = function () { r.remove(); renum(); };
          renum(); return r;
        };
        if (!p) {
          addRow(''); // campos sempre em branco: você digita cada instituição
          m.querySelector('#pAddInst').onclick = function () { var r = addRow(''); try { r.querySelector('[data-f=inst]').focus(); } catch (e) {} };
          m.querySelector('#pC').onchange = info; if (cidPre) info();
        }
        else {
          info();
          var ps = m.querySelector('#pS'), box = m.querySelector('#pReat');
          var chk = function () { box.hidden = !(ps.value === 'Ativo' && (p.st !== 'Ativo' || !p.prox)); };
          ps.onchange = chk; chk();
        }
        var save = function (btn, now) {
          CA.run(btn, m.querySelector('.form-err'), async function () {
            var inst = '', url = '', novos = [];
            if (p) {
              inst = val(m, 'pI').replace(/\s+/g, ' '); var urlRaw = val(m, 'pU'); url = safeUrl(urlRaw);
              if (inst.length < 2) fail('Informe a instituição do portal.');
              if (urlRaw && !url) fail('Endereço do portal inválido. Use um link que comece com https://');
            } else novos = lerInsts(m);
            var data = await CA.fresh(), ts = CA.ts(), rec, cid;
            if (p) {
              rec = recordOf(data, p.uid); if (!rec) fail('Este portal não existe mais na base. Atualize a tela.');
              cid = rec._clientId;
            } else {
              cid = val(m, 'pC'); if (!cid) fail('Escolha o aluno.');
            }
            var cli = arr(data, 'clients').filter(function (x) { return x['ID Cliente'] === cid; })[0];
            if (!cli) fail('Aluno não encontrado na Base de acadêmicos. Atualize a tela.');
            var temPortal = function (nome) { return arr(data, DS).filter(function (x) { return x._clientId === cid && (!p || x._uid !== p.uid) && (x['Status do acompanhamento'] || 'Ativo') !== 'Encerrado' && CA.normS(x['Instituição']).trim() === CA.normS(nome).trim(); })[0]; };
            (p ? [inst] : novos.map(function (n) { return n.inst; })).forEach(function (nome) { if (temPortal(nome)) fail('Este aluno já tem um portal da ' + nome + ' em acompanhamento.'); });
            var ops = [];
            if (p) {
              var st = val(m, 'pS'), antec = p.antec;
              Object.assign(rec, { 'Instituição': inst, Curso: val(m, 'pCu'), 'Matrícula': val(m, 'pM'), 'Endereço do portal': url, 'Status do acompanhamento': st, 'Antecedência do aviso': antec }, CA.editor(ts));
              if (st === 'Ativo' && (p.st !== 'Ativo' || !p.prox)) {
                var pr = val(m, 'pR'); if (!sane(pr) || pr < hoje()) fail('Informe a próxima conferência (hoje ou depois).');
                rec['Próxima conferência'] = pr;
              }
              if (st !== p.st) rec['Histórico'] = histPush(rec['Histórico'], { id: 'h_' + CA.rnd(8), em: agora(), tipo: 'status', resumo: 'Acompanhamento ' + (st === 'Ativo' ? 'reativado' : st.toLowerCase()) + '.', por: (CA.S.user && CA.S.user.email) || '' });
            } else {
              var pp = val(m, 'pP'); if (!sane(pp) || pp < hoje()) fail('Informe a data da primeira conferência (hoje ou depois).');
              novos.forEach(function (n) {
                var r = Object.assign({ _uid: 'portals_web_' + CA.slug(cli.Nome) + '_' + CA.slug(n.inst).slice(0, 12) + '_' + CA.rnd(5), _clientId: cid, _clientKey: cli._clientKey || '', 'Cliente/Aluno': cli.Nome, WhatsApp: cli.WhatsApp || '', 'Instituição': n.inst, Curso: n.curso, 'Matrícula': n.matr, 'Endereço do portal': n.url, 'Status do acompanhamento': 'Ativo', 'Situação constatada': '', 'Última conferência': '', 'Próxima conferência': pp, 'Antecedência do aviso': ANTEC_PADRAO, Recesso: null, Eventos: [], 'Histórico': [], _createdAt: ts, _editedAt: ts }, CA.creator());
                ops.push({ type: 'upsert', dataset: DS, uid: r._uid, record: r }); if (!rec) rec = r;
              });
            }
            if (p) ops.push({ type: 'upsert', dataset: DS, uid: rec._uid, record: rec });
            // todos os portais do aluno entram numa única gravação: ou grava tudo, ou nada
            await CA.commit(ops, p ? 'portal-edicao' : 'portal-novo', p ? 'Portal atualizado.' : novos.length === 1 ? 'Portal de ' + novos[0].inst + ' adicionado.' : novos.length + ' portais adicionados: ' + novos.map(function (n) { return n.inst; }).join(', ') + '.');
            CA.closeLayers();
            if (now) setTimeout(function () { formConferencia(rec._uid); }, 60);
          });
        };
        m.querySelector('#bOk').onclick = function () { save(this, false); };
        var bn = m.querySelector('#bNow'); if (bn) bn.onclick = function () { save(this, true); };
      }
    });
  }
  function instRow(nome) {
    return '<div class="pt-inst"><div class="pt-inst-h"><b class="pt-inst-n">Instituição</b><button type="button" class="btn-ghost sm danger" data-rmi aria-label="Remover esta instituição">' + ic('x') + 'Remover</button></div>'
      + '<div class="form-grid">'
      + '<div class="field"><label>Nome da instituição</label><input data-f="inst" list="pIList" autocomplete="off" value="' + esc(nome) + '"></div>'
      + '<div class="field"><label>Endereço do portal (opcional)</label><input data-f="url" type="url" inputmode="url" placeholder="https://…"></div>'
      + '<div class="field"><label>Curso (opcional)</label><input data-f="curso" type="text"></div>'
      + '<div class="field"><label>Matrícula (opcional)</label><input data-f="matr" type="text" autocomplete="off"></div>'
      + '</div></div>';
  }
  function lerInsts(m) {
    var out = [], vistos = {};
    [].forEach.call(m.querySelectorAll('.pt-inst'), function (r, i) {
      var g = function (k) { return r.querySelector('[data-f=' + k + ']').value.trim().replace(/\s+/g, ' '); };
      var n = { inst: g('inst'), urlRaw: g('url'), curso: g('curso'), matr: g('matr') }, rot = m.querySelectorAll('.pt-inst').length > 1 ? 'Instituição ' + (i + 1) : 'Instituição';
      if (!n.inst && !n.urlRaw && !n.curso && !n.matr) return; // linha extra deixada em branco
      if (n.inst.length < 2) fail(rot + ': informe o nome da instituição.');
      n.url = safeUrl(n.urlRaw); if (n.urlRaw && !n.url) fail(rot + ' (' + n.inst + '): endereço do portal inválido. Use um link que comece com https://');
      var k = CA.normS(n.inst).trim(); if (vistos[k]) fail('A instituição ' + n.inst + ' foi informada duas vezes.'); vistos[k] = 1;
      out.push(n);
    });
    if (!out.length) fail('Informe a instituição do portal.');
    return out;
  }
  function histPush(h, e) {
    h = Array.isArray(h) ? h.filter(function (x) { return x && x.id !== e.id; }) : [];
    h.push(e);
    h.sort(function (a, b) { return String(a.em || '').localeCompare(String(b.em || '')); });
    return h.slice(-HIST_MAX);
  }

  /* ================= REGISTRAR CONFERÊNCIA / AJUSTAR CALENDÁRIO ================= */
  function rowNovo(id, tipo) {
    tipo = TIPOS[tipo] ? tipo : 'disciplina';
    return '<div class="pt-ev pt-new" data-id="' + esc(id) + '">'
      + '<div class="pt-ev-h"><select data-f="tipo" aria-label="Tipo de evento">' + opts(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k].nome]; }), tipo) + '</select>'
      + '<input data-f="nome" type="text" placeholder="' + esc(TIPOS[tipo].ph) + '" aria-label="Nome">'
      + '<button type="button" class="btn-ghost sm danger" data-rm aria-label="Remover">' + ic('x') + '</button></div>'
      + '<div class="pt-ev-d">' + datesHTML(tipo, {}) + '<label class="pt-obs"><span>Obs.</span><input data-f="obs" type="text" placeholder="opcional"></label></div></div>';
  }
  function datesHTML(tipo, e) {
    var c = TIPOS[tipo].campos;
    return Object.keys(c).map(function (k) { return '<label><span>' + esc(c[k]) + '</span><input data-f="' + k + '" type="date" value="' + esc(e[k] || '') + '"></label>'; }).join('');
  }
  function rowAntigo(e, h) {
    var rf = refOf(e), late = rf && rf.d < h, c = TIPOS[e.tipo].campos;
    var stOpts = [['keep', late ? 'Ainda não aconteceu' : 'Continua previsto']];
    if (e.status === 'previsto' && (e.tipo === 'disciplina' || ((e.tipo === 'atividade' || e.tipo === 'trabalho') && e.inicio))) stOpts.push(['disponivel', e.tipo === 'disciplina' ? 'Foi liberada' : 'Foi liberada (em andamento)']);
    stOpts.push(['concluido', e.tipo === 'prova' ? 'Prova realizada' : 'Concluída'], ['cancelado', 'Cancelar (registro incorreto)']);
    return '<div class="pt-ev pt-old' + (late ? ' late' : '') + '" data-id="' + esc(e.id) + '">'
      + '<div class="pt-ev-h"><span class="pt-tp">' + esc(TIPOS[e.tipo].nome) + '</span><b>' + esc(evNome(e)) + '</b><span class="pt-st">' + esc(stLabel(e)) + (rf ? ' · ' + esc(rf.t.toLowerCase()) + ' ' + dd(rf.d) : '') + '</span></div>'
      + '<div class="pt-ev-d"><label class="pt-sel"><span>O que você encontrou</span><select data-f="acao">' + opts(stOpts, 'keep') + '</select></label>'
      + Object.keys(c).map(function (k) { return '<label><span>' + esc(c[k].replace(' (opcional)', '')) + '</span><input data-f="' + k + '" type="date" value="' + esc(e[k] || '') + '"></label>'; }).join('')
      + '</div>' + (late ? '<small class="pt-late">A data já passou. Informe o que encontrou ou ajuste a nova data.</small>' : '') + '</div>';
  }

  function formConferencia(uid, ajuste) {
    var P = CA.PT(), p = P.byUid[uid]; if (!p) { CA.toast('Portal não encontrado. Atualize a tela.', true); return; }
    var h = hoje(), histId = 'h_' + CA.rnd(10), touched = false;
    var anter = p.abertos.slice().sort(function (a, b) { var ra = refOf(a), rb = refOf(b); return ((ra && ra.d) || '9999').localeCompare((rb && rb.d) || '9999'); });
    var sit0 = p.constatada && SIT[p.constatada] ? p.constatada : 'em_dia';
    var body = '<div class="review"><span><b>' + esc(p.nome) + '</b> · ' + esc(p.inst) + (p.curso ? ' · ' + esc(p.curso) : '') + (p.matr ? ' · matrícula ' + esc(p.matr) : '') + '</span>'
      + '<span>' + esc(p.contratacao) + ' · última conferência: <b>' + (p.ult ? dtBr(p.ult) + (SIT[p.constatada] ? ' (' + esc(SIT[p.constatada].toLowerCase()) + ')' : '') : 'nenhuma') + '</b>'
      + (p.prox ? ' · programada para <b>' + dbr(p.prox) + '</b>' + (!ajuste && p.prox > h ? ' <span class="pt-chip info">conferência antecipada</span>' : '') : '') + '</span></div>'
      + '<div class="form-grid" style="margin-top:14px">'
      + (ajuste ? '' : field('cDT', 'Data e hora da conferência', inp('cDT', 'datetime-local', agora(), ' max="' + agora() + '"'), '', 'Preenchida agora. Corrija se conferiu em outro momento.')
        + '<div class="field full"><label>Como está o portal?</label><div class="seg pt-seg" role="group" aria-label="Situação constatada">' + Object.keys(SIT).map(function (k) { return '<button type="button" data-sit="' + k + '" aria-pressed="' + (k === sit0) + '">' + esc(k === 'recesso' ? 'Em recesso' : SIT[k]) + '</button>'; }).join('') + '</div></div>')
      + '</div>'
      + (anter.length ? '<section class="pt-sec"><h3>Registrados antes <span class="count">' + anter.length + '</span></h3><div class="pt-evs" id="cOld">' + anter.map(function (e) { return rowAntigo(e, h); }).join('') + '</div></section>' : '')
      + '<section class="pt-sec"><h3>' + (ajuste ? 'Incluir eventos' : 'Novas disciplinas, provas ou atividades') + '</h3><div class="pt-evs" id="cNew"></div>'
      + '<button type="button" class="btn sm" id="cAdd">' + ic('plus') + 'Adicionar disciplina ou atividade</button></section>'
      + '<section class="pt-sec" id="cRec"' + (sit0 === 'recesso' && !ajuste ? '' : ' hidden') + '><h3>Recesso acadêmico</h3><div class="form-grid">'
      + field('rI', 'Início do recesso', inp('rI', 'date', p.recesso ? p.recesso.inicio : ''), '') + field('rF', 'Término (opcional)', inp('rF', 'date', p.recesso ? p.recesso.fim : ''), '')
      + field('rR', 'Previsão de retorno das aulas (opcional)', inp('rR', 'date', p.recesso ? p.recesso.retorno : ''), 'full', 'Sem previsão de retorno? Basta escolher a próxima conferência abaixo.') + '</div></section>'
      + '<section class="pt-sec pt-next"><h3>Próxima conferência</h3><div class="pt-next-r">' + inp('cNx', 'date', '', ' min="' + h + '" aria-label="Próxima conferência"')
      + '<span class="pt-quick">' + [[7, '+7 dias'], [15, '+15'], [30, '+30']].map(function (q) { return '<button type="button" class="btn-ghost sm" data-q="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</span></div>'
      + '<p class="pt-sug" id="cSug"></p></section>'
      + '<details class="pt-more"><summary>Mais opções</summary><div class="form-grid" style="margin-top:10px">'
      + (ajuste ? '' : field('cE', 'Acompanhamento deste portal', '<select id="cE">' + opts([['Ativo', 'Continuar acompanhando'], ['Suspenso', 'Suspender'], ['Encerrado', 'Encerrar']], 'Ativo') + '</select>', '', 'Suspender ou encerrar dispensa a próxima conferência.'))
      + '</div></details>'
      + field('cO', 'Observações (opcional)', '<textarea id="cO" rows="2"></textarea>', 'full pt-o')
      + ERR;
    CA.modal({
      title: ajuste ? 'Ajustar datas do portal' : 'Registrar conferência do portal', sub: ajuste ? 'Para mudanças de calendário da instituição, sem registrar uma nova conferência.' : 'Depois de salvar, o sistema programa sozinho os próximos avisos.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: ajuste ? 'Salvar ajustes' : 'Salvar conferência', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        var sit = sit0, nx = m.querySelector('#cNx'), newBox = m.querySelector('#cNew');
        m.querySelector('.modal-b').classList.add('pt-mb');
        if (ajuste && p.prox) { nx.value = p.prox; touched = true; }
        m.querySelector('#bNo').onclick = CA.closeModal;
        var setSit = function (k) {
          sit = k; m.querySelectorAll('[data-sit]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sit') === k)); });
          var rb = m.querySelector('#cRec'); if (rb) rb.hidden = k !== 'recesso';
          sugerir();
        };
        m.querySelectorAll('[data-sit]').forEach(function (b) { b.onclick = function () { setSit(b.getAttribute('data-sit')); }; });
        var addRow = function (tipo) {
          var w = document.createElement('div'); w.innerHTML = rowNovo('ev_' + CA.rnd(10), tipo); var row = w.firstChild; newBox.appendChild(row);
          var t = row.querySelector('[data-f=tipo]');
          t.onchange = function () {
            var keep = {}; row.querySelectorAll('.pt-ev-d input[type=date]').forEach(function (i) { keep[i.getAttribute('data-f')] = i.value; });
            var obs = row.querySelector('[data-f=obs]').value;
            row.querySelector('.pt-ev-d').innerHTML = datesHTML(t.value, keep) + '<label class="pt-obs"><span>Obs.</span><input data-f="obs" type="text" placeholder="opcional"></label>';
            row.querySelector('[data-f=obs]').value = obs; row.querySelector('[data-f=nome]').placeholder = TIPOS[t.value].ph; sugerir();
          };
          row.querySelector('[data-rm]').onclick = function () { row.remove(); sugerir(); };
          try { row.querySelector('[data-f=nome]').focus({ preventScroll: false }); } catch (e) {}
          sugerir();
        };
        m.querySelector('#cAdd').onclick = function () { var last = newBox.lastElementChild; addRow(last ? last.querySelector('[data-f=tipo]').value : 'disciplina'); };
        // ouvintes no corpo do formulário (o elemento #modal é reaproveitado por outras janelas)
        var mb = m.querySelector('.modal-b');
        mb.addEventListener('input', function (e) { if (e.target === nx) { touched = !!nx.value; return; } if (e.target.matches('input[type=date],select')) sugerir(); });
        mb.addEventListener('change', function (e) { if (e.target !== nx && e.target.matches('input[type=date],select')) sugerir(); });
        m.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { nx.value = CA.addDays(h, +b.getAttribute('data-q')); touched = true; sugerir(); }; });
        /* Sugestão determinística: a data mais próxima entre os eventos que continuam abertos e o retorno do recesso */
        function sugerir() {
          var L = coletar(m, p, sit, ajuste, true), c = [];
          L.evs.forEach(function (e) { var r = refOf(e); if (r && r.d >= h) c.push({ d: r.d, t: r.t.toLowerCase() + ' de ' + evNome(e) }); });
          if (sit === 'recesso' && L.rec && sane(L.rec.retorno) && L.rec.retorno >= h) c.push({ d: L.rec.retorno, t: 'retorno das aulas' });
          c.sort(function (a, b) { return a.d.localeCompare(b.d); });
          var s = m.querySelector('#cSug'), best = c[0];
          if (!touched) nx.value = best ? best.d : '';
          var enc = m.querySelector('#cE') && m.querySelector('#cE').value !== 'Ativo';
          s.innerHTML = enc ? 'O acompanhamento deixa de ter próxima conferência.' : best ? 'Sugerida: <b>' + dbr(best.d) + '</b> (' + esc(best.t) + ')' + (touched && nx.value !== best.d ? ' · <button type="button" class="lnk" data-use="' + best.d + '">usar esta</button>' : '') + '. Você não precisa conferir antes disso.'
            : 'Sem data prevista no portal: escolha quando conferir de novo.';
          var u = s.querySelector('[data-use]'); if (u) u.onclick = function () { nx.value = u.getAttribute('data-use'); touched = false; sugerir(); };
          nx.disabled = !!enc;
        }
        sugerir();
        m.querySelector('#bOk').onclick = function () {
          var btn = this;
          CA.run(btn, m.querySelector('.form-err'), async function () {
            var L = coletar(m, p, sit, ajuste, false), enc = !ajuste && val(m, 'cE') !== 'Ativo' ? val(m, 'cE') : '';
            var dt = ajuste ? '' : val(m, 'cDT'), next = enc ? '' : nx.value;
            if (!ajuste) { if (!isDT(dt)) fail('Informe a data e a hora da conferência.'); if (dt > agora()) fail('A conferência não pode estar no futuro.'); if (dt.slice(0, 10) < '2020-01-01') fail('Data da conferência inválida.'); }
            /* Coerência: evento mantido como previsto com a data já vencida na data da conferência */
            if (!ajuste) L.upd.forEach(function (u) {
              if (!u.keep) return;
              var e = Object.assign(JSON.parse(JSON.stringify(p.eventos.filter(function (x) { return x.id === u.id; })[0] || {})), u.set), r = e.tipo ? refOf(e) : null;
              if (r && r.d < dt.slice(0, 10)) fail(TIPOS[e.tipo].nome + ' "' + evNome(e) + '": a ' + r.t.toLowerCase() + ' estava prevista para ' + dbr(r.d) + '. Informe o que encontrou no portal ou ajuste a nova data.');
            });
            if (!enc) { if (!sane(next)) fail('Informe a próxima conferência. Todo portal acompanhado precisa de uma próxima data.'); if (next < h) fail('A próxima conferência não pode ser antes de hoje.'); if (CA.days(h, next) > 730) fail('A próxima conferência está a mais de 2 anos. Confira a data.'); }
            var data = await CA.fresh(), rec = recordOf(data, uid); if (!rec) fail('Este portal não existe mais na base. Atualize a tela.');
            var ts = CA.ts(), base = (Array.isArray(rec.Eventos) ? rec.Eventos : []).map(parseEv), byId = {};
            base.forEach(function (e) { byId[e.id] = e; });
            var alterados = [], novos = [], ign = 0;
            L.upd.forEach(function (u) {
              var e = byId[u.id]; if (!e) return;
              var antes = JSON.stringify([e.status, e.inicio, e.fim, e.prova]);
              Object.assign(e, u.set);
              if (JSON.stringify([e.status, e.inicio, e.fim, e.prova]) !== antes) { e.atualizado = ts; alterados.push(evNome(e) + ': ' + stLabel(e).toLowerCase() + (refOf(e) ? ', ' + refTxt(e).toLowerCase() : '')); }
            });
            L.novos.forEach(function (n) {
              var rn = refOf(n), dupE = base.filter(function (e) { var re = refOf(e); return e.id !== n.id && e.tipo === n.tipo && e.status !== 'cancelado' && CA.normS(evNome(e)) === CA.normS(evNome(n)) && ((re && rn && re.d === rn.d) || (!re && !rn)); })[0];
              if (dupE) { ign++; return; }
              if (byId[n.id]) { Object.assign(byId[n.id], n); return; } // mesma linha já gravada numa tentativa anterior
              n.criado = ts; n.atualizado = ts; base.push(n); byId[n.id] = n; novos.push(evNome(n) + (rn ? ' (' + rn.t.toLowerCase() + ' ' + dbr(rn.d) + ')' : ''));
            });
            var hd = ajuste ? h : dt.slice(0, 10);
            var antecN = p.antec, prevProx = CA.normDate(rec['Próxima conferência'] || '');
            var resumo;
            Object.assign(rec, { Eventos: base, 'Antecedência do aviso': antecN }, CA.editor(ts));
            if (ajuste) {
              rec['Próxima conferência'] = next;
              resumo = 'Ajuste de calendário' + (prevProx !== next ? ': próxima conferência ' + (prevProx ? 'de ' + dbr(prevProx) + ' ' : '') + 'para ' + dbr(next) : '') + '.';
            } else {
              if (sit === 'recesso') rec.Recesso = L.rec; else rec.Recesso = null;
              Object.assign(rec, { 'Situação constatada': sit, 'Última conferência': dt, 'Próxima conferência': next, 'Status do acompanhamento': enc || 'Ativo' });
              resumo = SIT[sit] + (sit === 'recesso' && L.rec ? ' (' + [L.rec.inicio ? 'início ' + dbr(L.rec.inicio) : '', L.rec.retorno ? 'retorno ' + dbr(L.rec.retorno) : ''].filter(Boolean).join(', ') + ')' : '') + '.';
            }
            rec['Histórico'] = histPush(rec['Histórico'], { id: histId, em: ajuste ? agora() : dt, tipo: ajuste ? 'ajuste' : 'conferencia', situacao: ajuste ? '' : sit, resumo: resumo, novos: novos, alterados: alterados, proxima: next, antecipada: !ajuste && !!prevProx && hd < prevProx, encerrado: enc, obs: val(m, 'cO'), por: (CA.S.user && CA.S.user.email) || '' });
            await CA.commit([{ type: 'upsert', dataset: DS, uid: uid, record: rec }], ajuste ? 'portal-ajuste' : 'portal-conferencia',
              (ajuste ? 'Datas atualizadas.' : 'Conferência registrada.') + (next ? ' Próxima: ' + dbr(next) + '.' : enc ? ' Acompanhamento ' + enc.toLowerCase() + '.' : '') + (ign ? ' ' + ign + (ign === 1 ? ' evento repetido ignorado.' : ' eventos repetidos ignorados.') : ''));
            CA.closeLayers();
          });
        };
      }
    });
  }
  /* Lê o formulário. "leve" = só para a sugestão de data (não valida). */
  function coletar(m, p, sit, ajuste, leve) {
    var out = { upd: [], novos: [], evs: [], rec: null };
    m.querySelectorAll('.pt-old').forEach(function (row) {
      var id = row.getAttribute('data-id'), e0 = p.eventos.filter(function (x) { return x.id === id; })[0]; if (!e0) return;
      var e = JSON.parse(JSON.stringify(e0)), a = row.querySelector('[data-f=acao]').value, set = {};
      row.querySelectorAll('input[type=date]').forEach(function (i) { var k = i.getAttribute('data-f'); if (!leve && i.value && !sane(i.value)) fail('Data inválida em "' + evNome(e0) + '".'); set[k] = i.value; });
      if (a === 'disponivel') set.status = 'disponivel'; else if (a === 'concluido' || a === 'cancelado') set.status = a;
      Object.assign(e, set);
      out.upd.push({ id: id, set: set, keep: a === 'keep' });
      if (e.status !== 'concluido' && e.status !== 'cancelado') out.evs.push(e);
    });
    m.querySelectorAll('.pt-new').forEach(function (row) {
      var g = function (k) { var el = row.querySelector('[data-f=' + k + ']'); return el ? el.value.trim() : ''; };
      var tipo = g('tipo'), nome = g('nome').replace(/\s+/g, ' ');
      var n = parseEv({ id: row.getAttribute('data-id'), tipo: tipo, status: 'previsto', inicio: g('inicio'), fim: g('fim'), prova: g('prova'), obs: g('obs') });
      if (tipo === 'disciplina' || tipo === 'prova') n.disciplina = nome; else n.descricao = nome;
      var vazio = !nome && !n.inicio && !n.fim && !n.prova;
      if (vazio) return;
      if (!leve) {
        if (!nome) fail('Informe o nome da ' + TIPOS[tipo].nome.toLowerCase() + ' adicionada.');
        ['inicio', 'fim', 'prova'].forEach(function (k) { if (n[k] && !sane(n[k])) fail('Data inválida em "' + nome + '".'); });
        if (n.inicio && n.fim && n.fim < n.inicio) fail('"' + nome + '": o prazo/término é anterior à liberação.');
      }
      out.novos.push(n); out.evs.push(n);
    });
    if (!ajuste && sit === 'recesso') {
      var ri = val(m, 'rI'), rf = val(m, 'rF'), rr = val(m, 'rR');
      if (!leve) {
        [ri, rf, rr].forEach(function (x) { if (x && !sane(x)) fail('Data do recesso inválida.'); });
        if (ri && rf && rf < ri) fail('O término do recesso é anterior ao início.');
        if (ri && rr && rr < ri) fail('O retorno das aulas é anterior ao início do recesso.');
      }
      out.rec = { inicio: ri, fim: rf, retorno: rr };
    }
    return out;
  }

  /* ================= DETALHES DO PORTAL (botão Abrir) ================= */
  function openPortal(uid) {
    var P = CA.PT(), p = P.byUid[uid]; if (!p) { CA.toast('Portal não encontrado. Atualize a tela.', true); return; }
    var h = P.hoje, acc = accessOf(p), url = safeUrl(p.url);
    var actions = (p.ativo ? '<button class="btn sm gold" data-a="check">' + ic('check') + 'Registrar conferência</button><button class="btn sm" data-a="adj">' + ic('cal') + 'Ajustar datas</button>' : '')
      + (url ? '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + ic('out') + 'Abrir portal</a>' : '')
      + '<button class="btn sm" data-a="edit">' + ic('edit') + 'Editar</button><button class="btn sm" data-a="cli">' + ic('users') + 'Ficha do aluno</button>';
    var conf = !p.ativo ? '<span class="chip mute">' + esc(p.st) + '</span>' : p.prox ? dbr(p.prox) + ' ' + chip(p.diasConf, p.diasConf < 0 ? 'Atrasada há ' + (-p.diasConf) + (p.diasConf === -1 ? ' dia' : ' dias') : p.diasConf === 0 ? 'Hoje' : null) : '<span class="pt-chip late">Sem data programada</span>';
    var body = '<dl class="facts">'
      + '<div><dt>Aluno</dt><dd>' + esc(p.nome) + '</dd></div><div><dt>Contratação</dt><dd>' + esc(p.contratacao) + (p.c && p.c.status !== 'Ativo' ? ' · ' + esc(p.c.status) : '') + '</dd></div>'
      + '<div><dt>Instituição</dt><dd>' + esc(p.inst || '—') + '</dd></div><div><dt>Curso</dt><dd>' + esc(p.curso || '—') + '</dd></div>'
      + (p.matr ? '<div><dt>Matrícula</dt><dd class="num">' + esc(p.matr) + '</dd></div>' : '')
      + '<div><dt>Situação atual</dt><dd><span class="chip ' + p.situacao.c + '">' + esc(p.situacao.t) + '</span></dd></div>'
      + '<div><dt>Última conferência</dt><dd>' + (p.ult ? dtBr(p.ult) + (SIT[p.constatada] ? '<small class="pt-sm">constatado: ' + esc(SIT[p.constatada].toLowerCase()) + '</small>' : '') : 'Ainda não conferido') + '</dd></div>'
      + '<div><dt>Próxima conferência</dt><dd>' + conf + '</dd></div>'
      + '</dl>';
    if (p.recesso) body += '<div class="note info"><b>Recesso acadêmico</b>' + [p.recesso.inicio ? ' · início ' + dbr(p.recesso.inicio) : '', p.recesso.fim ? ' · término ' + dbr(p.recesso.fim) : '', p.recesso.retorno ? ' · retorno previsto ' + dbr(p.recesso.retorno) : ' · retorno sem data'].join('') + '</div>';
    if (acc) body += '<div class="pt-acc">' + ic('lock') + '<span>Acesso salvo em Acessos de portal' + (acc.login ? ' · login <b class="num">' + esc(acc.login) + '</b>' : '') + '</span>' + (acc.login ? '<button type="button" class="btn-ghost sm" data-copy="' + esc(acc.login) + '">' + ic('copy') + 'Copiar login</button>' : '') + '</div>';
    var ab = p.abertos.slice().sort(function (a, b) { var ra = refOf(a), rb = refOf(b); return ((ra && ra.d) || '9999').localeCompare((rb && rb.d) || '9999'); });
    body += '<section class="panel"><div class="panel-h"><h2>Previsto no portal</h2><span class="muted">' + ab.length + '</span></div><div class="panel-b"><div class="rows">'
      + (ab.length ? ab.map(function (e) { var r = refOf(e), di = r ? CA.days(h, r.d) : null; return '<div class="row">' + CA.views.when(r ? r.d : '', di) + '<div class="main"><b>' + esc(evNome(e)) + '</b><span>' + esc(TIPOS[e.tipo].nome) + ' · ' + esc(stLabel(e)) + (r ? ' · ' + esc(r.t.toLowerCase()) + ' ' + dbr(r.d) : '') + (e.obs ? ' · ' + esc(e.obs) : '') + '</span></div>' + (r ? chip(di) : '') + '</div>'; }).join('')
        : '<div class="empty">Nada previsto. ' + (p.ativo ? 'O próximo passo é a conferência programada.' : '') + '</div>') + '</div></div></section>';
    var fech = p.eventos.filter(function (e) { return e.status === 'concluido' || e.status === 'cancelado'; }).reverse();
    if (fech.length) body += '<details class="grp"><summary><span class="tone in"></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '<span class="t">Concluídos e cancelados</span><span class="count">' + fech.length + '</span></summary><div class="panel-b"><div class="rows">'
      + fech.map(function (e) { return '<div class="row"><div class="main"><b>' + esc(evNome(e)) + '</b><span>' + esc(TIPOS[e.tipo].nome) + ' · ' + esc(stLabel(e)) + (e.atualizado ? ' em ' + dbr(String(e.atualizado).slice(0, 10)) : '') + '</span></div></div>'; }).join('') + '</div></div></details>';
    body += '<details class="grp"><summary><span class="tone act"></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '<span class="t">Histórico de conferências</span><span class="count">' + p.hist.length + '</span></summary><div class="panel-b">'
      + (p.hist.length ? '<ol class="pt-hist">' + p.hist.map(function (x) {
        return '<li><b>' + dtBr(x.em) + '</b> · ' + esc(x.tipo === 'ajuste' ? 'Ajuste de datas' : x.tipo === 'status' ? 'Acompanhamento' : 'Conferência' + (x.antecipada ? ' antecipada' : '')) + '<span>' + esc(x.resumo || '') + '</span>'
          + (x.novos && x.novos.length ? '<span>Novos: ' + esc(x.novos.join('; ')) + '</span>' : '') + (x.alterados && x.alterados.length ? '<span>Atualizados: ' + esc(x.alterados.join('; ')) + '</span>' : '')
          + (x.proxima ? '<span>Próxima conferência: ' + dbr(x.proxima) + '</span>' : '') + (x.obs ? '<span class="pt-ob">' + esc(x.obs) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' : '<div class="empty">Nenhuma conferência registrada ainda.</div>') + '</div></details>';
    CA.drawer({
      title: p.inst || 'Portal acadêmico', sub: p.nome + ' · ' + p.situacao.t.toLowerCase(), actions: actions, body: body,
      mount: function (d) {
        d.addEventListener('click', function (e) {
          var b = e.target.closest('[data-a],[data-copy]'); if (!b) return;
          if (b.hasAttribute('data-copy')) { if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { CA.toast('Login copiado.'); }); return; }
          var k = b.getAttribute('data-a');
          if (k === 'check') formConferencia(uid);
          if (k === 'adj') formConferencia(uid, true);
          if (k === 'edit') formPortal(uid);
          if (k === 'cli') CA.openClient(p.cid);
        });
      }
    });
  }

  /* ---------- Seção na ficha do aluno ---------- */
  CA.portalClientSection = function (cid) {
    var P = CA.PT(), L = P.byCid[cid] || [];
    return '<section class="panel"><div class="panel-h"><h2>Portais acadêmicos</h2><button type="button" class="btn-ghost sm" data-ptadd="' + esc(cid) + '">' + ic('plus') + 'Adicionar portal</button></div><div class="panel-b"><div class="rows">'
      + (L.length ? L.map(rowPortal).join('') : '<div class="empty">Nenhum portal em acompanhamento.</div>') + '</div></div></section>';
  };
  function rowPortal(p) {
    var nx = p.itens.filter(function (x) { return x.k !== 'conf'; })[0];
    var right = !p.ativo ? '<span class="chip mute">' + esc(p.st) + '</span>' : p.semProg ? '<span class="pt-chip late">Sem data</span>' : chip(p.diasConf);
    return '<button type="button" class="row" data-ptopen="' + esc(p.uid) + '">' + CA.views.when(p.ativo ? p.prox : '', p.ativo ? p.diasConf : null)
      + '<div class="main"><b>' + esc(p.nome) + ' · ' + esc(p.inst) + '</b><span>' + esc(p.situacao.t) + (p.ativo && p.prox ? ' · conferir ' + dd(p.prox) : '') + (nx ? ' · ' + esc(nx.t.toLowerCase()) + ' ' + dd(nx.d) : '') + '</span></div>' + right + '</button>';
  }

  /* ================= TELA: Agenda › Portais acadêmicos ================= */
  var ag = CA.AREAS.filter(function (a) { return a.id === 'agenda'; })[0];
  if (ag && !ag.subs.some(function (s) { return s[0] === 'portais'; })) ag.subs.push(['portais', 'Portais acadêmicos']);
  CA.VIEWS['agenda/portais'] = function () {
    var P = CA.PT(), h = P.hoje, A = P.ativos;
    var grupos = [
      ['Conferências atrasadas', 'out', function (p) { return p.diasConf !== null && p.diasConf < 0; }],
      ['Sem acompanhamento programado', 'out', function (p) { return p.semProg; }],
      ['Conferir hoje', 'warn', function (p) { return p.diasConf === 0; }],
      ['Próximos 7 dias', 'act', function (p) { return p.diasConf > 0 && p.diasConf <= 7; }],
      ['Mais adiante', 'in', function (p) { return p.diasConf > 7; }]
    ];
    var n = function (f) { return A.filter(f).length; };
    var out = '<div class="page-head"><div><h1>Portais acadêmicos</h1><p>' + A.length + (A.length === 1 ? ' portal acompanhado' : ' portais acompanhados') + '. Confira só na data programada; o sistema avisa na central 2 dias antes.</p></div><div class="page-actions">'
      + '<button type="button" class="btn primary" data-act="ptNew">' + ic('plus') + 'Adicionar portal</button></div></div>';
    out += '<div class="pt-kpis">'
      + kpi('Atrasadas', n(grupos[0][2]) + n(grupos[1][2]), 'out') + kpi('Hoje', n(grupos[2][2]), 'today') + kpi('Próximos 7 dias', n(grupos[3][2]), 'mid')
      + kpi('Eventos previstos', A.reduce(function (t, p) { return t + p.abertos.length; }, 0), 'info') + kpi('Mensalistas sem portal', P.mensSemPortal.length, P.mensSemPortal.length ? 'warn' : 'ok') + '</div>';
    out += '<div class="groups">';
    var any = false;
    grupos.forEach(function (g) {
      var items = A.filter(g[2]); if (!items.length) return; any = true;
      out += grpH('pt-' + g[0], g[0], items.length, g[1], '<div class="panel-b"><div class="rows">' + items.map(rowPortal).join('') + '</div></div>', g[1] === 'out' || g[0] === 'Conferir hoje');
    });
    if (!any) out += '<div class="panel">' + CA.views.empty('Nenhum portal em acompanhamento', 'Use Adicionar portal para começar pelos mensalistas.') + '</div>';
    var inat = P.list.filter(function (p) { return !p.ativo; });
    if (inat.length) out += grpH('pt-inat', 'Suspensos e encerrados', inat.length, 'mute', '<div class="panel-b"><div class="rows">' + inat.map(rowPortal).join('') + '</div></div>');
    if (P.mensSemPortal.length) out += grpH('pt-sem', 'Mensalistas sem portal cadastrado', P.mensSemPortal.length, 'warn', '<div class="panel-b"><div class="rows">' + P.mensSemPortal.map(function (x) {
      return '<div class="row"><div class="main"><b>' + esc(x.nome) + '</b><span>' + esc(x.cid) + ((CA.M().cById[x.cid] || {}).fac ? ' · ' + esc(CA.M().cById[x.cid].fac) : '') + '</span></div><button type="button" class="btn-ghost sm" data-act="ptNew" data-cid="' + esc(x.cid) + '">' + ic('plus') + 'Adicionar portal</button></div>';
    }).join('') + '</div></div>');
    return out + '</div>';
  };
  function kpi(t, v, c) { return '<div class="pt-kpi ' + (v || c === 'ok' ? c : 'zero') + '"><b class="num">' + v + '</b><span>' + esc(t) + '</span></div>'; }
  function grpH(key, title, count, tone, body, open) {
    return '<details class="grp" data-k="' + esc(key) + '"' + (open ? ' open' : '') + '><summary><span class="tone ' + tone + '"></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '<span class="t">' + esc(title) + '</span><span class="count">' + count + '</span></summary>' + body + '</details>';
  }

  /* ---------- Ações ---------- */
  var act0 = CA.action;
  CA.action = function (act, el) {
    var g = function (a) { return el && el.getAttribute(a); };
    if (act === 'ptOpen') return openPortal(g('data-uid'));
    if (act === 'ptCheck') return formConferencia(g('data-uid'));
    if (act === 'ptNew') return formPortal(null, g('data-cid'));
    return act0.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ptopen],[data-ptadd]'); if (!b) return;
    var inV = b.closest('#view,#drawer'); if (!inV) return;
    e.stopPropagation();
    if (b.hasAttribute('data-ptopen')) openPortal(b.getAttribute('data-ptopen')); else formPortal(null, b.getAttribute('data-ptadd'));
  }, true);
  CA.openPortal = openPortal; CA.formConferencia = formConferencia; CA.formPortal = formPortal;
  CA._pt = { refOf: refOf, faixa: faixa, falta: falta, situacao: situacao, hoje: hoje }; // usado pelos testes
})(window.CA);
