import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const payload = JSON.parse(readFileSync(new URL('./fixtures/intelligence-release.json', import.meta.url)));
const context = vm.createContext({ window: {}, URL, URLSearchParams });
const source = new URL('../public/intelligence-data.js', import.meta.url);
if (existsSync(source)) vm.runInContext(readFileSync(source, 'utf8'), context);
const intel = context.window.AppIntelligenceData;
const clone = () => structuredClone(payload);

test('accepts the full service-generated intelligence contract', () => {
  assert.ok(intel, 'Intelligence calculation module must be available');
  assert.equal(intel.validate(payload).ok, true);
});

test('rejects malformed nested products, dangling references, prohibited content and inconsistent totals', () => {
  assert.ok(intel, 'Intelligence validation must be available');
  const mutations = [
    p => { p.sites[0].coves[0].priority_components.growth = '0.5'; },
    p => { p.sites[0].coves[0].lat = 100; },
    p => { p.sites[0].coves[0].current_ha = 999; },
    p => { p.sites[0].coves[0].series[0][0] = '2026-02-31'; },
    p => { p.sites[0].coves[1].id = p.sites[0].coves[0].id; },
    p => { p.sites[0].sensor_plan[0].cove_id = 999; },
    p => { p.sites[0].spread_edges = [{ from_cove_id: 1, to_cove_id: 999, distance_km: 1 }]; },
    p => { p.sites[0].crew_plan.stops[0].order = 7; },
    p => { p.sites[0].totals.detected_ha += 10; },
    p => { p.sites[0].priority_weights.defaults = { severity: 1 }; },
    p => { p.sites[0].priority_weights.defaults = Object.fromEntries(Object.keys(p.sites[0].priority_weights.defaults).map(k => [k, 0])); },
    p => { p.sites[1].status = 'operational'; },
    p => { p.santee_reference.operational = true; },
    p => { p.santee_reference.trend.cagr = 99; },
    p => { p.portfolio.site_evaluations['sam-rayburn'].operational = true; },
    p => { p.deterministic_answers.hotspot.citations = ['missing']; },
    p => { p.deterministic_answers.hotspot.source_paths = ['sites.sam']; },
    p => { p.csv_exports.crew_route.rows[0].cove_id = 999; },
    p => { p.reference.provenance = 's3://private/raw'; },
    p => { p.reference.provenance = 'authorization: Bearer secret'; },
    p => { p.model_prompt = 'use my credential'; },
    p => { delete p.sites[0].early_warning; },
  ];
  for (const mutate of mutations) { const changed = clone(); mutate(changed); assert.equal(intel.validate(changed).ok, false, String(mutate)); }
  for (const invalid of [null, {}, [], { schema: payload.schema }]) assert.equal(intel.validate(invalid).ok, false);
});

test('live priorities and nearest-neighbour closed route match the service and do not mutate the release', () => {
  assert.ok(intel, 'Intelligence calculations must be available');
  const site = clone().sites[0];
  const before = JSON.stringify(site);
  const coves = intel.priorities(site.coves, site.priority_weights.defaults);
  assert.deepEqual(Array.from(coves, c => c.priority), site.coves.map(c => c.priority));
  assert.deepEqual(JSON.parse(JSON.stringify(intel.crewPlan(coves, site.assets, 3))), site.crew_plan);
  const changed = intel.priorities(site.coves, { severity: 0, growth: 0, spread: 0, infrastructure: 0, treatability: 1 });
  assert.notDeepEqual(Array.from(changed, c => c.priority), site.coves.map(c => c.priority));
  assert.equal(intel.crewPlan(changed, site.assets, 1).stops.length, 1);
  assert.equal(JSON.stringify(site), before);
  const zero = intel.priorities(site.coves, Object.fromEntries(Object.keys(site.priority_weights.defaults).map(k => [k, 0])));
  assert.ok(zero.every(c => c.priority === 0));
  assert.equal(intel.crewPlan([], site.assets, 3).start, null);
});

