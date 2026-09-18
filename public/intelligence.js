(function () {
  'use strict';
  const D = window.AppIntelligenceData;
  const VIEWS = { overview: 'Overview', map: 'Map', priorities: 'Priorities', science: 'Sensors & sampling', infrastructure: 'Infrastructure', warnings: 'EDRR & warnings', portfolio: 'Portfolio', ask: 'Ask', methods: 'Methods & data' };
  const LAYERS = {
    current_ha: ['Detected extent (ha)', 'Latest valid observation per cove; below 1 ha is shown neutral.'],
    growth_ha_yr: ['Growth rate (ha/year)', 'Theil–Sen trend over the last two years; blue decline, red growth.'],
    spread_pressure: ['Spread pressure', 'Distance-decayed nearby extent, weighted toward the outlet.'],
    infrastructure_risk: ['Infrastructure risk', 'Extent × nearest-asset criticality × proximity decay within 4 km.'],
    priority: ['Composite priority', 'Current weighted mean of five normalized priority components.'],
    uncertainty_pct: ['Model uncertainty percentile', 'Released GP forecast uncertainty rank; not a species confidence.'],
  };
  const fmt = (value, digits = 1) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
  function node(tag, text, attrs = {}) {
    const n = document.createElement(tag);
    if (text !== null && text !== undefined) n.textContent = text;
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
    return n;
  }
  function svg(tag, attrs = {}, text) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(label, onclick, attrs = {}) {
    const n = node('button', label, { type: 'button', ...attrs });
    n.addEventListener('click', onclick);
    return n;
  }
  function card(title, content) {
    const n = node('section', null, { class: 'intel-card' });
    if (title) n.append(node('h2', title));
    if (typeof content === 'string') n.append(node('p', content));
    else if (content) n.append(content);
    return n;
  }
  function table(headers, rows, caption) {
    const wrap = node('div', null, { class: 'intel-table-wrap', tabindex: '0', role: 'region', 'aria-label': caption });
    const t = node('table'), head = node('tr'), body = node('tbody');
    t.append(node('caption', caption, { class: 'sr-only' }));
    headers.forEach(h => head.append(node('th', h, { scope: 'col' })));
    const thead = node('thead'); thead.append(head); t.append(thead);
    rows.forEach(row => { const tr = node('tr'); row.forEach(value => { const td = node('td'); td.append(value?.nodeType ? value : String(value ?? '—')); tr.append(td); }); body.append(tr); });
    if (!rows.length) { const tr = node('tr'); tr.append(node('td', 'No qualifying rows in this release.', { colspan: headers.length })); body.append(tr); }
    t.append(body); wrap.append(t); return wrap;
  }
  function lineChart(series, label) {
    if (!series.length) return node('p', 'No observations are published for this series.');
    const chart = svg('svg', { viewBox: '0 0 680 190', role: 'img', 'aria-label': label, class: 'intel-chart' });
    chart.append(svg('title', {}, label));
    const dates = series.map(r => Date.parse(r[0])), start = Math.min(...dates), end = Math.max(...dates), max = Math.max(1, ...series.map(r => r[1]));
    const x = t => 52 + (t - start) / (end - start || 1) * 606, y = v => 150 - v / max * 125;
    for (let i = 0; i < 4; i++) {
      const value = max * i / 3;
      chart.append(svg('line', { x1: 52, x2: 658, y1: y(value), y2: y(value), stroke: '#31433c' }));
      chart.append(svg('text', { x: 46, y: y(value) + 4, 'text-anchor': 'end' }, fmt(value)));
    }
    chart.append(svg('polyline', { points: series.map((r, i) => `${x(dates[i])},${y(r[1])}`).join(' '), fill: 'none', stroke: '#a8da5a', 'stroke-width': 2 }));
    series.forEach((r, i) => { const point = svg('circle', { cx: x(dates[i]), cy: y(r[1]), r: 3, fill: '#a8da5a' }); point.append(svg('title', {}, `${r[0]}: ${fmt(r[1])} ha`)); chart.append(point); });
    chart.append(svg('text', { x: 52, y: 180 }, series[0][0]), svg('text', { x: 658, y: 180, 'text-anchor': 'end' }, series.at(-1)[0]));
    const wrap = node('div'); wrap.append(chart);
    const details = node('details'); details.append(node('summary', 'Observation values'), table(['Date', 'Detected ha'], series.map(([d, v]) => [d, fmt(v)]), label)); wrap.append(details);
    return wrap;
  }
  function referenceChart(rows) {
    if (!rows.length) return node('p', 'Annual species observations are not published in this release.');
    const species = [['salvinia_ha','Salvinia','#b5d982'],['crested_floating_heart_ha','Crested floating heart','#82bbde'],['waterhyacinth_ha','Water hyacinth','#e7bd77'],['duckweed_ha','Duckweed','#d39bbe']];
    const chart = svg('svg',{viewBox:'0 0 700 250',class:'intel-chart',role:'img','aria-label':'Santee annual species reference-label extent'});
    const first=rows[0].year,last=rows.at(-1).year,max=Math.max(1,...rows.flatMap(r=>species.map(([key])=>r[key])));
    const x=year=>50+(year-first)/(last-first||1)*485,y=ha=>205-ha/max*180;
    for(let i=0;i<4;i++){const ha=max*i/3;chart.append(svg('line',{x1:50,x2:535,y1:y(ha),y2:y(ha),stroke:'#31433c'}),svg('text',{x:43,y:y(ha)+4,'text-anchor':'end'},fmt(ha)));}
    species.forEach(([key,label,color],index)=>{
      chart.append(svg('polyline',{points:rows.map(r=>`${x(r.year)},${y(r[key])}`).join(' '),fill:'none',stroke:color,'stroke-width':2,'data-reference-species':key}));
      rows.forEach(r=>{const p=svg('circle',{cx:x(r.year),cy:y(r[key]),r:3,fill:color});p.append(svg('title',{},`${label}, ${r.year}: ${fmt(r[key])} reference-label ha`));chart.append(p);});
      chart.append(svg('text',{x:547,y:35+index*25,style:`fill:${color}`} ,label));
    });
    rows.forEach(r=>chart.append(svg('text',{x:x(r.year),y:230,'text-anchor':'middle'},String(r.year))));
    return chart;
  }
  function create({ root, release, releaseId, requestExport }) {
    let disposed = false;
    root.replaceChildren();
    const validation = D.validate(release.intelligence);
    if (!validation.ok) {
      root.append(node('h1', 'Intelligence unavailable'), node('p', release.intelligence
        ? 'This release’s Intelligence payload did not pass validation. Its visual workspaces remain available.'
        : 'Intelligence was not published with this release. Its visual workspaces remain available.', { role: 'status' }));
      return { dispose() { disposed = true; root.replaceChildren(); } };
    }
    const payload = release.intelligence, caddo = payload.sites[0];
    const params = new URLSearchParams(location.search);
    const state = {
      site: params.get('intelSite') === 'santee' ? 'santee' : 'caddo',
      view: Object.hasOwn(VIEWS, params.get('intel')) ? params.get('intel') : 'overview',
      layer: Object.hasOwn(LAYERS, params.get('layer')) ? params.get('layer') : 'current_ha',
      cove: Number(params.get('cove')) || null,
      weights: { ...caddo.priority_weights.defaults }, budget: Math.min(14, Math.max(3, caddo.crew_plan.budget)), rank: 'priority',
      overlays: { assets: true, sensors: false, sampling: false, crew: false, spread: false, occurrences: false },
    };
    let coves, crew, view, nav, status;
    function recalculate() { coves = D.priorities(caddo.coves, state.weights); crew = D.crewPlan(coves, caddo.assets, state.budget); }
    recalculate();
    function syncURL() {
      const p = new URLSearchParams(location.search);
      p.set('workspace', 'intelligence'); p.set('intel', state.view); p.set('intelSite', state.site); p.set('layer', state.layer);
      if (state.cove && state.site === 'caddo') p.set('cove', state.cove); else p.delete('cove');
      history.replaceState(null, '', `?${p}${location.hash}`);
    }
    function go(id) { state.view = id; render(true); }
    function selectCove(id) { state.cove = id; state.site = 'caddo'; state.view = 'map'; render(true); }
    function coveButton(c) { return button(c.name, () => selectCove(c.id ?? c.cove_id)); }
    function siteContext() {
      const site = payload.sites.find(s => s.key === state.site);
      const info = node('div', null, { class: 'intel-boundary' });
      info.append(node('strong', `${site.label} · ${site.status === 'operational' ? 'Operational release' : 'Reference labels'}`), node('p', site.claim_boundary));
      return info;
    }
    function referenceCard() {
      const t = payload.santee_reference.trend;
      const content = card('Santee Cooper reference-label context', payload.sites[1].provenance);
      content.append(table(['Year', 'Reference-label extent'], [[t.first_year, `${fmt(t.first_extent_ha)} ha`], [t.latest_year, `${fmt(t.latest_extent_ha)} ha`]], 'Released Santee reference endpoints'), node('p', `${fmt(t.cagr * 100)}% compound annual change between the released endpoints.`), node('p', 'ReMetrix image-interpretation labels are not field ground truth. Operational maps, tasking, sensors and sampling are not deployed for Santee in this release.'), node('p', payload.santee_reference.boundary));
      payload.santee_reference.citations.forEach(c => content.append(node('p', c.text, { class: 'intel-note' })));
      return content;
    }
    function portfolio() {
      const grid = node('div', null, { class: 'intel-grid' });
      payload.portfolio.cards.forEach(c => { const box = card(c.label, `${fmt(c.headline_ha)} ${c.unit}`); box.append(node('p', c.status === 'operational' ? 'Caddo operational detection' : 'Reference-label context'), button(`Select ${c.label}`, () => { state.site = c.key; state.cove = null; render(true); })); grid.append(box); });
      view.append(grid, referenceCard());
      const answer = D.answer(payload, 'portfolio_recommendation', { coves });
      view.append(card('Portfolio recommendation', answer.answer), card('Sam Rayburn — excluded', payload.portfolio.site_evaluations['sam-rayburn'].answer));
      const context = payload.legacy_context?.santee;
      if (context) {
        view.append(card('Santee annual species comparison', referenceChart(context.annual_trend)));
        view.append(card('Santee annual reference labels', table(['Year', 'Salvinia ha', 'Crested floating heart ha', 'Water hyacinth ha', 'Duckweed ha'], context.annual_trend.map(r => [r.year, r.salvinia_ha, r.crested_floating_heart_ha, r.waterhyacinth_ha, r.duckweed_ha]), 'Santee annual multispecies reference-label extent')));
        view.append(card('Santee reference assets', table(['Asset', 'Type', 'Criticality', 'Coordinate confidence'], context.assets.map(a => [a.name, a.type, a.criticality, a.confidence]), 'Santee reference assets')), node('p', context.boundary));
      } else view.append(node('p', 'Annual multispecies reference series and Santee asset coordinates are not published in this release.', { class: 'intel-note' }));
    }
    function overview() {
      const totals = caddo.totals, basin = caddo.metadata.basin_series, latest = basin.at(-1);
      const baseline = latest && basin.find(r => Date.parse(r[0]) >= Date.parse(latest[0]) - 90 * 86400000);
      const metrics = node('div', null, { class: 'intel-metrics' });
      for (const [label, value] of [ ['Detected floating vegetation', `${fmt(totals.detected_ha)} ha`], ['Coves with ≥1 ha', `${totals.infested_coves} / ${totals.cove_count}`], ['Change over available last 90 days', baseline ? `${fmt(latest[1] - baseline[1])} ha` : 'Unavailable'], ['Fastest recent growth', `${fmt(D.rank(coves, 'growth_ha_yr')[0].growth_ha_yr)} ha/year`] ]) {
        const n = node('div'); n.append(node('span', label), node('strong', value)); metrics.append(n);
      }
      view.append(metrics, card('Release briefing', caddo.briefing));
      const actions = card('Top three field priorities');
      D.rank(coves.filter(c => c.current_ha >= 1 || c.priority >= 55)).slice(0, 3).forEach(c => { const p = node('p'); p.append(coveButton(c), node('span', ` · Priority ${c.priority} · ${fmt(c.current_ha)} ha. ${D.action(c)}`)); actions.append(p); });
      actions.append(button('Open priorities', () => go('priorities')));
      view.append(actions, card('Basin detected vegetation over time', lineChart(basin, 'Basin floating-vegetation observations; well-covered scenes only')));
      view.append(node('p', 'Per-cove latest valid observations can differ in date. Basin totals use scenes with at least half of coves observed. Changes are observation signals, not treatment effects.', { class: 'intel-note' }));
    }
    function drawMap(container, detail) {
      container.replaceChildren(); detail.replaceChildren();
      const allCoords = [...coves.map(c => [c.lon, c.lat]), ...caddo.assets.map(a => [a.lon, a.lat])];
      const polygonsOf = geometry => geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : geometry?.type === 'GeometryCollection' ? geometry.geometries.flatMap(polygonsOf) : [];
      const features = (release.caddo_geometry?.features || []).map(f => ({ ...f, polygons: polygonsOf(f.geometry) }));
      features.forEach(f => f.polygons.forEach(p => p.forEach(ring => ring.forEach(xy => allCoords.push(xy)))));
      const xs = allCoords.map(p => p[0]), ys = allCoords.map(p => p[1]), lo = Math.min(...xs), hi = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
      const k = Math.cos((top + bottom) / 2 * Math.PI / 180), scale = Math.min(840 / ((hi-lo)*k || 1), 510 / (top-bottom || 1));
      const P = ([x,y]) => [30+(x-lo)*k*scale, 30+(top-y)*scale];
      const canvas = svg('svg', { viewBox: '0 0 900 570', class: 'intel-map', role: 'group', 'aria-label': `${LAYERS[state.layer][0]} by cove` });
      canvas.append(svg('title', {}, LAYERS[state.layer][0]));
      const max = Math.max(1, ...coves.map(c => Math.abs(c[state.layer])));
      coves.forEach(c => {
        const f = features.find(f => f.properties.id === c.id);
        const t = c[state.layer] / max;
        const fill = state.layer === 'growth_ha_yr' ? (t < 0 ? `hsl(207 60% ${80-45*Math.abs(t)}%)` : `hsl(7 62% ${80-40*t}%)`)
          : state.layer === 'current_ha' && c.current_ha < 1 ? '#30443c' : `hsl(195 60% ${83-55*t}%)`;
        const attrs = { fill, stroke: state.cove === c.id ? '#ffffff' : '#152e25', 'stroke-width': state.cove === c.id ? 3 : 1.5, 'data-intel-cove': c.id, tabindex: 0, role: 'button', 'aria-label': `${c.name}: ${LAYERS[state.layer][0]} ${fmt(c[state.layer])}`, 'aria-pressed': state.cove === c.id };
        let shape;
        if (f?.polygons.length) {
          const polygons = f.polygons;
          const path = polygons.map(polygon => polygon.map(ring => ring.map((point, i) => `${i ? 'L' : 'M'}${P(point).join(',')}`).join(' ') + ' Z').join(' ')).join(' ');
          shape = svg('path', { ...attrs, d: path, 'fill-rule': 'evenodd' });
        } else { const [cx, cy] = P([c.lon, c.lat]); shape = svg('circle', { ...attrs, cx, cy, r: 7 }); }
        shape.append(svg('title', {}, `${c.name} · ${fmt(c.current_ha)} ha · ${fmt(c.growth_ha_yr)} ha/year`));
        const select = () => { state.cove = c.id; syncURL(); drawMap(container, detail); detail.querySelector('h2')?.focus(); };
        shape.addEventListener('click', select);
        shape.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
        canvas.append(shape);
      });
      const mark = (point, text, kind, color, shape = 'circle') => {
        const [x,y] = P(point);
        const n = shape === 'rect' ? svg('rect', { x:x-5, y:y-5, width:10, height:10, fill:color, stroke:'#10251d', 'data-overlay':kind }) : svg('circle', { cx:x, cy:y, r:kind === 'spread' ? 11 : 6, fill:kind === 'spread' ? 'none' : color, stroke:color, 'stroke-width':2, 'data-overlay':kind });
        n.append(svg('title', {}, text)); canvas.append(n);
      };
      if (state.overlays.spread) {
        const byId = new Map(coves.map(c => [c.id,c]));
        caddo.spread_edges.forEach(e => { const a = byId.get(e.from_cove_id), b = byId.get(e.to_cove_id), [x1,y1] = P([a.lon,a.lat]), [x2,y2] = P([b.lon,b.lat]); canvas.append(svg('line', { x1,y1,x2,y2,stroke:'#e4a467','stroke-dasharray':'4 4',opacity:.65,'data-overlay':'spread' })); });
        caddo.early_warning.emerging_front.forEach(f => { const c = byId.get(f.cove_id); mark([c.lon,c.lat], `${c.name}: currently clear emerging front`, 'spread', '#ffad7a'); });
      }
      if (state.overlays.crew && crew.start) {
        canvas.append(svg('polyline', { points: [crew.start.lonlat, ...crew.stops.map(s => s.lonlat), crew.start.lonlat].map(p => P(p).join(',')).join(' '), fill:'none', stroke:'#e6bc6b', 'stroke-width':2, 'stroke-dasharray':'6 4', 'data-overlay':'crew' }));
        crew.stops.forEach(s => { mark(s.lonlat, `Stop ${s.order}: ${s.name}`, 'crew', '#e6bc6b'); const [x,y] = P(s.lonlat); canvas.append(svg('text', { x:x+9,y:y+4,fill:'#fff' }, String(s.order))); });
      }
      if (state.overlays.sensors) caddo.sensor_plan.forEach(s => mark(s.lonlat, `${s.name}: sensor VOI ${s.value_of_information}`, 'sensors', '#9ebaff', 'rect'));
      if (state.overlays.sampling) caddo.sampling_plan.forEach(s => mark(s.lonlat, `${s.name}: sample species-unresolved mat`, 'sampling', '#ed9bce'));
      if (state.overlays.assets) caddo.assets.forEach(a => mark([a.lon,a.lat], `${a.name} · ${a.confidence} coordinates`, 'assets', '#efd078', 'rect'));
      if (state.overlays.occurrences) (payload.legacy_context?.occurrences || []).forEach(o => mark(o.lonlat, `${o.source} · ${o.date}`, 'occurrences', '#ef8585'));
      container.append(canvas, node('p', `${LAYERS[state.layer][1]} Point or line reference geometries use cove-centroid markers. Relative scale: ${state.layer === 'growth_ha_yr' ? 'declining blue to growing red' : 'light low to dark high'}; maximum ${fmt(max)}.`, { class:'intel-note' }));
      const c = coves.find(c => c.id === state.cove);
      if (!c) { detail.append(node('h2', 'Cove intelligence'), node('p', 'Select a cove on the map, or choose one below. Keyboard: Tab to a cove, then Enter.')); }
      else {
        detail.append(node('h2', c.name, { tabindex: '-1' }), lineChart(c.series, `${c.name} recent detected vegetation`));
        const fields = [ ['Detected now', `${fmt(c.current_ha)} ha (${c.current_pct}%)`], ['Peak on record', c.peak_ha === undefined ? 'Not published in this release' : `${fmt(c.peak_ha)} ha`], ['Growth over two years', `${fmt(c.growth_ha_yr)} ha/year`], ['Persistence', `${fmt(c.persistence*100)}% of recent clear passes`], ['Recent clear passes', c.n_recent_obs], ['Spread pressure percentile', c.spread_pct], ['Infrastructure risk percentile', c.infrastructure_pct], ['Nearest asset', `${c.nearest_asset} (${c.nearest_asset_km} km)`], ['Forecast uncertainty percentile', c.uncertainty_pct], ['Current priority', c.priority], ['Last published cove observation', Object.hasOwn(c, 'obs_date') ? c.obs_date || 'No valid observations' : c.series.at(-1)?.[0] || 'Unavailable'] ];
        const occurrences = payload.legacy_context?.occurrences || [];
        if (occurrences.length) fields.push(['Nearest released occurrence (weak context)', `${fmt(Math.min(...occurrences.map(o => D.distance([c.lon,c.lat],o.lonlat))),2)} km; does not confirm this mat’s species`]);
        detail.append(table(['Metric','Value'], fields, `${c.name} intelligence metrics`), node('p', D.action(c)));
        if (c.collapse_flag) detail.append(node('p', 'Rapid-decline candidate: compare with field and treatment records before attributing cause.', { class:'intel-boundary' }));
      }
    }
    function mapView() {
      const controls = node('div', null, { class:'intel-controls' });
      const label = node('label', 'Intelligence map layer');
      const select = node('select', null, { 'aria-label':'Intelligence map layer' });
      Object.entries(LAYERS).forEach(([key,[name]]) => select.append(node('option', name, { value:key })));
      select.value = state.layer; label.append(select); controls.append(label);
      const container = node('div'), detail = node('aside', null, { id:'intel-detail', class:'intel-card' });
      select.addEventListener('change', () => { state.layer = select.value; syncURL(); drawMap(container, detail); });
      const colors = { assets:'#efd078', sensors:'#9ebaff', sampling:'#ed9bce', crew:'#e6bc6b', spread:'#ffad7a', occurrences:'#ef8585' };
      for (const [key, text] of [['assets','Assets'],['sensors','Sensor plan'],['sampling','Sampling plan'],['crew','Crew route'],['spread','Spread front'],['occurrences','Confirmed occurrences']]) {
        const label = node('label', null, { class:'intel-toggle' }), input = node('input', null, { type:'checkbox', 'aria-label':text });
        input.checked = state.overlays[key]; input.disabled = key === 'occurrences' && !payload.legacy_context?.occurrences?.length;
        input.addEventListener('change', () => { state.overlays[key] = input.checked; drawMap(container,detail); });
        const swatch = node('span', '■', { 'aria-hidden':'true' }); swatch.style.color = colors[key]; label.append(input, swatch, text); controls.append(label);
      }
      view.append(controls, node('p', 'Infrastructure reference coordinates have mixed confidence. The crew route is straight-line planning distance, not a navigable boat route. Occurrence context is shown only when released.', { class:'intel-note' }));
      const grid = node('div', null, { class:'intel-map-layout' }); grid.append(container, detail); view.append(grid);
      const accessibleList = node('details'); accessibleList.append(node('summary', 'Select a cove by name'));
      coves.forEach(c => accessibleList.append(coveButton(c))); view.append(accessibleList); drawMap(container, detail);
    }
    async function exportCSV(kind, control) {
      if (disposed || !requestExport) return;
      const weights = { ...state.weights }, budget = state.budget;
      const exportedCoves = D.priorities(caddo.coves, weights), exportedCrew = D.crewPlan(exportedCoves, caddo.assets, budget);
      control.disabled = true; status.textContent = 'Checking export permission…';
      try {
        const result = await requestExport({ kind, weights, budget });
        if (disposed) return;
        if (result?.authorized !== true || result.source_revision !== release.meta.source_revision || result.release_id !== releaseId) throw new Error('The release changed or export was not authorized.');
        const url = URL.createObjectURL(new Blob([D.csv(D.COLUMNS[kind], D.exportRows(exportedCoves, exportedCrew)[kind])], { type:'text/csv;charset=utf-8' }));
        const a = node('a', null, { href:url, download:payload.csv_exports[kind].filename }); root.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        status.textContent = 'Authorized CSV exported with the weights and budget selected when requested.';
      } catch (error) { if (!disposed) status.textContent = String(error.message || 'Export unavailable.'); }
      finally { if (!disposed) control.disabled = false; }
    }
    function exportButton(kind, label) { const b = button(label, () => exportCSV(kind, b)); b.disabled = !requestExport; if (!requestExport) b.title = 'Export authorization is unavailable.'; return b; }
    function prioritiesView() {
      const settings = card('Priority weighting');
      const controls = node('div', null, { class:'intel-weight-grid' });
      const ptable = node('div', null, { id:'intel-priority-table' }), cbox = node('section', null, { id:'intel-crew', class:'intel-card' });
      function update() {
        recalculate();
        ptable.replaceChildren(table(['Cove','Now ha','Growth ha/year','Spread percentile','Infrastructure percentile','Priority'], D.rank(coves,state.rank).map(c => [coveButton(c),fmt(c.current_ha),fmt(c.growth_ha_yr),c.spread_pct,c.infrastructure_pct,c.priority]), 'Cove priority queue'));
        cbox.replaceChildren(node('h2','Resource-constrained crew plan'), node('p', `${crew.stops.length} stops · ${crew.route_km} km round trip · Start: ${crew.start?.name || 'No qualifying visits'}`), node('p','Nearest-neighbour planning route with return to launch. Straight-line distance; verify navigability, access and field conditions.'), table(['Stop','Cove','Leg km','Priority','Recommended action'],crew.stops.map(s => [s.order,coveButton(s),s.leg_km,s.priority,s.action]),'Crew route stops'));
        root.querySelector('#intel-zero-weights').hidden = Object.values(state.weights).some(v => v > 0);
      }
      const sliders = {};
      D.FACTORS.forEach(key => {
        const name = key[0].toUpperCase()+key.slice(1), label = node('label', `${name} weight`), output = node('output', `${Math.round(state.weights[key]*100)}%`, { id:`intel-weight-${key}` }), input = node('input', null, { type:'range', min:0,max:100,step:1,value:Math.round(state.weights[key]*100),'aria-label':`${name} weight` });
        input.addEventListener('input', () => { state.weights[key] = Number(input.value)/100; output.textContent = `${input.value}%`; update(); });
        label.append(output,input); controls.append(label); sliders[key] = { input, output };
      });
      settings.append(node('p','Weights are normalized by their sum. Changes update the queue, crew route, map priority layer and deterministic crew answers.'),controls);
      const presets = node('div',null,{class:'intel-controls'});
      Object.entries({Balanced:caddo.priority_weights.defaults,...D.PRESETS}).forEach(([label,weights]) => presets.append(button(label, () => { state.weights = {...weights}; for (const key of D.FACTORS) { sliders[key].input.value = Math.round(weights[key]*100); sliders[key].output.textContent = `${Math.round(weights[key]*100)}%`; } update(); })));
      settings.append(presets,node('p','All weights are zero: priorities are zero. Detected coves remain eligible and ties use cove ID.',{id:'intel-zero-weights',class:'intel-boundary'}));
      view.append(settings);
      const ranking = node('label','Rank by'), select = node('select',null,{'aria-label':'Rank coves by'});
      for (const key of ['priority','current_ha','growth_ha_yr','spread_pressure','infrastructure_risk']) select.append(node('option',LAYERS[key][0],{value:key}));
      select.value = state.rank; select.addEventListener('change', () => {state.rank=select.value;update();}); ranking.append(select);
      view.append(ranking,ptable,exportButton('cove_priorities','Export priorities CSV'));
      const budgetLabel = node('label','Crew visits this cycle'), budget = node('input',null,{type:'range',min:3,max:14,step:1,value:state.budget,'aria-label':'Crew visits this cycle'}), output = node('output',state.budget);
      budget.addEventListener('input',()=>{state.budget=Number(budget.value);output.textContent=state.budget;update();}); budgetLabel.append(output,budget);
      view.append(budgetLabel,cbox,exportButton('crew_route','Export crew route CSV')); update();
    }
    function science() {
      view.append(card('Sensor / monitoring network', 'Value-of-information ranking combines forecast uncertainty, operational consequence and observation sparsity, with spatial separation. This is a proposed network, not deployed sensors.'));
      view.append(table(['Rank','Cove','Information value','Uncertainty percentile','Rationale'],caddo.sensor_plan.map(s => [s.rank,coveButton(s),s.value_of_information,s.uncertainty_percentile,s.rationale]),'Sensor placement plan'));
      view.append(card('Species-confirmation sampling', 'Prioritize strong, persistent detected mats; record species and mat stage at the edge. Imagery alone does not confirm giant salvinia.'));
      view.append(table(['Rank','Cove','Detected ha','Species status','Rationale'],caddo.sampling_plan.map(s => [s.rank,coveButton(s),s.detected_ha,s.species_status,s.rationale]),'Sampling plan'));
      if (!payload.legacy_context?.occurrences?.length) view.append(node('p','Confirmed occurrence proximity is not published in this release; no corroboration is inferred.',{class:'intel-note'}));
      view.append(button('Show sensor and sampling map',()=>{state.overlays.sensors=true;state.overlays.sampling=true;go('map');}));
    }
    function infrastructure() {
      view.append(node('p','Coordinates are release reference constants with confidence shown per asset. Confirm against authoritative GIS before field use.',{class:'intel-boundary'}));
      view.append(table(['Asset','Type','Criticality','Weighted exposure ha','Threat','Coves within 4 km','Coordinate confidence'],caddo.asset_threat.map(a=>[a.name,a.type,a.criticality,a.exposure_ha_weighted,a.threat_score,a.coves_within_radius,a.confidence]),'Infrastructure threat ranking'));
      view.append(button('Show infrastructure map',()=>{state.layer='infrastructure_risk';state.overlays.assets=true;go('map');}));
    }
    function warnings() {
      view.append(card('Early detection and rapid response', 'Leverage ranks small, detected coves by relative growth and remaining treatability. The 90-day projection is a linear planning scenario, not a biological forecast. Field-confirm before choosing control.'));
      const cost = payload.legacy_context?.edrr_cost;
      view.append(table(['Cove','Now ha','Growth ha/year','90-day projected ha','Leverage',...(cost?['Annual control-cost band','Annual band at 90-day extent']:[])],caddo.edrr.map(e=>[coveButton(e),e.current_ha,e.growth_ha_yr,e.projected_ha_90d,e.leverage,...(cost?[`$${fmt(e.current_ha/.404686*cost.per_acre_year_low,0)}–$${fmt(e.current_ha/.404686*cost.per_acre_year_high,0)}`,`$${fmt(e.projected_ha_90d/.404686*cost.per_acre_year_low,0)}–$${fmt(e.projected_ha_90d/.404686*cost.per_acre_year_high,0)}`]:[])]),'EDRR early-response ranking'));
      view.append(node('p',cost ? `${cost.source}. ${cost.boundary}` : 'Verified control-cost reference bands are not published in this release; no monetary savings are estimated.',{class:'intel-note'}));
      const w = caddo.early_warning;
      view.append(card('Growth surges',table(['Cove','Growth ha/year','Now ha'],w.surges.map(c=>[coveButton(c),c.growth_ha_yr,c.current_ha]),'Surging coves')),
        card('Emerging spread front',table(['Currently clear cove','Spread pressure'],w.emerging_front.map(c=>[coveButton(c),c.spread_pressure]),'Emerging spread front')),
        card('Rapid-decline candidates',table(['Cove','Before ha','After ha','Elapsed days','Interpretation'],w.rapid_decline_candidates.map(c=>[coveButton(c),c.area_before_ha,c.area_after_ha,c.elapsed_days,c.interpretation]),'Rapid-decline candidates')));
    }
    function ask() {
      const form=node('form',null,{class:'intel-ask-form'}),label=node('label','Question about the active release'),input=node('input',null,{type:'text',maxlength:500,'aria-label':'Question about the active release'}),submit=node('button','Ask question',{type:'submit'});
      label.append(input);form.append(label,submit);
      const answerBox=node('section','Choose a question or enter one below.',{id:'intel-answer',class:'intel-card','aria-live':'polite'});
      function answerQuestion(q) {
        input.value=q;
        const a=D.answer(payload,q,{site:state.site,coves,budget:state.budget});
        answerBox.replaceChildren(node('h2','Deterministic release answer'),node('p',a.answer,{class:'intel-answer-text'}),node('p',a.boundary,{class:'intel-boundary'}));
        const citations=payload.reference.citations.filter(c=>a.citations.includes(c.id));
        citations.forEach(c=>answerBox.append(node('p',c.text,{class:'intel-note'})));
        if(a.source_paths.length) answerBox.append(node('p',`Release products: ${a.source_paths.join(', ')}`,{class:'intel-note'}));
      }
      form.addEventListener('submit',e=>{e.preventDefault();answerQuestion(input.value);});
      const questions=node('div',null,{class:'intel-questions'});
      Object.values(payload.deterministic_answers).forEach(a=>questions.append(button(a.question,()=>answerQuestion(a.question))));
      view.append(node('p','Answers use only active-release products and current priority weights / crew budget. No provider key or external model is used.'),form,answerBox,questions);
    }
    function methods() {
      const methods = [
        ['Detected extent','Latest valid per-cove observation, clipped to cove area. Floating vegetation ≥1 ha defines an affected cove. Sparse dates can differ across coves.'],
        ['Growth','Median pairwise (Theil–Sen) slope within the latest two years. Fewer than four recent observations yields a zero trend; this does not establish stability.'],
        ['Spread','Sum of neighbouring current ha × exp(−distance / 1.5 km), limited to 6 km, with 1.6× weight when the source is farther from the outlet. Outward pressure describes pressure toward currently clear neighbours.'],
        ['Infrastructure','Nearest-asset criticality × exp(−distance / 2 km) × current ha, within 4 km. Asset exposure sums nearby detected coves with ≥1 ha using the same decay.'],
        ['Priority','100 × weighted mean of released min–max normalized severity, positive growth, outward spread, infrastructure risk and treatability. Constant components normalize to 0.5. Treatability decreases toward 25 ha, with extra emphasis below 25 ha and growth >0.5 ha/year.'],
        ['Sensor placement','Normalized GP uncertainty × (0.35 + 0.4 × consequence + 0.25 × observation sparsity); consequence combines 0.6 × extent and 0.4 × spread pressure. Greedy selection applies 1−exp(−distance / 2 km) separation. Zero/default uncertainty is not proof of certainty.'],
        ['Sampling','Detected coves ranked by sqrt(current ha) × confirmation need × (0.6 + 0.4 × persistence). Confirmation need is 0.25 within 3 km of a released occurrence and 1 otherwise. At most six sites; occurrence proximity is weak context and species status remains unresolved.'],
        ['Crew plan','Select current ha ≥1 or priority ≥55, order the top budgeted coves by nearest-neighbour distance from the boat ramp nearest the highest priority target, and return to launch. Distances are geodesic, not navigable channel distances. Ties use priority then cove ID.'],
        ['EDRR','Eligible coves have 0 < current ha <25 and growth >0.5 ha/year. 90-day extent = current ha + growth × 90 / 365.25. Leverage = (growth / max(recent mean ha,1)) × (0.4 + 0.6 × (1−min(1,current ha/25))). Scenarios do not establish biological growth, cost effectiveness or treatment outcomes.'],
        ['Warnings','Surges have growth >2 ha/year and ≥1 ha current extent. Emerging fronts have <1 ha current extent and high incoming pressure. Rapid declines are inspection candidates; causal attribution needs field / treatment records.'],
      ];
      methods.forEach(([title,description])=>view.append(card(title,description)));
      view.append(card('Release provenance',`${caddo.provenance} ${payload.reference.provenance} Source products: ${payload.reference.source_products}. Detector: ${payload.reference.detector}.`));
      view.append(card('Asset criticality weights',table(['Asset','Class','Weight'],caddo.assets.map(a=>[a.name,a.type,a.criticality]),'Released asset criticality')));
      payload.reference.citations.forEach(c=>view.append(card(c.id,c.text)));
      payload.claim_boundaries.forEach(text=>view.append(node('p',text,{class:'intel-boundary'})));
    }
    function render(focus=false) {
      if(disposed)return;
      root.replaceChildren(); syncURL();
      const toolbar=node('div',null,{class:'intel-toolbar'}),label=node('label','Intelligence site'),select=node('select',null,{'aria-label':'Intelligence site'});
      payload.sites.forEach(s=>select.append(node('option',`${s.label} · ${s.status}`,{value:s.key})));
      select.value=state.site;select.addEventListener('change',()=>{state.site=select.value;state.cove=null;render(true);});label.append(select);
      toolbar.append(label,node('p',`Release as of ${payload.generated_at} · ${caddo.metadata.acquisition_count} acquisitions · ${caddo.metadata.cove_count} coves`));root.append(toolbar);
      nav=node('nav',null,{class:'intel-nav','aria-label':'Intelligence sections'});
      Object.entries(VIEWS).forEach(([id,label])=>nav.append(button(label,()=>go(id),id===state.view?{'aria-current':'page'}:{})));
      root.append(nav);
      view=node('div',null,{class:'intel-content'});view.append(node('h1',VIEWS[state.view],{tabindex:'-1'}),siteContext());root.append(view);
      status=node('p','',{role:'status','aria-live':'polite',class:'intel-export-status'});root.append(status);
      if(state.site==='santee'&&!['portfolio','ask','methods'].includes(state.view))view.append(referenceCard());
      else ({overview,map:mapView,priorities:prioritiesView,science,infrastructure,warnings,portfolio,ask,methods})[state.view]();
      if(focus)view.querySelector('h1').focus();
    }
    render();
    return { dispose() {disposed=true;root.replaceChildren();}, get state(){return {...state,weights:{...state.weights}};} };
  }
  window.AppIntelligence = { create };
}());
