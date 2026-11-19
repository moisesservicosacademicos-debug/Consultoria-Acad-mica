/* Gráficos interativos em SVG, desenhados na largura real do contêiner */
'use strict';
(function (CA) {
  var esc = CA.esc;
  var NS = 'http://www.w3.org/2000/svg';
  var REG = {}; // id -> config, redesenhado ao redimensionar

  /* Série mensal contínua (meses sem movimento entram com zero) */
  CA.monthSeries = function (M, from, to) {
    var out = [], ym = from;
    while (ym <= to) { var m = M.monthOf(ym); out.push({ ym: ym, rec: m.rec, desp: m.desp, res: m.res, mens: m.mens, event: m.event, extra: m.extra, outro: m.outro }); ym = CA.ymAdd(ym, 1); }
    return out;
  };
  CA.movAvg = function (arr, n) { return arr.map(function (_, i) { if (i < n - 1) return null; var s = 0; for (var j = i - n + 1; j <= i; j++) s += arr[j]; return s / n; }); };

  function nice(max, min) {
    var span = Math.max(1, max - min), raw = span / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { step: step, lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step };
  }
  function kfmt(v) {
    var a = Math.abs(v);
    if (a >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: a >= 10000 ? 0 : 1 }) + ' mil';
    return Math.round(v).toLocaleString('pt-BR');
  }
  CA.kfmt = kfmt;
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
  CA.chart = function (id, cfg) { REG[id] = cfg; return '<div class="chart-box" data-chart="' + esc(id) + '" style="height:' + (cfg.height || 280) + 'px"></div>'; };
  CA.mountCharts = function (root) {
    (root || document).querySelectorAll('.chart-box[data-chart]').forEach(function (box) { var cfg = REG[box.getAttribute('data-chart')]; if (cfg) (cfg.kind === 'hero' ? drawHero : draw)(box, cfg); });
  };
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { CA.mountCharts(); }, 150); });

  function draw(box, cfg) {
    var W = Math.max(280, box.clientWidth), H = cfg.height || 280, mobile = W < 560;
    var n = cfg.labels.length; if (!n) { box.innerHTML = '<div class="empty">Sem dados para o período.</div>'; return; }
    var L = mobile ? 40 : 54, R = 12, T = 14, B = 30;
    var all = []; cfg.series.forEach(function (s) { if (!s.hidden) s.values.forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    var hasBar = cfg.series.some(function (s) { return s.type === 'bar' && !s.hidden; });
    var mx = Math.max.apply(null, all.concat([0])), mn = Math.min.apply(null, all.concat([0]));
    var nk = nice(mx || 1, mn < 0 ? mn : 0);
    var y = function (v) { return T + (H - T - B) * (1 - (v - nk.lo) / ((nk.hi - nk.lo) || 1)); };
    var step = (W - L - R) / n, cx = function (i) { return L + step * i + step / 2; };
    var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || 'Gráfico') + '">';
    for (var v = nk.lo; v <= nk.hi + 1e-6; v += nk.step) s += '<line class="gl' + (Math.abs(v) < 1e-6 ? ' z' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="yt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + kfmt(v) + '</text>';
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


  /* ===== Gráfico principal do painel =====
     cfg = { kind:'hero', mode:'comp'|'yoy', cur:[{ym,rec,desp,res}], prev:[...12 meses anteriores], tip: fn(i), height } */
  function topRound(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function drawHero(box, cfg) {
    var W = Math.max(280, box.clientWidth), H = cfg.height || 300, mobile = W < 560, id = box.getAttribute('data-chart');
    var cur = cfg.cur, prev = cfg.prev, n = cur.length, yoy = cfg.mode === 'yoy';
    var L = mobile ? 34 : 46, R = mobile ? 6 : 10, T = 28, B = 30;
    var hasPrev = prev.some(function (m) { return m.rec > 0; });
    var mx = 0; cur.forEach(function (m, i) { mx = Math.max(mx, m.rec, m.desp, hasPrev ? prev[i].rec : 0); });
    var nk = nice((mx || 1) * 1.04, 0);
    var y = function (v) { return T + (H - T - B) * (1 - v / (nk.hi || 1)); };
    var step = (W - L - R) / n, cx = function (i) { return L + step * i + step / 2; };
    var best = 0; cur.forEach(function (m, i) { if (i < n - 1 && m.rec > cur[best].rec) best = i; });
    var s = '<svg class="hero' + (yoy ? ' yoy' : '') + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '') + '"><defs>'
      + '<linearGradient id="' + id + 'gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--hero-a)"/><stop offset="1" style="stop-color:var(--hero-b)"/></linearGradient>'
      + '<linearGradient id="' + id + 'gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--out);stop-opacity:.95"/><stop offset="1" style="stop-color:var(--out);stop-opacity:.7"/></linearGradient>'
      + '<linearGradient id="' + id + 'aC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--hero-a);stop-opacity:.34"/><stop offset="1" style="stop-color:var(--hero-a);stop-opacity:0"/></linearGradient>'
      + '<linearGradient id="' + id + 'aP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--hero-ghost);stop-opacity:.30"/><stop offset="1" style="stop-color:var(--hero-ghost);stop-opacity:0"/></linearGradient>'
      + '<pattern id="' + id + 'hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--hero-a);opacity:.16"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--hero-a);stroke-width:2.2;opacity:.55"/></pattern>'
      + '</defs>';
    for (var v = 0; v <= nk.hi + 1e-6; v += nk.step) s += '<line class="gl' + (v === 0 ? ' z' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="yt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (v ? kfmt(v).replace(' mil', 'k') : '0') + '</text>';
    var i;
    if (!yoy) {
      var gw = Math.min(step * .56, mobile ? 20 : 34);
      for (i = 0; i < n; i++) {
        var m = cur[i], x = cx(i) - gw / 2, part = cfg.partialLast && i === n - 1;
        var lucro = Math.max(0, m.rec - m.desp), dsp = Math.min(m.desp, Math.max(m.rec, m.desp)), top = Math.max(m.rec, m.desp);
        s += '<g class="col' + (i === best ? ' best' : '') + '" data-i="' + i + '">';
        if (top > 0) {
          var yT = y(top), yL = y(lucro), y0 = y(0);
          // coluna inteira com cantos superiores arredondados; lucro embaixo, despesas em cima
          s += '<clipPath id="' + id + 'c' + i + '"><path d="' + topRound(x, yT, gw, y0 - yT, mobile ? 4 : 6) + '"/></clipPath><g clip-path="url(#' + id + 'c' + i + ')">';
          if (lucro > 0) s += '<rect x="' + x + '" y="' + yL + '" width="' + gw + '" height="' + (y0 - yL) + '" style="fill:url(#' + id + (part ? 'hx' : 'gP') + ')"/>';
          if (dsp > 0) s += '<rect x="' + x + '" y="' + yT + '" width="' + gw + '" height="' + Math.max(0, yL - yT - (lucro > 0 ? 1.5 : 0)) + '" style="fill:url(#' + id + 'gD)' + (part ? ';opacity:.5' : '') + '"/>';
          s += '</g>';
          var showLbl = !mobile || i === best || i === n - 1;
          if (showLbl && m.rec > 0) s += '<text class="vlbl pv' + (i === best ? ' b' : '') + '" x="' + cx(i) + '" y="' + (yT - 8) + '" text-anchor="middle">' + kfmt(m.rec).replace(' mil', 'k') + '</text>';
        }
        s += '</g>';
      }
      if (hasPrev) for (i = 0; i < n; i++) if (prev[i].rec > 0) {
        var ty = y(prev[i].rec), tw = gw / 2 + (mobile ? 3 : 6);
        s += '<g class="col" data-i="' + i + '"><line class="tick-a" x1="' + (cx(i) - tw) + '" x2="' + (cx(i) + tw) + '" y1="' + ty + '" y2="' + ty + '"/><line class="tick" x1="' + (cx(i) - tw) + '" x2="' + (cx(i) + tw) + '" y1="' + ty + '" y2="' + ty + '"/></g>';
      }
    } else {
      var pc = cur.map(function (m, k) { return [cx(k), y(m.rec)]; }), dC = smooth(pc), y0b = y(0);
      if (hasPrev) {
        var pq = prev.map(function (m, k) { return [cx(k), y(m.rec)]; }), dP = smooth(pq);
        s += '<path d="' + dP + 'L' + pq[n - 1][0] + ',' + y0b + 'L' + pq[0][0] + ',' + y0b + 'Z" style="fill:url(#' + id + 'aP)"/><path class="ln yp" d="' + dP + '"/>';
      }
      s += '<path d="' + dC + 'L' + pc[n - 1][0] + ',' + y0b + 'L' + pc[0][0] + ',' + y0b + 'Z" style="fill:url(#' + id + 'aC)"/><path class="ln yc" d="' + dC + '"/>';
      pc.forEach(function (p, k) { s += '<g class="col" data-i="' + k + '"><circle class="yd" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (k === n - 1 ? 4.5 : 3) + '"/></g>'; });
    }
    for (i = 0; i < n; i++) s += '<text class="xt' + (i === n - 1 ? ' now' : '') + '" x="' + cx(i) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(cfg.tick(i)) + '</text>';
    s += '<line class="guide" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" style="opacity:0"/><rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + (H - B) + '" fill="transparent"/></svg><div class="tip" hidden></div>';
    box.innerHTML = s;
    var svg = box.querySelector('svg'), tip = box.querySelector('.tip'), guide = box.querySelector('.guide'), cols = svg.querySelectorAll('.col'), last = -1;
    function show(clientX) {
      var r = svg.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((clientX - r.left - L) / step)));
      if (k === last) return; last = k;
      svg.classList.add('hov'); cols.forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-i') === k); });
      if (yoy) { guide.setAttribute('x1', cx(k)); guide.setAttribute('x2', cx(k)); guide.style.opacity = 1; }
      tip.innerHTML = cfg.tip(k); tip.hidden = false;
      var tw = tip.offsetWidth, left = cx(k) + 18; if (left + tw > W - 4) left = cx(k) - tw - 18; if (left < 4) left = 4;
      tip.style.left = left + 'px';
    }
    function hide() { tip.hidden = true; guide.style.opacity = 0; svg.classList.remove('hov'); last = -1; }
    svg.addEventListener('pointermove', function (e) { show(e.clientX); });
    svg.addEventListener('pointerdown', function (e) { show(e.clientX); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
  }

  /* Quadro de detalhe padrão de um mês */
  CA.tipMonth = function (title, rows, foot) {
    return '<b>' + esc(title) + '</b>' + rows.map(function (r) { return '<div class="tr"><span class="sw" style="background:' + r[2] + '"></span><span>' + esc(r[0]) + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + (foot ? '<div class="tf">' + foot + '</div>' : '');
  };
})(window.CA);