test('CSV reflects current priority and route, quotes commas/newlines and neutralizes formula cells', () => {
  assert.ok(intel, 'Intelligence CSV must be available');
  const site = clone().sites[0];
  const csv = intel.csv(['name', 'value'], [{ name: '=HYPERLINK("bad")\nnext,cell', value: -2 }]);
  assert.equal(csv, 'name,value\r\n"\'=HYPERLINK(""bad"")\nnext,cell",-2\r\n');
  const coves = intel.priorities(site.coves, site.priority_weights.defaults);
  const crew = intel.crewPlan(coves, site.assets, 1);
  const rows = intel.exportRows(coves, crew);
  assert.equal(rows.crew_route.length, 1);
  assert.equal(rows.crew_route[0].priority, crew.stops[0].priority);
  assert.equal(rows.cove_priorities.length, 4);
});

test('deterministic questions cover every product, preserve boundaries and use live crew budgets', () => {
  assert.ok(intel, 'Intelligence questions must be available');
  for (const [id, value] of Object.entries(payload.deterministic_answers)) {
    const answer = intel.answer(payload, value.question);
    assert.equal(answer.id, id, value.question);
    assert.ok(answer.answer && answer.boundary && answer.citations.length);
  }
  const site = payload.sites[0];
  const coves = intel.priorities(site.coves, site.priority_weights.defaults);
  const answer = intel.answer(payload, 'Where do I send crews this week?', { coves, budget: 1 });
  assert.match(answer.answer, /1.stop/);
  assert.match(intel.answer(payload, 'Is it confirmed giant salvinia?').boundary, /unresolved/);
  assert.match(intel.answer(payload, 'How are crews planned?', { site: 'santee' }).answer, /reference.only/);
  assert.match(intel.answer(payload, 'invent a treatment cost').boundary, /scenario|cost|treatment/i);
});

test('optional context validates occurrences, historical cost references and complete annual species labels', () => {
  const changed = clone();
  changed.legacy_context = JSON.parse(readFileSync(new URL('./fixtures/intelligence-context.json', import.meta.url)));
  assert.equal(intel.validate(changed).ok, true);
  for (const mutate of [
    c => { c.occurrences[0].date = 'not a date'; },
    c => { c.occurrences[0].lonlat = [999, 1]; },
    c => { c.edrr_cost.per_acre_year_low = -2; },
    c => { c.edrr_cost.per_acre_year_high = 1; },
    c => { delete c.edrr_cost.boundary; },
    c => { c.santee.annual_trend[0].salvinia_ha = '12'; },
    c => { c.santee.annual_trend[1].year = c.santee.annual_trend[0].year; },
    c => { c.santee.assets[0].criticality = 2; },
  ]) { const p = structuredClone(changed); mutate(p.legacy_context); assert.equal(intel.validate(p).ok, false, String(mutate)); }
});

test('legacy monitor, cost and delay phrasing routes to bounded release answers', () => {
  for (const [question, id] of [['Where should we monitor next?', 'sensor_placement'], ['What is the cost?', 'edrr_early_wins'], ['What if we delay 90 days?', 'edrr_early_wins'], ['What can we afford?', 'edrr_early_wins'], ['What saves money?', 'edrr_early_wins'], ['What is the budget?', 'edrr_early_wins']]) assert.equal(intel.answer(payload, question).id, id);
});


test('full-record dates and peaks are validated while optional-less releases remain supported', () => {
  const data = clone();
  for (const cove of data.sites[0].coves) { delete cove.obs_date; delete cove.peak_ha; }
  assert.equal(intel.validate(data).ok, true);
  for (const [field,value] of [['obs_date','1999-01-01'],['peak_ha',0],['obs_date','2026-02-31']]) {
    const changed=clone(); changed.sites[0].coves[0][field]=value;
    assert.equal(intel.validate(changed).ok,false);
  }
});
