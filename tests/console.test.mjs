import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const sourceUrl = new URL("../public/console.js", import.meta.url);

function loadConsole() {
  const window = {};
  vm.runInContext(readFileSync(sourceUrl, "utf8"), vm.createContext({ window }));
  return window.AppConsole;
}

test("publishes the map-console browser API", () => {
  assert.equal(existsSync(sourceUrl), true);
  if (!existsSync(sourceUrl)) return;
  const consoleApi = loadConsole();
  assert.equal(typeof consoleApi?.create, "function");
  assert.equal(typeof consoleApi?.observationsFor, "function");
});

test("adapts real monitor frames without inventing unpublished science", () => {
  const observations = loadConsole().observationsFor({
    monitor: {
      frames: [
        { id: "scene-1", date: "2025-06-01", file: "one.webp", mat_ha: 12.5 },
        { id: "scene-2", date: "2025-07-01", file: "two.webp", mat_ha: 8.25 },
      ],
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(observations)), [
    {
      id: "scene-1",
      date: "2025-06-01",
      source_scene: "scene-1",
      metrics: { detected_ha: 12.5 },
      granules: [],
      samples: [],
      layers: { base: { file: "one.webp" }, intensity: { file: "one.webp" } },
    },
    {
      id: "scene-2",
      date: "2025-07-01",
      source_scene: "scene-2",
      metrics: { detected_ha: 8.25 },
      granules: [],
      samples: [],
      layers: { base: { file: "two.webp" }, intensity: { file: "two.webp" } },
    },
  ]);
  assert.equal("fai_mean" in observations[0].metrics, false);
});

test("uses richer release-owned console observations when published", () => {
  const published = [{
    id: "scene-1",
    date: "2025-06-01",
    source_scene: "scene-1",
    metrics: { fai_mean: -0.012 },
    granules: [{ satellite: "S2A", tile: "T15SUS", product_id: "real-product" }],
    samples: [],
    layers: { base: { file: "base.webp" }, zones: { file: "zones.webp" } },
  }];

  assert.equal(loadConsole().observationsFor({ console: { observations: published } })[0], published[0]);
});

test("uses the real observation date as the stable key when an older frame has no id", () => {
  const [observation] = loadConsole().observationsFor({
    monitor: { frames: [{ date: "2020-05-01", file: "frame.webp", mat_ha: 1 }] },
  });

  assert.equal(observation.id, "2020-05-01");
  assert.equal(observation.source_scene, null);
});
