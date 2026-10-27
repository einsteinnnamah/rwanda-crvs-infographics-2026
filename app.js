/**
 * Who Gets Counted? — Rwanda Vital Statistics 2019–2025
 * Dynamic infographic. Data validated against NISR Final Tables_CRVS_2025_0.xlsx (see DATA_AUDIT_REPORT.md).
 *
 * Libraries: rough.js (hand-drawn charts), GSAP 3.13 + ScrollTrigger + ScrollSmoother (motion), Leaflet (district map).
 * Structure: a paged reader. The cover (hero + key findings) and nine chapters are separate pages; only one is
 * visible at a time and you move between them with the previous / next cards, the chapters index, or arrow keys.
 */

(function () {
  'use strict';

  const DATA = window.RWANDA_CRVS_DATA;
  if (!DATA) { console.error('Data not loaded'); return; }

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = window.matchMedia('(pointer: coarse)').matches;
  const SEED = 11;
  const EASE = 'power3.out';

  const fmt = n => Math.round(n).toLocaleString('en-US');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ------------------------------------------------------------
  // Design tokens (read from CSS so the theme toggle re-colours everything)
  // ------------------------------------------------------------
  const C = {};
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    Object.assign(C, { ink: v('--ink'), paper: v('--paper'), muted: v('--muted'), accent: v('--accent-fill') || v('--accent'), accentText: v('--accent'), blue: v('--blue'), ochre: v('--ochre'), plum: v('--plum'),
      invBg: v('--inv-bg'), invFg: v('--inv-fg'), invMuted: v('--inv-muted'), invAccent: v('--inv-accent'), invBlue: v('--inv-blue'),
      map: [v('--map-1'), v('--map-2'), v('--map-3'), v('--map-4')] });
  }
  readTokens();

  // ------------------------------------------------------------
  // i18n
  // ------------------------------------------------------------
  let LANG = 'en';
  const DICT = window.I18N || {};
  const t = (key, vars) => {
    let out = (LANG !== 'en' && DICT[LANG] && DICT[LANG][key]) || key;
    if (vars) Object.keys(vars).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
  };
  const originals = new WeakMap();
  function translateDom(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(n) {
      const p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.nodeName; if (tag === 'SCRIPT' || tag === 'STYLE' || p.closest('svg,canvas,.leaflet-container,.signpost')) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if (!originals.has(n)) originals.set(n, n.nodeValue);
      const orig = originals.get(n);
      const key = orig.replace(/\s+/g, ' ').trim();
      const tr = t(key);
      if (tr === key) { n.nodeValue = orig; return; }
      const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
      n.nodeValue = lead + tr + trail;
    });
  }

  // ------------------------------------------------------------
  // Tooltip
  // ------------------------------------------------------------
  const tip = $('#tip');
  function showTip(text, x, y) { tip.textContent = text; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.setAttribute('data-show', ''); }
  function hideTip() { tip.removeAttribute('data-show'); }
  function bindTip(el, text) {
    el.style.cursor = 'crosshair';
    const show = e => showTip(typeof text === 'function' ? text() : text, e.clientX, e.clientY);
    el.addEventListener('pointermove', show); el.addEventListener('pointerdown', show); el.addEventListener('pointerleave', hideTip);
  }

  // ------------------------------------------------------------
  // rough.js helpers
  // ------------------------------------------------------------
  const NS = 'http://www.w3.org/2000/svg';
  function makeSvg(container, w, h) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('role', 'img');
    container.innerHTML = ''; container.appendChild(svg);
    return svg;
  }
  function text(svg, x, y, str, opts = {}) {
    const el = document.createElementNS(NS, 'text');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('font-family', opts.serif ? "'Instrument Serif', Georgia, serif" : (opts.sans ? "'Inter Tight', sans-serif" : "'Space Mono', monospace"));
    el.setAttribute('font-size', opts.size || 12); el.setAttribute('fill', opts.fill || C.ink);
    if (opts.anchor) el.setAttribute('text-anchor', opts.anchor);
    if (opts.weight) el.setAttribute('font-weight', opts.weight);
    if (opts.upper) el.setAttribute('style', 'text-transform:uppercase;letter-spacing:0.04em');
    if (opts.halo) { el.setAttribute('paint-order', 'stroke'); el.setAttribute('stroke', opts.halo); el.setAttribute('stroke-width', opts.haloW || 6); el.setAttribute('stroke-linejoin', 'round'); }
    el.textContent = str; svg.appendChild(el);
    return el;
  }
  const hit = (svg, tag, attrs, tipText) => { const h = document.createElementNS(NS, tag); Object.keys(attrs).forEach(k => h.setAttribute(k, attrs[k])); h.setAttribute('fill', 'transparent'); h.setAttribute('class', 'hit'); svg.appendChild(h); bindTip(h, tipText); return h; };
  const fillOpts = (color, extra = {}) => Object.assign({ stroke: C.ink, strokeWidth: 1.6, roughness: 1.8, bowing: 1.2, fill: color, fillStyle: 'hachure', hachureGap: 5, fillWeight: 1.1, hachureAngle: -45, seed: SEED }, extra);

  function roughPie(container, slices) {
    if (!container || !window.rough) return;
    const size = 440, cx = size / 2, cy = size / 2, r = 190;
    const svg = makeSvg(container, size, size); const rc = rough.svg(svg);
    const total = slices.reduce((a, s) => a + s.value, 0); let a0 = -Math.PI / 2;
    slices.forEach((s, i) => {
      const a1 = a0 + (s.value / total) * Math.PI * 2, mid = (a0 + a1) / 2, large = (a1 - a0) > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
      svg.appendChild(rc.path(d, fillOpts(s.color, { hachureAngle: s.angle ?? (i % 2 ? 45 : -45), seed: SEED + i })));
      hit(svg, 'path', { d }, `${s.label}: ${s.pct}%`);
      const lr = r * 0.62;
      const lab = text(svg, cx + lr * Math.cos(mid), cy + lr * Math.sin(mid), `${s.pct}%`, { serif: true, size: 36, anchor: 'middle', halo: C.paper });
      lab.setAttribute('dominant-baseline', 'middle');
      a0 = a1;
    });
    svg.setAttribute('aria-label', slices.map(s => `${s.label} ${s.pct}%`).join(', '));
  }

  function roughHBars(container, rows, opts = {}) {
    if (!container || !window.rough) return;
    const w = 640, rowH = opts.rowH || 54, padL = opts.padL || 110, padR = 110, top = 10;
    const svg = makeSvg(container, w, top + rows.length * rowH + 10); const rc = rough.svg(svg);
    const max = opts.max || Math.max(...rows.map(r => r.value)), plotW = w - padL - padR;
    rows.forEach((r, i) => {
      const y = top + i * rowH, bw = Math.max(4, (r.value / max) * plotW), bh = rowH - 14;
      if (r.ghost) svg.appendChild(rc.rectangle(padL, y, (r.ghost / max) * plotW, bh, { stroke: C.ink, strokeWidth: 1.2, roughness: 1.6, fill: 'none', seed: SEED + i, strokeLineDash: [4, 4] }));
      svg.appendChild(rc.rectangle(padL, y, bw, bh, fillOpts(r.color, { hachureAngle: r.angle ?? -45, seed: SEED + 7 + i })));
      hit(svg, 'rect', { x: padL, y, width: plotW, height: bh }, r.tip || `${r.label}: ${fmt(r.value)}`);
      text(svg, padL - 12, y + bh / 2 + 4, r.label, { sans: true, size: 15, anchor: 'end', weight: 500 });
      text(svg, padL + bw + 10, y + bh / 2 + 5, r.valueLabel || fmt(r.value), { serif: true, size: 22 });
    });
    svg.setAttribute('aria-label', rows.map(r => `${r.label} ${r.valueLabel || r.value}`).join(', '));
  }

  // Two full-length bars (one per sex). Each bar is 100% of expected deaths, split into registered and not registered.
  function roughSplitBars(container, rows) {
    if (!container || !window.rough) return;
    const w = 640, rowH = 118, padL = 84, padR = 16, top = 26;
    const svg = makeSvg(container, w, top + rows.length * rowH); const rc = rough.svg(svg);
    const plotW = w - padL - padR;
    rows.forEach((r, i) => {
      const y = top + i * rowH, bh = 56, regW = (r.reg / r.exp) * plotW, pct = (r.reg / r.exp) * 100;
      // not registered: dashed outline, faint cross-hatch
      svg.appendChild(rc.rectangle(padL + regW, y, plotW - regW, bh, { stroke: C.ink, strokeWidth: 1.2, roughness: 1.5, seed: SEED + i, strokeLineDash: [5, 5], fill: C.muted, fillStyle: 'cross-hatch', hachureGap: 11, fillWeight: 0.5 }));
      // registered: solid hatched
      svg.appendChild(rc.rectangle(padL, y, regW, bh, fillOpts(r.color, { hachureAngle: r.angle, seed: SEED + 7 + i })));
      hit(svg, 'rect', { x: padL, y, width: regW, height: bh }, `${r.label}: ${fmt(r.reg)} ${t('registered')} (${pct.toFixed(1)}%)`);
      hit(svg, 'rect', { x: padL + regW, y, width: plotW - regW, height: bh }, `${r.label}: ${fmt(r.exp - r.reg)} ${t('not registered')} (${(100 - pct).toFixed(1)}%)`);
      text(svg, padL - 14, y + bh / 2 + 6, r.label, { sans: true, size: 17, anchor: 'end', weight: 500 });
      text(svg, padL, y - 9, `${t('Expected')} ${fmt(r.exp)}`, { size: 11, upper: true, fill: C.muted });
      text(svg, padL + regW / 2, y + bh / 2 + 10, `${pct.toFixed(1)}%`, { serif: true, size: 30, anchor: 'middle', halo: C.paper, haloW: 7 });
      text(svg, padL + regW + (plotW - regW) / 2, y + bh / 2 + 7, `${(100 - pct).toFixed(1)}%`, { serif: true, size: 22, anchor: 'middle', halo: C.paper, haloW: 6, fill: C.ink });
      text(svg, padL, y + bh + 20, `${fmt(r.reg)} ${t('registered')}`, { sans: true, size: 12.5, fill: r.color, weight: 600 });
      text(svg, padL + plotW, y + bh + 20, `${fmt(r.exp - r.reg)} ${t('not registered')}`, { sans: true, size: 12.5, anchor: 'end', fill: C.ink });
    });
    svg.setAttribute('aria-label', rows.map(r => `${r.label}: ${fmt(r.reg)} of ${fmt(r.exp)} expected deaths registered`).join('. '));
  }

  function roughStacked(container, segs) {
    if (!container || !window.rough) return;
    const w = 640, h = 110, bh = 64;
    const svg = makeSvg(container, w, h); const rc = rough.svg(svg);
    const total = segs.reduce((a, s) => a + s.value, 0); let x = 0;
    segs.forEach((s, i) => {
      const sw = (s.value / total) * w;
      svg.appendChild(rc.rectangle(x + (i ? 3 : 0), 8, sw - (i ? 3 : 0), bh, fillOpts(s.color, { hachureAngle: i % 2 ? 45 : -45, seed: SEED + 20 + i })));
      hit(svg, 'rect', { x, y: 8, width: sw, height: bh }, `${s.label}: ${fmt(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`);
      text(svg, x + sw / 2, 8 + bh / 2 + 10, `${((s.value / total) * 100).toFixed(0)}%`, { serif: true, size: 34, anchor: 'middle', halo: C.paper });
      text(svg, x + sw / 2, 98, s.label, { size: 11, anchor: 'middle', upper: true, fill: C.muted });
      x += sw;
    });
  }

  function roughLines(container, years, series) {
    if (!container || !window.rough) return;
    const w = 760, h = 420, padL = 56, padR = 24, padT = 24, padB = 44;
    const svg = makeSvg(container, w, h); const rc = rough.svg(svg);
    const px = i => padL + (i / (years.length - 1)) * (w - padL - padR), py = v => padT + (1 - v / 100) * (h - padT - padB);
    [0, 25, 50, 75, 100].forEach(v => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', padL); l.setAttribute('x2', w - padR); l.setAttribute('y1', py(v)); l.setAttribute('y2', py(v));
      l.setAttribute('stroke', C.ink); l.setAttribute('stroke-opacity', 0.14); svg.appendChild(l);
      text(svg, padL - 10, py(v) + 4, v + '%', { size: 11, anchor: 'end', fill: C.muted });
    });
    years.forEach((y, i) => text(svg, px(i), h - 14, y, { size: 11, anchor: 'middle', fill: C.muted }));
    const top = series[0].values, bot = series[1].values;
    const area = years.map((_, i) => `${px(i)} ${py(top[i])}`).join(' L ') + ' L ' + years.map((_, i) => `${px(i)} ${py(bot[i])}`).reverse().join(' L ') + ' Z';
    svg.appendChild(rc.path('M ' + area, { stroke: 'none', fill: C.accent, fillStyle: 'hachure', hachureGap: 9, fillWeight: 0.7, hachureAngle: -45, roughness: 1.2, seed: SEED }));
    series.forEach((s, k) => {
      const pts = s.values.map((v, i) => [px(i), py(v)]);
      svg.appendChild(rc.curve(pts, { stroke: s.color, strokeWidth: 3, roughness: 1.2, bowing: 0.6, seed: SEED + k }));
      pts.forEach(([x, y], i) => {
        svg.appendChild(rc.circle(x, y, 10, { stroke: s.color, strokeWidth: 2, fill: C.paper, fillStyle: 'solid', roughness: 0.8, seed: SEED + i }));
        hit(svg, 'circle', { cx: x, cy: y, r: 16 }, `${s.label} ${years[i]}: ${s.values[i]}%`);
      });
      const last = pts[pts.length - 1];
      text(svg, last[0] - 6, last[1] + (k ? 34 : -16), `${s.values[s.values.length - 1]}%`, { serif: true, size: 28, anchor: 'end', fill: s.color });
    });
    text(svg, (padL + w - padR) / 2, py(70) + 6, t('the gap'), { size: 11, anchor: 'middle', upper: true, fill: C.accentText });
    svg.setAttribute('aria-label', 'Birth and death registration completeness, 2019 to 2025. Births from 87.0% to 92.9%. Deaths from 31.4% to 50.5%.');
  }

  function roughDrivers(container) {
    if (!container || !window.rough) return;
    const w = 1000, h = 640;
    const svg = makeSvg(container, w, h); const rc = rough.svg(svg);
    const ink = C.ink, soft = C.muted, hot = C.accent, bg = C.paper;
    const nodes = [
      { x: 190, y: 430, r: 110, big: '55.9%', lab: t('Place'), sub: t('die in the community') },
      { x: 500, y: 140, r: 110, big: '57.9%', lab: t('Sex'), sub: t('of the missing are women') },
      { x: 830, y: 440, r: 82, big: '10.1%', lab: t('Time'), sub: t('registered late') }
    ];
    [[0, 1], [1, 2], [0, 2]].forEach(([a, b], i) => svg.appendChild(rc.line(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, { stroke: soft, strokeWidth: 1.6, roughness: 1.4, seed: SEED + i, strokeLineDash: [3, 7] })));
    const cx = (nodes[0].x + nodes[1].x + nodes[2].x) / 3, cy = (nodes[0].y + nodes[1].y + nodes[2].y) / 3;
    svg.appendChild(rc.circle(cx, cy, 136, { stroke: hot, strokeWidth: 2, fill: hot, fillStyle: 'cross-hatch', hachureGap: 7, fillWeight: 0.8, roughness: 1.6, seed: SEED }));
    text(svg, cx, cy + 10, '38,521', { serif: true, size: 40, anchor: 'middle', fill: ink, halo: bg, haloW: 8 });
    text(svg, cx, cy + 32, t('not counted'), { size: 11, anchor: 'middle', upper: true, fill: ink, halo: bg });
    nodes.forEach((n, i) => {
      svg.appendChild(rc.circle(n.x, n.y, n.r * 2, { stroke: ink, strokeWidth: 2, fill: 'none', roughness: 1.6, seed: SEED + 30 + i }));
      svg.appendChild(rc.circle(n.x, n.y, n.r * 2 + 14, { stroke: hot, strokeWidth: 1.4, fill: 'none', roughness: 1.4, seed: SEED + 40 + i, strokeLineDash: [10, 8] }));
      svg.appendChild(rc.circle(n.x, n.y, 16, { stroke: ink, strokeWidth: 2, fill: bg, fillStyle: 'solid', roughness: 0.8, seed: SEED + i }));
      text(svg, n.x, n.y - 30, n.lab, { size: 12, anchor: 'middle', upper: true, fill: soft });
      text(svg, n.x, n.y + 56, n.big, { serif: true, size: 44, anchor: 'middle', fill: ink });
      text(svg, n.x, n.y + 76, n.sub, { sans: true, size: n.r < 100 ? 10 : 11, anchor: 'middle', fill: soft });
      hit(svg, 'circle', { cx: n.x, cy: n.y, r: n.r }, `${n.lab}: ${n.big} ${n.sub}`);
    });
    svg.setAttribute('aria-label', 'Three drivers of the registration gap: place 55.9% community deaths, sex 57.9% of missing deaths are women, time 10.1% late registration. All connect to 38,521 unregistered deaths.');
  }

  // ------------------------------------------------------------
  // Charts
  // ------------------------------------------------------------
  function buildCharts() {
    const ts = DATA.timeSeriesCompleteness;
    roughLines($('#chart-twolines'), ts.map(r => r.year), [
      { label: t('Births'), color: C.blue, values: ts.map(r => r.birth) },
      { label: t('Deaths'), color: C.accent, values: ts.map(r => r.death) }
    ]);
    const sg = DATA.sexGap2025;
    roughSplitBars($('#chart-sexgap'), [
      { label: t('Men'), reg: sg.male.registered, exp: sg.male.expected, color: C.blue, angle: 45 },
      { label: t('Women'), reg: sg.female.registered, exp: sg.female.expected, color: C.accent, angle: -45 }
    ]);
    roughPie($('#chart-place'), [
      { label: t('Community (home)'), value: 22010, pct: '55.9', color: C.accent, angle: -45 },
      { label: t('Health facility'), value: 17345, pct: '44.1', color: C.blue, angle: 45 }
    ]);
    const b = DATA.backlog2025;
    roughStacked($('#chart-backlog'), [
      { label: t('Occurred in 2025'), value: b.occurred_in_2025.count, color: C.ink },
      { label: t('Occurred earlier'), value: b.occurred_earlier_years.count, color: C.ochre }
    ]);
    roughHBars($('#chart-age'), [
      { label: t('0 to 4'), value: 6393, color: C.ochre, valueLabel: '16.2%' },
      { label: t('5 to 14'), value: 950, color: C.ink, valueLabel: '2.4%' },
      { label: t('15 to 24'), value: 1731, color: C.ink, valueLabel: '4.4%' },
      { label: t('25 to 39'), value: 4473, color: C.ink, valueLabel: '11.4%' },
      { label: t('40 to 59'), value: 6913, color: C.ink, valueLabel: '17.6%' },
      { label: t('60 and over'), value: 18895, color: C.accent, valueLabel: '48.0%' }
    ].map(r => Object.assign(r, { tip: t('{l}: {v} deaths ({p})', { l: r.label, v: fmt(r.value), p: r.valueLabel }) })), { max: 18895, padL: 120 });
    const cod = DATA.causeOfDeath2025;
    const causeSlices = side => [
      { label: t('Non-communicable'), value: side.ncd.count, pct: side.ncd.pct.toFixed(1), color: C.ink, angle: -45 },
      { label: t('Communicable, maternal, perinatal'), value: side.communicable.count, pct: side.communicable.pct.toFixed(1), color: C.blue, angle: 45 },
      { label: t('Injuries'), value: side.injuries.count, pct: side.injuries.pct.toFixed(1), color: C.ochre, angle: -45 }
    ];
    roughPie($('#chart-cause-fac'), causeSlices(cod.facility));
    roughPie($('#chart-cause-com'), causeSlices(cod.community));
    roughDrivers($('#chart-drivers'));
    // charts rebuilt on a page that is already drawn appear instantly; undrawn ones wait for their scroll trigger
    $$('.chart, .drivers__diagram').forEach(c => { if (!c.hasAttribute('data-drawn')) prepareDraw(c); });
  }

  // "Sketch in" — every rough stroke draws itself via dash offset; labels and markers fade in after
  function prepareDraw(container) {
    const svg = $('svg', container); if (!svg || REDUCED) return;
    $$('path, line', svg).forEach(p => { if (p.classList.contains('hit')) return; let L = 0; try { L = p.getTotalLength(); } catch (e) {} if (!L) return; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    $$('text, circle', svg).forEach(x => { x.style.opacity = 0; });
    container.setAttribute('data-pending', '');
  }
  function drawChart(container) {
    container.setAttribute('data-drawn', '');
    if (!container.hasAttribute('data-pending')) return;
    container.removeAttribute('data-pending');
    const svg = $('svg', container); if (!svg) return;
    const strokes = $$('path, line', svg).filter(p => !p.classList.contains('hit') && p.style.strokeDasharray);
    const n = strokes.length, each = Math.min(0.9, Math.max(0.35, 180 / Math.max(n, 1))), stagger = Math.min(0.012, 1.4 / Math.max(n, 1));
    sfx.sketch(Math.min(1.6, each + n * stagger));
    gsap.to(strokes, { strokeDashoffset: 0, duration: each, ease: 'power2.inOut', stagger, onComplete() { strokes.forEach(p => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); } });
    gsap.to($$('text, circle', svg), { opacity: 1, duration: 0.5, delay: Math.min(1.2, n * stagger * 0.8), stagger: 0.02, ease: 'power2.out' });
  }

  // ------------------------------------------------------------
  // Dot field (canvas): 7,788 dots = 77,876 expected deaths; 3,852 fade = 38,521 missing
  // ------------------------------------------------------------
  const dotField = (() => {
    const canvas = $('#dotcanvas'); if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const TOTAL = Math.round(77876 / 10), MISSING = Math.round(38521 / 10);
    let cols, rows, cell, W, H, order = [], progress = 0;
    function seeded(n) { let s = 1337; const a = []; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; a.push(s / 2147483647); } return a; }
    function layout() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth || 600; cols = W < 600 ? 72 : 108; rows = Math.ceil(TOTAL / cols); cell = W / cols; H = rows * cell;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!order.length) { const rnd = seeded(TOTAL); order = Array.from({ length: TOTAL }, (_, i) => i).sort((a, b) => rnd[a] - rnd[b]); }
      draw();
    }
    // Two offscreen layers: counted dots (glowing) and missing dots (outlines). The glow is the counted layer
    // drawn once blurred underneath itself, so the per-frame cost is one loop plus three drawImage calls.
    const layerA = document.createElement('canvas'), layerB = document.createElement('canvas');
    const ctxA = layerA.getContext('2d'), ctxB = layerB.getContext('2d');
    const missingSet = new Set();
    let glow = 1, breathing = null;
    function paintLayers() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      [layerA, layerB].forEach(l => { l.width = W * dpr; l.height = H * dpr; });
      [ctxA, ctxB].forEach(c => c.setTransform(dpr, 0, 0, dpr, 0, 0));
      const nMissing = Math.round(MISSING * progress); missingSet.clear();
      for (let i = 0; i < nMissing; i++) missingSet.add(order[i]);
      const r = cell * 0.26;
      ctxA.fillStyle = C.ink; ctxB.strokeStyle = C.accent; ctxB.lineWidth = 0.8; ctxB.globalAlpha = 0.8;
      for (let i = 0; i < TOTAL; i++) {
        const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
        if (missingSet.has(i)) { ctxB.beginPath(); ctxB.arc(x, y, r, 0, Math.PI * 2); ctxB.stroke(); }
        else { ctxA.beginPath(); ctxA.arc(x, y, r, 0, Math.PI * 2); ctxA.fill(); }
      }
    }
    function compose() {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      // glow: blurred copy of the counted layer, intensity breathes
      ctx.save(); ctx.filter = `blur(${Math.max(2, cell * 0.45)}px)`; ctx.globalAlpha = 0.55 * glow; ctx.drawImage(layerA, 0, 0, W, H); ctx.restore();
      ctx.save(); ctx.filter = `blur(${Math.max(1, cell * 0.18)}px)`; ctx.globalAlpha = 0.6; ctx.drawImage(layerA, 0, 0, W, H); ctx.restore();
      ctx.drawImage(layerA, 0, 0, W, H);
      ctx.drawImage(layerB, 0, 0, W, H);
    }
    function draw() { if (!W) return; paintLayers(); compose(); }
    function breathe(on) {
      if (REDUCED) return;
      if (breathing) { breathing.kill(); breathing = null; }
      if (!on) return;
      const o = { g: 1 };
      breathing = gsap.to(o, { g: 0.35, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate() { glow = o.g; compose(); } });
    }
    window.addEventListener('resize', layout);
    return { set(p) { progress = Math.max(0, Math.min(1, p)); draw(); }, get: () => progress, redraw: draw, layout, breathe };
  })();

  // ------------------------------------------------------------
  // Count-ups: any .figure whose text is a number counts up on reveal
  // ------------------------------------------------------------
  function countUp(el, dur = 1.4) {
    if (el.hasAttribute('data-counted')) return; el.setAttribute('data-counted', '');
    const raw = el.textContent.trim(); const m = raw.match(/^([+\-]?)([\d,]+)(?:\.(\d+))?(%?)$/); if (!m) return;
    const sign = m[1], dec = m[3] ? m[3].length : 0, to = parseFloat(m[2].replace(/,/g, '') + (m[3] ? '.' + m[3] : '')), suffix = m[4];
    if (REDUCED) return;
    const obj = { v: 0 }; el.setAttribute('data-counting', '');
    gsap.to(obj, { v: to, duration: dur, ease: 'power3.out', onUpdate() { el.textContent = sign + obj.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; }, onComplete() { el.textContent = raw; el.removeAttribute('data-counting'); } });
  }

  // ------------------------------------------------------------
  // Figure hover: a pen circles the number by hand, and the digits re-tally
  // ------------------------------------------------------------
  function initFigureHover() {
    if (REDUCED || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || !window.rough) return;
    document.addEventListener('pointerover', e => {
      const el = e.target.closest('.figure'); if (!el || el.hasAttribute('data-hovering') || el.closest('svg')) return;
      if (el.hasAttribute('data-counting')) return;
      const raw = el.textContent; if (!/\d/.test(raw)) return;
      el.setAttribute('data-hovering', '');
      // 1. hand-drawn circle
      // measure the glyphs, not the element: figures are often block-level and text-aligned inside a wider column
      const range = document.createRange(); range.selectNodeContents(el); const tr = range.getBoundingClientRect(); const er = el.getBoundingClientRect();
      const r = { left: tr.left - er.left, top: tr.top - er.top, width: tr.width, height: tr.height };
      const padX = Math.max(10, r.width * 0.1), padY = Math.max(4, r.height * 0.02);
      const w = r.width + padX * 2, h = r.height + padY * 2;
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'fig-ring'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.style.cssText = `position:absolute;left:${r.left - padX}px;top:${r.top - padY}px;width:${w}px;height:${h}px;overflow:visible;pointer-events:none`;
      const rc = rough.svg(svg);
      const node = rc.ellipse(w / 2, h / 2, w * 0.98, h * 0.92, { stroke: 'currentColor', strokeWidth: 2, roughness: 2.2, bowing: 2, fill: 'none', seed: Math.floor(Math.random() * 1000) });
      svg.appendChild(node);
      el.style.position = el.style.position || 'relative'; el.appendChild(svg);
      const paths = $$('path', svg);
      paths.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
      gsap.to(paths, { strokeDashoffset: 0, duration: 0.42, ease: 'power2.out', stagger: 0.08 });
      // 2. re-tally: digits flicker and lock left to right
      const chars = raw.split(''); const digitIdx = chars.map((c, i) => /\d/.test(c) ? i : -1).filter(i => i >= 0);
      const start = performance.now(), per = 38, total = 120 + digitIdx.length * per;
      const tick = () => {
        if (!el.hasAttribute('data-hovering')) { el.textContent = raw; el.appendChild(svg); return; }
        const t = performance.now() - start;
        const out = chars.slice();
        digitIdx.forEach((ci, k) => { if (t < 120 + k * per) out[ci] = String(Math.floor(Math.random() * 10)); });
        if (Math.floor(t / per) !== Math.floor((t - 16) / per)) tickOnce(1500 + Math.floor(t / per) * 90, 0.15);
        el.textContent = out.join(''); el.appendChild(svg);
        if (t < total) requestAnimationFrame(tick); else { el.textContent = raw; el.appendChild(svg); }
      };
      requestAnimationFrame(tick);
      const leave = () => {
        el.removeEventListener('pointerleave', leave); el.removeAttribute('data-hovering');
        gsap.to(svg, { opacity: 0, duration: 0.18, ease: 'power2.in', onComplete() { svg.remove(); } });
      };
      el.addEventListener('pointerleave', leave);
    });
  }

  // ------------------------------------------------------------
  // Pages
  // ------------------------------------------------------------
  const CHAPTERS = [
    ['ch-01', 'Seven years on the record'], ['ch-02', 'The ones not counted'], ['ch-03', 'The missing women'],
    ['ch-04', 'Where people die'], ['ch-05', 'The backlog and the clock'], ['ch-06', 'Who appears in the record'],
    ['ch-07', 'What the record says they died of'], ['ch-08', 'Three drivers, one gap'], ['ch-09', 'Now close the gap']
  ];
  const PAGES = ['cover', ...CHAPTERS.map(c => c[0])];
  const pageNodes = {}; // page id -> [top-level elements]
  const pageInit = {};  // page id -> scroll choreography created?
  let currentPage = null, smoother = null;

  function assignPages() {
    const main = $('main'); let page = 'cover';
    Array.from(main.children).forEach(el => {
      if (el.tagName === 'FOOTER') { el.setAttribute('data-page', 'ch-09'); (pageNodes['ch-09'] = pageNodes['ch-09'] || []).push(el); return; } // footer closes the last chapter
      if (el.id && el.id.startsWith('ch-')) page = el.id;
      el.setAttribute('data-page', page);
      (pageNodes[page] = pageNodes[page] || []).push(el);
    });
  }

  function renderSignposts() {
    $$('.signpost').forEach(el => { const list = pageNodes[el.getAttribute('data-page')]; if (list) list.splice(list.indexOf(el), 1); el.remove(); });
    const label = i => i < 0 ? t('Front cover') : `${t('Chapter')} ${String(i + 1).padStart(2, '0')}`;
    const title = i => i < 0 ? t('Who gets counted?') : t(CHAPTERS[i][1]);
    const id = i => i < 0 ? 'cover' : CHAPTERS[i][0];
    CHAPTERS.forEach(([cid], i) => {
      const prev = i - 1, next = i + 1 < CHAPTERS.length ? i + 1 : -1;
      const sp = document.createElement('nav');
      sp.className = 'signpost'; sp.setAttribute('aria-label', 'Chapter navigation'); sp.setAttribute('data-page', cid);
      sp.innerHTML = `
        <a class="signpost__card signpost__card--prev" href="#${id(prev)}" data-go="${id(prev)}">
          <span class="mono">← ${t('Previous')} · ${label(prev)}</span>
          <h3>${title(prev)}</h3>
          <span class="mono mono--muted">${t('You are here')} · ${label(i)} · ${t(CHAPTERS[i][1])}</span>
        </a>
        <a class="signpost__card signpost__card--next" href="#${id(next)}" data-go="${id(next)}">
          <span class="mono">${next < 0 ? t('Back to the front cover') : label(next)}</span>
          <h3>${title(next)}</h3>
          <span class="mono">${t('Next chapter →')}</span>
        </a>`;
      const list = pageNodes[cid];
      // the source citation lives at the foot of the chapter, not in its head
      let src = list.find(e => e.classList && e.classList.contains('chapter-source'));
      if (!src) {
        const cite = $('.chapter__num .cite', list[0]);
        if (cite) { src = document.createElement('div'); src.className = 'chapter-source'; src.setAttribute('data-page', cid); src.appendChild(cite); list.filter(e => e.tagName !== 'FOOTER').pop().insertAdjacentElement('afterend', src); list.push(src); if (cid !== currentPage) src.setAttribute('hidden', ''); }
      }
      const anchor = list.filter(e => e.tagName !== 'FOOTER').pop();
      anchor.insertAdjacentElement('afterend', sp);
      list.push(sp);
      if (cid !== currentPage) sp.setAttribute('hidden', '');
    });
    // the cover ends with a single "begin" card
    const cover = document.createElement('nav');
    cover.className = 'signpost signpost--single'; cover.setAttribute('aria-label', 'Begin'); cover.setAttribute('data-page', 'cover');
    cover.innerHTML = `
      <a class="signpost__card signpost__card--next" href="#ch-01" data-go="ch-01">
        <span class="mono">${t('Begin')} · ${label(0)}</span>
        <h3>${title(0)}</h3>
        <span class="mono">${t('Next chapter →')}</span>
      </a>`;
    const cl = pageNodes.cover; cl[cl.length - 1].insertAdjacentElement('afterend', cover); cl.push(cover);
    if (currentPage !== 'cover') cover.setAttribute('hidden', '');
  }

  function setProgress(page) {
    const i = CHAPTERS.findIndex(c => c[0] === page);
    const num = $('#prog-num'), title = $('#prog-title');
    if (i < 0) { num.textContent = ''; title.textContent = t('Chapters'); return; }
    num.textContent = `${String(i + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
    title.textContent = t(CHAPTERS[i][1]);
  }

  // split a heading into words for a rise-in, then restore the plain text (keeps the i18n text walker simple)
  function riseWords(el, delay = 0) {
    if (!el || REDUCED) return;
    const html = el.innerHTML;
    const words = el.textContent.trim().split(/\s+/);
    el.classList.add('rise');
    el.innerHTML = words.map(w => `<span class="w"><span class="wi">${w}</span></span>`).join(' ');
    gsap.from($$('.wi', el), { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.06, delay, onComplete() { el.classList.remove('rise'); el.innerHTML = html; } });
  }

  function pageEntrance(page) {
    if (REDUCED) return;
    if (page === 'cover') { heroIntro(); return; }
    const first = pageNodes[page][0];
    const head = $('.chapter__head', first);
    riseWords($('.chapter-title, .sim__title', first), 0.1);
    const nums = $$('.chapter__num > *', first);
    const lede = head ? $('.lede', head) : $('.lede', first);
    // explicit end states + clearProps: nothing on the page head can be left invisible if a tween is interrupted
    gsap.fromTo(nums, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: EASE, overwrite: 'auto', clearProps: 'opacity,transform' });
    if (lede) gsap.fromTo(lede, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.3, ease: EASE, overwrite: 'auto', clearProps: 'opacity,transform' });
    if (head) { head.style.setProperty('--rule-x', 0); gsap.to(head, { '--rule-x': 1, duration: 0.9, delay: 0.3, ease: 'power3.inOut' }); }
    setTimeout(() => gsap.set([...nums, lede].filter(Boolean), { clearProps: 'opacity,transform' }), 1600);
  }

  // Parallax "alive" drift: figures and charts move at slightly different speeds from the page, copy lags a touch.
  // Applied per page because ScrollSmoother only measures visible elements.
  const DRIFT = [
    ['.figrow', 'speed', 0.94], ['.bigfig', 'speed', 0.92], ['.dotfield__copy', 'speed', 0.9],
    ['.callout', 'lag', 0.08],
    ['.twolines .chart', 'speed', 0.95], ['#chart-sexgap', 'speed', 0.96], ['#chart-place', 'speed', 0.95], ['#chart-age', 'speed', 0.96],
    ['#chart-cause-fac', 'speed', 0.95], ['#chart-cause-com', 'speed', 0.93], ['.drivers__diagram', 'speed', 0.96], ['.drivers__legend > *', 'lag', 0.08],
    ['.sim__result', 'speed', 0.95], ['.inspector', 'speed', 0.96], ['.sim__bg i', 'speed', 0.85]
  ];
  function applyDrift(scope) {
    if (!smoother) return;
    const targets = [];
    DRIFT.forEach(([sel, kind, v]) => scope(sel).forEach(el => {
      if (el.closest('#timeline, .map-wrap') || el.hasAttribute('data-speed') || el.hasAttribute('data-lag')) { if (el.hasAttribute('data-speed') || el.hasAttribute('data-lag')) targets.push(el); return; }
      el.setAttribute(kind === 'speed' ? 'data-speed' : 'data-lag', String(v)); targets.push(el);
    }));
    if (targets.length) smoother.effects(targets);
  }

  // scroll choreography for a page, created the first time it becomes visible
  function initPage(page) {
    if (pageInit[page]) return; pageInit[page] = true;
    const els = pageNodes[page];
    const scope = sel => els.flatMap(e => (e.matches(sel) ? [e] : []).concat($$(sel, e)));
    applyDrift(scope);
    if (page === 'ch-04') initMap();

    scope('.reveal').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.setAttribute('data-in', '') }));
    scope('.chart, .drivers__diagram').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => drawChart(el) }));
    scope('.figure').forEach(el => { if (el.closest('.hero, .finding, .timeline__panel')) return; ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => countUp(el) }); });
    scope('.dtable').forEach(tb => { const rows = $$('tbody tr', tb); if (REDUCED) return; gsap.set(rows, { opacity: 0, y: 8 }); ScrollTrigger.create({ trigger: tb, start: 'top 85%', once: true, onEnter: () => gsap.to(rows, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: EASE }) }); });
    scope('.signpost').forEach(sp => signpostReveal(sp));

    if (page === 'cover') {
      const f = $$('.finding');
      if (!REDUCED) { gsap.set(f, { opacity: 0, y: 24 }); ScrollTrigger.create({ trigger: '.findings', start: 'top 80%', once: true, onEnter: () => gsap.to(f, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: EASE }) }); }
      if (!REDUCED) gsap.to('.wordmark .o', { rotate: 348, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
    if (page === 'ch-01') initTimeline();
    if (page === 'ch-02' && dotField) {
      dotField.layout();
      const counter = $('#dot-counter');
      // plays once, in full, the moment the stage comes into view: the count runs to 38,521 while the dots empty out
      ScrollTrigger.create({ trigger: '#dotstage', start: 'top 70%', once: true, onEnter() {
        if (REDUCED) { dotField.set(1); counter.textContent = fmt(38521); return; }
        const o = { p: 0 };
        sfx.glide(440, 196, 2.8);
        gsap.to(o, { p: 1, duration: 2.8, ease: 'power2.inOut', onUpdate() { dotField.set(o.p); counter.textContent = fmt(38521 * o.p); }, onComplete() { counter.textContent = fmt(38521); dotField.breathe(true); sfx.beep(); } });
      } });
    }
  }
  function signpostReveal(sp) {
    if (REDUCED) return;
    const cards = $$('.signpost__card', sp); gsap.set(cards, { opacity: 0, y: 24 });
    ScrollTrigger.create({ trigger: sp, start: 'top 90%', once: true, onEnter: () => gsap.to(cards, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: EASE }) });
  }

  function initTimeline() {
    const timeline = $('#timeline'), track = $('#track'), ruler = $('#ruler'), marker = $('#ruler-marker');
    const panels = $$('.timeline__panel'); const years = panels.map(p => +p.dataset.year);
    drawRuler($('#ruler-svg'), years);
    const vertical = REDUCED || window.matchMedia('(max-width: 900px)').matches;
    const yearLabels = $$('#ruler-svg text');
    let lastYi = -1, lastTk = -1, lastClick = 0;
    const setMarker = p => { const w = ruler.clientWidth, x = p * (w - 2); marker.style.setProperty('--x', x + 'px'); const yi = Math.round(p * (years.length - 1));
      // dial: a dry click as the marker passes each minor tick (12 per year), a brighter tick on the year marks
      const tk = Math.floor(p * (years.length - 1) * 12); if (tk !== lastTk) { const n = performance.now(); if (n - lastClick > 24) { lastClick = n; if (tk % 12 === 0) sfx.tick(700 + (tk / 12) * 60, 0.2); else sfx.click(); } lastTk = tk; } yearLabels.forEach((l, i) => l.setAttribute('fill', i === yi ? C.accentText : C.muted)); };
    if (vertical) {
      timeline.setAttribute('data-vertical', '');
      if (!REDUCED) panels.forEach(p => { const kids = Array.from(p.children); gsap.set(kids, { opacity: 0, y: 24 }); ScrollTrigger.create({ trigger: p, start: 'top 75%', once: true, onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: EASE }) }); });
      return;
    }
    const totalScroll = () => track.scrollWidth - document.documentElement.clientWidth;
    const tween = gsap.to(track, { x: () => -totalScroll(), ease: 'none', scrollTrigger: {
      trigger: timeline, start: 'top top', end: () => '+=' + totalScroll(), pin: true, scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1,
      snap: { snapTo: 1 / (panels.length - 1), duration: { min: 0.2, max: 0.6 }, ease: 'power2.inOut', delay: 0.05 },
      onUpdate(self) { setMarker(self.progress); }
    } });
    setMarker(0);
    // each panel's copy rises as it slides into view; the big year drifts slower than the panel (parallax)
    panels.forEach((p, i) => {
      if (i === 0) return;
      const year = $('.year', p), rest = $$('.sub, .note, .timeline__stats > *', p);
      gsap.from(rest, { opacity: 0, y: 28, duration: 0.7, stagger: 0.08, ease: EASE, scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 70%', toggleActions: 'play none none reverse' } });
      // year drifts in from the right and lands flush with its copy when the panel is centred, then drifts on
      gsap.fromTo(year, { x: 90 }, { x: 0, ease: 'none', immediateRender: true, scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left right', end: 'left left', scrub: true } });
      gsap.fromTo(year, { x: 0 }, { x: -60, ease: 'none', immediateRender: false, scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left left', end: 'right left', scrub: true } });
    });
  }

  function drawRuler(svg, years) {
    const w = 1000, h = 72; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = '';
    const n = years.length - 1, minor = 12;
    for (let i = 0; i <= n * minor; i++) {
      const x = (i / (n * minor)) * w, isYear = i % minor === 0, isHalf = i % (minor / 2) === 0;
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', 0); l.setAttribute('y2', isYear ? 26 : isHalf ? 16 : 9);
      l.setAttribute('stroke', C.ink); l.setAttribute('stroke-width', isYear ? 1.2 : 0.6); l.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(l);
      if (isYear) { const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', x + (i === 0 ? 4 : i === n * minor ? -4 : 0)); tx.setAttribute('y', 44); tx.setAttribute('text-anchor', i === 0 ? 'start' : i === n * minor ? 'end' : 'middle'); tx.setAttribute('font-family', "'Space Mono', monospace"); tx.setAttribute('font-size', 11); tx.setAttribute('fill', C.muted); tx.textContent = years[i / minor]; svg.appendChild(tx); }
    }
  }

  // every page opens at its very top: reset the native scroll and the smoother, now and after layout settles
  function hardTop() { window.scrollTo(0, 0); if (smoother) smoother.scrollTop(0); }
  function scrollTop(instant = true) { if (smoother) smoother.scrollTo(0, !instant); else window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' }); }

  let transitioning = false;
  function goTo(page, { instant = false, push = true } = {}) {
    if (!PAGES.includes(page)) page = 'cover';
    if (page === currentPage || transitioning) return;
    const content = $('#smooth-content');
    const show = () => {
      PAGES.forEach(p => pageNodes[p].forEach(el => el.toggleAttribute('hidden', p !== page)));
      currentPage = page;
      document.body.setAttribute('data-page', page);
      setProgress(page);
      if (push) history.replaceState(null, '', page === 'cover' ? location.pathname + location.search : '#' + page);
      if (window.va) window.va('event', { name: 'chapter_view', data: { page } });
      $$('#chapters a').forEach(a => a.toggleAttribute('data-current', a.getAttribute('href') === '#' + page));
      hardTop();
      initPage(page);
      if (dotField) dotField.breathe(page === 'ch-02' && dotField.get() >= 1);
      ScrollTrigger.refresh();
      if (smoother) smoother.effects('[data-speed], [data-lag]');
      hardTop(); requestAnimationFrame(hardTop);
      };
    if (instant || REDUCED || currentPage === null) { show(); gsap.set(content, { opacity: 1, y: 0 }); if (!instant) pageEntrance(page); return; }
    transitioning = true; sfx.page();
    gsap.to(content, { opacity: 0, y: -14, duration: 0.28, ease: 'power2.in', onComplete() {
      show();
      gsap.fromTo(content, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: EASE, onComplete() { transitioning = false; } });
      pageEntrance(page);
    } });
  }
  function initRouting() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const target = a.getAttribute('data-go') || a.getAttribute('href').slice(1);
      if (target === 'top') { e.preventDefault(); if (currentPage === 'cover') scrollTop(false); else goTo('cover'); return; }
      if (target === 'findings') { e.preventDefault(); goTo('cover'); return; }
      if (PAGES.includes(target)) { e.preventDefault(); goTo(target); }
    });
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = PAGES.indexOf(currentPage);
      if (e.key === 'ArrowRight' && i < PAGES.length - 1) goTo(PAGES[i + 1]);
      if (e.key === 'ArrowLeft' && i > 0) goTo(PAGES[i - 1]);
    });
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PAGES.includes(h) && h !== currentPage) goTo(h); });
  }

  // ------------------------------------------------------------
  // Monitor audio (Web Audio, no files): a short beep per heartbeat, a sustained tone on flatline
  // ------------------------------------------------------------
  const audio = (() => {
    let ac = null, master = null, flatOsc = null;
    const ensure = () => { if (ac) return ac; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); master = ac.createGain(); master.gain.value = 0.18; master.connect(ac.destination); return ac; };
    return {
      unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); return !!c; },
      beep() { const c = ensure(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(880, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.13); },
      flatline(seconds = 2.2) { const c = ensure(); if (!c || flatOsc) return; const t = c.currentTime; flatOsc = c.createOscillator(); const g = c.createGain(); flatOsc.type = 'sine'; flatOsc.frequency.setValueAtTime(880, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 0.02); g.gain.setValueAtTime(0.8, t + seconds - 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + seconds); flatOsc.connect(g); g.connect(master); flatOsc.start(t); flatOsc.stop(t + seconds + 0.05); },
      stop() { if (flatOsc) { try { flatOsc.stop(); } catch (e) {} flatOsc = null; } },
      // --- site-wide sfx (all quiet, all synthesised) ---
      tick(freq = 1200, vol = 0.35) { const c = ensure(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.06); },
      noise(dur = 0.25, { from = 400, to = 1800, vol = 0.3, q = 1 } = {}) { const c = ensure(); if (!c) return; const t = c.currentTime; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1); const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02); },
      click() { const c = ensure(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'square'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.018); f.type = 'highpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.03); }, // dial detent
      page() { this.noise(0.32, { from: 300, to: 2400, vol: 0.28, q: 0.8 }); },           // paper turn
      sketch(dur = 0.8) { this.noise(dur, { from: 1800, to: 900, vol: 0.12, q: 2.5 }); }, // pencil on paper
      glide(f0 = 440, f1 = 220, dur = 2.6, vol = 0.18) { const c = ensure(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.3); g.gain.setValueAtTime(vol, t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
    };
  })();
  let SOUND = false;
  const sfx = new Proxy({}, { get: (_, k) => (...a) => { if (SOUND && audio[k]) audio[k](...a); } });
  let lastTick = 0; const tickOnce = (f, v) => { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; sfx.tick(f, v); };
  function setSound(on, persist = true) {
    SOUND = on && audio.unlock();
    const b = $('#sound-btn'); if (b) { b.setAttribute('aria-pressed', String(SOUND)); b.querySelector('[data-sound-label]').textContent = SOUND ? t('Sound on') : t('Sound off'); }
    if (persist) { try { localStorage.setItem('wgc-sound', SOUND ? '1' : '0'); } catch (e) {} }
  }

  // ------------------------------------------------------------
  // Loader + hero intro
  // ------------------------------------------------------------
  function initLoader(done) {
    const loader = $('#loader'), out = $('#loader-text');
    const line = t('Rwanda records 9 in 10 births. It records 1 in 2 deaths.');
    if (location.search.includes('noloader')) { loader.remove(); return done(); }
    $('#loader-count-label').textContent = t('Expected deaths not registered · 2025');
    if (REDUCED) { out.textContent = line; $('#loader-count').textContent = fmt(38521); $('#loader-gate').remove(); return setTimeout(() => { loader.remove(); done(); }, 900); }
    const gate = $('#loader-gate');
    const begin = withSound => { setSound(withSound); gate.setAttribute('hidden', ''); setTimeout(() => gate.remove(), 300); runMonitor(); };
    $('#enter-sound').addEventListener('click', () => begin(true));
    $('#enter-quiet').addEventListener('click', () => begin(false));
    if (location.search.includes('autoenter')) begin(false);
    function runMonitor() {
    // ECG monitor: a bright head sweeps left to right drawing PQRST beats, an erase bar wipes the old trace just ahead of it, looping.
    const canvas = $('#loader-ecg'), ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 800, H = canvas.clientHeight || 120;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = H * 0.6, PERIOD = Math.max(180, W / 4.2), SPEED = W / 2.6; // px per second: one sweep ≈ 2.6s, ~70 bpm
    const bump = (p, c, w, a) => a * Math.exp(-((p - c) * (p - c)) / (2 * w * w));
    const wave = (x, flat) => flat ? base : base - (bump((x % PERIOD) / PERIOD, 0.18, 0.03, 7) - bump((x % PERIOD) / PERIOD, 0.33, 0.012, 9) + bump((x % PERIOD) / PERIOD, 0.36, 0.014, 62) - bump((x % PERIOD) / PERIOD, 0.395, 0.012, 22) + bump((x % PERIOD) / PERIOD, 0.6, 0.05, 11));
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--rule').trim(); ctx.setLineDash([2, 8]); ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(W, base); ctx.stroke(); ctx.setLineDash([]);
    let head = 0, last = performance.now(), flat = false, running = true, lastBeat = -1;
    const counter = $('#loader-count'), SWEEP = 3.2, t0 = performance.now() + 300;
    const paperRGB = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    const frame = now => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const from = head; head += SPEED * dt;
      // erase window ahead of the head (hard clear + soft fade), then draw the new segment
      const erase = 46; ctx.fillStyle = paperRGB; ctx.fillRect(from - 5, 0, erase + 6, H);
      ctx.globalAlpha = 0.35; ctx.fillRect(from + 1 + erase, 0, 18, H); ctx.globalAlpha = 1;
      ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.strokeStyle = C.accentText; ctx.shadowColor = C.accentText; ctx.shadowBlur = 6;
      const x0 = Math.max(0, from - 6); ctx.beginPath(); ctx.moveTo(x0, wave(x0, flat));
      for (let x = x0 + 0.5; x <= head; x += 0.5) ctx.lineTo(x, wave(x, flat));
      ctx.stroke(); ctx.shadowBlur = 0;
      // head dot
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head, wave(head, flat), 2.4, 0, Math.PI * 2); ctx.fill();
      // blip on each R peak
      const beatIdx = Math.floor((head % PERIOD) / PERIOD * 100) >= 36 ? Math.floor(head / PERIOD) : -1;
      if (!flat && beatIdx >= 0 && beatIdx !== lastBeat) { lastBeat = beatIdx; if (SOUND) audio.beep(); gsap.fromTo(counter, { scale: 1 }, { scale: 1.06, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: 'right bottom' }); }
      if (head >= W) { head = 0; ctx.fillStyle = paperRGB; ctx.fillRect(0, 0, erase, H); }
      // count in step with the load
      const p = Math.max(0, Math.min(1, (now - t0) / (SWEEP * 1000)));
      counter.textContent = fmt(38521 * p);
      if (p >= 1 && !flat) { flat = true; if (SOUND) audio.flatline(2.2); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    let i = 0;
    const type = () => {
      out.textContent = line.slice(0, ++i);
      if (i < line.length) setTimeout(type, i < 24 ? 28 : 22);
    };
    setTimeout(type, 300);
    setTimeout(() => { gsap.to(loader, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onComplete() { running = false; audio.stop(); loader.remove(); } }); setTimeout(done, 350); }, 300 + SWEEP * 1000 + 1400);
    }
  }
  function heroIntro() {
    document.body.classList.remove('is-loading');
    if (REDUCED || currentPage !== 'cover') return;
    gsap.from('#hero-who', { y: 20, opacity: 0, duration: 0.6, ease: EASE });
    gsap.from('#wordmark > *', { y: 40, opacity: 0, duration: 0.8, stagger: 0.06, ease: EASE, delay: 0.1 });
    gsap.from('.hero__lede > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.1, ease: EASE, delay: 0.4 });
    gsap.from('.hero__meta .meta-cell', { y: 12, opacity: 0, duration: 0.5, stagger: 0.06, ease: EASE, delay: 0.6 });
    gsap.from('.hero__kicker', { opacity: 0, duration: 0.5, delay: 0.2 });
    $$('.hero__num .figure').forEach(el => { el.removeAttribute('data-counted'); countUp(el, 1.4); });
  }

  // ------------------------------------------------------------
  // Chapters overlay
  // ------------------------------------------------------------
  function initChapters() {
    const btn = $('#chapters-btn'), nav = $('#chapters'), close = $('#chapters-close');
    const open = o => { nav.toggleAttribute('data-open', o); btn.setAttribute('aria-expanded', String(o)); if (smoother) smoother.paused(o); if (o) playChaptersMap(); else if (cmTl) cmTl.kill(); sfx.noise(0.22, { from: o ? 300 : 1600, to: o ? 1600 : 300, vol: 0.2, q: 1 }); };
    btn.addEventListener('click', () => open(!nav.hasAttribute('data-open')));
    close.addEventListener('click', () => open(false));
    $$('a', nav).forEach(a => a.addEventListener('click', () => open(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
  }

  // ------------------------------------------------------------
  // Map: inline hand-drawn SVG of the 30 districts (rough.js), linked to the inspector, the ranked strip and the table
  // ------------------------------------------------------------
  let currentDistrict = null, mapBuilt = false, pinned = null;
  const bucket = p => p >= 60 ? 3 : p >= 55 ? 2 : p >= 45 ? 1 : 0;
  const GAPS = [8, 5.5, 3.8, 2.8];
  function selectDistrict(name, { pin = false, hover = false } = {}) {
    const d = DATA.districtData[name]; if (!d) return;
    if (pin) pinned = name;
    updateInspector(d);
    $$('.district, .strip i, .dtable tr[data-district]').forEach(el => { el.classList.toggle('is-active', el.dataset.d === pinned); el.classList.toggle('is-hot', el.dataset.d === name && name !== pinned); });
    $('#rwanda-map').toggleAttribute('data-focus', hover); $('#district-strip').toggleAttribute('data-focus', hover);
    $$('.map-label').forEach(l => l.classList.toggle('hot', l.dataset.d === name));
  }
  function unhover() { selectDistrict(pinned || 'Muhanga'); }

  function buildMap() {
    const host = $('#rwanda-map'); if (!host || !window.rough) return;
    const wasDrawn = host.hasAttribute('data-drawn');
    const feats = DATA.geoJSON.features;
    // equirectangular fit; Rwanda sits on the equator so a cos-lat scale is enough
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    feats.forEach(f => f.geometry.coordinates.forEach(r => r.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); })));
    const W = 900, pad = 36, kx = Math.cos((miny + maxy) / 2 * Math.PI / 180);
    const scale = (W - 2 * pad) / ((maxx - minx) * kx);
    const H = Math.round((maxy - miny) * scale + 2 * pad);
    const px = x => pad + (x - minx) * kx * scale, py = y => pad + (maxy - y) * scale;
    const svg = makeSvg(host, W, H); const rc = rough.svg(svg);
    const labels = [];
    feats.forEach((f, i) => {
      const p = f.properties, name = p.district;
      const d = f.geometry.coordinates.map(r => 'M ' + r.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(' L ') + ' Z').join(' ');
      const b = bucket(p.community_pct), col = C.map[b];
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'district'); g.dataset.d = name;
      const base = document.createElementNS(NS, 'path'); base.setAttribute('d', d); base.setAttribute('class', 'base'); base.setAttribute('fill', col); base.setAttribute('fill-opacity', 0.22); g.appendChild(base);
      const hatch = rc.path(d, { stroke: 'none', fill: col, fillStyle: 'hachure', hachureGap: GAPS[b], fillWeight: 1 + b * 0.15, hachureAngle: -45, roughness: 1.3, seed: SEED + i });
      g.appendChild(hatch);
      const outline = rc.path(d, { stroke: C.ink, strokeWidth: 1.4, roughness: 1.1, bowing: 0.6, fill: 'none', seed: SEED + 60 + i });
      outline.setAttribute('class', 'outline'); g.appendChild(outline);
      const h = document.createElementNS(NS, 'path'); h.setAttribute('d', d); h.setAttribute('class', 'hit'); g.appendChild(h);
      bindTip(h, () => `${name}: ${p.community_pct}% ${t('community')} · ${p.facility_pct}% ${t('facility')}`);
      h.addEventListener('pointerenter', () => { selectDistrict(name, { hover: true }); tickOnce(500 + p.community_pct * 12, 0.22); }); h.addEventListener('pointerleave', unhover);
      h.addEventListener('click', () => selectDistrict(name, { pin: true }));
      svg.appendChild(g);
      // centroid for labels
      const ring = f.geometry.coordinates[0]; let cx = 0, cy = 0; ring.forEach(([x, y]) => { cx += px(x); cy += py(y); });
      labels.push({ name, x: cx / ring.length, y: cy / ring.length });
    });
    // permanent labels: the four extremes + Kigali's Gasabo for orientation
    ['Muhanga', 'Nyaruguru', 'Nyarugenge', 'Kicukiro', 'Nyagatare', 'Rusizi'].forEach(n => {
      const l = labels.find(x => x.name === n); if (!l) return;
      const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', l.x); tx.setAttribute('y', l.y + 4); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('class', 'map-label'); tx.dataset.d = n; tx.textContent = n; svg.appendChild(tx);
    });
    if (wasDrawn) host.setAttribute('data-drawn', ''); else prepareDraw(host);
    // ranked strip
    const strip = $('#district-strip'); strip.innerHTML = '';
    Object.values(DATA.districtData).sort((a, b) => b.community_pct - a.community_pct).forEach(d => {
      const b = bucket(d.community_pct), i = document.createElement('i'); i.dataset.d = d.district;
      i.style.height = (d.community_pct / 70 * 100) + '%';
      i.style.backgroundImage = `repeating-linear-gradient(-45deg, ${C.map[b]} 0 1.4px, transparent 1.4px ${GAPS[b] * 0.9}px)`;
      i.setAttribute('title', `${d.district} ${d.community_pct}%`);
      i.addEventListener('pointerenter', () => selectDistrict(d.district, { hover: true })); i.addEventListener('pointerleave', unhover); i.addEventListener('click', () => selectDistrict(d.district, { pin: true }));
      strip.appendChild(i);
    });
    if (!mapBuilt) {
      $$('.dtable.extremes tbody tr').forEach(tr => { const n = tr.cells[0].textContent.trim(); if (DATA.districtData[n]) { tr.dataset.district = n; tr.dataset.d = n; tr.addEventListener('click', () => selectDistrict(n, { pin: true })); tr.addEventListener('pointerenter', () => selectDistrict(n, { hover: true })); tr.addEventListener('pointerleave', unhover); } });
      mapBuilt = true; pinned = 'Muhanga';
    }
    selectDistrict(pinned || 'Muhanga');
  }
  // Small hand-drawn Rwanda for the chapters index: district outlines, the flag's 24-ray sun rising behind the north-east
  function buildChaptersMap() {
    const host = $('#chapters-map'); if (!host || !window.rough) return;
    const feats = DATA.geoJSON.features;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    feats.forEach(f => f.geometry.coordinates.forEach(r => r.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); })));
    const W = 460, pad = 30, kx = Math.cos((miny + maxy) / 2 * Math.PI / 180), scale = (W - 2 * pad) / ((maxx - minx) * kx), H = Math.round((maxy - miny) * scale + 2 * pad + 40);
    const px = x => pad + (x - minx) * kx * scale, py = y => pad + 40 + (maxy - y) * scale;
    const svg = makeSvg(host, W, H); const rc = rough.svg(svg);
    // sun
    const sx = W - 70, sy = 56, R = 26;
    const sun = document.createElementNS(NS, 'g'); sun.setAttribute('class', 'cm-sun'); sun.style.transformOrigin = `${sx}px ${sy}px`; svg.appendChild(sun);
    const rays = document.createElementNS(NS, 'g'); rays.setAttribute('class', 'cm-rays'); rays.style.transformOrigin = `${sx}px ${sy}px`; sun.appendChild(rays);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; rays.appendChild(rc.line(sx + Math.cos(a) * (R + 6), sy + Math.sin(a) * (R + 6), sx + Math.cos(a) * (R + 22), sy + Math.sin(a) * (R + 22), { stroke: C.accentText, strokeWidth: 1.4, roughness: 1.2, seed: SEED + i })); }
    sun.appendChild(rc.circle(sx, sy, R * 2, { stroke: C.accentText, strokeWidth: 1.6, fill: C.accentText, fillStyle: 'cross-hatch', hachureGap: 5, fillWeight: 0.8, roughness: 1.3, seed: SEED }));
    feats.forEach((f, i) => {
      const d = f.geometry.coordinates.map(r => 'M ' + r.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(' L ') + ' Z').join(' ');
      const g = rc.path(d, { stroke: C.ink, strokeWidth: 1, roughness: 1, bowing: 0.5, fill: C.ink, fillStyle: 'hachure', hachureGap: 9, fillWeight: 0.5, hachureAngle: -45, seed: SEED + i });
      g.setAttribute('class', 'cm-district'); g.dataset.d = f.properties.district; svg.appendChild(g);
      const h = document.createElementNS(NS, 'path'); h.setAttribute('d', d); h.setAttribute('fill', 'transparent'); h.setAttribute('class', 'hit'); g.appendChild(h);
      const p = f.properties, enter = () => cmFocus(host, g, `${p.district} · ${p.community_pct}% ${t('die at home')} · ${fmt(p.total)} ${t('registered deaths')}`);
      h.addEventListener('pointerenter', () => { enter(); tickOnce(500 + p.community_pct * 12, 0.22); }); h.addEventListener('click', enter); h.addEventListener('pointerleave', () => cmFocus(host, null));
    });
    // Kigali marker + label
    const k = feats.find(f => f.properties.district === 'Gasabo'); if (k) { const ring = k.geometry.coordinates[0]; let cx = 0, cy = 0; ring.forEach(([x, y]) => { cx += px(x); cy += py(y); }); cx /= ring.length; cy /= ring.length; const kg = rc.circle(cx, cy, 9, { stroke: C.accentText, strokeWidth: 1.5, fill: C.accentText, fillStyle: 'solid', roughness: 0.8, seed: SEED }); kg.setAttribute('class', 'cm-kigali'); kg.style.transformOrigin = `${cx}px ${cy}px`; svg.appendChild(kg); const kl = text(svg, cx + 10, cy + 4, 'KIGALI', { size: 10, fill: C.ink, halo: C.paper, haloW: 4 }); kl.setAttribute('class', 'cm-label'); }
    const capText = t('30 districts') + ' · 77,876 ' + t('expected deaths') + ' · 2025';
    const cap = text(svg, pad, H - 6, capText, { size: 10, upper: true, fill: C.muted }); cap.setAttribute('class', 'cm-label cm-cap'); cap.dataset.default = capText;
    host.setAttribute('data-ready', '');
  }
  // hover a district: it lifts with a glow, the rest recede, the caption swaps with a blur crossfade
  let cmSwap = null;
  function cmFocus(host, g, caption) {
    $$('.cm-district', host).forEach(el => el.classList.toggle('is-hot', el === g));
    host.toggleAttribute('data-focus', !!g);
    const cap = $('.cm-cap', host); if (!cap) return;
    const next = g ? caption : cap.dataset.default;
    if (cap.textContent === next) return;
    cap.classList.add('is-swapping');
    clearTimeout(cmSwap);
    cmSwap = setTimeout(() => { cap.textContent = next; cap.setAttribute('fill', g ? C.accentText : C.muted); cap.classList.remove('is-swapping'); }, 110);
  }
  // plays each time the chapters index opens: districts sketch in, rays fan out then turn slowly, Kigali pulses
  let cmTl = null;
  function playChaptersMap() {
    const host = $('#chapters-map'); if (!host || REDUCED || !host.hasAttribute('data-ready')) return;
    if (cmTl) cmTl.kill();
    const svg = $('svg', host);
    const strokes = $$('.cm-district path:not(.hit)', svg), rays = $$('.cm-rays path', svg), sun = $('.cm-sun', svg), sunBody = $$('.cm-sun > g:not(.cm-rays)', svg), labels = $$('.cm-label, .cm-kigali', svg);
    const [sx, sy] = sun.style.transformOrigin.split(' ').map(parseFloat);
    strokes.forEach(p => { let L = 0; try { L = p.getTotalLength(); } catch (e) {} if (L) { p.style.strokeDasharray = L; p.style.strokeDashoffset = L; } });
    gsap.set(rays, { opacity: 0 }); gsap.set(sunBody, { opacity: 0 }); gsap.set(labels, { opacity: 0 }); gsap.set(sun, { scale: 1, svgOrigin: `${sx} ${sy}` });
    cmTl = gsap.timeline();
    cmTl.to(strokes, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut', stagger: 0.004 }, 0)
        .to(sunBody, { opacity: 1, duration: 0.5, ease: EASE }, 0.5)
        .to(rays, { opacity: 1, duration: 0.3, ease: EASE, stagger: 0.025 }, 0.7)
        .to(labels, { opacity: 1, duration: 0.5, stagger: 0.1, ease: EASE }, 1.2)
        // the sun breathes: a slow scale pulse with the rays brightening on each inhale
        .to(sun, { scale: 1.06, svgOrigin: `${sx} ${sy}`, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 1.6)
        .to(rays, { opacity: 0.55, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 1.6);
  }
  function initMap() { if (!mapBuilt) buildMap(); }
  window.restyleMap = () => { if (mapBuilt) buildMap(); };

  function updateInspector(d) {
    if (!d) return; currentDistrict = d;
    $('#insp-name').textContent = d.district + ' ' + t('District');
    $('#insp-province').textContent = `${d.province} ${t('Province')} · ${t(d.type || 'District')}`;
    $('#insp-comm-pct').textContent = d.community_pct + '%'; $('#insp-comm-count').textContent = fmt(d.community || 0) + ' ' + t('deaths');
    $('#insp-fac-pct').textContent = d.facility_pct + '%'; $('#insp-fac-count').textContent = fmt(d.facility || 0) + ' ' + t('deaths');
    $('#insp-total').textContent = fmt(d.total || 0) + ' ' + t('registered deaths');
    const rank = Object.values(DATA.districtData).sort((a, b) => b.community_pct - a.community_pct).findIndex(x => x.district === d.district) + 1;
    $('#insp-rank').textContent = `#${rank} ${t('of 30 by community share')}`;
    $('#insp-bar-fill').style.width = Math.min(100, d.community_pct) + '%';
    const vars = { d: d.district, c: d.community_pct, f: d.facility_pct }, tw = $('#insp-takeaway');
    if (d.community_pct >= 60) tw.textContent = t('More than six in ten deaths in {d} happen at home. Without village-level reporting, these deaths depend entirely on a family making the journey to register.', vars);
    else if (d.community_pct <= 40) tw.textContent = t('{d} is facility-heavy: most deaths are logged at the bedside and enter the civil register directly.', vars);
    else tw.textContent = t('In {d}, deaths split between home ({c}%) and facilities ({f}%). Both channels matter here.', vars);
    $$('#inspector .figure').forEach(el => el.setAttribute('data-counted', ''));
  }

  // ------------------------------------------------------------
  // Simulator
  // ------------------------------------------------------------
  function initSimulator() {
    const s = { chw: $('#slider-chw'), female: $('#slider-female'), kiosk: $('#slider-kiosk') };
    const v = { chw: $('#val-chw'), female: $('#val-female'), kiosk: $('#val-kiosk') };
    const result = $('#proj-result'), meter = $('#proj-meter'), note = $('#proj-note');
    if (!s.chw) return;
    function update() {
      const chw = +s.chw.value, female = +s.female.value, kiosk = +s.kiosk.value;
      v.chw.textContent = '+' + chw + '%'; v.female.textContent = '+' + female + '%'; v.kiosk.textContent = '+' + kiosk + '%';
      const projected = Math.min(96, 50.5 + 16.5 + chw * 0.8 + female * 0.9 + kiosk * 0.7);
      result.textContent = projected.toFixed(1) + '%'; result.setAttribute('data-counted', '');
      meter.style.width = projected + '%';
      const hitT = projected >= 80; result.toggleAttribute('data-hit', hitT);
      note.textContent = hitT ? t('Target met · +{n} over', { n: (projected - 80).toFixed(1) }) : t('{n} points short of target', { n: (80 - projected).toFixed(1) });
    }
    Object.values(s).forEach(el => el.addEventListener('input', () => { update(); tickOnce(900 + +el.value * 40, 0.18); })); update();
    window.updateSim = update;
    const bg = $('#sim-bg');
    [[-10, -20, 70], [45, 10, 60], [15, 40, 55], [70, 50, 65]].forEach(([l, tp, d], i) => { const c = document.createElement('i'); c.style.cssText = `left:${l}%;top:${tp}%;width:${d}vw;height:${d}vw;`; c.setAttribute('data-speed', String(0.8 + i * 0.08)); bg.appendChild(c); });
  }

  // ------------------------------------------------------------
  // Theme + language
  // ------------------------------------------------------------
  function rebuildVisuals() {
    readTokens(); buildCharts(); buildChaptersMap();
    if (dotField) dotField.redraw();
    if (window.restyleMap) window.restyleMap();
    if (currentDistrict) updateInspector(currentDistrict);
    if (window.updateSim) window.updateSim();
  }
  function themeLabel() { $('#theme-btn').querySelector('[data-theme-label]').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? t('Light') : t('Dark'); }
  function setTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = theme === 'dark' ? '#1c1b1a' : '#f1ede8';
    $('#theme-btn').setAttribute('aria-pressed', String(theme === 'dark')); themeLabel();
    if (persist) { try { localStorage.setItem('wgc-theme', theme); } catch (e) {} }
    rebuildVisuals();
  }
  function setLang(lang, persist = true) {
    LANG = DICT[lang] || lang === 'en' ? lang : 'en';
    document.documentElement.lang = LANG;
    $$('#lang-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
    translateDom(document.body);
    document.title = t('Who Gets Counted? Rwanda Vital Statistics 2019–2025');
    renderSignposts(); setProgress(currentPage); themeLabel(); setSound(SOUND, false);
    if (persist) { try { localStorage.setItem('wgc-lang', LANG); } catch (e) {} }
    rebuildVisuals();
    ScrollTrigger.refresh();
  }
  function initMobileNote() {
    const n = $('#mobile-note'); if (!n) return;
    try { if (sessionStorage.getItem('wgc-mobile-note') === '1') { n.setAttribute('hidden', ''); return; } } catch (e) {}
    $('#mobile-note-x').addEventListener('click', () => { n.setAttribute('hidden', ''); try { sessionStorage.setItem('wgc-mobile-note', '1'); } catch (e) {} });
  }
  function initControls() {
    $('#theme-btn').addEventListener('click', () => { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); sfx.tick(1000, 0.25); });
    $('#sound-btn').addEventListener('click', () => { setSound(!SOUND); if (SOUND) audio.tick(1200, 0.3); });
    document.addEventListener('pointerenter', e => { if (e.target.closest && e.target.closest('.signpost__card, .chapters__list a')) tickOnce(1400, 0.12); }, true);
    $$('#lang-seg button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let lang = 'en';
    try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('wgc-lang') || 'en'; } catch (e) {}
    try { const th = new URLSearchParams(location.search).get('theme'); if (th === 'light' || th === 'dark') { document.documentElement.setAttribute('data-theme', th); readTokens(); } } catch (e) {}
    if (!DICT[lang] && lang !== 'en') lang = 'en';
    LANG = lang; document.documentElement.lang = lang;
    $$('#lang-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    if (lang !== 'en') { translateDom(document.body); document.title = t('Who Gets Counted? Rwanda Vital Statistics 2019–2025'); }
    themeLabel();
    try { if (localStorage.getItem('wgc-sound') === '1') { $('#enter-sound').classList.add('is-preferred'); } } catch (e) {}

    if (!REDUCED && !COARSE) smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1.1, effects: true, normalizeScroll: false });

    assignPages();
    const start = location.hash.slice(1);
    currentPage = null;
    renderSignposts();
    initChapters(); initControls(); initRouting(); initFigureHover(); buildChaptersMap(); initMobileNote();
    buildCharts();
    initSimulator();
    goTo(PAGES.includes(start) ? start : 'cover', { instant: true, push: false });
    initLoader(() => { if (currentPage === 'cover') heroIntro(); else document.body.classList.remove('is-loading'); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ScrollTrigger.refresh(); hardTop(); });
    window.addEventListener('load', () => { ScrollTrigger.refresh(); hardTop(); });
  });
})();
