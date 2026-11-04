// A timeline of journeys against bands (an event, office hours, stays). It picks its own scale:
// hours for a window of up to 5 days, days for a longer one. Every bar is at its true time and length.
import { fmtDur } from './time.js';
import { esc } from './parts.js';

// timeline(svg, trip, opts) -> { paint({ chosen, hover, dim }), cursor(T, text), draw() }
// opts.rows: [{ label, journeys }]  journeys of one row must not overlap in time (out and back can share a row).
// opts.bands: [{ label, spans: [{ a, b, kind }], marks: [{ at, label, name, weight }] }]  kind: 'event' | 'work' | 'stay' | 'plain'
// opts.side(j): text after the bar (a price). opts.lead(j): text before it (carrier and time).
// opts.onPick(j), opts.onHover(j|null, event), opts.onTime(T|null): pointer over the axis gives a time.
// opts.from, opts.to: hours; default the trip window. opts.scale: 'auto' | 'hours' | 'days'.
export function timeline(svgEl, T, opts) {
  const svg = d3.select(svgEl), S = { chosen: new Set(), hover: null, dim: () => false };
  const from = opts.from ?? T.T0, to = opts.to ?? T.T1;
  const days = (to - from) > 24 * 5 || opts.scale === 'days';
  let x, g, rowsY = [], cur;

  function draw() {
    svg.selectAll('*').remove();
    const { width, height } = svgEl.getBoundingClientRect(); if (!width) return;
    const left = opts.left ?? (days ? 96 : 118), right = width - (opts.rightPad ?? 92), top = 38, bottom = height - 20;
    x = d3.scaleLinear().domain([from, to]).range([left, right]);
    g = svg.append('g');
    g.append('defs').html(`<pattern id="pc-night" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".6" height="4" fill="var(--ink)" opacity=".07"/></pattern>
      <pattern id="pc-hatch-red" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".8" height="3.2" fill="var(--red)"/></pattern>`);
    g.append('text').attr('x', 0).attr('y', 29).attr('class', 'pc-caps muted').text((opts.clockLabel || T.raw.clock_label || T.clock.abbr()).toUpperCase());
    // Axis: days on top; hours under them on the hour scale, dates on the day scale.
    const D = T.clock.days(from, to);
    const every = days ? Math.ceil(D.length / Math.max(1, (right - left) / 46)) : 1;
    D.forEach((d, i) => {
      if (!days) for (const [a, b] of [[d.s, d.s + 6.5], [d.e - 1.5, d.e]]) { const aa = Math.max(from, a), bb = Math.min(to, b);
        if (bb > aa) g.append('rect').attr('x', x(aa)).attr('y', top - 4).attr('width', x(bb) - x(aa)).attr('height', bottom - top + 4).attr('fill', 'url(#pc-night)'); }
      if (d.s > from) g.append('line').attr('x1', x(d.s)).attr('x2', x(d.s)).attr('y1', days ? 16 : 0).attr('y2', bottom).attr('stroke', days && d.wd !== 'Mon' ? 'var(--rule2)' : 'var(--rule)');
      const a = Math.max(from, d.s), b = Math.min(to, d.e);
      if (days) { if (i % every === 0) g.append('text').attr('x', x(a) + 3).attr('y', 28).attr('class', 'pc-tick').text(d.day === 1 || i === 0 ? `${d.day} ${d.mon}` : d.day);
        if (d.wd === 'Mon' || i === 0) g.append('text').attr('x', x(a) + 3).attr('y', 11).attr('class', 'pc-caps').text(i === 0 || d.day <= 7 ? `${d.mon.toUpperCase()}` : '');
        if (d.wd === 'Sat' || d.wd === 'Sun') g.append('rect').attr('x', x(a)).attr('y', top - 4).attr('width', x(b) - x(a)).attr('height', bottom - top + 4).attr('fill', 'url(#pc-night)');
      } else {
        g.append('text').attr('x', x((a + b) / 2)).attr('y', 11).attr('text-anchor', 'middle').attr('class', 'pc-caps big').text(x(b) - x(a) > 60 ? d.label.toUpperCase() : '');
        // Ticks on the hour, labelled with the wall clock, so a day with a clock change still reads right.
        for (let k = 1; k < Math.round(d.e - d.s); k++) { const hh = d.s + k; if (hh <= from || hh >= to) continue;
          const h = Math.round(T.clock.local(hh).h) % 24, major = h % 3 === 0;
          g.append('line').attr('x1', x(hh)).attr('x2', x(hh)).attr('y1', major ? 31 : 33).attr('y2', 36).attr('stroke', 'var(--ink)').attr('opacity', major ? .5 : .22);
          if (major) g.append('text').attr('x', x(hh)).attr('y', 28).attr('text-anchor', 'middle').attr('class', 'pc-tick' + (h % 6 ? '' : ' strong')).text(String(h).padStart(2, '0'));
          if (h % 6 === 0) g.append('line').attr('x1', x(hh)).attr('x2', x(hh)).attr('y1', top).attr('y2', bottom).attr('stroke', 'var(--rule2)').attr('stroke-dasharray', '2 3'); }
      }
    });
    g.append('line').attr('x1', left).attr('x2', right).attr('y1', 36).attr('y2', 36).attr('stroke', 'var(--rule)');

    // Bands
    let y = top + 16;
    for (const band of opts.bands || []) {
      g.append('text').attr('x', 0).attr('y', y + 3.5).attr('class', 'pc-caps').text(band.label.toUpperCase());
      for (const s of band.spans) {
        const r = g.append('rect').attr('x', x(Math.max(from, s.a))).attr('y', y - 4.5).attr('width', Math.max(1, x(Math.min(to, s.b)) - x(Math.max(from, s.a)))).attr('height', 9);
        if (s.kind === 'event') r.attr('fill', 'url(#pc-hatch-red)').attr('stroke', 'var(--red)').attr('stroke-width', .6);
        else if (s.kind === 'stay') r.attr('fill', 'var(--ink)').attr('opacity', .85);
        else r.attr('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', .7);
        if (s.label && x(s.b) - x(s.a) > 40) g.append('text').attr('x', (x(s.a) + x(s.b)) / 2).attr('y', y - 7).attr('text-anchor', 'middle').attr('class', 'pc-note').text(s.label);
      }
      band.y = y;
      g.append('g').attr('class', 'pc-marks').selectAll('g').data(band.marks || []).join('g').attr('transform', (m) => `translate(${x(m.at)},${y})`).call((s) => {
        s.append('rect').attr('x', -3).attr('y', -3).attr('width', 6).attr('height', 6).attr('transform', 'rotate(45)').attr('fill', (m) => m.on === false ? 'var(--red)' : 'var(--card)').attr('stroke', 'var(--card)').attr('stroke-width', 1.2);
        s.filter((m) => m.label).append('text').attr('y', -8).attr('text-anchor', 'middle').attr('class', 'pc-note').text((m) => m.label);
        s.append('circle').attr('r', 9).attr('fill', 'transparent').on('mousemove', (e, m) => opts.tip?.show(e, `<b>${esc(m.name || m.label)}</b>`)).on('mouseleave', () => opts.tip?.hide());
      });
      band.layer = g.append('g');
      y += 18;
    }
    // Journey rows
    const rows = opts.rows || [];
    const f0 = y + 18, maxRows = Math.max(1, rows.length);
    const rowH = Math.max(11, Math.min(19, (bottom - f0) / maxRows));
    g.append('line').attr('x1', 0).attr('x2', width - 36).attr('y1', f0 - 14).attr('y2', f0 - 14).attr('stroke', 'var(--rule2)');
    rowsY = [];
    rows.forEach((row, i) => { const ry = f0 + i * rowH; rowsY.push(ry);
      if (row.label) g.append('text').attr('x', 0).attr('y', ry + 3.5).attr('class', 'pc-caps muted').text(row.label.toUpperCase()); });
    const data = rows.flatMap((row, i) => row.journeys.map((j) => ({ j, y: rowsY[i] })));
    const fl = g.append('g').selectAll('g').data(data).join('g').attr('class', 'pc-trow')
      .on('mousemove', (e, d) => { opts.onHover?.(d.j, e); if (S.hover !== d.j.id) { S.hover = d.j.id; paint(); } })
      .on('mouseleave', () => { opts.onHover?.(null); S.hover = null; paint(); })
      .on('click', (e, d) => opts.onPick?.(d.j));
    fl.each(function (d) {
      const r = d3.select(this), j = d.j;
      for (const t of j.transfers) r.append('line').attr('x1', x(t.a) + 1).attr('x2', x(t.b) - 1).attr('y1', d.y).attr('y2', d.y)
        .attr('stroke', t.ground ? 'var(--red)' : 'var(--ink)').attr('stroke-dasharray', t.ground ? '3 2' : '1 2.5').attr('opacity', t.ground ? .8 : .55);
      r.append('rect').attr('x', x(j.dep) - (days ? 4 : 90)).attr('y', d.y - rowH / 2).attr('width', x(j.arr) - x(j.dep) + (days ? 8 : 150)).attr('height', rowH).attr('fill', 'transparent');
      r.append('text').attr('class', 'lead').attr('x', x(j.dep) - 6).attr('y', d.y + 3.8).attr('text-anchor', 'end');
      for (const s of j.segments) r.append('rect').attr('class', 'seg ' + s.mode).attr('x', x(s.a)).attr('y', d.y - 4).attr('width', Math.max(2, x(s.b) - x(s.a))).attr('height', 8).attr('rx', 1.5);
      r.append('text').attr('class', 'side').attr('x', x(j.arr) + 6).attr('y', d.y + 3.8);
    });
    // Time cursor
    cur = g.append('g').attr('pointer-events', 'none');
    svg.on('pointermove', (e) => { const [px] = d3.pointer(e, svgEl); if (px < left || px > right) { opts.onTime?.(null); return; }
      opts.onTime?.(Math.round(x.invert(px) * 12) / 12); }).on('pointerleave', () => opts.onTime?.(null));
    Object.assign(api, { x, g, fl, width, height, bottom, left, right });
    paint();
  }
  function paint(next) {
    if (next) Object.assign(S, next);
    if (!api.fl) return;
    const on = (d) => S.chosen.has(d.j.id) || S.hover === d.j.id;
    api.fl.attr('opacity', (d) => S.dim(d.j) ? .32 : 1);
    api.fl.selectAll('.seg').attr('fill', (d) => S.chosen.has(d.j.id) ? 'var(--red)' : 'var(--ink)').attr('opacity', (d) => S.chosen.has(d.j.id) ? 1 : S.hover === d.j.id ? .7 : .3);
    if (!days || true) {
      api.fl.select('.lead').attr('fill', (d) => on(d) ? 'var(--ink)' : 'var(--muted)').style('font-weight', (d) => S.chosen.has(d.j.id) ? 600 : 400)
        .text((d) => days && !on(d) ? '' : opts.lead ? opts.lead(d.j) : `${d.j.carrierName || ''} ${d.j.depL.hm}`);
      api.fl.select('.side').attr('fill', (d) => S.chosen.has(d.j.id) ? 'var(--red)' : on(d) ? 'var(--ink)' : 'var(--muted)').style('font-weight', (d) => S.chosen.has(d.j.id) ? 600 : 400)
        .text((d) => days && !on(d) ? '' : opts.side ? opts.side(d.j) : `${d.j.arrL.hm}`);
    }
  }
  // A red line at T with a label pill at the bottom; null clears it.
  function cursor(t, text) {
    if (!cur) return;
    const items = t == null ? [] : [{ t, text }];
    const c = cur.selectAll('g').data(items).join((en) => { const s = en.append('g'); s.append('line'); s.append('rect'); s.append('text'); return s; });
    c.select('line').attr('y1', 16).attr('y2', api.bottom).attr('stroke', 'var(--red)');
    c.select('text').attr('y', api.height - 5).attr('text-anchor', 'middle').attr('class', 'pc-pill').text((d) => d.text);
    c.each(function (d) { const s = d3.select(this), w = s.select('text').node().getComputedTextLength() + 16, xt = x(d.t);
      const dx = Math.min(api.width - 36 - (xt + w / 2), Math.max(0, w / 2 - xt));
      s.attr('transform', `translate(${xt},0)`); s.select('rect').attr('x', -w / 2 + dx).attr('y', api.height - 18).attr('width', w).attr('height', 17).attr('rx', 2).attr('fill', 'var(--red)');
      s.select('text').attr('x', dx); });
  }
  // Draw the part of a band's spans that applies to the chosen option, in red (work lost) or ink (time at the event).
  function overlay(bandIndex, spans, kind = 'lost') {
    const band = (opts.bands || [])[bandIndex]; if (!band?.layer) return;
    band.layer.selectAll('rect').data(spans).join('rect').attr('y', band.y - 4.5).attr('height', 9).attr('x', (s) => x(s[0])).attr('width', (s) => Math.max(0, x(s[1]) - x(s[0])))
      .attr('fill', kind === 'lost' ? 'var(--red)' : 'var(--ink)');
  }
  function marks(bandIndex, on) { const band = (opts.bands || [])[bandIndex]; if (!band) return;
    g?.selectAll('.pc-marks').filter((_, i) => i === bandIndex).selectAll('g').select('rect').attr('fill', (m, i) => on[i] ? 'var(--card)' : 'var(--red)'); }
  const api = { draw, paint, cursor, overlay, marks, days, fmtDur };
  draw();
  return api;
}
