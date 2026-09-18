import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
const root = resolve('public');
const tenantId = '00000000-0000-4000-8000-000000000001';
const releaseId = '00000000-0000-4000-8000-000000000002';
const secondTenant = '00000000-0000-4000-8000-000000000003';
const fixture = JSON.parse(await readFile(new URL('../fixtures/intelligence-release.json', import.meta.url)));
async function setup(t, withContext = false) {
  const server = createServer(async (req, res) => {
    const name = resolve(root, req.url.split('?')[0].slice(1) || 'index.html');
    if (!name.startsWith(root + sep)) { res.writeHead(404); return res.end(); }
    try { res.setHeader('content-type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(name)] || 'application/octet-stream'); res.end(await readFile(name)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => { await browser.close(); await new Promise(done => server.close(done)); });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [], exports = [];
  page.on('pageerror', e => errors.push(e.stack));
  const payload = JSON.parse(await readFile(new URL('../fixtures/full-legacy-release.json', import.meta.url)));
  payload.intelligence = structuredClone(fixture);
  if (withContext) payload.intelligence.legacy_context = JSON.parse(await readFile(new URL('../fixtures/intelligence-context.json', import.meta.url)));
  payload.caddo_geometry.features = fixture.sites[0].coves.map(c => ({ type: 'Feature', properties: { id: c.id, name: c.name }, geometry: { type: 'Polygon', coordinates: [[[c.lon-.004,c.lat-.003],[c.lon+.004,c.lat-.003],[c.lon+.004,c.lat+.003],[c.lon-.004,c.lat+.003],[c.lon-.004,c.lat-.003]]] } }));
  const assets = {};
  function files(obj) { for (const [key, val] of Object.entries(obj)) { if (key === 'file') { assets[val] = `${origin}/api/tenants/${tenantId}/salvinia/releases/${releaseId}/assets/${encodeURIComponent(val)}`; } else if (val && typeof val === 'object') files(val); } }
  files(payload);
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.RUNTIME_CONFIG={apiBaseUrl:${JSON.stringify(origin)}}` }));
  let denyExport = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path === '/api/tenants/accessible') body = { data: { tenants: [{ id: tenantId, slug: 'caddo', display_name: 'Caddo Lake' }, { id: secondTenant, slug: 'empty', display_name: 'Other tenant' }] } };
    else if (path === '/api/auth/get-session') body = { user: { name: 'Operator', role: 'operator' } };
    else if (path.endsWith('/intelligence/export')) {
      exports.push(route.request().postDataJSON());
      return route.fulfill({ status: denyExport ? 403 : 200, json: denyExport ? { error: 'export_not_allowed' } : { authorized: true, source_revision: payload.meta.source_revision, release_id: releaseId } });
    } else if (path.endsWith('/manifest')) { const release = structuredClone(payload); if (path.includes(secondTenant)) delete release.intelligence; body = { release: { id: releaseId }, payload: release, assets }; }
    else if (path.includes('/assets/')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8q7WQAAAABJRU5ErkJggg==', 'base64') });
    else return route.fulfill({ status: 404, json: { error: 'not_found' } });
    return route.fulfill({ json: body });
  });
  await page.goto(`${origin}/?tenant=${tenantId}&workspace=intelligence&intel=map`);
  return { page, payload, errors, exports, origin, deny: () => { denyExport = true; } };
}

test('Intelligence uses real service products across map, priorities, planning, research context and questions', async t => {
  const { page, errors, exports, deny } = await setup(t);
  await page.locator('#intelligence-root h1').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('#workspace-intelligence').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('.map-stage').isVisible(), false);
  for (const layer of ['current_ha','growth_ha_yr','spread_pressure','infrastructure_risk','priority','uncertainty_pct']) {
    await page.getByLabel('Intelligence map layer', { exact: true }).selectOption(layer);
    assert.equal(await page.locator('[data-intel-cove]').count(), 4);
  }
  for (const label of ['Assets', 'Sensor plan', 'Sampling plan', 'Crew route', 'Spread front']) await page.getByLabel(label, { exact: true }).check();
  assert.ok(await page.locator('[data-overlay="assets"]').count());
  assert.ok(await page.locator('[data-overlay="sensors"]').count());
  assert.ok(await page.locator('[data-overlay="crew"]').count());
  await page.locator('[data-intel-cove="1"]').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#intel-detail').textContent(), /Cove 001/);
  assert.match(await page.locator('#intel-detail').textContent(), /Peak on record/);
  assert.match(page.url(), /cove=1/);
  if (process.env.SALVINIA_SCREENSHOTS) await page.screenshot({ path: `${process.env.SALVINIA_SCREENSHOTS}/intelligence-map.png`, fullPage: true });
  await page.getByRole('button', { name: 'Priorities', exact: true }).click();
  const initial = await page.locator('#intel-priority-table').textContent();
  await page.getByRole('button', { name: 'EDRR / early wins', exact: true }).click();
  assert.notEqual(await page.locator('#intel-priority-table').textContent(), initial);
  const slider = page.getByLabel('Severity weight', { exact: true });
  await slider.fill('70'); await slider.dispatchEvent('input');
  assert.equal(await page.locator('#intel-weight-severity').textContent(), '70%');
  await page.getByLabel('Crew visits this cycle', { exact: true }).fill('3');
  await page.getByLabel('Crew visits this cycle', { exact: true }).dispatchEvent('input');
  assert.match(await page.locator('#intel-crew').textContent(), /3 stops/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export crew route CSV', exact: true }).click()]);
  assert.equal(download.suggestedFilename(), 'caddo-crew-route.csv');
  assert.equal(exports[0].kind, 'crew_route');
  assert.equal(exports[0].budget, 3);
  assert.equal(exports[0].weights.severity, .7);
  if (process.env.SALVINIA_SCREENSHOTS) await page.screenshot({ path: `${process.env.SALVINIA_SCREENSHOTS}/intelligence-priorities.png`, fullPage: true });
  deny();
  await page.getByRole('button', { name: 'Export priorities CSV', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'export_not_allowed' }).waitFor();
  for (const label of ['Overview','Sensors & sampling','Infrastructure','EDRR & warnings','Portfolio','Methods & data']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.ok((await page.locator('#intelligence-root h1').textContent()).length);
  }
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  for (const question of Object.values(fixture.deterministic_answers).map(a => a.question)) {
    await page.getByRole('button', { name: question, exact: true }).click();
    assert.ok((await page.locator('#intel-answer').textContent()).length > 40);
  }
  assert.equal(await page.locator('#intelligence-root input[type="password"]').count(), 0);
  await page.getByLabel('Intelligence site', { exact: true }).selectOption('santee');
  assert.match(await page.locator('#intelligence-root').textContent(), /reference.label|reference-only/);
  assert.equal(await page.locator('#intelligence-root option[value="sam-rayburn"]').count(), 0);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  assert.equal(await page.locator('[data-intel-cove]').count(), 0);
  await page.setViewportSize({ width: 700, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#workspace-console').click();
  assert.equal(await page.locator('#intelligence-root').isVisible(), false);
  assert.equal(await page.locator('.map-stage').isVisible(), true);
  await page.locator('#workspace-briefing').click();
  assert.equal(await page.locator('#panel').isVisible(), true);
  await page.locator('#workspace-intelligence').click();
  assert.equal(await page.locator('#intelligence-root').isVisible(), true);
  assert.match(page.url(), new RegExp(`tenant=${tenantId}`));
  assert.deepEqual(errors, []);
});

test('missing or malformed optional Intelligence stays bounded and tenant replacement disposes controls', async t => {
  const { page, payload, errors } = await setup(t);
  await page.locator('#intelligence-root h1').waitFor({ timeout: 5000 });
  await page.evaluate(() => window.demoApp.dispose());
  assert.equal(await page.locator('#intelligence-root button').count(), 0);
  const malformed = structuredClone(payload); malformed.intelligence.sites[0].sensor_plan[0].cove_id = 999;
  await page.evaluate(release => window.startSalviniaApp({ kind: 'full', release }), malformed);
  await page.locator('#workspace-intelligence').click();
  assert.match(await page.locator('#intelligence-root').textContent(), /Intelligence unavailable/);
  await page.locator('#workspace-briefing').click();
  assert.equal(await page.locator('#panel').isVisible(), true);
  const absent = structuredClone(payload); delete absent.intelligence;
  await page.evaluate(release => window.startSalviniaApp({ kind: 'full', release }), absent);
  await page.locator('#workspace-intelligence').click();
  assert.match(await page.locator('#intelligence-root').textContent(), /not published/);
  assert.deepEqual(errors, []);
});

test('CSV authorization rejects a different release ID and cannot complete after tenant disposal', async t => {
  const { page, payload, errors } = await setup(t);
  await page.locator('#intelligence-root h1').waitFor();
  await page.getByRole('button', { name: 'Priorities', exact: true }).click();
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.route('**/intelligence/export', route => route.fulfill({ json: { authorized: true, source_revision: payload.meta.source_revision, release_id: secondTenant } }));
  await page.getByRole('button', { name: 'Export crew route CSV', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'active release changed' }).waitFor();
  assert.equal(downloads, 0);
  let pending;
  const requested = new Promise(resolve => { pending = resolve; });
  let finish;
  await page.route('**/intelligence/export', async route => { pending(); await new Promise(resolve => { finish = resolve; }); await route.fulfill({ json: { authorized: true, source_revision: payload.meta.source_revision, release_id: releaseId } }); });
  await page.getByRole('button', { name: 'Export crew route CSV', exact: true }).click();
  await requested;
  await page.evaluate(() => window.demoApp.dispose());
  finish();
  await page.waitForResponse('**/intelligence/export');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  assert.equal(downloads, 0);
  assert.equal(await page.locator('#intelligence-root button').count(), 0);
  assert.deepEqual(errors, []);
});

test('released occurrence and historical reference context renders without promoting Santee to operations', async t => {
  const { page, errors } = await setup(t, true);
  await page.locator('#intelligence-root h1').waitFor();
  await page.getByLabel('Confirmed occurrences', { exact: true }).check();
  assert.equal(await page.locator('[data-overlay="occurrences"]').count(), 1);
  await page.getByRole('button', { name: 'EDRR & warnings', exact: true }).click();
  assert.match(await page.locator('#intelligence-root').textContent(), /Historical annual aquatic-weed control/);
  assert.match(await page.locator('#intelligence-root').textContent(), /Annual control-cost band/);
  await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
  assert.match(await page.locator('#intelligence-root').textContent(), /Cross Generating Station/);
  assert.match(await page.locator('#intelligence-root').textContent(), /Crested floating heart ha/);
  assert.equal(await page.locator('[data-reference-species]').count(), 4);
  assert.equal(await page.locator('.workspace').evaluate(e => e.clientHeight < innerHeight && e.scrollHeight > e.clientHeight), true);
  if (process.env.SALVINIA_SCREENSHOTS) { await page.locator('[data-reference-species]').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.SALVINIA_SCREENSHOTS}/intelligence-reference.png` }); }
  assert.match(await page.locator('#intelligence-root').textContent(), /No Santee operational detection/);
  assert.equal(await page.locator('#intelligence-root script').count(), 0);
  assert.deepEqual(errors, []);
});

test('valid non-polygon GeoJSON is bounded to cove markers and collections preserve area geometry', async t => {
  const { page, payload, errors } = await setup(t);
  const coords = fixture.sites[0].coves.map(c => [c.lon,c.lat]);
  payload.caddo_geometry.features.forEach((f,i) => { f.geometry = [
    {type:'Point',coordinates:coords[0]}, {type:'LineString',coordinates:coords.slice(0,2)},
    {type:'GeometryCollection',geometries:[f.geometry]}, {type:'MultiPoint',coordinates:coords.slice(2)},
  ][i]; });
  await page.reload();
  await page.locator('[data-intel-cove="1"]').waitFor();
  assert.equal(await page.locator('[data-intel-cove]').count(), 4);
  await page.locator('[data-intel-cove="1"]').click();
  assert.match(await page.locator('#intel-detail').textContent(), /Cove 001/);
  assert.deepEqual(errors, []);
});
