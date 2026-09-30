import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadSargassumRelease } from "../public/release-client.js";
import { startSargassumWorkspace } from "../public/sargassum-app.js";
import { fakeDocument, fakeLeaflet, WORKSPACE_CLASSES, WORKSPACE_IDS } from "./support/fake-dom.mjs";

const fixture = JSON.parse(readFileSync(new URL("fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("fixtures/sargassum-days.json", import.meta.url)));
const tenant = { id: fixture.release.tenant_id, display_name: "Puerto Rico DNER" };

async function classification() {
  return loadSargassumRelease("https://api.example.test", tenant.id, async () => Response.json(structuredClone(fixture)));
}

function environment({ loadDay } = {}) {
  const documentRef = fakeDocument(WORKSPACE_IDS, WORKSPACE_CLASSES);
  const windowRef = {};
  const leaflet = fakeLeaflet();
  const loads = [];
  const dependencies = {
    documentRef,
    windowRef,
    leaflet,
    loadDay: loadDay ?? (async (row) => { loads.push(row.date); return structuredClone(days[row.date]); }),
  };
  return { documentRef, windowRef, leaflet, loads, dependencies, byId: (id) => documentRef.querySelector(`#${id}`) };
}

test("renders the release header, summary tiles, and one timeline button per day", async () => {
  const env = environment();
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;

  assert.equal(env.byId("public-landing").hidden, true);
  assert.equal(env.documentRef.querySelector(".app-shell").hidden, false);
  assert.equal(env.byId("sargassum-title").textContent, "Puerto Rico Sargassum detections");
  assert.match(env.byId("sargassum-coverage").textContent, /2025-05-09 – 2025-05-17 · 3 daily records/);
  assert.match(env.byId("sargassum-revision").textContent, /fixture-v1/);
  const summary = env.byId("sargassum-summary").textContent;
  assert.match(summary, /Days observed3/);
  assert.match(summary, /Alert days1/);
  assert.match(summary, /Peak coverage0\.645%/);
  assert.match(summary, /Latest severityLow/);
  const buttons = env.byId("sargassum-timeline").children;
  assert.deepEqual(buttons.map((button) => button.getAttribute("data-date")), ["2025-05-09", "2025-05-16", "2025-05-17"]);
  assert.ok(buttons[0].className.includes("alert") && buttons[0].className.includes("severity-medium"));
  assert.equal(env.windowRef.demoApp, controller);
});

test("selects the latest day first and draws the AOI, approach zone, corridors, hotspots, and trajectories", async () => {
  const env = environment();
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;
  assert.deepEqual(env.loads, ["2025-05-17"]);
  assert.equal(env.leaflet.calls.geoJSON.length, 1);
  assert.deepEqual(env.leaflet.calls.rectangles[0], [[16.5, -69], [19.5, -63]]);

  await controller.selectDate("2025-05-09");
  assert.deepEqual(env.loads, ["2025-05-17", "2025-05-09"]);
  assert.equal(env.leaflet.calls.circleMarkers.length, days["2025-05-09"].hotspots.length);
  assert.ok(env.leaflet.calls.polylines.length > 0, "sample trajectories are drawn");
  assert.ok(env.leaflet.calls.rectangles.length > 1, "corridor boxes are drawn");
  const detail = env.byId("sargassum-detail").textContent;
  assert.match(detail, /Medium severity · alert active/);
  assert.match(detail, /Arrival probability/);
  assert.match(detail, /Most likely origin/);
  assert.match(env.byId("sargassum-day-status").textContent, /2025-05-09: 163 hotspots shown/);

  await controller.selectDate("2025-05-09");
  assert.deepEqual(env.loads, ["2025-05-17", "2025-05-09"], "day assets are cached per token");
});

test("renders alert text as text, never as markup", async () => {
  const hostile = "<img src=x onerror=alert(1)> Sargassum approaching";
  const env = environment({
    loadDay: async (row) => ({ ...structuredClone(days[row.date]), alert: { ...days[row.date].alert, message: hostile } }),
  });
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;
  assert.ok(env.byId("sargassum-detail").textContent.includes(hostile));
});

test("reports a day that cannot be loaded without breaking the workspace", async () => {
  const env = environment({ loadDay: async () => { throw Object.assign(new Error("nope"), { requestId: "req-9" }); } });
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;
  assert.match(env.byId("sargassum-day-status").textContent, /2025-05-17 detections could not be loaded \(reference req-9\)/);
});

test("dispose removes the map and releases the global handle", async () => {
  const env = environment();
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;
  env.windowRef.demoApp.dispose();
  assert.equal(env.leaflet.calls.removed, 1);
  assert.equal(env.windowRef.demoApp, null);
});

test("renders without a map when Leaflet is unavailable", async () => {
  const env = environment();
  env.dependencies.leaflet = undefined;
  const controller = startSargassumWorkspace(await classification(), tenant, {}, env.dependencies);
  await controller.ready;
  assert.equal(controller.map, null);
  assert.match(env.byId("sargassum-detail").textContent, /Low severity/);
});
