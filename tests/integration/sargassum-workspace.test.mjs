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
const TENANT = { id: fixture.release.tenant_id, slug: "puerto-rico-dner", display_name: "Puerto Rico DNER" };
const SITE_ROOT = `/api/tenants/${TENANT.id}/salvinia/sites/puerto-rico/releases`;

function server() {
  const requests = [];
  const dayByToken = new Map(fixture.payload.timeline.map((row) => [row.file, days[row.date]]));
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname, credentials: init.credentials });
    assert.equal(url.origin, API_ORIGIN);
    if (url.pathname === "/api/tenants/accessible") return Response.json({ data: { tenants: [TENANT] } });
    if (url.pathname === `${SITE_ROOT}/current/manifest`) return Response.json(structuredClone(fixture));
    const asset = url.pathname.match(new RegExp(`^${SITE_ROOT}/${fixture.release.id}/assets/([0-9a-f]{64})$`));
    if (asset && dayByToken.has(asset[1])) return Response.json(dayByToken.get(asset[1]));
    return Response.json({ error: "not_found" }, { status: 404 });
  };
  return { fetcher, requests };
}

test("an authenticated tenant loads the Puerto Rico release and renders its latest verified day", async () => {
  const api = server();
  const documentRef = fakeDocument(WORKSPACE_IDS, WORKSPACE_CLASSES);
  const windowRef = {};
  const leaflet = fakeLeaflet();
  let controller;
  const result = await start({ apiBaseUrl: API_ORIGIN }, {
    loadTenants: (base) => loadAccessibleTenants(base, api.fetcher),
    loadRelease: (base, tenantId) => loadSargassumRelease(base, tenantId, api.fetcher),
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
    `${SITE_ROOT}/current/manifest`,
    `${SITE_ROOT}/${fixture.release.id}/assets/${latestToken}`,
  ]);
  assert.match(documentRef.querySelector("#sargassum-day-status").textContent, /2025-05-17: 0 hotspots shown/);

  await controller.selectDate("2025-05-16");
  assert.equal(leaflet.calls.circleMarkers.length, days["2025-05-16"].hotspots.length);
  assert.match(documentRef.querySelector("#sargassum-detail").textContent, /2025-05-16/);
});

test("a tenant without a Puerto Rico release sees the empty state instead of the Caddo workspace", async () => {
  const requests = [];
  const fetcher = async (input) => {
    requests.push(new URL(String(input)).pathname);
    if (new URL(String(input)).pathname === "/api/tenants/accessible") return Response.json({ data: { tenants: [TENANT] } });
    return Response.json({ error: "release_not_found" }, { status: 404 });
  };
  let empty = false;
  const result = await start({ apiBaseUrl: API_ORIGIN }, {
    loadTenants: (base) => loadAccessibleTenants(base, fetcher),
    loadRelease: (base, tenantId) => loadSargassumRelease(base, tenantId, fetcher),
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    showEmptyRelease: () => { empty = true; },
    startApp: () => { throw new Error("no workspace without a release"); },
  });
  assert.deepEqual(result, { status: "empty", tenantId: TENANT.id });
  assert.equal(empty, true);
  assert.ok(!requests.some((path) => path.includes("/salvinia/releases/current/manifest")), "the Caddo route is never requested");
});
