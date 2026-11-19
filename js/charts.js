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
    (root || document).querySelectorAll('.chart-box[data-chart]').forEach(function (box) { var cfg = REG[box.getAttribute('data-chart')]; if (cfg) draw(box, cfg); });
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

  /* Quadro de detalhe padrão de um mês */
  CA.tipMonth = function (title, rows, foot) {
    return '<b>' + esc(title) + '</b>' + rows.map(function (r) { return '<div class="tr"><span class="sw" style="background:' + r[2] + '"></span><span>' + esc(r[0]) + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + (foot ? '<div class="tf">' + foot + '</div>' : '');
  };
})(window.CA);
