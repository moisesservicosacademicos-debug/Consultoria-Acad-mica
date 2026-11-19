/* Gráficos interativos em SVG, desenhados na largura real do contêiner */
'use strict';
(function (CA) {
  var esc = CA.esc;
  var NS = 'http://www.w3.org/2000/svg';
  var REG = {}; // id -> config, redesenhado ao redimensionar

  /* Série mensal contínua (meses sem movimento entram com zero) */
  CA.monthSeries = function (M, from, to) {
    var out = [], ym = from;
    while (ym <= to) { var m = M.monthOf(ym); out.push({ ym: ym, rec: m.rec, desp: m.desp, res: m.res, pl: m.pl || 0, mens: m.mens, event: m.event, extra: m.extra, outro: m.outro }); ym = CA.ymAdd(ym, 1); }
    return out;
  };
  CA.movAvg = function (arr, n) { return arr.map(function (_, i) { if (i < n - 1) return null; var s = 0; for (var j = i - n + 1; j <= i; j++) s += arr[j]; return s / n; }); };

  function nice(max, min) {
    var span = Math.max(1, max - min), raw = span / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { step: step, lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step };
  }
  function kfmt(v) { return CA.brl(v); }
  CA.kfmt = kfmt;
  function axisW(nk, mobile, fmt) { fmt = fmt || CA.brl; var w = Math.max(fmt(nk.hi).length, fmt(nk.lo).length); return Math.round(w * (mobile ? 5.6 : 6.1)) + 12; }
  /* Curva monotônica (não passa do ponto, sem "ondas" falsas) */
  function smooth(pts) {
    var n = pts.length; if (n < 2) return pts.length ? 'M' + pts[0][0] + ',' + pts[0][1] : '';
    if (n === 2) return 'M' + pts[0][0] + ',' + pts[0][1] + 'L' + pts[1][0] + ',' + pts[1][1];
    var dx = [], dy = [], m = [], t = [];
    for (var i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { var s = 3 / Math.sqrt(h); t[i] = s * a * m[i]; t[i + 1] = s * b * m[i]; }
    }
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (i = 0; i < n - 1; i++) {
      var c = dx[i] / 3;
      d += 'C' + (pts[i][0] + c) + ',' + (pts[i][1] + c * t[i]) + ' ' + (pts[i + 1][0] - c) + ',' + (pts[i + 1][1] - c * t[i + 1]) + ' ' + pts[i + 1][0] + ',' + pts[i + 1][1];
    }
    return d;
  }

  /*
    cfg = {
      labels: [..] rótulos do eixo X (um por ponto),
      ticks: fn(i) -> rótulo exibido ou '' (opcional),
      series: [{ key, label, color, type: 'bar'|'line'|'area'|'dash', values: [...] , width }],
      tip: fn(i) -> HTML do quadro de detalhe,
      partialLast: bool, markers: [{ i, label }], height, zero: bool
    }
  */
  CA.chart = function (id, cfg) { REG[id] = cfg; return '<div class="chart-box' + (cfg.fill ? ' fill' : '') + '" data-chart="' + esc(id) + '"' + (cfg.fill ? '' : ' style="height:' + (cfg.height || 280) + 'px"') + '></div>'; };
  /* Esconde itens da linha do tempo que não cabem no cartão (nada fica cortado pela metade) */
  CA.fitTimeline = function (root) {
    (root || document).querySelectorAll('.tl:not(.tl-all)').forEach(function (tl) {
      var kids = [].slice.call(tl.children); kids.forEach(function (k) { k.hidden = false; });
      var lim = tl.getBoundingClientRect().bottom, hid = 0;
      kids.forEach(function (k) { if (k.getBoundingClientRect().bottom > lim + 1) { k.hidden = true; if (k.classList.contains('tl-i')) hid++; } });
      for (var i = kids.length - 1; i >= 0; i--) { if (kids[i].hidden) continue; if (kids[i].classList.contains('tl-d')) kids[i].hidden = true; break; }
      var more = tl.parentNode.querySelector('.tl-more'); if (more) { more.textContent = hid ? '+' + hid + ' na agenda' : ''; more.hidden = !hid; }
    });
  };
  CA.mountCharts = function (root) {
    CA.fitTimeline(root);
    (root || document).querySelectorAll('.chart-box[data-chart]').forEach(function (box) { var cfg = REG[box.getAttribute('data-chart')]; if (cfg) (cfg.kind === 'hero' ? drawHero : cfg.kind === 'bars' ? drawBars : draw)(box, cfg); });
  };
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { CA.mountCharts(); }, 150); });

  function draw(box, cfg) {
    var W = Math.max(280, box.clientWidth), H = cfg.height || 280, mobile = W < 560;
    var n = cfg.labels.length; if (!n) { box.innerHTML = '<div class="empty">Sem dados para o período.</div>'; return; }
    var R = 12, T = 14, B = 30, L;
    var all = []; cfg.series.forEach(function (s) { if (!s.hidden) s.values.forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    var hasBar = cfg.series.some(function (s) { return s.type === 'bar' && !s.hidden; });
    var mx = Math.max.apply(null, all.concat([0])), mn = Math.min.apply(null, all.concat([0]));
    var nk = nice(mx || 1, mn < 0 ? mn : 0);
    var fmt = cfg.yfmt || kfmt; L = axisW(nk, mobile, fmt);
    var y = function (v) { return T + (H - T - B) * (1 - (v - nk.lo) / ((nk.hi - nk.lo) || 1)); };
    var step = (W - L - R) / n, cx = function (i) { return L + step * i + step / 2; };
    var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || 'Gráfico') + '">';
    for (var v = nk.lo; v <= nk.hi + 1e-6; v += nk.step) s += '<line class="gl' + (Math.abs(v) < 1e-6 ? ' z' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="yt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    // faixas de ano
    if (cfg.yearBands) {
      for (var i = 0; i < n; i++) if (i > 0 && cfg.labels[i].slice(5, 7) === '01') s += '<line class="yb" x1="' + (L + step * i) + '" x2="' + (L + step * i) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
    }
    // barras agrupadas
    var bars = cfg.series.filter(function (x) { return x.type === 'bar' && !x.hidden; }), gw = Math.min(step * .72, cfg.barMax || (mobile ? 26 : 44)), bw = bars.length ? gw / bars.length : 0;
    bars.forEach(function (ser, k) {
      ser.values.forEach(function (val, i) {
        if (val == null) return; var x0 = cx(i) - gw / 2 + k * bw, y0 = y(Math.max(0, val)), y1 = y(Math.min(0, val));
        s += '<rect class="bar" x="' + (x0 + .5) + '" y="' + y0 + '" width="' + Math.max(1, bw - 1.5) + '" height="' + Math.max(0, y1 - y0) + '" rx="' + Math.min(3, bw / 3) + '" style="fill:' + ser.color + (cfg.partialLast && i === n - 1 ? ';opacity:.45' : '') + '"/>';
      });
    });
    // linhas e áreas
    cfg.series.forEach(function (ser) {
      if (ser.type === 'bar' || ser.hidden) return;
      var pts = []; ser.values.forEach(function (val, i) { if (val != null && isFinite(val)) pts.push([cx(i), y(val)]); });
      if (!pts.length) return;
      var d = smooth(pts);
      if (ser.type === 'area') s += '<path d="' + d + 'L' + pts[pts.length - 1][0] + ',' + y(Math.max(nk.lo, 0)) + 'L' + pts[0][0] + ',' + y(Math.max(nk.lo, 0)) + 'Z" style="fill:' + ser.color + ';opacity:.12"/>';
      s += '<path class="ln' + (ser.type === 'dash' ? ' dash' : '') + '" d="' + d + '" style="stroke:' + ser.color + ';stroke-width:' + (ser.width || (ser.type === 'dash' ? 2 : 2.5)) + '"/>';
      if (ser.endDot !== false && ser.type !== 'dash') { var lp = pts[pts.length - 1]; s += '<circle class="end" cx="' + lp[0] + '" cy="' + lp[1] + '" r="4.5" style="stroke:' + ser.color + '"/>'; }
    });
    (cfg.hlines || []).forEach(function (hl) { s += '<line class="hl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(hl.v) + '" y2="' + y(hl.v) + '"/><text class="hlt" x="' + (L + 6) + '" y="' + (y(hl.v) + 15) + '" text-anchor="start">' + esc(hl.label) + '</text>'; });
    // marcos
    (cfg.markers || []).forEach(function (mk) {
      var mxp = cx(mk.i), myp = y(mk.v);
      s += '<circle class="mk" cx="' + mxp + '" cy="' + myp + '" r="4"/>' + (mobile ? '' : '<text class="mkt" x="' + (mxp - 6) + '" y="' + (myp - 10) + '" text-anchor="end">' + esc(mk.label) + '</text>');
    });
    // eixo X
    var every = Math.max(1, Math.ceil(n / (mobile ? 6 : 13)));
    for (i = 0; i < n; i++) {
      var tl = cfg.ticks ? cfg.ticks(i, every) : (i % every === 0 ? cfg.labels[i] : '');
      if (tl) s += '<text class="xt" x="' + cx(i) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(tl) + '</text>';
    }
    s += '<line class="guide" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" style="opacity:0"/>';
    s += '<rect class="hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/></svg><div class="tip" hidden></div>';
    box.innerHTML = s;
    if (!cfg.tip) return;
    var svg = box.querySelector('svg'), tip = box.querySelector('.tip'), guide = box.querySelector('.guide'), last = -1;
    function show(clientX) {
      var r = svg.getBoundingClientRect(), x = clientX - r.left, i = Math.max(0, Math.min(n - 1, Math.floor((x - L) / step)));
      if (i === last) return; last = i;
      guide.setAttribute('x1', cx(i)); guide.setAttribute('x2', cx(i)); guide.style.opacity = 1;
      tip.innerHTML = cfg.tip(i); tip.hidden = false;
      var tw = tip.offsetWidth, left = cx(i) + 14; if (left + tw > W - 4) left = cx(i) - tw - 14; if (left < 4) left = 4;
      tip.style.left = left + 'px';
    }
    function hide() { tip.hidden = true; guide.style.opacity = 0; last = -1; }
    svg.addEventListener('pointermove', function (e) { show(e.clientX); });
    svg.addEventListener('pointerdown', function (e) { show(e.clientX); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    if (cfg.initialTip != null) { var r0 = svg.getBoundingClientRect(); show(r0.left + cx(cfg.initialTip)); }
  }


  /* ===== Gráfico principal do painel: colunas empilhadas (lucro + despesas por grupo) e linha da receita =====
     cfg = { kind:'hero', months:[{ym,rec,desp,res,g:{grupo:valor}}], groups:[[nome,cor]], partialLast, tick:fn(i), tip:fn(i) } */
  function txtW(t, px) { return t.length * px * .56; }
  function drawHero(box, cfg) {
    var W = Math.max(280, box.clientWidth), H = cfg.height || 320, mobile = W < 620, id = box.getAttribute('data-chart');
    var ms = cfg.months, n = ms.length, groups = cfg.groups;
    var mx = 0; ms.forEach(function (m) { mx = Math.max(mx, m.rec, m.desp); });
    var nk = nice((mx || 1) * 1.08, 0);
    var callW = mobile ? 0 : 150, L = axisW(nk, mobile) + (mobile ? 0 : 18), R = (mobile ? 6 : 10) + callW, T = 30, B = 34;
    var y = function (v) { return T + (H - T - B) * (1 - v / (nk.hi || 1)); };
    var step = (W - L - R) / n, cx = function (i) { return L + step * i + step / 2; };
    var gw = Math.min(step * (n > 8 ? .6 : .7), 100), lx = [], best = 0;
    ms.forEach(function (m, i) { if (!(cfg.partialLast && i === n - 1) && m.rec > ms[best].rec) best = i; });
    var s = '<svg class="hero" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '') + '">'
      + '<defs><pattern id="' + id + 'hx" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#fff" stroke-width="2.4" opacity=".35"/></pattern></defs>';
    for (var v = 0; v <= nk.hi + 1e-6; v += nk.step) s += '<line class="gl' + (v === 0 ? ' z' : '') + '" x1="' + L + '" x2="' + (W - R + (mobile ? 0 : 6)) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="yt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(CA.brl(v)) + '</text>';
    if (!mobile) s += '<text class="ytit" transform="translate(12,' + ((T + H - B) / 2) + ') rotate(-90)" text-anchor="middle">Receita mensal (R$)</text>';
    var i, segsLast = [];
    for (i = 0; i < n; i++) {
      var m = ms[i], x = cx(i) - gw / 2, part = cfg.partialLast && i === n - 1, base = 0;
      var stack = [['Lucro líquido', 'var(--st-lucro)', Math.max(0, m.rec - m.desp), true]];
      groups.forEach(function (g) { if (m.g[g[0]] > 0) stack.push([g[0], g[1], m.g[g[0]]]); });
      s += '<g class="col" data-i="' + i + '">';
      stack.forEach(function (sg) {
        var y1 = y(base), y2 = y(base + sg[2]); base += sg[2];
        var hgt = Math.max(0, y1 - y2);
        s += '<rect x="' + x + '" y="' + y2 + '" width="' + gw + '" height="' + hgt + '" style="fill:' + sg[1] + '"/>';
        if (part && hgt > 0) s += '<rect x="' + x + '" y="' + y2 + '" width="' + gw + '" height="' + hgt + '" fill="url(#' + id + 'hx)"/>';
        if (i === n - 1) segsLast.push([sg[0], sg[1], (y1 + y2) / 2]);
        if (sg[3] && hgt > 24) {
          var t = CA.brl(sg[2]), fs = mobile ? 9.5 : 11;
          if (txtW(t, fs) <= gw - 4) s += '<text class="inl pv" x="' + cx(i) + '" y="' + ((y1 + y2) / 2 + 4) + '" text-anchor="middle" style="font-size:' + fs + 'px">' + esc(t) + '</text>';
        }
      });
      s += '</g>';
      lx.push([cx(i), y(m.rec)]);
    }
    // linha da receita
    s += '<path class="rln" d="M' + lx.map(function (p) { return p[0] + ',' + p[1]; }).join('L') + '"/>';
    var lfs = mobile ? 9.5 : 11.5;
    lx.forEach(function (p, k) {
      s += '<g class="col" data-i="' + k + '"><circle class="rdot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (mobile ? 4 : 5.5) + '"/>';
      var t = CA.brl(ms[k].rec), fits = txtW(t, lfs) <= step - 4;
      if (fits || k === best || k === n - 1) s += '<text class="rlbl pv' + (k === best ? ' b' : '') + '" x="' + Math.min(Math.max(p[0], L + txtW(t, lfs) / 2), W - R - txtW(t, lfs) / 2 + (mobile ? 0 : 8)) + '" y="' + (p[1] - 12) + '" text-anchor="middle" style="font-size:' + lfs + 'px">' + esc(t) + '</text>';
      s += '</g>';
    });
    // rótulos com setas (como na referência), alinhados à última coluna
    if (!mobile) {
      var ax = cx(n - 1) + gw / 2, tx = W - callW + 22, items = [['Receita', 'var(--st-line)', lx[n - 1][1], true]].concat(segsLast.slice().reverse());
      var lastY = -1e9; items.forEach(function (it) { it.ly = Math.max(it[2], lastY + 19); lastY = it.ly; });
      var over = lastY - (H - B - 4); if (over > 0) items.forEach(function (it) { it.ly -= over; });
      items.forEach(function (it) {
        var sx = it[3] ? lx[n - 1][0] + 8 : ax;
        s += '<g class="callout"><circle cx="' + sx + '" cy="' + it[2] + '" r="3.2" style="fill:var(--surface);stroke:' + it[1] + '"/><path d="M' + (sx + 3.5) + ',' + it[2] + ' L' + (tx - 22) + ',' + it[2] + ' L' + (tx - 12) + ',' + it.ly + ' L' + (tx - 6) + ',' + it.ly + '"/><path class="arw" d="M' + (tx - 6) + ',' + (it.ly - 3.5) + ' L' + (tx - 1) + ',' + it.ly + ' L' + (tx - 6) + ',' + (it.ly + 3.5) + 'Z"/><text x="' + (tx + 3) + '" y="' + (it.ly + 4) + '">' + esc(it[0]) + '</text></g>';
      });
    }
    for (i = 0; i < n; i++) s += '<text class="xt' + (cfg.partialLast && i === n - 1 ? ' now' : '') + '" x="' + cx(i) + '" y="' + (H - 14) + '" text-anchor="middle">' + esc(cfg.tick(i)) + '</text>' + (cfg.partialLast && i === n - 1 ? '<text class="xs" x="' + cx(i) + '" y="' + (H - 2) + '" text-anchor="middle">em andamento</text>' : '');
    s += '<rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + (H - B) + '" fill="transparent"/></svg><div class="tip" hidden></div>';
    box.innerHTML = s;
    var svg = box.querySelector('svg'), tip = box.querySelector('.tip'), cols = svg.querySelectorAll('.col'), last = -1;
    function show(clientX) {
      var r = svg.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((clientX - r.left - L) / step)));
      if (k === last) return; last = k;
      svg.classList.add('hov'); cols.forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-i') === k); });
      tip.innerHTML = cfg.tip(k); tip.hidden = false;
      var tw = tip.offsetWidth, left = cx(k) + gw / 2 + 12; if (left + tw > W - 4) left = cx(k) - gw / 2 - tw - 12; if (left < 4) left = 4;
      tip.style.left = left + 'px';
    }
    function hide() { tip.hidden = true; svg.classList.remove('hov'); last = -1; }
    svg.addEventListener('pointermove', function (e) { show(e.clientX); });
    svg.addEventListener('pointerdown', function (e) { show(e.clientX); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
  }


  /* ===== Colunas de receita com despesas no topo, média e projeção do mês =====
     cfg = { kind:'bars', fill, months:[{ym,rec,desp}], avg, proj, partialLast, tick:fn(i), tip:fn(i) } */
  function topRound(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function drawBars(box, cfg) {
    var W = Math.max(280, box.clientWidth), H = Math.max(160, box.clientHeight || cfg.height || 280), mobile = W < 620;
    var ms = cfg.months, n = ms.length, last = n - 1;
    var mx = Math.max(1, cfg.avg || 0, cfg.proj || 0); ms.forEach(function (m) { mx = Math.max(mx, m.rec, m.desp); });
    var nk = nice(mx * 1.06, 0), L = axisW(nk, mobile) + 6, R = 8, T = 22, B = 24;
    var y = function (v) { return T + (H - T - B) * (1 - v / (nk.hi || 1)); };
    var st = (W - L - R) / n, cx = function (i) { return L + st * i + st / 2; }, bw = Math.min(st * .52, 46);
    var best = -1; ms.forEach(function (m, i) { if (!(cfg.partialLast && i === last) && (best < 0 || m.rec > ms[best].rec)) best = i; });
    var s = '<svg class="bars" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '') + '">';
    for (var v = 0; v <= nk.hi + 1e-6; v += nk.step) s += '<line class="gl' + (v === 0 ? ' z' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="yt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(CA.brl(v)) + '</text>';
    ms.forEach(function (m, i) {
      var x = cx(i) - bw / 2, part = cfg.partialLast && i === last, top = Math.max(m.rec, m.desp), r = Math.min(4, bw / 4);
      s += '<g class="col" data-i="' + i + '">';
      if (top > 0) {
        s += '<path class="b' + (part ? ' part' : i === best ? ' best' : '') + '" d="' + topRound(x, y(top), bw, y(0) - y(top), r) + '"/>';
        if (m.desp > 0) { var hd = Math.max(3, y(0) - y(m.desp)); s += '<path class="dsp" d="' + topRound(x, y(top), bw, Math.min(hd, y(0) - y(top)), r) + '"/>'; }
      }
      if (part && cfg.proj > top) s += '<rect class="proj" x="' + x + '" y="' + y(cfg.proj) + '" width="' + bw + '" height="' + (y(top) - y(cfg.proj)) + '" rx="' + r + '"/>';
      var lbl = i === best || (part && (m.rec > 0 || cfg.proj > 0));
      if (lbl) { var ly = part ? y(Math.max(top, cfg.proj || 0)) : y(top); s += '<text class="bl pv' + (i === best ? ' b' : '') + '" x="' + Math.min(cx(i), W - R - 34) + '" y="' + (ly - 7) + '" text-anchor="middle">' + esc(CA.brl(m.rec)) + '</text>'; }
      s += '<text class="xt' + (part ? ' now' : '') + '" x="' + cx(i) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(cfg.tick(i)) + '</text></g>';
    });
    if (cfg.avg > 0) s += '<line class="avg" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(cfg.avg) + '" y2="' + y(cfg.avg) + '"/><text class="avgt" x="' + (L + 8) + '" y="' + (y(cfg.avg) - 6) + '">média mensal ' + esc(CA.brl(cfg.avg)) + '</text>';
    s += '<rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent"/></svg><div class="tip" hidden></div>';
    box.innerHTML = s;
    var svg = box.querySelector('svg'), tip = box.querySelector('.tip'), cols = svg.querySelectorAll('.col'), lastI = -1;
    function show(clientX) {
      var rr = svg.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((clientX - rr.left - L) / st)));
      if (k === lastI) return; lastI = k;
      svg.classList.add('hov'); cols.forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-i') === k); });
      tip.innerHTML = cfg.tip(k); tip.hidden = false;
      var tw = tip.offsetWidth, left = cx(k) + bw / 2 + 12; if (left + tw > W - 4) left = cx(k) - bw / 2 - tw - 12; if (left < 4) left = 4;
      tip.style.left = left + 'px';
    }
    function hide() { tip.hidden = true; svg.classList.remove('hov'); lastI = -1; }
    svg.addEventListener('pointermove', function (e) { show(e.clientX); });
    svg.addEventListener('pointerdown', function (e) { show(e.clientX); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
  }

  /* Medidor em arco (270°) */
  CA.gauge = function (pct, label, sub, tone) {
    var p = Math.max(0, Math.min(100, pct == null ? 0 : pct)), r = 42, c = 2 * Math.PI * r, arc = c * .75;
    var txt = pct == null ? '—' : (tone === 'signed' ? (pct >= 0 ? '+' : '−') + Math.abs(Math.round(pct)) : Math.round(pct)) + (pct == null ? '' : '%');
    var p2 = tone === 'signed' ? Math.min(100, Math.abs(pct || 0)) : p;
    return '<div class="gauge' + (tone === 'signed' && pct < 0 ? ' neg' : '') + '"><div class="g-w"><svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(135 50 50)">'
      + '<circle class="g-tr" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + arc + ' ' + c + '"/>'
      + '<circle class="g-v" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + (arc * p2 / 100) + ' ' + c + '"/></g></svg>'
      + '<b class="num">' + txt + '</b></div><div class="g-txt"><span class="g-l">' + esc(label) + '</span>' + (sub ? '<span class="g-s">' + sub + '</span>' : '') + '</div></div>';
  };

  /* Quadro de detalhe padrão de um mês */
  CA.tipMonth = function (title, rows, foot) {
    return '<b>' + esc(title) + '</b>' + rows.map(function (r) { return '<div class="tr"><span class="sw" style="background:' + r[2] + '"></span><span>' + esc(r[0]) + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + (foot ? '<div class="tf">' + foot + '</div>' : '');
  };
})(window.CA);
