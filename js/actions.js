/* Ações: fichas, formulários e montagem das gravações pelo motor oficial */
'use strict';
(function (CA) {
  var esc = CA.esc, brl = CA.brl, dbr = CA.dbr, ic = CA.icon, num = CA.num, r2 = CA.r2, $ = CA.$;
  var MES = CA.MES, MES3 = CA.MES3;

  function opts(list, sel) { return list.map(function (v) { var val = Array.isArray(v) ? v[0] : v, lab = Array.isArray(v) ? v[1] : v; return '<option value="' + esc(val) + '"' + (val === sel ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join(''); }
  function field(id, label, input, cls, hint) { return '<div class="field ' + (cls || '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</div>'; }
  function inp(id, type, val, extra) { return '<input id="' + id + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '>'; }
  function money(id, val) { return '<input id="' + id + '" type="text" inputmode="decimal" placeholder="0,00" value="' + (val || val === 0 ? esc(String(r2(val)).replace('.', ',')) : '') + '">'; }
  function sel(id, html) { return '<select id="' + id + '">' + html + '</select>'; }
  function txt(id, val) { return '<textarea id="' + id + '">' + esc(val || '') + '</textarea>'; }
  function val(m, id) { var el = m.querySelector('#' + id); return el ? el.value.trim() : ''; }
  function err(m) { return m.querySelector('.form-err'); }
  var ERR = '<p class="form-err" role="alert" hidden></p>';
  function fail(msg) { throw new Error(msg); }
  function findBy(list, k, v) { return (list || []).filter(function (x) { return x[k] === v; })[0]; }
  function clientOptions(M, selId, filter) {
    return '<option value="">Escolha o cliente…</option>' + M.clients.filter(filter || function () { return true; }).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === selId ? ' selected' : '') + '>' + esc(c.nome + (c.tel ? ' · ' + CA.telFmt(c.tel) : '') + ' · ' + c.id) + '</option>';
    }).join('');
  }
  function recordOf(data, ds, uid) { return JSON.parse(JSON.stringify(findBy(data[ds], '_uid', uid) || null)); }

  /* ---------- Despachante ---------- */
  CA.action = function (act, el) {
    var g = function (a) { return el && el.getAttribute(a); };
    var M = CA.M();
    switch (act) {
      case 'refresh': CA.pull(true).then(function () { CA.render(); CA.toast('Base atualizada.'); }).catch(function (e) { CA.toast(CA.errMsg(e), true); }); break;
      case 'go': var p = g('data-go').split('/'); CA.go(p[0], p[1]); break;
      case 'mes': CA.monthShift(g('data-k'), +g('data-d')); break;
      case 'cli': openClient(g('data-cid'), g('data-uid')); break;
      case 'sv': openService(g('data-uid')); break;
      case 'dl': openDeadline(g('data-uid')); break;
      case 'sch': openSchedule(g('data-uid')); break;
      case 'lead': formLead(g('data-uid')); break;
      case 'newClient': formClient(); break;
      case 'newMensalista': formClient(null, true); break;
      case 'payMens': formMensalidade(g('data-cid'), g('data-comp')); break;
      case 'undoMens': undoMensalidade(g('data-uid')); break;
      case 'reactivate': formReactivate(g('data-uid')); break;
      case 'newSv': formService(g('data-cid')); break;
      case 'paySv': formServicePay(g('data-uid')); break;
      case 'finish': formFinish(g('data-uid')); break;
      case 'undoSvPay': undoServicePay(g('data-uid')); break;
      case 'newDesp': formDespesa(); break;
      case 'undoDesp': undoDespesa(g('data-uid')); break;
      case 'newSch': formSchedule(); break;
      case 'newLead': formLead(); break;
      case 'newCat': formCatalog(); break;
      case 'editCat': formCatalog(g('data-uid')); break;
      case 'newAccess': formAccess(); break;
      case 'editAccess': formAccess(g('data-uid')); break;
      case 'showPw': var a = findBy(M.access, 'uid', g('data-uid')), sp = document.querySelector('[data-pw="' + CSS.escape(g('data-uid')) + '"]'); if (a && sp) sp.textContent = sp.textContent === a.senha ? '••••••••' : a.senha; break;
      case 'copy': copy(g('data-v')); break;
      case 'evoToggle': var hk = g('data-k'), hd = CA.S.ui.evoHide || (CA.S.ui.evoHide = {}); hd[hk] = !hd[hk]; CA.render(); break;
      case 'pnDre': CA.painelDrawer('dre'); break;
      case 'pnTk': CA.painelDrawer('tk'); break;
      case 'heroN': CA.S.ui.heroN = +g('data-k'); CA.render(); break;
      case 'yoyMetric': CA.S.ui.yoyMetric = g('data-k'); CA.render(); break;
    }
  };
  function copy(v) {
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { CA.toast('Copiado.'); }, function () { CA.toast('Não foi possível copiar.', true); });
  }

  /* ================= FICHA DO CLIENTE ================= */
  function openClient(cid, uid) {
    var M = CA.M(), c = (cid && M.cById[cid]) || findBy(M.clients, 'uid', uid);
    var rc = c ? M.rcByCid[c.id] : M.rcl.filter(function (x) { return x.cid === cid; })[0];
    if (!c && !rc) { CA.toast('Cliente não encontrado na base.', true); return; }
    var id = c ? c.id : rc.cid, nome = c ? c.nome : rc.nome, tel = (c && c.tel) || (rc && rc.tel) || '';
    var svs = M.services.filter(function (s) { return s.cid === id; });
    var rps = M.rpay.filter(function (p) { return p.cid === id; });
    var sps = M.spay.filter(function (p) { return p.cid === id; });
    var totPago = rps.reduce(function (t, p) { return t + p.valor; }, 0) + sps.reduce(function (t, p) { return t + p.valor; }, 0);
    var saldo = svs.reduce(function (t, s) { return t + s.saldo; }, 0);
    var acc = M.access.filter(function (a) { return a.cid === id || (a.nome && CA.normS(a.nome) === CA.normS(nome)); });
    var wa = CA.waLink(tel);
    var actions = (wa ? '<a class="btn sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + ic('wa') + 'WhatsApp</a>' : '')
      + (rc && rc.status === 'Ativo' ? '<button class="btn sm gold" data-a="pay">' + ic('coin') + 'Registrar mensalidade</button>' : '')
      + '<button class="btn sm" data-a="sv">' + ic('plus') + 'Novo serviço</button>'
      + (c ? '<button class="btn sm" data-a="edit">' + ic('edit') + 'Editar cadastro</button>' : '');
    var body = '<dl class="facts">'
      + '<div><dt>Tipo</dt><dd>' + esc(c ? c.tipo : 'Mensalista') + '</dd></div>'
      + '<div><dt>Cadastro</dt><dd>' + esc(c && c.desde ? dbr(c.desde) : '—') + '</dd></div>'
      + '<div><dt>Faculdade</dt><dd>' + esc((c && c.fac) || '—') + '</dd></div>'
      + '<div><dt>WhatsApp</dt><dd class="num">' + esc(CA.telFmt(tel) || '—') + '</dd></div>'
      + '<div><dt>Total já pago</dt><dd class="num pv in">' + brl(totPago) + '</dd></div>'
      + '<div><dt>Saldo em aberto</dt><dd class="num pv ' + (saldo > 0 ? 'warn' : '') + '">' + brl(saldo) + '</dd></div></dl>';
    if (c && c.r['Observações']) body += '<div class="note info">' + esc(c.r['Observações']) + '</div>';
    if (rc) {
      body += '<section class="panel"><div class="panel-h"><h2>Mensalidade</h2>' + CA.chipFaixa(rc) + '</div><div class="panel-b"><dl class="facts">'
        + '<div><dt>Valor do plano</dt><dd class="num pv">' + brl(rc.valor) + '</dd></div><div><dt>Vencimento</dt><dd>' + (rc.dia ? 'Todo dia ' + rc.dia : '—') + '</dd></div>'
        + '<div><dt>Próximo vencimento</dt><dd class="num">' + (rc.prox ? dbr(rc.prox) : '—') + '</dd></div><div><dt>Último pagamento</dt><dd class="num">' + (rc.ult ? dbr(rc.ult) : '—') + '</dd></div></dl>'
        + '<div class="drawer-actions" style="margin-top:12px">' + '<button class="btn-ghost sm" data-a="plan">' + ic('edit') + 'Alterar plano</button>'
        + (rc.status === 'Ativo' ? '<button class="btn-ghost sm" data-a="pause">' + ic('pause') + 'Pausar cobrança</button>' : '<button class="btn-ghost sm" data-a="react">' + ic('play') + 'Reativar</button>') + '</div></div></section>';
    }
    if (svs.length) {
      body += '<section class="panel"><div class="panel-h"><h2>Serviços</h2><span class="muted">' + svs.length + '</span></div><div class="panel-b"><div class="rows">' + svs.map(function (s) {
        return '<button type="button" class="row" data-sv="' + esc(s.uid) + '"><div class="main"><b>' + esc(s.servico) + '</b><span>' + esc(s.sid) + ' · ' + esc(s.ent) + (s.done && s.entregue ? ' em ' + CA.dshort(s.entregue) : s.prazo ? ' · prazo ' + CA.dshort(s.prazo) : '') + '</span></div><div class="val num">' + brl(s.total) + '<small>' + (s.saldo > 0 ? 'falta ' + brl(s.saldo) : 'quitado') + '</small></div></button>';
      }).join('') + '</div></div></section>';
    }
    var hist = rps.map(function (p) { return { d: p.data, t: 'Mensalidade ' + (p.comp ? CA.ymShort(p.comp).toLowerCase() : ''), v: p.valor, f: p.forma, ds: 'rp', uid: p.uid }; })
      .concat(sps.map(function (p) { return { d: p.data, t: p.servico + ' · ' + p.parcela.toLowerCase(), v: p.valor, f: p.forma, ds: 'sp', uid: p.uid }; }))
      .sort(function (a, b) { return b.d.localeCompare(a.d); });
    if (hist.length) {
      body += '<details class="grp"><summary><span class="tone in"></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '<span class="t">Pagamentos</span><span class="s num">' + brl(totPago) + '</span><span class="count">' + hist.length + '</span></summary><div class="panel-b"><div class="rows">' + hist.map(function (h) {
        return '<div class="row"><div class="main"><b>' + esc(h.t) + '</b><span>' + dbr(h.d) + (h.f ? ' · ' + esc(h.f) : '') + '</span></div><div class="val num in">' + brl(h.v) + '</div><button class="btn-ghost sm danger" data-undo="' + h.ds + '" data-uid="' + esc(h.uid) + '" aria-label="Estornar">' + ic('undo') + '</button></div>';
      }).join('') + '</div></div></details>';
    }
    if (acc.length) {
      body += '<section class="panel"><div class="panel-h"><h2>Acesso ao portal</h2></div><div class="panel-b">' + acc.map(function (a) {
        return '<dl class="facts"><div><dt>Faculdade</dt><dd>' + esc(a.fac || '—') + '</dd></div><div><dt>Login</dt><dd class="num">' + esc(a.login || '—') + '</dd></div><div><dt>Senha</dt><dd class="num"><span data-pw2>••••••••</span> <button class="btn-ghost sm" data-showpw="' + esc(a.uid) + '">' + ic('eye') + 'Ver</button></dd></div></dl>';
      }).join('') + '</div></section>';
    }
    if (!svs.length && !hist.length && !rc) body += '<div class="empty"><b>Sem movimentação ainda</b>Lance um serviço ou cadastre como mensalista.</div>';
    CA.drawer({
      title: nome, sub: id + (rc ? ' · mensalista ' + rc.status.toLowerCase() : c ? ' · ' + c.tipo.toLowerCase() : ''), actions: actions, body: body,
      mount: function (d) {
        d.addEventListener('click', function (e) {
          var b = e.target.closest('[data-a],[data-sv],[data-undo],[data-showpw]'); if (!b) return;
          if (b.hasAttribute('data-sv')) return openService(b.getAttribute('data-sv'));
          if (b.hasAttribute('data-undo')) return b.getAttribute('data-undo') === 'rp' ? undoMensalidade(b.getAttribute('data-uid')) : undoServicePay(b.getAttribute('data-uid'));
          if (b.hasAttribute('data-showpw')) { var a = findBy(M.access, 'uid', b.getAttribute('data-showpw')); var s = b.parentNode.querySelector('[data-pw2]'); if (a && s) s.textContent = s.textContent === a.senha ? '••••••••' : (a.senha || '—'); return; }
          var k = b.getAttribute('data-a');
          if (k === 'pay') formMensalidade(id);
          if (k === 'sv') formService(id);
          if (k === 'edit') formClient(c.uid);
          if (k === 'plan') formPlan(rc.uid);
          if (k === 'pause') pauseMensalista(rc.uid);
          if (k === 'react') formReactivate(rc.uid);
        });
      }
    });
  }

  /* ================= CLIENTE: novo / editar / mensalista ================= */
  function formClient(uid, asMens) {
    var M = CA.M(), c = uid ? findBy(M.clients, 'uid', uid) : null, rc = c ? M.rcByCid[c.id] : null;
    var tipos = ['Cliente não recorrente', 'Cliente recorrente', 'Contato comercial', 'Recorrente arquivado'];
    var body = '<div class="form-grid">'
      + field('fNome', 'Nome', inp('fNome', 'text', c ? c.nome : '', ' autocomplete="off" required'), '')
      + field('fTel', 'WhatsApp', inp('fTel', 'tel', c ? CA.telFmt(c.tel) : '', ' inputmode="tel" placeholder="(11) 9 9999-9999"'), '')
      + field('fFac', 'Faculdade', inp('fFac', 'text', c ? c.fac : ''), '')
      + field('fTipo', 'Tipo', sel('fTipo', opts(tipos, c ? c.tipo : (asMens ? 'Cliente recorrente' : 'Cliente não recorrente'))), '')
      + field('fObs', 'Observações', txt('fObs', c ? c.r['Observações'] : ''), 'full');
    if (!rc) {
      body += '<div class="field full"><label class="check"><input type="checkbox" id="fMens"' + (asMens ? ' checked' : '') + '> Cobrar mensalidade (mensalista)</label></div>'
        + '<div class="form-grid full" id="mensBox"' + (asMens ? '' : ' hidden') + '>'
        + field('fValor', 'Valor mensal', money('fValor', ''), '')
        + field('fDia', 'Dia do vencimento', inp('fDia', 'number', '', ' min="1" max="31" inputmode="numeric"'), '')
        + field('fIni', 'Início do plano', inp('fIni', 'date', CA.today()), '')
        + field('fProx', 'Primeira cobrança', inp('fProx', 'date', ''), '', 'Calculada pelo dia do vencimento. Ajuste se precisar.')
        + '</div>';
    }
    body += '</div>' + ERR;
    CA.modal({
      title: c ? 'Editar cadastro' : asMens ? 'Novo mensalista' : 'Novo cliente', sub: c ? c.id + ' · ' + c.nome : 'O cadastro entra direto na base oficial.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: c ? 'Salvar alterações' : 'Cadastrar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        var mc = m.querySelector('#fMens');
        var calc = function () {
          var dia = parseInt(val(m, 'fDia'), 10), ini = val(m, 'fIni');
          if (dia >= 1 && dia <= 31 && CA.isISO(ini)) { var due = CA.dueIn(ini.slice(0, 7), dia); if (due < ini) due = CA.proxVenc(ini.slice(0, 7), dia); m.querySelector('#fProx').value = due; }
        };
        if (mc) {
          mc.onchange = function () { m.querySelector('#mensBox').hidden = !mc.checked; if (mc.checked) m.querySelector('#fTipo').value = 'Cliente recorrente'; };
          m.querySelector('#fDia').oninput = calc; m.querySelector('#fIni').onchange = calc;
        }
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var nome = val(m, 'fNome').replace(/\s+/g, ' '), tel = CA.telDig(val(m, 'fTel'));
            if (nome.length < 2) fail('Informe o nome do cliente.');
            if (tel && tel.length < 10) fail('Telefone incompleto. Use DDD + número.');
            var mens = mc && mc.checked, mv, dia, ini, prox;
            if (mens) {
              mv = CA.numOrNaN(val(m, 'fValor')); dia = parseInt(val(m, 'fDia'), 10); ini = val(m, 'fIni'); prox = val(m, 'fProx');
              if (!(mv > 0)) fail('Informe o valor mensal.');
              if (!(dia >= 1 && dia <= 31)) fail('Dia do vencimento deve ser de 1 a 31.');
              if (!CA.isISO(ini) || !CA.isISO(prox)) fail('Informe o início do plano e a primeira cobrança.');
            }
            var data = await CA.fresh(), ts = CA.ts(), ops = [];
            if (tel) {
              var dup = (data.clients || []).filter(function (x) { return CA.telDig(x.WhatsApp) === tel && (!c || x._uid !== c.uid); })[0];
              if (dup) fail('Este WhatsApp já está no cadastro de ' + (dup.Nome || '') + ' (' + (dup['ID Cliente'] || '') + ').');
            }
            var rec, cid;
            if (c) {
              rec = recordOf(data, 'clients', c.uid); if (!rec) fail('O cadastro não existe mais na base. Atualize a tela.');
              cid = rec['ID Cliente'];
              Object.assign(rec, { Nome: nome, WhatsApp: tel ? CA.telFmt(tel) : '', Faculdade: val(m, 'fFac'), Tipo: val(m, 'fTipo'), 'Observações': val(m, 'fObs'), _userEdited: '1' }, CA.editor(ts));
            } else {
              cid = CA.nextClientId(data);
              rec = Object.assign({ _uid: 'clients_web_' + CA.slug(nome) + '_' + CA.stamp8() + '_' + CA.rnd(4), 'ID Cliente': cid, _clientId: cid, _clientKey: CA.chaveCli(nome, tel), Nome: nome, WhatsApp: tel ? CA.telFmt(tel) : '', Faculdade: val(m, 'fFac'), Tipo: val(m, 'fTipo'), 'Status Cadastro': 'Ativo', 'Data Cadastro': CA.today(), 'Observações': val(m, 'fObs'), _createdAt: ts, _editedAt: ts }, CA.creator());
              var rv = revive(data, [rec._clientKey, rec._clientKey.split('|')[0] + '|semfone']); if (rv) ops.push(rv);
            }
            ops.unshift({ type: 'upsert', dataset: 'clients', uid: rec._uid, record: rec });
            if (mens) {
              var hoje = CA.today(), dd = CA.days(hoje, prox);
              var r = Object.assign({ _uid: 'recurringClients_web_' + CA.slug(nome) + '_' + CA.rnd(4), 'ID Cliente': cid, _clientId: cid, _clientKey: rec._clientKey, Cliente: nome, WhatsApp: rec.WhatsApp, 'E-mail': '', Plano: 'Mensal', Status: 'Ativo', 'Situação': dd < 0 ? 'Mensalidade em atraso' : dd <= 7 ? 'Vence em até 7 dias' : 'Em dia', 'Valor Mensal': String(mv), 'Dia Vencimento': dia, 'Início do Plano': ini, 'Próximo Vencimento': prox, 'Ajuste Próximo Vencimento': prox, 'Último Pagamento': '', 'Dias p/ Próximo': dd, 'Rank Atraso': '', 'Forma Preferida': 'Pix', 'Data Pausa': '', 'Data Arquivamento': '', 'Data Reativação': '', 'Retomar Cobrança em': '', 'Observações': '', _manualNextDue: '', _manualRecurringEdit: '1', _createdAt: ts, _editedAt: ts }, CA.creator());
              ops.push({ type: 'upsert', dataset: 'recurringClients', uid: r._uid, record: r });
              if (rec.Tipo !== 'Cliente recorrente') { rec.Tipo = 'Cliente recorrente'; }
            }
            await CA.commit(ops, c ? 'cliente-edicao' : 'cliente-novo', c ? 'Cadastro atualizado.' : 'Cliente ' + cid + ' cadastrado.');
            CA.closeLayers();
            if (!c) setTimeout(function () { openClient(cid); }, 60);
          });
        };
      }
    });
  }
  /* Remove chaves das listas de excluídos quando um cliente/serviço é cadastrado de novo (mesma regra do artefato). */
  function revive(data, keys) {
    var meta = CA.businessMeta(data), hit = false;
    ['deletedClientKeys', 'deletedOperationalProjectKeys'].forEach(function (k) {
      if (!Array.isArray(meta[k])) return;
      var before = meta[k].length; meta[k] = meta[k].filter(function (x) { return keys.indexOf(String(x)) < 0; }); if (meta[k].length !== before) hit = true;
    });
    if (Array.isArray(meta.deletedOperationalProjects)) {
      var b2 = meta.deletedOperationalProjects.length;
      meta.deletedOperationalProjects = meta.deletedOperationalProjects.filter(function (x) { return !(x && Array.isArray(x.keys) && x.keys.some(function (y) { return keys.indexOf(String(y)) >= 0; })); });
      if (meta.deletedOperationalProjects.length !== b2) hit = true;
    }
    return hit ? { type: 'set_meta', value: meta } : null;
  }

  function formPlan(uid) {
    var M = CA.M(), rc = findBy(M.rcl, 'uid', uid); if (!rc) return;
    CA.modal({
      title: 'Alterar plano', sub: rc.nome + ' · ' + rc.cid,
      body: '<div class="form-grid">' + field('pV', 'Valor mensal', money('pV', rc.valor)) + field('pD', 'Dia do vencimento', inp('pD', 'number', rc.dia || '', ' min="1" max="31"'))
        + field('pP', 'Próximo vencimento', inp('pP', 'date', rc.prox)) + field('pF', 'Forma preferida', sel('pF', opts(CA.FORMAS, rc.forma)))
        + field('pO', 'Observações', txt('pO', rc.obs), 'full') + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Salvar plano', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var v = CA.numOrNaN(val(m, 'pV')), d = parseInt(val(m, 'pD'), 10), p = val(m, 'pP');
            if (!(v > 0)) fail('Informe o valor mensal.'); if (!(d >= 1 && d <= 31)) fail('Dia do vencimento deve ser de 1 a 31.'); if (!CA.isISO(p)) fail('Informe o próximo vencimento.');
            var data = await CA.fresh(), r = recordOf(data, 'recurringClients', uid); if (!r) fail('Mensalista não encontrado. Atualize a tela.');
            var ts = CA.ts(), dd = CA.days(CA.today(), p);
            Object.assign(r, { 'Valor Mensal': String(v), 'Dia Vencimento': d, 'Próximo Vencimento': p, 'Ajuste Próximo Vencimento': p, 'Dias p/ Próximo': dd, 'Situação': r.Status === 'Ativo' ? (dd < 0 ? 'Mensalidade em atraso' : dd <= 7 ? 'Vence em até 7 dias' : 'Em dia') : r['Situação'], 'Forma Preferida': val(m, 'pF'), 'Observações': val(m, 'pO'), _manualRecurringEdit: '1', _userEdited: '1' }, CA.editor(ts));
            await CA.commit([{ type: 'upsert', dataset: 'recurringClients', uid: uid, record: r }], 'plano', 'Plano atualizado.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  async function pauseMensalista(uid) {
    var rc = findBy(CA.M().rcl, 'uid', uid); if (!rc) return;
    if (!(await CA.confirm('Pausar cobrança', '<b>' + esc(rc.nome) + '</b> deixa de aparecer nas cobranças até ser reativado. Nenhum pagamento é apagado.', 'Pausar'))) return;
    try {
      var data = await CA.fresh(), r = recordOf(data, 'recurringClients', uid), ts = CA.ts();
      Object.assign(r, { Status: 'Pausado', 'Situação': 'Pausado - sem cobrança', 'Data Pausa': CA.today(), _pauseIndefinite: '1', 'Dias p/ Próximo': '', 'Rank Atraso': '' }, CA.editor(ts));
      await CA.commit([{ type: 'upsert', dataset: 'recurringClients', uid: uid, record: r }], 'pausa', 'Cobrança pausada.');
      CA.closeLayers();
    } catch (e) { CA.toast(CA.errMsg(e), true); }
  }
  function formReactivate(uid) {
    var rc = findBy(CA.M().rcl, 'uid', uid); if (!rc) return;
    var sug = rc.dia ? CA.dueIn(CA.today().slice(0, 7), rc.dia) : CA.today(); if (sug < CA.today() && rc.dia) sug = CA.proxVenc(CA.today().slice(0, 7), rc.dia);
    if (rc.prox && rc.prox > sug) sug = rc.prox; // pagamento antecipado já cobre meses à frente
    CA.modal({
      title: 'Reativar mensalista', sub: rc.nome + ' · ' + brl(rc.valor) + ' por mês',
      body: '<div class="form-grid">' + field('rP', 'Próxima cobrança', inp('rP', 'date', sug)) + field('rV', 'Valor mensal', money('rV', rc.valor)) + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Reativar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var p = val(m, 'rP'), v = CA.numOrNaN(val(m, 'rV'));
            if (!CA.isISO(p)) fail('Informe a próxima cobrança.'); if (!(v > 0)) fail('Informe o valor mensal.');
            var data = await CA.fresh(), r = recordOf(data, 'recurringClients', uid), ts = CA.ts(), dd = CA.days(CA.today(), p), ops = [];
            Object.assign(r, { Status: 'Ativo', 'Situação': dd < 0 ? 'Mensalidade em atraso' : dd <= 7 ? 'Vence em até 7 dias' : 'Em dia', 'Valor Mensal': String(v), 'Data Reativação': CA.today(), 'Próximo Vencimento': p, 'Ajuste Próximo Vencimento': p, 'Dias p/ Próximo': dd, _recurringReactivatedAt: ts, _pauseIndefinite: '', 'Data Pausa': '' }, CA.editor(ts));
            ops.push({ type: 'upsert', dataset: 'recurringClients', uid: uid, record: r });
            var cl = findBy(data.clients, 'ID Cliente', r['ID Cliente']);
            if (cl && cl.Tipo !== 'Cliente recorrente') { cl = JSON.parse(JSON.stringify(cl)); Object.assign(cl, { Tipo: 'Cliente recorrente', _recurringReactivatedAt: ts }, CA.editor(ts)); ops.push({ type: 'upsert', dataset: 'clients', uid: cl._uid, record: cl }); }
            await CA.commit(ops, 'reativacao', 'Mensalista reativado.');
            CA.closeLayers();
          });
        };
      }
    });
  }

  /* ================= MENSALIDADE ================= */
  function formMensalidade(cid, comp) {
    var M = CA.M(), ativos = M.rcl.filter(function (x) { return x.status === 'Ativo'; });
    if (!ativos.length) { CA.toast('Nenhum mensalista ativo. Cadastre um mensalista primeiro.', true); return; }
    var body = '<div class="form-grid">'
      + field('mC', 'Mensalista', sel('mC', '<option value="">Escolha…</option>' + ativos.map(function (x) { return '<option value="' + esc(x.cid) + '"' + (x.cid === cid ? ' selected' : '') + '>' + esc(x.nome + ' · ' + brl(x.valor) + ' · ' + x.cid) + '</option>'; }).join('')), 'full')
      + field('mComp', 'Competência (mês pago)', inp('mComp', 'month', comp || ''), '')
      + field('mD', 'Data do pagamento', inp('mD', 'date', CA.today(), ' max="' + CA.today() + '"'), '')
      + field('mV', 'Valor recebido', money('mV', ''), '')
      + field('mF', 'Forma', sel('mF', opts(CA.FORMAS, 'Pix')), '')
      + field('mO', 'Observação (opcional)', inp('mO', 'text', ''), 'full')
      + '</div><div id="mInfo" class="review" style="margin-top:14px" hidden></div>' + ERR;
    CA.modal({
      title: 'Registrar mensalidade', sub: 'Grava o pagamento, o lançamento no financeiro e atualiza o próximo vencimento.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Registrar pagamento', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        var fill = function (keepComp) {
          var x = M.rcByCid[val(m, 'mC')]; if (!x) { m.querySelector('#mInfo').hidden = true; return; }
          if (!keepComp || !val(m, 'mComp')) {
            var last = M.rpay.filter(function (p) { return p.cid === x.cid && p.comp; }).map(function (p) { return p.comp; }).sort().pop();
            m.querySelector('#mComp').value = last ? CA.ymAdd(last, 1) : (x.prox ? x.prox.slice(0, 7) : CA.today().slice(0, 7));
          }
          if (!val(m, 'mV')) m.querySelector('#mV').value = String(x.valor).replace('.', ',');
          m.querySelector('#mF').value = CA.FORMAS.indexOf(x.forma) >= 0 ? x.forma : 'Pix';
          info();
        };
        var info = function () {
          var x = M.rcByCid[val(m, 'mC')], c = val(m, 'mComp'), box = m.querySelector('#mInfo');
          if (!x || !/^\d{4}-\d{2}$/.test(c)) { box.hidden = true; return; }
          var dup = M.rpay.some(function (p) { return p.cid === x.cid && p.comp === c; });
          var prox = x.dia ? CA.proxVenc(c, x.dia) : '';
          if (x.prox && prox && x.prox > prox) prox = x.prox;
          box.hidden = false;
          box.innerHTML = '<span>Plano de <b>' + brl(x.valor) + '</b>, vence todo dia ' + (x.dia || '—') + '.</span><span>Último pagamento: <b>' + (x.ult ? dbr(x.ult) : 'nenhum') + '</b>. Próximo vencimento depois deste: <b>' + (prox ? dbr(prox) : '—') + '</b>.</span>'
            + (dup ? '<span class="out"><b>Já existe pagamento desta competência.</b> Escolha outro mês ou estorne o anterior.</span>' : '');
        };
        m.querySelector('#mC').onchange = function () { m.querySelector('#mV').value = ''; fill(false); };
        m.querySelector('#mComp').onchange = info;
        if (cid) fill(!!comp);
        m.querySelector('#bOk').onclick = function () {
          var b = this;
          CA.run(b, err(m), async function () {
            var data = await CA.fresh(), M2 = CA.M();
            var x = M2.rcByCid[val(m, 'mC')], c = val(m, 'mComp'), d = val(m, 'mD'), v = CA.numOrNaN(val(m, 'mV')), forma = val(m, 'mF') || 'Pix', obsX = val(m, 'mO');
            if (!x) fail('Escolha o mensalista.');
            if (x.status !== 'Ativo') fail('Este mensalista está ' + x.status.toLowerCase() + '. Reative antes de registrar.');
            if (!x.dia) fail('Mensalista sem dia de vencimento. Ajuste o plano primeiro.');
            if (!/^\d{4}-\d{2}$/.test(c)) fail('Informe a competência.');
            if (!CA.isISO(d)) fail('Informe a data do pagamento.');
            if (d > CA.today()) fail('A data do pagamento não pode ser no futuro.');
            if (!(v > 0)) fail('Informe o valor recebido.');
            if (M2.rpay.some(function (p) { return p.cid === x.cid && p.comp === c; })) fail('Já existe pagamento de ' + CA.ymShort(c).toLowerCase() + ' para este mensalista.');
            var rcRec = recordOf(data, 'recurringClients', x.uid); if (!rcRec) fail('Ficha do mensalista não encontrada. Atualize a tela.');
            var ops = buildMensalidade(data, rcRec, x, { comp: c, data: d, valor: v, forma: forma, obs: obsX });
            var diff = r2(v - x.valor), sig = x.cid + '|' + v;
            if (Math.abs(diff) > 0.005 && m.getAttribute('data-ok') !== sig) {
              m.setAttribute('data-ok', sig);
              var box = m.querySelector('#mInfo'); box.hidden = false;
              box.insertAdjacentHTML('beforeend', '<span class="warn"><b>Valor diferente do plano (' + brl(x.valor) + ').</b> ' + (diff < 0 ? 'Fica registrado como pagamento parcial, com ' + brl(-diff) + ' em aberto.' : 'O excedente de ' + brl(diff) + ' fica registrado na diferença.') + ' Toque de novo para confirmar.</span>');
              b.disabled = false; b.textContent = 'Confirmar com este valor'; return;
            }
            await CA.commit(ops, 'mensalidade', 'Mensalidade de ' + x.nome + ' registrada.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function buildMensalidade(data, rcRec, x, l) {
    var ts = CA.ts(), hoje = CA.today(), dia = x.dia, rm = l.data.slice(0, 7), ant = l.comp > rm, nome = rcRec.Cliente || x.nome;
    var calc = CA.proxVenc(l.comp, dia), prox = x.prox && x.prox > calc ? x.prox : calc;
    var ult = x.ult && x.ult > l.data ? x.ult : l.data;
    var dd = l.data.split('-').reverse().join('/'), obs;
    if (ant) obs = 'Mensalidade de ' + CA.ymShort(l.comp).toLowerCase() + ' paga antecipadamente em ' + dd + ' via ' + l.forma + '.';
    else if (l.comp === rm && +l.data.slice(8, 10) > dia) { var at = +l.data.slice(8, 10) - dia; obs = 'Pagamento via ' + l.forma + ' em ' + dd + ', ' + at + (at > 1 ? ' dias' : ' dia') + ' após o vencimento (' + CA.dbr(CA.dueIn(l.comp, dia)) + ').'; }
    else obs = 'Pagamento de ' + CA.ymShort(l.comp).toLowerCase() + ' via ' + l.forma + ' em ' + dd + '.';
    if (l.obs) obs += ' ' + l.obs;
    var diff = r2(l.valor - x.valor), parcial = diff < -0.005;
    var cm = +l.comp.slice(5) - 1, rmi = +rm.slice(5) - 1, base = CA.slug(nome) + '_' + CA.stamp8(l.data) + '_' + MES3[cm] + '_' + Math.round(l.valor) + '_' + CA.rnd(4);
    var rpU = 'recurringPayments_web_' + base, feU = 'financeEntries_web_' + base, key = rcRec._clientKey || x.key, tel = rcRec.WhatsApp || x.tel || '';
    var cr = CA.creator();
    var rp = Object.assign({ _uid: rpU, Ano: +l.comp.slice(0, 4), 'Mês': MES[cm], 'Mês Nº': cm + 1, Cliente: nome, WhatsApp: tel, _clientId: x.cid, _clientKey: key, 'Competência': l.comp + '-01', 'Observações': obs, 'Valor Recebido': l.valor, 'Forma Pagamento': l.forma, 'Tipo de pagador': 'Pessoa física', 'Data Recebimento': l.data, 'Tipo de Lançamento': ant ? 'Pagamento antecipado' : 'Pagamento mensal', 'Saldo da Mensalidade': parcial ? diff : 0, 'Diferença': diff, 'Status da Mensalidade': parcial ? 'Mensalidade parcial' : ant ? 'Mensalidade antecipada quitada' : 'Mensalidade quitada', 'Valor Mensal Previsto': x.valor, 'Data Prevista Próx. Pgto': prox, _financeUid: feU, _idempotencyKeyV470: 'recurringPayments::' + nome.toLowerCase() + '||' + l.comp + '::' + l.data + '::' + l.valor.toFixed(2) + '::pagamento mensal::' + l.forma.toLowerCase(), _createdAt: ts, _editedAt: ts }, cr);
    var fe = Object.assign({ _uid: feU, ID: CA.maxNum(data.financeEntries, 'ID') + 1, Ano: +l.data.slice(0, 4), Data: l.data, 'Mês': MES[rmi], 'Mês Nº': rmi + 1, Status: 'Recebido', Cliente: nome, WhatsApp: tel, _linkDs: 'recurringPayments', _linkUid: rpU, _clientId: x.cid, _clientKey: key, 'Cliente vinculado': key, 'Serviço': 'Pagamento recorrente ' + nome + ' · ' + CA.ymShort(l.comp), 'Despesa/Custo': 0, 'Observações': obs, 'Valor Líquido': l.valor, 'Receita Recebida': l.valor, 'Taxas/Descontos': 0, 'Tipo de pagador': 'Pessoa física', 'Considerar no DRE?': 1, 'Forma de Pagamento': l.forma, 'Natureza do Movimento': 'Operacional', 'Classificação Financeira': 'receita operacional', _autoPaymentSig: 'recurringPayments|' + nome.toLowerCase() + '|' + l.data + '|' + l.comp + '||' + l.valor + '|pagamento mensal|' + l.forma.toLowerCase(), _createdAt: ts, _editedAt: ts }, cr);
    var em = prox < hoje, dias = CA.days(hoje, prox);
    var rc = Object.assign(rcRec, { 'Último Pagamento': ult, 'Próximo Vencimento': prox, 'Ajuste Próximo Vencimento': prox, 'Situação': em ? 'Mensalidade em atraso' : dias <= 7 ? 'Vence em até 7 dias' : 'Em dia', 'Dias p/ Próximo': dias }, CA.editor(ts));
    if (!em) rc['Rank Atraso'] = '';
    return [
      { type: 'upsert', dataset: 'recurringPayments', uid: rpU, record: rp },
      { type: 'upsert', dataset: 'financeEntries', uid: feU, record: fe },
      { type: 'upsert', dataset: 'recurringClients', uid: rc._uid, record: rc }
    ];
  }
  async function undoMensalidade(uid) {
    var M = CA.M(), p = findBy(M.rpay, 'uid', uid);
    if (!p) { CA.toast('Pagamento não encontrado. Atualize a tela.', true); return; }
    var ok = await CA.confirm('Estornar mensalidade', 'Vou apagar o pagamento de <b>' + esc(CA.clientName(p.cid, p.nome)) + '</b> (' + brl(p.valor) + ', competência ' + esc(p.comp ? CA.ymShort(p.comp).toLowerCase() : '—') + ', pago em ' + dbr(p.data) + ') e o lançamento ligado a ele no financeiro. O vencimento do mensalista volta para antes deste pagamento. Depois você pode lançar de novo.', 'Estornar', true);
    if (!ok) return;
    try {
      var data = await CA.fresh(), rp = recordOf(data, 'recurringPayments', uid); if (!rp) fail('Este pagamento já não existe na base.');
      var ops = [{ type: 'delete', dataset: 'recurringPayments', uid: uid }];
      (data.financeEntries || []).forEach(function (f) { if ((rp._financeUid && f._uid === rp._financeUid) || (f._linkDs === 'recurringPayments' && f._linkUid === uid)) ops.push({ type: 'delete', dataset: 'financeEntries', uid: f._uid }); });
      var cid = rp._clientId, comp = CA.normDate(rp['Competência']).slice(0, 7), ts = CA.ts();
      var rcRec = (data.recurringClients || []).filter(function (r) { return (r['ID Cliente'] || r._clientId) === cid; })[0];
      if (rcRec && /^\d{4}-\d{2}$/.test(comp)) {
        rcRec = JSON.parse(JSON.stringify(rcRec));
        var dia = parseInt(rcRec['Dia Vencimento'], 10), rest = (data.recurringPayments || []).filter(function (x) { return x._clientId === cid && x._uid !== uid; });
        var lastComp = rest.map(function (x) { return CA.normDate(x['Competência']).slice(0, 7); }).filter(function (v) { return /^\d{4}-\d{2}$/.test(v); }).sort().pop() || '';
        var lastPay = rest.map(function (x) { return CA.normDate(x['Data Recebimento']); }).filter(CA.isISO).sort().pop() || '';
        var curProx = CA.normDate(rcRec['Próximo Vencimento'] || rcRec['Ajuste Próximo Vencimento']);
        if (dia >= 1 && (!lastComp || comp >= lastComp)) {
          var np = CA.proxVenc(lastComp && lastComp > CA.ymAdd(comp, -1) ? lastComp : CA.ymAdd(comp, -1), dia);
          if (!curProx || curProx >= np) {
            var dd = CA.days(CA.today(), np);
            Object.assign(rcRec, { 'Próximo Vencimento': np, 'Ajuste Próximo Vencimento': np, 'Dias p/ Próximo': dd, 'Situação': rcRec.Status === 'Ativo' ? (dd < 0 ? 'Mensalidade em atraso' : dd <= 7 ? 'Vence em até 7 dias' : 'Em dia') : rcRec['Situação'] });
          }
        }
        rcRec['Último Pagamento'] = lastPay;
        Object.assign(rcRec, CA.editor(ts));
        ops.push({ type: 'upsert', dataset: 'recurringClients', uid: rcRec._uid, record: rcRec });
      }
      var meta = CA.businessMeta(data);
      meta.deletedRecurringCompetences = (Array.isArray(meta.deletedRecurringCompetences) ? meta.deletedRecurringCompetences : []).concat([{ key: CA.normS(rp.Cliente || '').trim() + '|' + comp, source: 'financeEntries', cliente: rp.Cliente || '', deletedAt: ts, competencia: comp }]);
      ops.push({ type: 'set_meta', value: meta });
      await CA.commit(ops, 'estorno-mensalidade', 'Mensalidade estornada.');
      CA.closeLayers();
    } catch (e) { CA.toast(CA.errMsg(e), true); }
  }

  /* ================= SERVIÇOS ================= */
  function formService(cid) {
    var M = CA.M();
    var body = '<div class="form-grid">'
      + '<div class="field full"><label>Cliente</label><div class="seg" role="group" aria-label="Cliente"><button type="button" data-cm="old" aria-pressed="true">Já cadastrado</button><button type="button" data-cm="new" aria-pressed="false">Cliente novo</button></div></div>'
      + '<div class="full" id="cOld">' + field('sC', 'Escolha o cliente', sel('sC', clientOptions(M, cid))) + '</div>'
      + '<div class="form-grid full" id="cNew" hidden>' + field('sNN', 'Nome do cliente novo', inp('sNN', 'text', '')) + field('sNT', 'WhatsApp', inp('sNT', 'tel', '', ' inputmode="tel"')) + '</div>'
      + field('sS', 'Serviço', '<input id="sS" list="svNames" autocomplete="off"><datalist id="svNames">' + M.serviceNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>', '')
      + field('sVinc', 'Tipo', sel('sVinc', opts([['eventual', 'Serviço eventual'], ['extra', 'Extra de mensalista']], 'eventual')), '')
      + field('sT', 'Valor total', money('sT', ''), '')
      + field('sDC', 'Data da contratação', inp('sDC', 'date', CA.today()), '')
      + field('sPz', 'Prazo de entrega', inp('sPz', 'date', ''), '')
      + field('sPg', 'Pagamento agora', sel('sPg', opts([['none', 'Nada recebido ainda'], ['entrada', 'Entrada (parte do valor)'], ['unico', 'Pagamento integral']], 'none')), '')
      + '<div class="form-grid full" id="pBox" hidden>' + field('sPV', 'Valor recebido', money('sPV', '')) + field('sPD', 'Data do pagamento', inp('sPD', 'date', CA.today(), ' max="' + CA.today() + '"')) + field('sPF', 'Forma', sel('sPF', opts(CA.FORMAS, 'Pix'))) + field('sPP', 'Próximo pagamento previsto', inp('sPP', 'date', '')) + '</div>'
      + field('sO', 'Observações', txt('sO', ''), 'full') + '</div>' + ERR;
    CA.modal({
      title: 'Novo serviço', sub: 'Cria o serviço, o prazo de entrega e, se houver, o recebimento no financeiro.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Lançar serviço', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        var mode = 'old';
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelectorAll('[data-cm]').forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-cm'); m.querySelectorAll('[data-cm]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); m.querySelector('#cOld').hidden = mode !== 'old'; m.querySelector('#cNew').hidden = mode !== 'new'; if (mode === 'new') m.querySelector('#sVinc').value = 'eventual'; }; });
        var setVinc = function () { var rc = M.rcByCid[val(m, 'sC')]; m.querySelector('#sVinc').value = rc && rc.status === 'Ativo' ? 'extra' : 'eventual'; };
        m.querySelector('#sC').onchange = setVinc; if (cid) setVinc();
        m.querySelector('#sS').onchange = function () { var c = M.catalog.filter(function (x) { return CA.normS(x.nome) === CA.normS(val(m, 'sS')); })[0]; if (c && !val(m, 'sT') && c.valor) m.querySelector('#sT').value = String(c.promo || c.valor).replace('.', ','); };
        var pg = m.querySelector('#sPg'); pg.onchange = function () { m.querySelector('#pBox').hidden = pg.value === 'none'; if (pg.value === 'unico') m.querySelector('#sPV').value = val(m, 'sT'); };
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var servico = val(m, 'sS').replace(/\s+/g, ' '), total = CA.numOrNaN(val(m, 'sT')), dc = val(m, 'sDC'), pz = val(m, 'sPz'), pgm = val(m, 'sPg'), extra = val(m, 'sVinc') === 'extra';
            if (!servico) fail('Informe o serviço.'); if (!(total > 0)) fail('Informe o valor total.'); if (!CA.isISO(dc)) fail('Informe a data da contratação.'); if (!CA.isISO(pz)) fail('Informe o prazo de entrega.');
            if (pz < dc) fail('O prazo de entrega é anterior à contratação.');
            var pv = 0, pd = '', pf = 'Pix', pp = '';
            if (pgm !== 'none') {
              pv = CA.numOrNaN(val(m, 'sPV')); pd = val(m, 'sPD'); pf = val(m, 'sPF'); pp = val(m, 'sPP');
              if (!(pv > 0)) fail('Informe o valor recebido.'); if (!CA.isISO(pd)) fail('Informe a data do pagamento.'); if (pd > CA.today()) fail('A data do pagamento não pode ser no futuro.');
              if (pv > total + 0.005) fail('O valor recebido é maior que o total.');
              if (pgm === 'unico' && Math.abs(pv - total) > 0.005) fail('Pagamento integral precisa ser igual ao total. Use Entrada para parte do valor.');
              if (pgm === 'entrada' && pv >= total - 0.005) fail('Entrada igual ao total. Escolha Pagamento integral.');
            }
            var data = await CA.fresh(), ts = CA.ts(), ops = [], cli;
            if (mode === 'new') {
              var nn = val(m, 'sNN').replace(/\s+/g, ' '), nt = CA.telDig(val(m, 'sNT'));
              if (nn.length < 2) fail('Informe o nome do cliente novo.'); if (nt.length < 10) fail('Informe o WhatsApp do cliente novo com DDD.');
              var dup = (data.clients || []).filter(function (x) { return CA.telDig(x.WhatsApp) === nt; })[0];
              if (dup) fail('Este WhatsApp já é de ' + dup.Nome + ' (' + dup['ID Cliente'] + '). Escolha em Já cadastrado.');
              var ncid = CA.nextClientId(data);
              cli = Object.assign({ _uid: 'clients_web_' + CA.slug(nn) + '_' + CA.stamp8() + '_' + CA.rnd(4), 'ID Cliente': ncid, _clientId: ncid, _clientKey: CA.chaveCli(nn, nt), Nome: nn, WhatsApp: CA.telFmt(nt), Faculdade: '', Tipo: 'Cliente não recorrente', 'Status Cadastro': 'Ativo', 'Data Cadastro': dc, 'Observações': 'Cadastro feito junto com o lançamento de serviço.', _createdAt: ts, _editedAt: ts }, CA.creator());
              ops.push({ type: 'upsert', dataset: 'clients', uid: cli._uid, record: cli });
            } else {
              cli = findBy(data.clients, 'ID Cliente', val(m, 'sC')); if (!cli) fail('Escolha o cliente.');
            }
            var cidX = cli['ID Cliente'], key = cli._clientKey || CA.chaveCli(cli.Nome, cli.WhatsApp), nome = cli.Nome, tel = cli.WhatsApp || '';
            if ((data.services || []).some(function (s) { return s._clientId === cidX && CA.normS(s['Serviço/Projeto']) === CA.normS(servico) && CA.normDate(s['Data Contratação']) === dc && Math.abs(num(s['Valor Total Contratado']) - total) < 0.005; })) fail('Já existe este serviço para o cliente nesta data com o mesmo valor.');
            var svId = CA.nextCode(data.services, 'ID Serviço', 'SV-'), rnd = CA.rnd(4), base = CA.slug(nome) + '_' + CA.stamp8(dc) + '_' + rnd;
            var svUid = 'services_web_' + base, quit = pgm !== 'none' && Math.abs(pv - total) < 0.005, rec = r2(pv), saldo = quit ? 0 : r2(total - rec);
            var fin = quit ? 'Quitado' : rec > 0 ? 'Parcialmente recebido' : 'Pendente', cls = extra ? 'recurring-extra' : 'eventual', vinc = extra ? 'Extra de recorrente' : 'Serviço eventual';
            var cr = CA.creator();
            var svc = Object.assign({ _uid: svUid, 'ID Serviço': svId, Cliente: nome, WhatsApp: tel, _clientId: cidX, _clientKey: key, 'Serviço/Projeto': servico, 'Vínculo do projeto': vinc, _serviceClassV438: cls, 'Data Contratação': dc, 'Data Entrega Prevista': pz, 'Valor Total Contratado': String(total), 'Total Recebido': rec, 'Saldo a Receber': saldo, '% Recebido': r2(rec / total), 'Status Financeiro': fin, 'Status Entrega': 'Em produção', 'Diferença/Excedente': 0, 'Data Prevista Próx. Pgto': !quit && CA.isISO(pp) ? pp : '', 'Observações': val(m, 'sO'), _lastServiceCommitV472: { at: ts, paid: quit, total: total, completed: false }, _createdAt: ts, _editedAt: ts, _lastEditedAt: ts }, cr);
            if (rec > 0) svc._autoProductionByPayment = '1';
            if (quit) svc._settledAtV383 = ts;
            ops.push({ type: 'upsert', dataset: 'services', uid: svUid, record: svc });
            if (rec > 0) {
              var parc = quit ? 'Pagamento único' : 'Entrada';
              buildServicePay(data, ops, svc, { valor: pv, data: pd, forma: pf, parcela: parc, saldo: saldo, fin: fin, ent: 'Em produção', base: base, extra: extra, obs: '' });
            }
            var dlId = CA.maxNum(data.deadlines, 'ID') + 1, pzN = Date.UTC(+pz.slice(0, 4), +pz.slice(5, 7) - 1, +pz.slice(8, 10), 3), dleft = CA.days(CA.today(), pz);
            var dl = Object.assign({ _uid: 'deadlines_web_' + base, ID: dlId, Peso: 2, Status: 'Em andamento', Prioridade: 'Média', 'Serviço': servico, _linkDs: 'services', _linkUid: svUid, _clientId: cidX, _clientKey: key, 'Cliente/Aluno': nome, WhatsApp: tel, 'Data do pedido': dc, 'Prazo previsto': pz, 'Prazo numérico': pzN, 'Descrição / Etapa': 'Serviço pontual vinculado ao serviço ' + svId, 'Situação do prazo': dleft < 0 ? 'Em atraso' : 'Dentro do prazo', 'Dias até o prazo': dleft, _autoProjectDeadline: '1', _deadlineIntegrationVersion: 'v320', _createdAt: ts, _editedAt: ts }, cr);
            ops.push({ type: 'upsert', dataset: 'deadlines', uid: dl._uid, record: dl });
            var rv = revive(data, cli && mode === 'new' ? [key, key.split('|')[0] + '|semfone', 'cs:' + key.split('|')[0] + '|' + CA.normKey(servico)] : ['cs:' + key.split('|')[0] + '|' + CA.normKey(servico)]); if (rv) ops.push(rv);
            await CA.commit(ops, 'servico-novo', svId + ' lançado para ' + nome + '.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function buildServicePay(data, ops, sv, p) {
    var ts = CA.ts(), mi = +p.data.slice(5, 7) - 1, cr = CA.creator();
    var spUid = 'servicePayments_web_' + p.base, feUid = 'financeEntries_web_' + p.base, pk = CA.normS(p.parcela);
    var nome = sv.Cliente, svId = sv['ID Serviço'], servNome = sv['Serviço/Projeto'], key = sv._clientKey, clasR = p.extra ? 'Recebimento extra de recorrente' : 'Recebimento eventual';
    var sp = Object.assign({ _uid: spUid, Ano: +p.data.slice(0, 4), 'Mês': MES[mi], 'Mês Nº': mi + 1, Cliente: nome, WhatsApp: sv.WhatsApp || '', _clientId: sv._clientId, _clientKey: key, 'ID Serviço': svId, 'Serviço/Projeto': servNome, 'Tipo Parcela': p.parcela, 'Valor Recebido': p.valor, 'Forma Pagamento': p.forma, 'Tipo de pagador': 'Pessoa física', 'Data Recebimento': p.data, 'Situação do Projeto': p.fin + ' / ' + p.ent + ' / Saldo ' + brl(p.saldo), 'Saldo Atual do Projeto': p.saldo, 'Status Entrega do Projeto': p.ent, 'Status Financeiro do Projeto': p.fin, 'Classificação do recebimento': clasR, _serviceClassV438: sv._serviceClassV438 || (p.extra ? 'recurring-extra' : 'eventual'), _financeUid: feUid, _createdFromServiceFormV470: '1', _idempotencyKeyV470: 'servicePayments::' + svId + '::' + p.data + '::' + p.valor.toFixed(2) + '::' + pk + '::' + p.forma.toLowerCase(), _createdAt: ts, _editedAt: ts, _lastEditedAt: ts }, cr);
    if (p.obs) sp['Observações'] = p.obs;
    var fe = Object.assign({ _uid: feUid, ID: CA.maxNum(data.financeEntries, 'ID') + 1, Ano: +p.data.slice(0, 4), Data: p.data, 'Mês': MES[mi], 'Mês Nº': mi + 1, Status: 'Recebido', Cliente: nome, WhatsApp: sv.WhatsApp || '', _linkDs: 'servicePayments', _linkUid: spUid, _clientId: sv._clientId, _clientKey: key, 'Cliente vinculado': key, 'Serviço': clasR + ' ' + nome + ' · ' + svId + ' · ' + servNome, 'Despesa/Custo': 0, 'Observações': p.obs || '', 'Valor Líquido': p.valor, 'Receita Recebida': p.valor, 'Taxas/Descontos': 0, 'Tipo de pagador': 'Pessoa física', 'Considerar no DRE?': 1, 'Forma de Pagamento': p.forma, _autoPaymentSig: 'servicePayments|' + nome.toLowerCase() + '|' + p.data + '||' + svId + '|' + CA.normS(servNome) + '|' + p.valor + '|' + pk + '|' + p.forma.toLowerCase(), _createdAt: ts, _editedAt: ts }, cr);
    if ((data.servicePayments || []).some(function (x) { return x._idempotencyKeyV470 === sp._idempotencyKeyV470; })) fail('Este recebimento já foi registrado (mesmo serviço, data, valor e forma).');
    ops.push({ type: 'upsert', dataset: 'servicePayments', uid: spUid, record: sp });
    ops.push({ type: 'upsert', dataset: 'financeEntries', uid: feUid, record: fe });
  }
  function formServicePay(uid) {
    var M = CA.M(), open = M.services.filter(function (s) { return s.saldo > 0; });
    if (!open.length) { CA.toast('Nenhum serviço com saldo a receber.', true); return; }
    var body = '<div class="form-grid">' + field('rS', 'Serviço', sel('rS', '<option value="">Escolha…</option>' + open.map(function (s) { return '<option value="' + esc(s.uid) + '"' + (s.uid === uid ? ' selected' : '') + '>' + esc(s.sid + ' · ' + s.nome + ' · ' + s.servico + ' · falta ' + brl(s.saldo)) + '</option>'; }).join('')), 'full')
      + field('rV', 'Valor recebido', money('rV', '')) + field('rD', 'Data do pagamento', inp('rD', 'date', CA.today(), ' max="' + CA.today() + '"'))
      + field('rF', 'Forma', sel('rF', opts(CA.FORMAS, 'Pix'))) + field('rP', 'Próximo pagamento previsto', inp('rP', 'date', ''), '', 'Só se ainda sobrar saldo.')
      + field('rO', 'Observação (opcional)', inp('rO', 'text', ''), 'full') + '</div><div id="rInfo" class="review" style="margin-top:14px" hidden></div>' + ERR;
    CA.modal({
      title: 'Registrar recebimento de serviço', sub: 'Atualiza o saldo do serviço e lança a entrada no financeiro.', body: body,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Registrar recebimento', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        var info = function () {
          var s = M.svByUid[val(m, 'rS')], box = m.querySelector('#rInfo'); if (!s) { box.hidden = true; return; }
          box.hidden = false; box.innerHTML = '<span>Total <b>' + brl(s.total) + '</b>, já recebido <b>' + brl(s.rec) + '</b>, saldo <b>' + brl(s.saldo) + '</b>.</span><span>Se o valor for igual ao saldo, o serviço fica quitado.</span>';
          if (!val(m, 'rV')) m.querySelector('#rV').value = String(s.saldo).replace('.', ',');
        };
        m.querySelector('#rS').onchange = function () { m.querySelector('#rV').value = ''; info(); }; if (uid) info();
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var v = CA.numOrNaN(val(m, 'rV')), d = val(m, 'rD'), f = val(m, 'rF'), pp = val(m, 'rP');
            if (!val(m, 'rS')) fail('Escolha o serviço.'); if (!(v > 0)) fail('Informe o valor recebido.'); if (!CA.isISO(d)) fail('Informe a data.'); if (d > CA.today()) fail('A data não pode ser no futuro.');
            var data = await CA.fresh(), sv = recordOf(data, 'services', val(m, 'rS')); if (!sv) fail('Serviço não encontrado. Atualize a tela.');
            var total = num(sv['Valor Total Contratado']), recAnt = num(sv['Total Recebido']), saldoAnt = r2(total - recAnt);
            if (v > saldoAnt + 0.005) fail('O valor é maior que o saldo do serviço (' + brl(saldoAnt) + ').');
            var recN = r2(recAnt + v), saldo = r2(total - recN), quit = saldo <= 0.004; if (quit) saldo = 0;
            var ts = CA.ts(), fin = quit ? 'Quitado' : 'Parcialmente recebido', ent = sv['Status Entrega'] || 'Em produção', extra = /recorrente/i.test(sv['Vínculo do projeto'] || '') || sv._serviceClassV438 === 'recurring-extra';
            var parc = quit ? (recAnt > 0 ? 'Saldo final' : 'Pagamento único') : (recAnt > 0 ? 'Parcela' : 'Entrada');
            Object.assign(sv, { 'Total Recebido': recN, 'Saldo a Receber': saldo, '% Recebido': total ? r2(recN / total) : 1, 'Status Financeiro': fin, 'Data Prevista Próx. Pgto': !quit && CA.isISO(pp) ? pp : '', _lastServiceCommitV472: Object.assign({}, sv._lastServiceCommitV472 || {}, { at: ts, paid: quit, total: total, completed: ent === 'Concluído' }) }, CA.editor(ts));
            if (quit) sv._settledAtV383 = ts;
            var ops = [{ type: 'upsert', dataset: 'services', uid: sv._uid, record: sv }];
            buildServicePay(data, ops, sv, { valor: v, data: d, forma: f, parcela: parc, saldo: saldo, fin: fin, ent: ent, base: CA.slug(sv.Cliente) + '_' + CA.stamp8(d) + '_' + CA.rnd(4), extra: extra, obs: val(m, 'rO') });
            await CA.commit(ops, 'recebimento-servico', quit ? sv['ID Serviço'] + ' quitado.' : 'Recebimento registrado. Falta ' + brl(saldo) + '.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function concPts(diff) { return diff < 0 ? 100 + Math.min(20, 10 * -diff - 5) : diff === 0 ? 100 : Math.max(0, 105 - 10 * diff); }
  function formFinish(uid) {
    var s = CA.M().svByUid[uid]; if (!s) return;
    CA.modal({
      title: 'Concluir entrega', sub: s.sid + ' · ' + s.servico + ' de ' + s.nome,
      body: '<div class="form-grid">' + field('fD', 'Data em que foi entregue', inp('fD', 'date', CA.today(), ' max="' + CA.today() + '"'), 'full') + '</div>'
        + (s.saldo > 0 ? '<div class="note" style="margin-top:12px">Ainda há ' + brl(s.saldo) + ' a receber. A entrega fica concluída e o saldo continua em aberto.</div>' : '')
        + (s.prazo ? '<div class="review" style="margin-top:12px">Prazo combinado: <b>' + dbr(s.prazo) + '</b></div>' : '') + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Concluir entrega', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var d = val(m, 'fD'); if (!CA.isISO(d)) fail('Informe a data da entrega.'); if (d > CA.today()) fail('A data não pode ser no futuro.');
            var data = await CA.fresh(), sv = recordOf(data, 'services', uid); if (!sv) fail('Serviço não encontrado.');
            if (/conclu|cancel/i.test(sv['Status Entrega'] || '')) fail('Este serviço já está ' + sv['Status Entrega'].toLowerCase() + '.');
            var dc = CA.normDate(sv['Data Contratação']); if (CA.isISO(dc) && d < dc) fail('A entrega é anterior à contratação (' + dbr(dc) + ').');
            var ts = CA.ts(), total = num(sv['Valor Total Contratado']), saldo = Math.max(0, num(sv['Saldo a Receber'])), quit = saldo <= 0.005;
            Object.assign(sv, { 'Status Entrega': 'Concluído', 'Entrega real': d, 'Data Entrega Real': d, _lastServiceCommitV472: Object.assign({}, sv._lastServiceCommitV472 || {}, { at: ts, paid: quit, total: total, completed: true }), _deadlineEditedAt: ts }, CA.editor(ts));
            var ops = [{ type: 'upsert', dataset: 'services', uid: uid, record: sv }], stf = sv['Status Financeiro'] || (quit ? 'Quitado' : 'Parcialmente recebido');
            (data.servicePayments || []).forEach(function (p) {
              if (p['ID Serviço'] !== sv['ID Serviço'] || p._clientId !== sv._clientId) return;
              var r = JSON.parse(JSON.stringify(p)); Object.assign(r, { 'Status Entrega do Projeto': 'Concluído', 'Situação do Projeto': stf + ' / Concluído / Saldo ' + brl(saldo), _editedAt: ts });
              ops.push({ type: 'upsert', dataset: 'servicePayments', uid: r._uid, record: r });
            });
            var entN = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 3);
            (data.deadlines || []).forEach(function (x) {
              if (x._linkDs !== 'services' || x._linkUid !== uid || /conclu|cancel/i.test(x.Status || '')) return;
              var r = JSON.parse(JSON.stringify(x)), pr = CA.normDate(r['Prazo previsto']), diff = CA.isISO(pr) ? CA.days(pr, d) : 0, pts = concPts(diff), peso = Number(r.Peso) || 2;
              Object.assign(r, { Status: 'Concluído', 'Entrega real': d, 'Entrega numérica': entN, 'Meta cumprida?': diff <= 0 ? 'Sim' : 'Não', 'Situação do prazo': diff <= 0 ? 'Cumprido' : 'Cumprido com atraso', 'Dias (+ atraso / - adiantado)': diff, 'Dias até o prazo': 0, 'Pontuação do prazo': pts, 'Pontuação ponderada': r2(pts * peso), _editedAt: ts, _lastEditedAt: ts });
              ops.push({ type: 'upsert', dataset: 'deadlines', uid: r._uid, record: r });
            });
            await CA.commit(ops, 'conclusao', 'Entrega concluída.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  async function reopenService(uid) {
    var s = CA.M().svByUid[uid]; if (!s) return;
    if (!(await CA.confirm('Reabrir serviço', '<b>' + esc(s.servico) + '</b> de ' + esc(s.nome) + ' volta para em produção e a data de entrega é limpa.', 'Reabrir'))) return;
    try {
      var data = await CA.fresh(), sv = recordOf(data, 'services', uid), ts = CA.ts(), ops = [];
      Object.assign(sv, { 'Status Entrega': 'Em produção', 'Entrega real': '', 'Data Entrega Real': '', _lastServiceCommitV472: Object.assign({}, sv._lastServiceCommitV472 || {}, { at: ts, completed: false }) }, CA.editor(ts));
      ops.push({ type: 'upsert', dataset: 'services', uid: uid, record: sv });
      (data.servicePayments || []).forEach(function (p) {
        if (p['ID Serviço'] !== sv['ID Serviço'] || p._clientId !== sv._clientId) return;
        var r = JSON.parse(JSON.stringify(p)); Object.assign(r, { 'Status Entrega do Projeto': 'Em produção', 'Situação do Projeto': (sv['Status Financeiro'] || '') + ' / Em produção / Saldo ' + brl(num(sv['Saldo a Receber'])), _editedAt: ts });
        ops.push({ type: 'upsert', dataset: 'servicePayments', uid: r._uid, record: r });
      });
      (data.deadlines || []).forEach(function (x) {
        if (x._linkDs !== 'services' || x._linkUid !== uid) return;
        var r = JSON.parse(JSON.stringify(x)), pr = CA.normDate(r['Prazo previsto']), dl = CA.isISO(pr) ? CA.days(CA.today(), pr) : 0;
        Object.assign(r, { Status: 'Em andamento', 'Entrega real': '', 'Entrega numérica': '', 'Meta cumprida?': '', 'Situação do prazo': dl < 0 ? 'Em atraso' : 'Dentro do prazo', 'Dias (+ atraso / - adiantado)': '', 'Dias até o prazo': dl, 'Pontuação do prazo': '', 'Pontuação ponderada': '', _editedAt: ts });
        ops.push({ type: 'upsert', dataset: 'deadlines', uid: r._uid, record: r });
      });
      await CA.commit(ops, 'reabrir', 'Serviço reaberto.');
      CA.closeLayers();
    } catch (e) { CA.toast(CA.errMsg(e), true); }
  }
  async function undoServicePay(spUid) {
    var M = CA.M(), p = findBy(M.spay, 'uid', spUid);
    if (!p) { CA.toast('Recebimento não encontrado. Atualize a tela.', true); return; }
    var s = M.services.filter(function (x) { return x.sid === p.sid && (!p.cid || x.cid === p.cid); })[0];
    var others = s ? M.paysOf(s).filter(function (x) { return x.uid !== spUid; }).length : 0;
    var body = 'Vou apagar o recebimento de <b>' + brl(p.valor) + '</b> de ' + esc(CA.clientName(p.cid, p.nome)) + ' (' + esc(p.sid) + ' · ' + esc(p.servico) + ', ' + dbr(p.data) + ') e o lançamento dele no financeiro. O saldo do serviço é recalculado.';
    if (s && !others) body += '<label class="check" style="margin-top:10px"><input type="checkbox" id="delSv"> Apagar também o serviço ' + esc(s.sid) + ' e o prazo dele (use quando o serviço foi lançado por engano)</label>';
    CA.modal({
      title: 'Estornar recebimento', body: '<div class="review">' + body + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Estornar', cls: 'danger', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          var delSv = m.querySelector('#delSv') && m.querySelector('#delSv').checked;
          CA.run(this, err(m), async function () {
            var data = await CA.fresh(), sp = recordOf(data, 'servicePayments', spUid); if (!sp) fail('Este recebimento já não existe na base.');
            var ops = [{ type: 'delete', dataset: 'servicePayments', uid: spUid }];
            (data.financeEntries || []).forEach(function (f) { if ((sp._financeUid && f._uid === sp._financeUid) || (f._linkDs === 'servicePayments' && f._linkUid === spUid)) ops.push({ type: 'delete', dataset: 'financeEntries', uid: f._uid }); });
            var sv = (data.services || []).filter(function (x) { return x['ID Serviço'] === sp['ID Serviço'] && (!sp._clientId || x._clientId === sp._clientId); })[0];
            if (sv) {
              sv = JSON.parse(JSON.stringify(sv));
              var rest = (data.servicePayments || []).filter(function (x) { return x._uid !== spUid && x['ID Serviço'] === sv['ID Serviço'] && x._clientId === sv._clientId; });
              if (delSv && !rest.length) {
                ops.push({ type: 'delete', dataset: 'services', uid: sv._uid });
                (data.deadlines || []).forEach(function (x) { if (x._linkDs === 'services' && x._linkUid === sv._uid) ops.push({ type: 'delete', dataset: 'deadlines', uid: x._uid }); });
              } else {
                var ts = CA.ts(), total = num(sv['Valor Total Contratado']), rec = r2(rest.reduce(function (t, x) { return t + num(x['Valor Recebido']); }, 0)), saldo = Math.max(0, r2(total - rec)), quit = saldo <= 0.004 && total > 0;
                Object.assign(sv, { 'Total Recebido': rec, 'Saldo a Receber': quit ? 0 : saldo, '% Recebido': total ? r2(rec / total) : 0, 'Status Financeiro': quit ? 'Quitado' : rec > 0 ? 'Parcialmente recebido' : 'Pendente', _lastServiceCommitV472: Object.assign({}, sv._lastServiceCommitV472 || {}, { at: ts, paid: quit, total: total }) }, CA.editor(ts));
                if (!quit) delete sv._settledAtV383;
                ops.push({ type: 'upsert', dataset: 'services', uid: sv._uid, record: sv });
              }
            }
            await CA.commit(ops, 'estorno-servico', 'Recebimento estornado.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function openService(uid) {
    var M = CA.M(), s = M.svByUid[uid]; if (!s) { CA.toast('Serviço não encontrado.', true); return; }
    var pays = M.paysOf(s);
    var actions = (!s.done ? '<button class="btn sm gold" data-a="finish">' + ic('check') + 'Concluir entrega</button>' : '<button class="btn sm" data-a="reopen">' + ic('undo') + 'Reabrir</button>')
      + (s.saldo > 0 ? '<button class="btn sm" data-a="pay">' + ic('coin') + 'Registrar recebimento</button>' : '')
      + '<button class="btn sm" data-a="edit">' + ic('edit') + 'Editar</button><button class="btn sm" data-a="cli">' + ic('users') + 'Ficha do cliente</button>';
    var body = '<dl class="facts"><div><dt>Total contratado</dt><dd class="num pv">' + brl(s.total) + '</dd></div><div><dt>Recebido</dt><dd class="num pv in">' + brl(s.rec) + '</dd></div>'
      + '<div><dt>Saldo</dt><dd class="num pv ' + (s.saldo > 0 ? 'warn' : '') + '">' + (s.saldo > 0 ? brl(s.saldo) : 'Quitado') + '</dd></div><div><dt>Tipo</dt><dd>' + esc(s.vinc) + '</dd></div>'
      + '<div><dt>Contratado em</dt><dd class="num">' + (s.dc ? dbr(s.dc) : '—') + '</dd></div><div><dt>Prazo</dt><dd class="num">' + (s.prazo ? dbr(s.prazo) : '—') + (!s.done && s.dias !== null ? ' · ' + CA.prazoTxt(s.dias) : '') + '</dd></div>'
      + '<div><dt>Entrega</dt><dd>' + esc(s.ent) + (s.entregue ? ' em ' + dbr(s.entregue) : '') + '</dd></div><div><dt>Próximo pagamento</dt><dd class="num">' + (s.proxPgto ? dbr(s.proxPgto) : '—') + '</dd></div></dl>';
    if (s.r['Observações']) body += '<div class="note info">' + esc(s.r['Observações']) + '</div>';
    body += '<section class="panel"><div class="panel-h"><h2>Recebimentos</h2><span class="muted">' + pays.length + '</span></div><div class="panel-b"><div class="rows">' + (pays.length ? pays.map(function (p) {
      return '<div class="row"><div class="main"><b>' + esc(p.parcela || 'Recebimento') + '</b><span>' + dbr(p.data) + ' · ' + esc(p.forma) + '</span></div><div class="val num in">' + brl(p.valor) + '</div><button class="btn-ghost sm danger" data-undo="' + esc(p.uid) + '">' + ic('undo') + 'Estornar</button></div>';
    }).join('') : '<div class="empty">Nenhum recebimento ainda</div>') + '</div></div></section>';
    CA.drawer({
      title: s.servico, sub: s.sid + ' · ' + s.nome, actions: actions, body: body,
      mount: function (d) {
        d.addEventListener('click', function (e) {
          var b = e.target.closest('[data-a],[data-undo]'); if (!b) return;
          if (b.hasAttribute('data-undo')) return undoServicePay(b.getAttribute('data-undo'));
          var k = b.getAttribute('data-a');
          if (k === 'finish') formFinish(uid); if (k === 'reopen') reopenService(uid); if (k === 'pay') formServicePay(uid); if (k === 'edit') formEditService(uid);
          if (k === 'cli') openClient(s.cid);
        });
      }
    });
  }
  function formEditService(uid) {
    var s = CA.M().svByUid[uid]; if (!s) return;
    CA.modal({
      title: 'Editar serviço', sub: s.sid + ' · ' + s.nome,
      body: '<div class="form-grid">' + field('eS', 'Serviço', inp('eS', 'text', s.servico)) + field('eT', 'Valor total', money('eT', s.total), '', 'O saldo é recalculado com base no que já foi recebido.')
        + field('eP', 'Prazo de entrega', inp('eP', 'date', s.prazo)) + field('eN', 'Próximo pagamento previsto', inp('eN', 'date', s.proxPgto)) + field('eO', 'Observações', txt('eO', s.r['Observações']), 'full') + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Salvar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var nomeS = val(m, 'eS'), t = CA.numOrNaN(val(m, 'eT')), pz = val(m, 'eP');
            if (!nomeS) fail('Informe o serviço.'); if (!(t > 0)) fail('Informe o valor total.'); if (pz && !CA.isISO(pz)) fail('Prazo inválido.');
            var data = await CA.fresh(), sv = recordOf(data, 'services', uid); if (!sv) fail('Serviço não encontrado.');
            var rec = num(sv['Total Recebido']); if (t < rec - 0.005) fail('O total não pode ser menor que o já recebido (' + brl(rec) + ').');
            var ts = CA.ts(), saldo = r2(t - rec), quit = saldo <= 0.004, wasQuit = /quitado/i.test(sv['Status Financeiro'] || '');
            Object.assign(sv, { 'Serviço/Projeto': nomeS, 'Valor Total Contratado': String(t), 'Saldo a Receber': quit ? 0 : saldo, '% Recebido': r2(rec / t), 'Data Entrega Prevista': pz, 'Data Prevista Próx. Pgto': quit ? '' : val(m, 'eN'), 'Observações': val(m, 'eO') }, CA.editor(ts));
            if (quit !== wasQuit) { sv['Status Financeiro'] = quit ? 'Quitado' : rec > 0 ? 'Parcialmente recebido' : 'Pendente'; sv._lastServiceCommitV472 = Object.assign({}, sv._lastServiceCommitV472 || {}, { at: ts, paid: quit, total: t }); if (!quit) delete sv._settledAtV383; }
            var ops = [{ type: 'upsert', dataset: 'services', uid: uid, record: sv }];
            (data.deadlines || []).forEach(function (x) {
              if (x._linkDs !== 'services' || x._linkUid !== uid || /conclu|cancel/i.test(x.Status || '') || !CA.isISO(pz)) return;
              var r = JSON.parse(JSON.stringify(x)), dl = CA.days(CA.today(), pz);
              Object.assign(r, { 'Prazo previsto': pz, 'Prazo numérico': Date.UTC(+pz.slice(0, 4), +pz.slice(5, 7) - 1, +pz.slice(8, 10), 3), 'Serviço': nomeS, 'Dias até o prazo': dl, 'Situação do prazo': dl < 0 ? 'Em atraso' : 'Dentro do prazo', _editedAt: ts });
              ops.push({ type: 'upsert', dataset: 'deadlines', uid: r._uid, record: r });
            });
            await CA.commit(ops, 'servico-edicao', 'Serviço atualizado.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function openDeadline(uid) {
    var x = findBy(CA.M().deadlines, 'uid', uid); if (!x) return;
    CA.modal({
      title: x.servico || 'Prazo', sub: x.nome + (x.prazo ? ' · prazo ' + dbr(x.prazo) : ''),
      body: '<div class="review">' + esc(x.desc || 'Prazo sem descrição') + '</div><div class="form-grid" style="margin-top:14px">' + field('dD', 'Entregue em', inp('dD', 'date', CA.today(), ' max="' + CA.today() + '"'), 'full') + '</div>' + ERR,
      foot: [{ label: 'Fechar', id: 'bNo' }, { label: 'Marcar como entregue', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var d = val(m, 'dD'); if (!CA.isISO(d)) fail('Informe a data.');
            var data = await CA.fresh(), r = recordOf(data, 'deadlines', uid); if (!r) fail('Prazo não encontrado.');
            var pr = CA.normDate(r['Prazo previsto']), diff = CA.isISO(pr) ? CA.days(pr, d) : 0, pts = concPts(diff), ts = CA.ts();
            Object.assign(r, { Status: 'Concluído', 'Entrega real': d, 'Entrega numérica': Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 3), 'Meta cumprida?': diff <= 0 ? 'Sim' : 'Não', 'Situação do prazo': diff <= 0 ? 'Cumprido' : 'Cumprido com atraso', 'Dias (+ atraso / - adiantado)': diff, 'Dias até o prazo': 0, 'Pontuação do prazo': pts, 'Pontuação ponderada': r2(pts * (Number(r.Peso) || 2)), _editedAt: ts, _lastEditedAt: ts });
            await CA.commit([{ type: 'upsert', dataset: 'deadlines', uid: uid, record: r }], 'prazo', 'Prazo concluído.');
            CA.closeLayers();
          });
        };
      }
    });
  }

  /* ================= DESPESAS ================= */
  function formDespesa() {
    var M = CA.M(), sug = {};
    M.fin.forEach(function (f) { if (f.tipo === 'desp' && f.desc) sug[f.desc] = f.grupo || sug[f.desc] || ''; });
    var names = Object.keys(sug).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    CA.modal({
      title: 'Lançar despesa', sub: 'Entra no resultado do mês da data de pagamento.',
      body: '<div class="form-grid">' + field('dN', 'Despesa', '<input id="dN" list="dNames" autocomplete="off" placeholder="Ex.: ChatGPT, Claude, recarga"><datalist id="dNames">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>', 'full')
        + field('dV', 'Valor', money('dV', '')) + field('dD', 'Data do pagamento', inp('dD', 'date', CA.today(), ' max="' + CA.today() + '"'))
        + field('dG', 'Grupo', sel('dG', opts(CA.GRUPOS, 'Operacional'))) + field('dF', 'Forma', sel('dF', opts(CA.FORMAS, 'Pix')))
        + field('dO', 'Observação (opcional)', inp('dO', 'text', ''), 'full') + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Lançar despesa', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#dN').onchange = function () { var g = sug[val(m, 'dN')]; if (g && CA.GRUPOS.indexOf(g) >= 0) m.querySelector('#dG').value = g; };
        m.querySelector('#bOk').onclick = function () {
          var b = this;
          CA.run(b, err(m), async function () {
            var nome = val(m, 'dN').replace(/\s+/g, ' '), v = CA.numOrNaN(val(m, 'dV')), d = val(m, 'dD'), g = val(m, 'dG'), f = val(m, 'dF');
            if (!nome) fail('Informe a despesa.'); if (!(v > 0)) fail('Informe o valor.'); if (!CA.isISO(d)) fail('Informe a data.'); if (d > CA.today()) fail('A data não pode ser no futuro.');
            var data = await CA.fresh(), sig = nome.toLowerCase() + '|' + d + '|' + v;
            if (m.getAttribute('data-ok') !== sig && (data.financeEntries || []).some(function (x) { return CA.normDate(x.Data) === d && String(x['Serviço'] || '').toLowerCase() === nome.toLowerCase() && Math.abs(num(x['Despesa/Custo']) - v) < 0.005; })) {
              m.setAttribute('data-ok', sig);
              var e2 = err(m); e2.textContent = 'Já existe ' + nome + ' de ' + brl(v) + ' em ' + dbr(d) + '. Se for outra despesa igual, toque de novo para lançar.'; e2.hidden = false;
              b.disabled = false; b.textContent = 'Lançar mesmo assim'; return;
            }
            var ts = CA.ts(), mi = +d.slice(5, 7) - 1, uid = 'financeEntries_web_despesa_' + CA.slug(nome) + '_' + CA.stamp8(d) + '_' + Math.round(v) + '_' + CA.rnd(4);
            var obs = nome + ' paga via ' + f + ' em ' + dbr(d) + '.' + (val(m, 'dO') ? ' ' + val(m, 'dO') : '');
            var fe = Object.assign({ _uid: uid, ID: CA.maxNum(data.financeEntries, 'ID') + 1, Ano: +d.slice(0, 4), Data: d, 'Mês': MES[mi], 'Mês Nº': mi + 1, Status: 'Pago', 'Serviço': nome, 'Despesa/Custo': v, 'Valor Líquido': -v, 'Receita Recebida': 0, 'Taxas/Descontos': 0, 'Tipo da Despesa': CA.DESP_FIXAS.indexOf(nome) >= 0 ? 'Fixa' : 'Variável', 'Grupo da Despesa': g, 'Observações': obs, 'Forma de Pagamento': f, 'Considerar no DRE?': 1, 'Natureza do Movimento': 'Operacional', 'Classificação Financeira': 'Despesa operacional', _createdAt: ts, _editedAt: ts }, CA.creator());
            await CA.commit([{ type: 'upsert', dataset: 'financeEntries', uid: uid, record: fe }], 'despesa', 'Despesa lançada.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  async function undoDespesa(uid) {
    var f = findBy(CA.M().fin, 'uid', uid); if (!f) { CA.toast('Despesa não encontrada.', true); return; }
    if (f.link) { CA.toast('Este lançamento está ligado a um recebimento. Estorne pelo recebimento.', true); return; }
    if (!(await CA.confirm('Estornar despesa', 'Vou apagar <b>' + esc(f.desc) + '</b> de ' + brl(f.desp) + ' paga em ' + dbr(f.data) + '.', 'Estornar', true))) return;
    try {
      var data = await CA.fresh(), r = recordOf(data, 'financeEntries', uid); if (!r) fail('A despesa já não existe na base.');
      if (r._linkDs || num(r['Receita Recebida']) > 0) fail('Este lançamento não é uma despesa avulsa.');
      await CA.commit([{ type: 'delete', dataset: 'financeEntries', uid: uid }], 'estorno-despesa', 'Despesa estornada.');
    } catch (e) { CA.toast(CA.errMsg(e), true); }
  }

  /* ================= AGENDA ================= */
  function formSchedule(uid) {
    var M = CA.M(), s = uid ? findBy(M.schedules, 'uid', uid) : null;
    CA.modal({
      title: s ? 'Editar agendamento' : 'Novo agendamento', sub: s ? s.id : 'Prova, trabalho ou compromisso com data.',
      body: '<div class="form-grid">' + field('aC', 'Cliente', sel('aC', clientOptions(M, s ? s.cid : '')), 'full')
        + field('aT', 'Tipo', sel('aT', opts(['Prova', 'Trabalho', 'Reunião', 'Outro'], s ? s.tipo : 'Prova'))) + field('aF', 'Faculdade', inp('aF', 'text', s ? s.fac : ''))
        + field('aD', 'Data', inp('aD', 'date', s ? s.data : '')) + field('aH', 'Horário', inp('aH', 'time', s ? s.hora : ''))
        + field('aX', 'Descrição', inp('aX', 'text', s ? s.desc : ''), 'full') + field('aO', 'Observações', txt('aO', s ? s.r['Observações'] : ''), 'full') + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: s ? 'Salvar' : 'Agendar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#aC').onchange = function () { var c = M.cById[val(m, 'aC')]; if (c && !val(m, 'aF')) m.querySelector('#aF').value = c.fac; };
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var d = val(m, 'aD'), desc = val(m, 'aX');
            if (!val(m, 'aC')) fail('Escolha o cliente.'); if (!CA.isISO(d)) fail('Informe a data.'); if (!desc) fail('Descreva o agendamento.');
            var data = await CA.fresh(), c = findBy(data.clients, 'ID Cliente', val(m, 'aC')), ts = CA.ts(), rec;
            if (!c) fail('Cliente não encontrado.');
            if (s) { rec = recordOf(data, 'schedules', s.uid); if (!rec) fail('Agendamento não encontrado.'); }
            else rec = Object.assign({ _uid: 'schedules_web_' + CA.slug(c.Nome) + '_' + CA.stamp8(d) + '_' + CA.rnd(4), ID: CA.nextCode(data.schedules, 'ID', 'AG-'), 'Data do registro': CA.today(), Status: 'Pendente', 'Situação do agendamento': 'Pendente', _createdAt: ts }, CA.creator());
            Object.assign(rec, { Tipo: val(m, 'aT'), 'Cliente/Aluno': c.Nome, WhatsApp: c.WhatsApp || '', _clientId: c['ID Cliente'], _clientKey: c._clientKey || '', Faculdade: val(m, 'aF'), 'Data agendada': d, 'Horário': val(m, 'aH'), 'Descrição': desc, 'Observações': val(m, 'aO'), _editedAt: ts });
            await CA.commit([{ type: 'upsert', dataset: 'schedules', uid: rec._uid, record: rec }], 'agenda', s ? 'Agendamento atualizado.' : 'Agendado.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function openSchedule(uid) {
    var s = findBy(CA.M().schedules, 'uid', uid); if (!s) return;
    CA.modal({
      title: s.desc || s.tipo, sub: s.nome + ' · ' + (s.data ? dbr(s.data) : 'sem data') + (s.hora ? ' às ' + s.hora : ''),
      body: '<dl class="facts"><div><dt>Tipo</dt><dd>' + esc(s.tipo || '—') + '</dd></div><div><dt>Faculdade</dt><dd>' + esc(s.fac || '—') + '</dd></div><div><dt>Situação</dt><dd>' + esc(s.status) + '</dd></div><div><dt>Código</dt><dd>' + esc(s.id) + '</dd></div></dl>' + (s.r['Observações'] ? '<div class="note info" style="margin-top:12px">' + esc(s.r['Observações']) + '</div>' : '') + ERR,
      foot: [{ label: 'Editar', id: 'bEd' }, { label: s.open ? 'Marcar como resolvido' : 'Reabrir', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bEd').onclick = function () { CA.closeModal(); formSchedule(uid); };
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var data = await CA.fresh(), r = recordOf(data, 'schedules', uid), ts = CA.ts(); if (!r) fail('Agendamento não encontrado.');
            if (s.open) Object.assign(r, { Status: 'Resolvido', 'Situação do agendamento': 'Resolvido', 'Concluído em': CA.today(), _editedAt: ts });
            else Object.assign(r, { Status: 'Pendente', 'Situação do agendamento': 'Pendente', 'Concluído em': '', _editedAt: ts });
            await CA.commit([{ type: 'upsert', dataset: 'schedules', uid: uid, record: r }], 'agenda-status', s.open ? 'Marcado como resolvido.' : 'Agendamento reaberto.');
            CA.closeLayers();
          });
        };
      }
    });
  }

  /* ================= CRM ================= */
  function formLead(uid) {
    var M = CA.M(), c = uid ? findBy(M.crm, 'uid', uid) : null;
    CA.modal({
      title: c ? c.nome : 'Novo contato', sub: c ? 'Contato comercial' : 'Pessoa interessada em algum serviço.',
      body: '<div class="form-grid">' + field('lN', 'Nome', inp('lN', 'text', c ? c.nome : '')) + field('lT', 'WhatsApp', inp('lT', 'tel', c ? CA.telFmt(c.tel) : '', ' inputmode="tel"'))
        + field('lS', 'Serviço de interesse', '<input id="lS" list="lSv" value="' + esc(c ? c.servico : '') + '"><datalist id="lSv">' + M.serviceNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>')
        + field('lV', 'Valor potencial', money('lV', c ? c.valor : ''))
        + field('lSt', 'Etapa', sel('lSt', opts(CA.FUNIL, c ? (CA.FUNIL.indexOf(c.status) >= 0 ? c.status : 'Novo contato') : 'Novo contato')))
        + field('lI', 'Interesse', sel('lI', opts(['Frio', 'Morno', 'Quente', 'Muito quente'], c ? c.nivel : 'Morno')))
        + field('lC', 'Data do contato', inp('lC', 'date', c ? c.contato : CA.today())) + field('lF', 'Próximo retorno', inp('lF', 'date', c ? c.follow : ''))
        + field('lO', 'Observações', txt('lO', c ? c.obs : ''), 'full') + '</div>' + ERR,
      foot: (c && CA.waLink(c.tel) ? [{ label: 'Abrir WhatsApp', id: 'bWa' }] : []).concat([{ label: 'Cancelar', id: 'bNo' }, { label: c ? 'Salvar' : 'Adicionar', cls: 'primary', id: 'bOk' }]),
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        var wa = m.querySelector('#bWa'); if (wa) wa.onclick = function () { window.open(CA.waLink(c.tel), '_blank', 'noopener'); };
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var nome = val(m, 'lN'); if (nome.length < 2) fail('Informe o nome.');
            var data = await CA.fresh(), ts = CA.ts(), rec, st = val(m, 'lSt'), tel = CA.telDig(val(m, 'lT')), vv = CA.numOrNaN(val(m, 'lV'));
            if (c) { rec = recordOf(data, 'crm', c.uid); if (!rec) fail('Contato não encontrado.'); }
            else rec = Object.assign({ _uid: 'crm_web_' + CA.slug(nome) + '_' + CA.rnd(5), _clientKey: CA.chaveCli(nome, tel), _createdAt: ts }, CA.creator());
            var dC = val(m, 'lC');
            Object.assign(rec, { Nome: nome, WhatsApp: tel ? CA.telFmt(tel) : '', 'Serviço de interesse': val(m, 'lS'), 'Valor potencial': isNaN(vv) ? 0 : vv, 'Status comercial': st, 'Etapa do funil': st === 'Convertido/Fechado' ? 'Fechado' : st === 'Perdido' ? 'Perdido' : 'Negociação', 'Nível de interesse': val(m, 'lI'), 'Data do contato': dC, 'Próximo follow-up': val(m, 'lF'), 'Observações': val(m, 'lO'), Ano: CA.isISO(dC) ? +dC.slice(0, 4) : '', 'Mês': CA.isISO(dC) ? MES[+dC.slice(5, 7) - 1] : '', 'Data de fechamento': st === 'Convertido/Fechado' ? (rec['Data de fechamento'] || CA.today()) : (rec['Data de fechamento'] || '') }, CA.editor(ts));
            await CA.commit([{ type: 'upsert', dataset: 'crm', uid: rec._uid, record: rec }], 'crm', c ? 'Contato atualizado.' : 'Contato adicionado.');
            CA.closeLayers();
          });
        };
      }
    });
  }

  /* ================= CATÁLOGO E ACESSOS ================= */
  function formCatalog(uid) {
    var c = uid ? findBy(CA.M().catalog, 'uid', uid) : null;
    var cats = ['TCC e artigos', 'Trabalhos acadêmicos', 'Provas e atividades', 'Formatação', 'Extensão', 'Consultoria acadêmica', 'Outros'];
    CA.modal({
      title: c ? 'Editar item do catálogo' : 'Novo item do catálogo', sub: c ? c.id : '',
      body: '<div class="form-grid">' + field('kN', 'Serviço', inp('kN', 'text', c ? c.nome : ''), 'full') + field('kC', 'Categoria', sel('kC', opts(cats, c ? c.cat : 'Trabalhos acadêmicos'))) + field('kS', 'Status', sel('kS', opts(['Ativo', 'Inativo'], c ? c.status : 'Ativo')))
        + field('kV', 'Valor de referência', money('kV', c ? c.valor : '')) + field('kP', 'Preço promocional', money('kP', c && c.promo ? c.promo : '')) + field('kO', 'Observações', inp('kO', 'text', c ? c.obs : ''), 'full') + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Salvar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var nome = val(m, 'kN'); if (!nome) fail('Informe o serviço.');
            var data = await CA.fresh(), ts = CA.ts(), rec;
            if (c) rec = recordOf(data, 'serviceCatalog', c.uid); else rec = Object.assign({ _uid: 'serviceCatalog_web_' + CA.slug(nome) + '_' + CA.rnd(4), 'ID Serviço Catálogo': CA.nextCode(data.serviceCatalog, 'ID Serviço Catálogo', 'CAT-'), _createdAt: ts }, CA.creator());
            var v = CA.numOrNaN(val(m, 'kV')), p = CA.numOrNaN(val(m, 'kP'));
            Object.assign(rec, { 'Serviço': nome, Categoria: val(m, 'kC'), Status: val(m, 'kS'), 'Valor Referência': isNaN(v) ? '' : v, 'Preço Promocional': isNaN(p) ? '' : p, 'Observações': val(m, 'kO'), _editedAt: ts });
            await CA.commit([{ type: 'upsert', dataset: 'serviceCatalog', uid: rec._uid, record: rec }], 'catalogo', 'Catálogo atualizado.');
            CA.closeLayers();
          });
        };
      }
    });
  }
  function formAccess(uid) {
    var M = CA.M(), a = uid ? findBy(M.access, 'uid', uid) : null;
    CA.modal({
      title: a ? 'Editar acesso' : 'Novo acesso de portal', sub: a ? a.nome : '',
      body: '<div class="form-grid">' + field('xC', 'Aluno', sel('xC', clientOptions(M, a ? a.cid : '')), 'full') + field('xF', 'Faculdade', inp('xF', 'text', a ? a.fac : ''), 'full')
        + field('xL', 'Login do portal', inp('xL', 'text', a ? a.login : '', ' autocomplete="off"')) + field('xS', 'Senha do portal', inp('xS', 'text', a ? a.senha : '', ' autocomplete="off"')) + '</div>' + ERR,
      foot: [{ label: 'Cancelar', id: 'bNo' }, { label: 'Salvar', cls: 'primary', id: 'bOk' }],
      mount: function (m) {
        m.querySelector('#bNo').onclick = CA.closeModal;
        m.querySelector('#xC').onchange = function () { var c = M.cById[val(m, 'xC')]; if (c && !val(m, 'xF')) m.querySelector('#xF').value = c.fac; };
        m.querySelector('#bOk').onclick = function () {
          CA.run(this, err(m), async function () {
            var data = await CA.fresh(), c = findBy(data.clients, 'ID Cliente', val(m, 'xC')), ts = CA.ts(), rec;
            if (!c && !a) fail('Escolha o aluno.');
            if (a) rec = recordOf(data, 'access', a.uid); else rec = Object.assign({ _uid: 'access_web_' + CA.slug(c.Nome) + '_' + CA.rnd(4), 'Data de Cadastro': CA.today(), _createdAt: ts }, CA.creator());
            if (c) Object.assign(rec, { 'Nome do Aluno': c.Nome, WhatsApp: c.WhatsApp || '', _clientId: c['ID Cliente'], _clientKey: c._clientKey || '' });
            Object.assign(rec, { Faculdade: val(m, 'xF'), 'Login do Portal': val(m, 'xL'), 'Senha do Portal': val(m, 'xS'), _editedAt: ts });
            await CA.commit([{ type: 'upsert', dataset: 'access', uid: rec._uid, record: rec }], 'acesso', 'Acesso salvo.');
            CA.closeLayers();
          });
        };
      }
    });
  }

  /* ================= LANÇAR / BUSCA / CONTA ================= */
  CA.launch = function () {
    var items = [['payMens', 'coin', 'Mensalidade', 'Pagamento de mensalista', 'var(--in-soft)', 'var(--in)'], ['paySv', 'receipt', 'Recebimento de serviço', 'Entrada ou saldo de um serviço', 'var(--action-soft)', 'var(--action)'], ['newSv', 'file', 'Novo serviço', 'Trabalho com prazo e valor', 'var(--info-soft)', 'var(--info)'], ['newDesp', 'receipt', 'Despesa', 'ChatGPT, Claude, recarga…', 'var(--out-soft)', 'var(--out)'], ['newClient', 'users', 'Novo cliente', 'Cadastro na base', 'var(--surface-2)', 'var(--ink-2)'], ['newSch', 'cal', 'Agendamento', 'Prova ou compromisso', 'var(--warn-soft)', 'var(--warn)'], ['newLead', 'target', 'Contato comercial', 'Entrada no CRM', 'var(--surface-2)', 'var(--ink-2)']];
    CA.modal({
      title: 'O que você quer lançar?',
      body: '<div class="launch-grid">' + items.map(function (i) { return '<button type="button" data-l="' + i[0] + '"><span class="ic" style="background:' + i[4] + ';color:' + i[5] + '">' + ic(i[1]) + '</span><span><b>' + i[2] + '</b><span>' + i[3] + '</span></span></button>'; }).join('') + '</div>',
      mount: function (m) { m.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { CA.closeModal(); CA.action(b.getAttribute('data-l'), null); }; }); }
    });
  };
  CA.search = function () {
    var M = CA.M();
    CA.modal({
      title: 'Buscar', body: '<input type="search" id="gq" placeholder="Cliente, telefone, serviço ou código (SV-, CR-, CL-)" aria-label="Buscar"><div class="search-res" id="gr"></div>',
      mount: function (m) {
        var q = m.querySelector('#gq'), out = m.querySelector('#gr');
        var go = function () {
          var t = CA.normS(q.value.trim()), d = CA.telDig(q.value); if (t.length < 2) { out.innerHTML = '<div class="empty">Digite ao menos 2 letras.</div>'; return; }
          var res = [];
          M.clients.forEach(function (c) { if (CA.normS(c.nome + ' ' + c.id).indexOf(t) >= 0 || (d.length >= 4 && CA.telDig(c.tel).indexOf(d) >= 0)) res.push(['cli', c.id, c.nome, c.id + ' · ' + c.tipo + (c.tel ? ' · ' + CA.telFmt(c.tel) : '')]); });
          M.services.forEach(function (s) { if (CA.normS(s.sid + ' ' + s.servico + ' ' + s.nome).indexOf(t) >= 0) res.push(['sv', s.uid, s.servico + ' · ' + s.nome, s.sid + ' · ' + s.ent + (s.saldo > 0 ? ' · falta ' + brl(s.saldo) : '')]); });
          M.crm.forEach(function (c) { if (CA.normS(c.nome + ' ' + c.servico).indexOf(t) >= 0) res.push(['lead', c.uid, c.nome, 'CRM · ' + c.status]); });
          out.innerHTML = res.length ? res.slice(0, 30).map(function (r) { return '<button type="button" data-k="' + r[0] + '" data-v="' + esc(r[1]) + '"><span><b>' + esc(r[2]) + '</b><span>' + esc(r[3]) + '</span></span></button>'; }).join('') : '<div class="empty">Nada encontrado.</div>';
        };
        q.oninput = go;
        out.onclick = function (e) {
          var b = e.target.closest('[data-k]'); if (!b) return; var k = b.getAttribute('data-k'), v = b.getAttribute('data-v');
          CA.closeLayers();
          setTimeout(function () { if (k === 'cli') openClient(v); else if (k === 'sv') openService(v); else formLead(v); }, 20);
        };
      }
    });
  };
  CA.openClient = openClient; CA.openService = openService;
})(window.CA);
