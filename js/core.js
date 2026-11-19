/* Consultoria Acadêmica · Gestão v2 — núcleo: utilidades, conexão, estado, interface base */
'use strict';
window.CA = window.CA || {};
(function (CA) {
  var CFG = CA.CFG = {
    url: 'https://teemhlpfcnhfwveedmym.supabase.co',
    key: 'sb_publishable_DQ9AGXIkznhUj_bg-whWFg_YjYlmMtl',
    ws: 'nova_empresa_main',
    version: '2.4.0',
    poll: 30000
  };

  /* ---------- Utilidades ---------- */
  var MES = CA.MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var MES3 = CA.MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  CA.FORMAS = ['Pix', 'Dinheiro', 'Transferência', 'Cartão', 'Outro'];
  CA.GRUPOS = ['Operacional', 'Ferramentas e sistemas', 'Marketing', 'Impostos e taxas', 'Pró-labore', 'Outros'];
  CA.DESP_FIXAS = ['ChatGPT', 'Claude', 'Gemini IA'];

  var esc = CA.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var num = CA.num = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim().replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  CA.numOrNaN = function (v) {
    var s = String(v == null ? '' : v).trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  var r2 = CA.r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var fmtBRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  CA.brl = function (n) { return fmtBRL.format(Number(n) || 0); };
  CA.brl0 = function (n) { return fmtBRL.format(Number(n) || 0); }; // padrão único: sempre com centavos
  CA.pct = function (n) { return Math.round((Number(n) || 0) * 100) + '%'; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoOf = CA.isoOf = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = CA.today = function () { return isoOf(new Date()); };
  var isISO = CA.isISO = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); };
  CA.normDate = function (s) {
    s = String(s || '').trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(6, 10) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);
    if (/^\d{2}-\d{2}-\d{4}/.test(s)) return s.slice(6, 10) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);
    return s.slice(0, 10);
  };
  CA.dbr = function (iso) { iso = CA.normDate(iso); return isISO(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; };
  CA.dshort = function (iso) { iso = CA.normDate(iso); return isISO(iso) ? iso.slice(8, 10) + ' ' + MES3[+iso.slice(5, 7) - 1] : ''; };
  var utc = function (iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  CA.days = function (a, b) { a = CA.normDate(a); b = CA.normDate(b); if (!isISO(a) || !isISO(b)) return null; return Math.round((utc(b) - utc(a)) / 86400000); };
  CA.addDays = function (iso, n) { var d = new Date(utc(iso) + n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  CA.ymAdd = function (ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); };
  CA.ymLabel = function (ym) { return MES[+ym.slice(5, 7) - 1] + ' de ' + ym.slice(0, 4); };
  CA.ymShort = function (ym) { return MES[+ym.slice(5, 7) - 1] + '/' + ym.slice(0, 4); };
  CA.dueIn = function (ym, dia) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); var ult = new Date(Date.UTC(y, m, 0)).getUTCDate(); return ym + '-' + pad(Math.min(dia, ult)); };
  CA.proxVenc = function (ym, dia) { return CA.dueIn(CA.ymAdd(ym, 1), dia); };
  var normS = CA.normS = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  CA.slug = function (t) { return normS(t).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'x'; };
  CA.telDig = function (v) { var d = String(v || '').replace(/\D/g, ''); if (d.length > 11 && d.slice(0, 2) === '55') d = d.slice(2); return d; };
  CA.telFmt = function (v) { var d = CA.telDig(v); return d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d[2] + ' ' + d.slice(3, 7) + '-' + d.slice(7) : d.length === 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : String(v || ''); };
  CA.chaveCli = function (nome, tel) { return normS(nome).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + '|' + CA.telDig(tel); };
  CA.rnd = function (n) { var s = ''; while (s.length < (n || 4)) s += Math.random().toString(36).slice(2); return s.slice(0, n || 4); };
  CA.ts = function () { return new Date().toISOString(); };
  CA.stamp8 = function (iso) { return String(iso || today()).replace(/-/g, '').slice(0, 8); };
  CA.mid = function (label) { var d = new Date(); return 'web2-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' + label + '-' + CA.rnd(6); };
  CA.waLink = function (tel) { var d = CA.telDig(tel); return d.length >= 10 ? 'https://wa.me/55' + d : ''; };
  CA.$ = function (id) { return document.getElementById(id); };
  CA.icon = function (name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; };
  var ICONS = CA.ICONS = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 9h6M9 13h6"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2 4 4.5 4.8l1.2-1.1 1.8.8"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    down: '<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M7 5v14l12-7z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };

  /* ---------- Conexão (Supabase, motor oficial v500) ---------- */
  function deviceId() {
    try {
      var k = 'ca2_device', v = localStorage.getItem(k);
      if (!v) { v = 'painel-web-v2-' + CA.rnd(10); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return 'painel-web-v2'; }
  }
  function makeApi() {
    if (window.CA_API) return window.CA_API; // usado só no ambiente de teste local
    var sb = window.supabase.createClient(CFG.url, CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ca2_auth', detectSessionInUrl: false }
    });
    function rpcErr(error) {
      var m = (error && (error.message || error.hint || error.details)) || 'Falha de comunicação com o banco.';
      var e = new Error(m); e.code = error && error.code; return e;
    }
    return {
      getSession: async function () { var r = await sb.auth.getSession(); return r.data.session; },
      signIn: async function (email, password) {
        var r = await sb.auth.signInWithPassword({ email: email, password: password });
        if (r.error) throw r.error; return r.data.session;
      },
      signOut: async function () { try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {} },
      onAuth: function (fn) { sb.auth.onAuthStateChange(function (ev, s) { fn(ev, s); }); },
      pull: async function (after) {
        var r = await sb.rpc('consultoria_workspace_pull_v500', { p_workspace_id: CFG.ws, p_after_revision: after == null ? null : after });
        if (r.error) throw rpcErr(r.error); return r.data;
      },
      mutate: async function (ops, mid) {
        var r = await sb.rpc('consultoria_workspace_mutate_v500', { p_workspace_id: CFG.ws, p_operations: ops, p_mutation_id: mid, p_device_id: deviceId() });
        if (r.error) throw rpcErr(r.error); return r.data;
      }
    };
  }
  CA.api = null;

  /* ---------- Estado ---------- */
  var S = CA.S = { data: null, revision: null, updatedAt: null, user: null, busy: false, offline: false, lastPull: 0, route: { area: 'painel', sub: '' }, ui: {} };

  CA.pull = async function (full) {
    if (!CA.api) return;
    setSync('busy', 'Sincronizando…');
    try {
      var r = await CA.api.pull(full || S.revision == null ? null : S.revision);
      if (r && r.changed && r.workspace) {
        S.data = r.workspace.data || {};
        S.revision = Number(r.workspace.revision);
        S.updatedAt = r.workspace.updated_at;
        CA.invalidate();
        S.offline = false; S.lastPull = Date.now();
        setSync('', syncLabel());
        return true;
      }
      S.offline = false; S.lastPull = Date.now();
      setSync('', syncLabel());
      return false;
    } catch (e) {
      S.offline = true;
      setSync('off', 'Sem conexão com o banco');
      throw e;
    }
  };
  function syncLabel() {
    var d = S.updatedAt ? new Date(S.updatedAt) : null;
    return 'Base atualizada' + (d && !isNaN(d) ? ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '');
  }
  function setSync(cls, txt) { var el = CA.$('sync'); if (!el) return; el.className = 'sync' + (cls ? ' ' + cls : ''); el.textContent = txt; }

  /* Grava pelo motor oficial e recarrega a base. */
  CA.commit = async function (ops, label, okMsg) {
    if (S.busy) throw new Error('Aguarde a gravação anterior terminar.');
    if (!ops || !ops.length) throw new Error('Nada para gravar.');
    S.busy = true; setSync('busy', 'Gravando…');
    try {
      var r = await CA.api.mutate(ops, CA.mid(label));
      if (!(r && r.ok && r.confirmed && r.checks_ok)) throw new Error((r && r.message) || 'O banco não confirmou a gravação.');
      S.busy = false;
      await CA.pull(true).catch(function () {});
      CA.render();
      if (okMsg) CA.toast(okMsg);
      return r;
    } catch (e) {
      S.busy = false; setSync('', syncLabel());
      throw e;
    }
  };
  /* Recarrega a base completa antes de montar uma gravação (IDs e registros sempre atuais). */
  CA.fresh = async function () { await CA.pull(true); return S.data; };

  CA.meta12 = ['deletedClientKeys', 'deletedServiceKeys', 'deletedOperationalProjects', 'deletedRecurringCompetences', 'deletedRecurringCompetenceKeys', 'deletedOperationalProjectKeys', 'overdueRule', 'openServicesYearRule', 'verifierDetailsOpen', 'incomeReportSource', 'accessLaunchScope', 'catalogSourcePolicy'];
  CA.businessMeta = function (data) {
    var m = (data && data.meta && typeof data.meta === 'object') ? data.meta : {}, out = {};
    CA.meta12.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(m, k)) out[k] = JSON.parse(JSON.stringify(m[k])); });
    return out;
  };
  CA.creator = function () {
    var u = S.user || {}, mail = u.email || '';
    return { _userCreated: '1', _createdBy: mail || 'Painel web', _createdByName: (mail.split('@')[0] || 'Painel web') + ' (painel web)', _createdByRole: 'primary', _createdByEmail: mail, _createdByUserId: u.id || '', _createdByAuthUid: u.id || '' };
  };
  CA.editor = function (ts) { var u = S.user || {}; return { _editedAt: ts, _lastEditedAt: ts, _lastEditedBy: u.email || 'Painel web', _lastEditedByUserId: u.id || '' }; };
  CA.maxNum = function (list, field, prefix) {
    var m = 0;
    (list || []).forEach(function (x) {
      var v = String(x[field] == null ? '' : x[field]);
      if (prefix) { if (v.indexOf(prefix) === 0 && /^\d+$/.test(v.slice(prefix.length))) m = Math.max(m, +v.slice(prefix.length)); }
      else if (/^\d+$/.test(v)) m = Math.max(m, +v);
    });
    return m;
  };
  CA.nextCode = function (list, field, prefix) { return prefix + ('00' + (CA.maxNum(list, field, prefix) + 1)).slice(-3); };
  CA.nextClientId = function (data) {
    var m = Math.max(CA.maxNum(data.clients, 'ID Cliente', 'CR-'), CA.maxNum(data.clients, 'ID Cliente', 'CL-'));
    return 'CR-' + ('00' + (m + 1)).slice(-3);
  };

  /* ---------- Interface base ---------- */
  CA.toast = function (msg, err) {
    var box = CA.$('toasts'), t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; box.appendChild(t);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(function () { t.remove(); }, err ? 7000 : 3800);
  };
  CA.errMsg = function (e) {
    var m = (e && e.message) || String(e || '');
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com a internet. Confira a rede e tente de novo; nada foi alterado.';
    if (/JWT|expired|não autenticada/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    return m;
  };

  var lastFocus = null;
  function openLayer() { lastFocus = document.activeElement; CA.$('overlay').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeLayers() {
    CA.$('overlay').hidden = true; CA.$('drawer').hidden = true; CA.$('modal').hidden = true;
    CA.$('drawer').innerHTML = ''; CA.$('modal').innerHTML = ''; document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  CA.closeLayers = closeLayers;
  CA.closeModal = function () {
    CA.$('modal').hidden = true; CA.$('modal').innerHTML = '';
    if (CA.$('drawer').hidden) closeLayers();
  };

  /* Modal: { title, sub, body, foot:[{label, cls, id}], mount(el) } */
  CA.modal = function (o) {
    if (CA.$('drawer').hidden) openLayer();
    var m = CA.$('modal');
    m.innerHTML = '<div class="modal-h"><div><h2 id="modalTitle">' + esc(o.title) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>'
      + '<button class="x" type="button" data-close aria-label="Fechar">' + CA.icon('x') + '</button></div>'
      + '<div class="modal-b">' + (o.body || '') + '</div>'
      + (o.foot ? '<div class="modal-f">' + o.foot.map(function (b) { return '<button type="button" class="btn ' + (b.cls || '') + '" id="' + b.id + '">' + esc(b.label) + '</button>'; }).join('') + '</div>' : '');
    m.hidden = false;
    m.querySelector('[data-close]').addEventListener('click', CA.closeModal);
    if (o.mount) o.mount(m);
    var f = m.querySelector('input:not([type=hidden]):not([readonly]), select, textarea, .modal-f .btn.primary');
    setTimeout(function () { if (f) try { f.focus(); } catch (e) {} }, 30);
    return m;
  };
  CA.drawer = function (o) {
    openLayer();
    var d = CA.$('drawer');
    d.innerHTML = '<div class="drawer-h"><h2 id="drawerTitle">' + esc(o.title) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '')
      + '<button class="icon-btn" type="button" data-close aria-label="Fechar">' + CA.icon('x') + '</button>'
      + (o.actions ? '<div class="drawer-actions">' + o.actions + '</div>' : '') + '</div><div class="drawer-b">' + (o.body || '') + '</div>';
    d.hidden = false;
    d.querySelector('[data-close]').addEventListener('click', closeLayers);
    if (o.mount) o.mount(d);
    setTimeout(function () { try { d.querySelector('[data-close]').focus(); } catch (e) {} }, 30);
    return d;
  };
  CA.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      CA.modal({
        title: title, body: '<div class="review">' + text + '</div>',
        foot: [{ label: 'Cancelar', id: 'cfNo' }, { label: okLabel || 'Confirmar', cls: danger ? 'danger' : 'primary', id: 'cfYes' }],
        mount: function (m) {
          m.querySelector('#cfNo').onclick = function () { CA.closeModal(); resolve(false); };
          m.querySelector('#cfYes').onclick = function () { CA.closeModal(); resolve(true); };
        }
      });
    });
  };
  /* Executa uma gravação com botão travado e mensagem de erro no próprio formulário. */
  CA.run = async function (btn, errEl, fn) {
    if (btn.disabled) return;
    var txt = btn.textContent; btn.disabled = true; btn.textContent = 'Gravando…';
    if (errEl) errEl.hidden = true;
    try { await fn(); }
    catch (e) {
      var msg = CA.errMsg(e);
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; } else CA.toast(msg, true);
      btn.disabled = false; btn.textContent = txt;
    }
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!CA.$('menu').hidden) { CA.$('menu').hidden = true; return; }
      if (!CA.$('modal').hidden) { CA.closeModal(); return; }
      if (!CA.$('drawer').hidden) { closeLayers(); }
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'overlay') {
      if (!CA.$('modal').hidden) CA.closeModal(); else closeLayers();
    }
  });

  CA.initApi = function () { CA.api = makeApi(); };
})(window.CA);
