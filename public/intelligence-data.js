(function () {
  'use strict';
  const FACTORS = ['severity', 'growth', 'spread', 'infrastructure', 'treatability'];
  const PRESETS = {
    'Protect infrastructure': { severity: .2, growth: .15, spread: .2, infrastructure: .4, treatability: .05 },
    'Stop the spread': { severity: .15, growth: .3, spread: .35, infrastructure: .1, treatability: .1 },
    'EDRR / early wins': { severity: .1, growth: .3, spread: .15, infrastructure: .1, treatability: .35 },
  };
  const ANSWER_PATHS = {
    extent: ['sites.caddo.totals'], hotspot: ['sites.caddo.rankings.hotspots'],
    fastest_growth: ['sites.caddo.rankings.fastest_growing'], spread_front: ['sites.caddo.early_warning.emerging_front'],
    infrastructure_risk: ['sites.caddo.asset_threat'], sensor_placement: ['sites.caddo.sensor_plan'],
    sampling: ['sites.caddo.sampling_plan'], crew_deployment: ['sites.caddo.crew_plan', 'csv_exports.crew_route'],
    edrr_early_wins: ['sites.caddo.edrr'], early_warning: ['sites.caddo.early_warning'],
    portfolio_recommendation: ['portfolio.recommendation'], santee_boundary: ['santee_reference'],
    sam_rayburn_exclusion: ['portfolio.site_evaluations.sam-rayburn'], claim_boundary: ['claim_boundaries'],
  };
  const COLUMNS = {
    cove_priorities: ['cove_id', 'name', 'longitude', 'latitude', 'current_ha', 'growth_ha_yr', 'spread_pressure', 'infrastructure_risk', 'priority', 'species_status'],
    crew_route: ['order', 'cove_id', 'leg_distance_km', 'current_extent_ha', 'growth_ha_per_year', 'priority', 'action'],
  };
  const number = value => typeof value === 'number' && Number.isFinite(value);
  const range = (low, high = Infinity) => value => number(value) && value >= low && value <= high;
  const integer = (low, high = Infinity) => value => Number.isInteger(value) && value >= low && value <= high;
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;
  const literal = expected => value => value === expected;
  const list = (check, max = 10000, min = 0) => value => Array.isArray(value) && value.length >= min && value.length <= max && value.every(check);
  const object = fields => value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(fields).length && Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const lonlat = value => Array.isArray(value) && value.length === 2 && range(-180, 180)(value[0]) && range(-90, 90)(value[1]);
  const series = list(row => Array.isArray(row) && row.length === 2 && date(row[0]) && range(0)(row[1]));
  const fraction = range(0, 1), percent = range(0, 100), positive = range(0);
  const factorFields = Object.fromEntries(FACTORS.map(key => [key, fraction]));
  const assetFields = { name: text, type: text, lat: range(-90, 90), lon: range(-180, 180), confidence: text, criticality: fraction };
  const coveFields = {
    id: integer(1), name: text, lon: range(-180, 180), lat: range(-90, 90), area_ha: v => number(v) && v > 0,
    current_ha: positive, current_pct: percent, growth_ha_yr: number, recent_mean_ha: positive,
    persistence: fraction, n_recent_obs: integer(0, 10000), uncertainty: number, survey_score: number, gp_ucb: number,
    collapse_flag: v => typeof v === 'boolean', series, severity_pct: percent, growth_pct: percent,
    uncertainty_pct: percent, spread_pressure: positive, spread_outward: positive, distance_to_outlet_km: positive,
    spread_pct: percent, nearest_asset: text, nearest_asset_km: positive, infrastructure_risk: positive,
    infrastructure_pct: percent, priority_components: object(factorFields), priority: percent,
  };
  const cove = value => {
    if (!value || typeof value !== 'object') return false;
    const { obs_date, peak_ha, ...base } = value;
    return object(coveFields)(base) && (obs_date === undefined && peak_ha === undefined
      || (obs_date === null || date(obs_date)) && positive(peak_ha) && peak_ha >= base.current_ha && peak_ha <= base.area_ha
        && (obs_date !== null || peak_ha === 0 && base.series.length === 0)
        && base.series.every(row => row[1] <= peak_ha) && (!base.series.length || base.series.at(-1)[0] === obs_date));
  };
  const citation = object({ id: text, text });
  function safeTree(value, depth = 0) {
    if (depth > 20) return false;
    if (typeof value === 'string') return !/\b[a-z][a-z0-9+.-]*:\/\/|\b(?:api[_ -]?key|browser[_ -]?key|model[_ -]?(?:key|prompt)|provider[_ -]?key|access[_ -]?key|secret[_ -]?(?:access[_ -]?)?key|session[_ -]?token|password|credentials?|authorization|token)\b\s*[:=]\s*\S+|\bbearer\s+\S+|\bsk-[a-z0-9_-]{4,}|\b(?:AKIA|ASIA)[A-Z0-9]{8,}/i.test(value);
    if (number(value) || value === null || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.length <= 131000 && value.every(item => safeTree(item, depth + 1));
    if (value && typeof value === 'object') return Object.entries(value).every(([key, item]) =>
      !/^(api_key|apikey|browser_key|model_key|model_prompt|provider_key|credentials)$/i.test(key) && safeTree(item, depth + 1));
    return false;
  }
  function validate(payload) {
    const errors = [];
    const check = (condition, path) => { if (!condition) throw new Error(path); };
    try {
      check(payload && safeTree(payload), 'intelligence safety');
      check(object({ schema: literal('giant-salvinia-intelligence-v1'), generated_at: date, sites: list(v => !!v, 2, 2),
        santee_reference: v => !!v, portfolio: v => !!v, deterministic_answers: v => !!v, csv_exports: v => !!v,
        reference: v => !!v, claim_boundaries: list(text, 4, 4), ...(payload.legacy_context ? { legacy_context: v => !!v } : {}),
      })(payload), 'intelligence');
      if (payload.legacy_context) {
        const context = payload.legacy_context;
        const annual = object({ year: integer(1900, 2100), salvinia_ha: positive, crested_floating_heart_ha: positive, waterhyacinth_ha: positive, duckweed_ha: positive });
        check(object({ occurrences: list(object({ date, lonlat, source: text })),
          edrr_cost: object({ per_acre_year_low: literal(200), per_acre_year_high: literal(2000), source: text, boundary: text }),
          santee: object({ annual_trend: list(annual, 100), assets: list(object(assetFields), 16), boundary: text }),
        })(context), 'intelligence.legacy_context');
        check(context.santee.annual_trend.every((row, index, rows) => index === 0 || row.year > rows[index - 1].year), 'intelligence annual reference order');
      }
      const [site, santee] = payload.sites;
      check(list(cove, 511, 1)(site.coves), 'intelligence.sites.caddo.coves');
      const ids = new Set(site.coves.map(c => c.id));
      const byId = new Map(site.coves.map(c => [c.id, c]));
      const ref = id => integer(1)(id) && ids.has(id);
      const namedRef = { cove_id: ref, name: text };
      const locatedRef = { ...namedRef, lonlat };
      const ranking = object({ id: ref, name: text, lonlat, current_ha: positive, growth_ha_yr: number, spread_pressure: positive, infrastructure_risk: positive, priority: percent });
      const stop = object({ order: integer(1, 32), ...locatedRef, leg_km: positive, priority: percent, action: text });
      const warnings = object({
        surges: list(object({ ...namedRef, growth_ha_yr: number, current_ha: positive }), 8),
        emerging_front: list(object({ ...namedRef, spread_pressure: positive }), 8),
        rapid_decline_candidates: list(object({ ...namedRef, area_before_ha: positive, area_after_ha: positive, elapsed_days: integer(1), interpretation: text }), 12),
      });
      check(object({
        key: literal('caddo'), label: text, status: literal('operational'), provenance: text, claim_boundary: text, briefing: text,
        metadata: object({ acquisition_count: integer(1, 10000), cove_count: integer(1, 511), record_start: date, record_end: date, forecast_origin: v => v === null || text(v), basin_series: series }),
        totals: object({ detected_ha: positive, infested_coves: integer(0, 511), cove_count: integer(1, 511), basin_area_ha: positive }),
        coves: list(cove, 511, 1),
        rankings: object(Object.fromEntries(['hotspots', 'fastest_growing', 'spread_risk', 'infrastructure_risk', 'priority'].map(k => [k, list(ranking, 12, 1)]))),
        spread_edges: list(object({ from_cove_id: ref, to_cove_id: ref, distance_km: positive }), 130305),
        assets: list(object(assetFields), 16, 1),
        asset_threat: list(object({ ...assetFields, exposure_ha_weighted: positive, threat_score: positive, coves_within_radius: integer(0, ids.size) }), 16, 1),
        sensor_plan: list(object({ rank: integer(1, 6), ...locatedRef, value_of_information: percent, uncertainty_percentile: percent, rationale: text }), 6, 1),
        sampling_plan: list(object({ rank: integer(1, 6), ...locatedRef, detected_ha: positive, species_status: literal('unresolved'), rationale: text }), 6),
        crew_plan: object({ budget: integer(1, 32), start: v => v === null || object({ name: text, lonlat })(v), route_km: positive, stops: list(stop, 32) }),
        edrr: list(object({ ...locatedRef, current_ha: positive, growth_ha_yr: number, projected_ha_90d: positive, leverage: positive, projection_boundary: text }), 15),
        early_warning: warnings,
        priority_weights: object({ defaults: object(factorFields), allowed_range: object(Object.fromEntries(FACTORS.map(k => [k, v => same(v, [0, 1])]))), formula: text }),
      })(site), 'intelligence.sites.caddo');
      check(ids.size === site.coves.length && site.coves.every(c => c.current_ha <= c.area_ha && (!c.obs_date || c.obs_date >= site.metadata.record_start && c.obs_date <= site.metadata.record_end)), 'intelligence cove measurements');
      check(site.metadata.cove_count === ids.size && site.totals.cove_count === ids.size
        && site.metadata.record_start <= site.metadata.record_end && site.metadata.record_end === payload.generated_at
        && site.metadata.basin_series.length <= site.metadata.acquisition_count
        && site.totals.infested_coves === site.coves.filter(c => c.current_ha >= 1).length
        && Math.abs(site.totals.detected_ha - site.coves.reduce((n, c) => n + c.current_ha, 0)) < .02, 'intelligence totals');
      check(Object.values(site.priority_weights.defaults).reduce((a, b) => a + b, 0) > 0, 'intelligence weights');
      const crew = site.crew_plan;
      check(crew.stops.length <= crew.budget && (crew.start === null) === !crew.stops.length
        && new Set(crew.stops.map(s => s.cove_id)).size === crew.stops.length
        && crew.stops.every((s, i) => s.order === i + 1 && same(s.lonlat, [byId.get(s.cove_id).lon, byId.get(s.cove_id).lat]))
        && site.assets.length === site.asset_threat.length, 'intelligence crew and assets');
      for (const product of [site.sensor_plan, site.sampling_plan, site.edrr]) check(new Set(product.map(s => s.cove_id)).size === product.length
        && product.every(s => same(s.lonlat, [byId.get(s.cove_id).lon, byId.get(s.cove_id).lat])), 'intelligence product references');
      check(object({ key: literal('santee'), label: text, status: literal('reference'), provenance: text, claim_boundary: text,
        reference_context: object({ evidence_type: text, operational: literal(false), allowed_use: text }),
      })(santee), 'intelligence.sites.santee');
      check(object({ operational: literal(false), trend: object({ first_year: integer(1900, 2100), latest_year: integer(1900, 2100), first_extent_ha: v => number(v) && v > 0, latest_extent_ha: positive, cagr: number }), citations: list(citation, 8, 1), boundary: text })(payload.santee_reference), 'intelligence.santee_reference');
      const trend = payload.santee_reference.trend;
      check(trend.first_year < trend.latest_year && Math.abs(trend.cagr - ((trend.latest_extent_ha / trend.first_extent_ha) ** (1 / (trend.latest_year - trend.first_year)) - 1)) <= .000051, 'intelligence reference trend');
      const p = payload.portfolio;
      check(object({ crew_budget: literal(crew.budget), cards: list(object({ key: text, label: text, status: text, headline_ha: positive, unit: text }), 2, 2),
        recommendation: object({ site_key: literal('caddo'), status: literal('operational'), priority_cove_id: ref, priority_score: percent, santee_status: literal('reference-only'), sam_rayburn_status: literal('excluded'), recommendation: text, citations: list(text, 8, 1), boundary: text }),
        site_evaluations: object({ 'sam-rayburn': object({ label: text, status: literal('excluded'), operational: literal(false), answer: text, boundary: text }) }),
      })(p), 'intelligence.portfolio');
      check(p.cards[0].key === 'caddo' && p.cards[0].status === 'operational' && p.cards[0].headline_ha === site.totals.detected_ha
        && p.cards[1].key === 'santee' && p.cards[1].status === 'reference' && p.cards[1].headline_ha === trend.latest_extent_ha
        && p.recommendation.priority_cove_id === site.rankings.priority[0].id && p.recommendation.priority_score === site.rankings.priority[0].priority, 'intelligence portfolio references');
      check(object({ detector: text, source_products: integer(1), provenance: text, citations: list(citation, 16, 1) })(payload.reference), 'intelligence.reference');
      const citations = new Map(payload.reference.citations.map(c => [c.id, c.text]));
      check(citations.size === payload.reference.citations.length, 'intelligence duplicate citations');
      const citationRefs = list(id => text(id) && citations.has(id), 8, 1);
      const boundaries = {
        ...Object.fromEntries(Object.keys(ANSWER_PATHS).slice(0, 8).map(id => [id, site.claim_boundary])),
        edrr_early_wins: payload.claim_boundaries[3], early_warning: payload.claim_boundaries[2],
        portfolio_recommendation: p.recommendation.boundary, santee_boundary: payload.santee_reference.boundary,
        sam_rayburn_exclusion: p.site_evaluations['sam-rayburn'].boundary, claim_boundary: payload.claim_boundaries.join(' '),
      };
      check(object(Object.fromEntries(Object.entries(ANSWER_PATHS).map(([id, paths]) => [id, object({ question: text, answer: text, source_paths: v => same(v, paths), citations: citationRefs, boundary: literal(boundaries[id]) })])))(payload.deterministic_answers), 'intelligence.deterministic_answers');
      check(citationRefs(p.recommendation.citations) && payload.santee_reference.citations.every(c => citations.get(c.id) === c.text), 'intelligence citation references');
      const rows = exportRows(site.coves, crew);
      check(object(Object.fromEntries(Object.entries(COLUMNS).map(([id, columns]) => [id, object({ filename: literal(`caddo-${id.replaceAll('_', '-')}.csv`), columns: v => same(v, columns), rows: v => same(v, rows[id]), claim_boundary: text })])))(payload.csv_exports), 'intelligence.csv_exports');
    } catch (error) { errors.push(error.message || 'intelligence invalid'); }
    return { ok: errors.length === 0, errors };
  }
  function priorities(coves, weights) {
    const total = FACTORS.reduce((sum, key) => sum + weights[key], 0) || 1;
    return coves.map(c => ({ ...c, priority: Math.round(1000 * FACTORS.reduce((sum, key) => sum + weights[key] * c.priority_components[key], 0) / total) / 10 }));
  }
  const rank = (coves, key = 'priority') => coves.slice().sort((a, b) => b[key] - a[key] || a.id - b.id);
  function distance(a, b) {
    const rad = Math.PI / 180;
    const x = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.min(1, x)));
  }
  function action(c) {
    if (c.current_ha < 5 && c.growth_ha_yr > .5) return 'Field-confirm, then consider a bounded early response if confirmed.';
    if (c.collapse_flag) return 'Verify the rapid change against inspection and treatment records before attributing cause.';
    if (c.current_ha >= 5) return 'Inspect active margins and record species and mat stage before selecting control.';
    return 'Monitor on the next clear pass and field-confirm before species-specific action.';
  }
  function crewPlan(coves, assets, budget) {
    if (!integer(1, 32)(budget)) throw new Error('Crew visits must be an integer from 1 to 32.');
    const remaining = rank(coves.filter(c => c.current_ha >= 1 || c.priority >= 55)).slice(0, budget);
    if (!remaining.length) return { budget, start: null, route_km: 0, stops: [] };
    const ramps = assets.filter(a => a.type === 'boat ramp');
    const candidates = ramps.length ? ramps : assets;
    if (!candidates.length) throw new Error('No released launch location is available.');
    const top = remaining[0];
    const start = candidates.slice().sort((a, b) => distance([top.lon, top.lat], [a.lon, a.lat]) - distance([top.lon, top.lat], [b.lon, b.lat]))[0];
    let current = [start.lon, start.lat], total = 0;
    const stops = [];
    while (remaining.length) {
      remaining.sort((a, b) => distance(current, [a.lon, a.lat]) - distance(current, [b.lon, b.lat]) || b.priority - a.priority || a.id - b.id);
      const c = remaining.shift(), leg = distance(current, [c.lon, c.lat]);
      total += leg;
      stops.push({ order: stops.length + 1, cove_id: c.id, name: c.name, lonlat: [c.lon, c.lat], leg_km: Math.round(leg * 100) / 100, priority: c.priority, action: action(c) });
      current = [c.lon, c.lat];
    }
    total += distance(current, [start.lon, start.lat]);
    return { budget, start: { name: start.name, lonlat: [start.lon, start.lat] }, route_km: Math.round(total * 100) / 100, stops };
  }
  function exportRows(coves, crew) {
    const byId = new Map(coves.map(c => [c.id, c]));
    return {
      cove_priorities: coves.slice().sort((a, b) => a.id - b.id).map(c => ({ cove_id: c.id, name: c.name, longitude: c.lon, latitude: c.lat, current_ha: c.current_ha, growth_ha_yr: c.growth_ha_yr, spread_pressure: c.spread_pressure, infrastructure_risk: c.infrastructure_risk, priority: c.priority, species_status: 'unresolved' })),
      crew_route: crew.stops.map(s => ({ order: s.order, cove_id: s.cove_id, leg_distance_km: s.leg_km, current_extent_ha: byId.get(s.cove_id).current_ha, growth_ha_per_year: byId.get(s.cove_id).growth_ha_yr, priority: s.priority, action: s.action })),
    };
  }
  function csv(columns, rows) {
    const cell = value => {
      let s = String(value ?? '');
      if (typeof value === 'string' && /^[\s]*[=+@-]|^[\t\r]/.test(s)) s = "'" + s;
      return /[,"\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
    };
    return [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  function answer(payload, question, options = {}) {
    const q = String(question || '').trim().toLowerCase();
    const answers = payload.deterministic_answers;
    let id = Object.keys(answers).find(k => q === k || q === answers[k].question.toLowerCase());
    if (/rayburn/.test(q)) id = 'sam_rayburn_exclusion';
    else if (/santee/.test(q) || options.site === 'santee') id = 'santee_boundary';
    if (!id) id = [
      ['claim_boundary', /claim|confirmed giant|treatment (?:effect|impact)|limitations/],
      ['early_warning', /early.warning|surge|rapid.decline|collapse/],
      ['portfolio_recommendation', /portfolio|expand|next site|roll out/],
      ['infrastructure_risk', /infrastruct|intake|dam|water.supply|asset|critical/],
      ['crew_deployment', /crew|deploy|send|route|dispatch|team|this week/],
      ['sensor_placement', /sensor|monitor|instrument|measure/],
      ['sampling', /sampl|confirm|species|field id|identif|ground/],
      ['fastest_growth', /fast|grow|accelerat/],
      ['spread_front', /spread|front|downstream/],
      ['hotspot', /hot.?spot|worst|biggest|largest|most infest/],
      ['edrr_early_wins', /edrr|early win|cheap|cost|delay|90.day|money|afford|budget/],
      ['extent', /extent|how much|detect|summary|overview|brief|status/],
    ].find(([, pattern]) => pattern.test(q))?.[0];
    if (!id) return { id: null, answer: 'That answer is not available in the active release. Choose a supported question below.', boundary: payload.claim_boundaries.join(' '), citations: [], source_paths: [] };
    const result = { ...answers[id], id };
    const site = payload.sites[0], coves = options.coves || site.coves;
    if (id === 'crew_deployment') {
      const crew = crewPlan(coves, site.assets, options.budget || site.crew_plan.budget);
      result.answer = `Current ${crew.stops.length}-stop plan: ${crew.route_km} km round trip from ${crew.start?.name || 'no launch selected'}.\n` + crew.stops.map(s => `${s.order}. ${s.name}: ${s.action}`).join('\n');
    }
    if (id === 'portfolio_recommendation') {
      const top = rank(coves)[0];
      result.answer = `Focus Caddo tasking on ${top.name} (current priority ${top.priority}). Santee is reference-only; Sam Rayburn is excluded.`;
    }
    return result;
  }
  window.AppIntelligenceData = { FACTORS, PRESETS, COLUMNS, validate, priorities, rank, distance, action, crewPlan, exportRows, csv, answer };
}());
