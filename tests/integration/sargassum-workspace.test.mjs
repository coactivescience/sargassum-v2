import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { start } from "../../public/bootstrap.js";
import { loadSargassumDay, loadSargassumRelease } from "../../public/release-client.js";
import { startSargassumWorkspace } from "../../public/sargassum-app.js";
import { loadAccessibleTenants } from "../../public/tenant-client.js";
import { fakeDocument, fakeLeaflet, WORKSPACE_CLASSES, WORKSPACE_IDS } from "../support/fake-dom.mjs";

const API_ORIGIN = "https://api.example.test";
const fixture = JSON.parse(readFileSync(new URL("../fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("../fixtures/sargassum-days.json", import.meta.url)));
const TENANT = { id: fixture.fixture.tenant_id, slug: "coastal-agency", display_name: "Coastal Agency" };
const SITE = fixture.fixture.site;
const SITES_PATH = `/api/tenants/${TENANT.id}/sargassum/sites`;
const SITE_ROOT = `${SITES_PATH}/${SITE.id}/releases`;
const { fixture: _context, ...MANIFEST } = fixture;

function server() {
  const requests = [];
  const dayByToken = new Map(fixture.payload.timeline.map((row) => [row.file, days[row.date]]));
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname, credentials: init.credentials });
    assert.equal(url.origin, API_ORIGIN);
    if (url.pathname === "/api/tenants/accessible") return Response.json({ data: { tenants: [TENANT] } });
    if (url.pathname === SITES_PATH) return Response.json({ sites: [SITE] });
    if (url.pathname === `${SITE_ROOT}/current/manifest`) return Response.json(structuredClone(MANIFEST));
    const asset = url.pathname.match(new RegExp(`^${SITE_ROOT}/${fixture.release.id}/assets/([0-9a-f]{64})$`));
    if (asset && dayByToken.has(asset[1])) return Response.json(dayByToken.get(asset[1]));
    return Response.json({ error: { code: "not_found" } }, { status: 404 });
  };
  return { fetcher, requests };
}

test("an authenticated tenant lists its Sargassum sites, loads the site release, and renders its latest verified day", async () => {
  const api = server();
  const documentRef = fakeDocument(WORKSPACE_IDS, WORKSPACE_CLASSES);
  const windowRef = {};
  const leaflet = fakeLeaflet();
  let controller;
  const result = await start({ apiBaseUrl: API_ORIGIN }, {
    loadTenants: (base) => loadAccessibleTenants(base, api.fetcher),
    loadRelease: (base, tenantId, options) => loadSargassumRelease(base, tenantId, { ...options, fetcher: api.fetcher }),
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    startApp: (release, tenant, classification) => {
      controller = startSargassumWorkspace({ release, ...classification }, tenant, {}, {
        documentRef,
        windowRef,
        leaflet,
        loadDay: (row) => loadSargassumDay(row, api.fetcher),
      });
    },
    showError: (state) => { throw new Error(`unexpected error state ${JSON.stringify(state)}`); },
  });
  await controller.ready;

  assert.deepEqual(result, { status: "ready", tenantId: TENANT.id });
  assert.ok(api.requests.every((request) => request.credentials === "include"));
  const latestToken = fixture.payload.timeline.at(-1).file;
  assert.deepEqual(api.requests.map((request) => request.path), [
    "/api/tenants/accessible",
    SITES_PATH,
    `${SITE_ROOT}/current/manifest`,
    `${SITE_ROOT}/${fixture.release.id}/assets/${latestToken}`,
  ]);
  assert.match(documentRef.querySelector("#sargassum-day-status").textContent, /2025-05-17: 0 hotspots shown/);

  await controller.selectDate("2025-05-16");
  assert.equal(leaflet.calls.circleMarkers.length, days["2025-05-16"].hotspots.length);
  assert.match(documentRef.querySelector("#sargassum-detail").textContent, /2025-05-16/);
});

test("a tenant whose site has no release yet sees the empty state, and no Salvinia route is requested", async () => {
  const requests = [];
  const fetcher = async (input) => {
    requests.push(new URL(String(input)).pathname);
    if (new URL(String(input)).pathname === "/api/tenants/accessible") return Response.json({ data: { tenants: [TENANT] } });
    if (new URL(String(input)).pathname === SITES_PATH) return Response.json({ sites: [{ ...SITE, current_release: null }] });
    return Response.json({ error: { code: "release_not_found" } }, { status: 404 });
  };
  let empty = false;
  const result = await start({ apiBaseUrl: API_ORIGIN }, {
    loadTenants: (base) => loadAccessibleTenants(base, fetcher),
    loadRelease: (base, tenantId, options) => loadSargassumRelease(base, tenantId, { ...options, fetcher }),
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    showEmptyRelease: () => { empty = true; },
    startApp: () => { throw new Error("no workspace without a release"); },
  });
  assert.deepEqual(result, { status: "empty", tenantId: TENANT.id });
  assert.equal(empty, true);
  assert.ok(!requests.some((path) => path.includes("/salvinia/")), "no Salvinia route is requested");
  assert.deepEqual(requests.slice(1), [SITES_PATH, `${SITE_ROOT}/current/manifest`]);
});
