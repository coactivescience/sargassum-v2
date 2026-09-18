import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadViews(globals = {}) {
  const window = globals.window || {};
  const context = vm.createContext({ window, ...globals });
  for (const file of ["../public/core.js", "../public/views.js"]) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
  }
  return window;
}

function fakeElement() {
  let html = "";
  const children = new Map();
  const collections = new Map();
  const listeners = new Map();
  const element = {
    textContent: "",
    hidden: false,
    value: 0,
    scrollTop: 0,
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    click() { listeners.get("click")?.({ currentTarget: element }); },
    querySelector(selector) {
      if (selector === "h1") {
        const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        return match ? { textContent: match[1].replace(/<[^>]+>/g, "").trim() } : null;
      }
      if (!children.has(selector)) children.set(selector, fakeElement());
      return children.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === ".ops-priority") {
        const count = html.match(/class="rank-row ops-priority"/g)?.length || 0;
        if (!collections.has(selector)) {
          collections.set(selector, Array.from({ length: count }, () => fakeElement()));
        }
        return collections.get(selector);
      }
      return [];
    },
    replaceChildren() {},
    appendChild() {},
    setAttribute() {},
  };
  Object.defineProperty(element, "innerHTML", {
    get: () => html,
    set: (value) => {
      html = String(value);
      children.clear();
      collections.clear();
    },
  });
  return element;
}

function fakeMap() {
  return {
    raster() {},
    coves() {},
    fit() {},
    focus() {},
    numberedMarker() {},
    groups: {
      geometry: { clearLayers() {} },
      markers: { clearLayers() {} },
      raster: { clearLayers() {} },
    },
  };
}

const fullLegacyViewData = JSON.parse(readFileSync(
  new URL("./fixtures/full-legacy-view-data.json", import.meta.url),
  "utf8",
));

function renderView(beat, data = fullLegacyViewData, map = fakeMap()) {
  const window = loadViews();
  const headings = [];
  const legends = [];
  const panel = fakeElement();
  const ctx = {
    data,
    map,
    panel,
    hyperspectralStage: fakeElement(),
    heading: (small, large) => headings.push([small, large]),
    legend: items => legends.push(items),
    usePlayback: () => {},
  };
  window.AppViews[beat](ctx);
  return { ctx, headings, legends, panel };
}

const fullViewCases = [
  ["monitor", /2017.*2026/],
  ["detect", /Jul 15, 2026/],
  ["operations", /Caddo Lake.*Jul 15, 2026/],
  ["response", /Aug 15, 2021/],
  ["verification", /East Pocket.*Aug 15, 2021.*Sep 15, 2021/],
  ["deploy", /Caddo Lake/],
  ["hyperspectral", /Area A.*Area B.*reference\/evaluation/i],
];

for (const [beat, payloadHeading] of fullViewCases) {
  test(`renders ${beat} from the portable full visual release`, () => {
    const { headings, panel } = renderView(beat);

    assert.ok(panel.querySelector("h1")?.textContent.length > 0);
    assert.match(headings.at(-1)[1], payloadHeading);
  });
}

test("missing imagery renders an escaped in-panel warning instead of throwing", () => {
  const release = structuredClone(fullLegacyViewData);
  release.monitor.frames[0].label = 'Baseline <img src=x onerror="alert(1)">';
  delete release.monitor.frames[0].file;

  const { panel } = renderView("monitor", release);

  assert.match(panel.innerHTML, /data-warning/);
  assert.match(panel.innerHTML, /Baseline &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(panel.innerHTML, /<img src=x/);
});

test("monitor renders a payload-labelled acquisition card for every observation", () => {
  const { panel } = renderView("monitor");

  assert.equal(panel.innerHTML.match(/class="acquisition-card"/g)?.length, 3);
  assert.match(panel.innerHTML, /2017 baseline acquisition/);
  assert.match(panel.innerHTML, /2026 approved acquisition/);
});

test("treatment chronology with missing or malformed dates renders escaped warnings instead of throwing", () => {
  const release = structuredClone(fullLegacyViewData);
  release.response.treatments[0].label = "Window <script>alert(1)</script>";
  release.response.treatments[0].start_date = "2026-02-30";
  release.response.treatments[0].end_date = { hostile: true };
  release.response.treatments.push({ label: "Missing date window", start_date: "2026-03-01" });

  const { panel } = renderView("response", release);

  assert.match(panel.innerHTML, /data-warning/);
  assert.match(panel.innerHTML, /Window &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(panel.innerHTML, /Missing date window/);
  assert.doesNotMatch(panel.innerHTML, /<script>alert/);
});

test("hyperspectral comparison stays gated and labels Kolkata as reference evaluation material", () => {
  const release = structuredClone(fullLegacyViewData);
  release.hyperspectral.evidence_gate = {
    passes: false,
    label: "Gate <script>failed</script>",
  };

  const { ctx, panel } = renderView("hyperspectral", release);

  assert.equal(ctx.hyperspectralStage.innerHTML, "");
  assert.match(panel.innerHTML, /reference\/evaluation/i);
  assert.match(panel.innerHTML, /Gate &lt;script&gt;failed&lt;\/script&gt;/);
  assert.doesNotMatch(panel.innerHTML, /<script>failed/);
});

test("hyperspectral comparison fails closed when the evidence gate is missing", () => {
  const release = structuredClone(fullLegacyViewData);
  delete release.hyperspectral.evidence_gate;

  const { ctx, panel } = renderView("hyperspectral", release);

  assert.equal(ctx.hyperspectralStage.innerHTML, "");
  assert.match(panel.innerHTML, /reference\/evaluation evidence is unavailable/i);
});

test("hyperspectral comparison fails closed unless exactly two sites are released", () => {
  const release = structuredClone(fullLegacyViewData);
  release.hyperspectral.sites.push({
    ...structuredClone(release.hyperspectral.sites[0]),
    label: "Area C",
  });

  const { ctx, panel } = renderView("hyperspectral", release);

  assert.equal(ctx.hyperspectralStage.innerHTML, "");
  assert.match(panel.innerHTML, /exactly two release-owned comparison sites/i);
});

test("hyperspectral findings are computed from released spectra and ignore unverified prose claims", () => {
  const release = structuredClone(fullLegacyViewData);
  release.hyperspectral.sites[0].label = "Alpha water area";
  release.hyperspectral.sites[1].label = "Beta water area";
  release.hyperspectral.sites[0].spectrum = [
    { wavelength_nm: 551, normalized_median: .31, normalized_q25: .3, normalized_q75: .32 },
    { wavelength_nm: 720, normalized_median: .32, normalized_q25: .31, normalized_q75: .33 },
    { wavelength_nm: 868, normalized_median: .33, normalized_q25: .32, normalized_q75: .34 },
  ];
  release.hyperspectral.sites[1].spectrum = [
    { wavelength_nm: 551, normalized_median: .21, normalized_q25: .2, normalized_q75: .22 },
    { wavelength_nm: 720, normalized_median: .22, normalized_q25: .21, normalized_q75: .23 },
    { wavelength_nm: 868, normalized_median: .23, normalized_q25: .22, normalized_q75: .24 },
  ];
  release.hyperspectral.robustness.summary = ["The profiles cross under alternate shoreline checks."];

  const { ctx, panel } = renderView("hyperspectral", release);
  const rendered = `${ctx.hyperspectralStage.innerHTML} ${panel.innerHTML}`;

  assert.match(rendered, /Alpha water area median is higher at 1 of 1 shared targets/);
  assert.doesNotMatch(rendered, /profiles cross|alternate shoreline checks|profiles converge/i);
});

test("hyperspectral missing imagery warns and never emits an undefined image source", () => {
  const release = structuredClone(fullLegacyViewData);
  delete release.hyperspectral.sites[0].aquatic_cover.file;

  const { ctx, panel } = renderView("hyperspectral", release);

  assert.match(panel.innerHTML, /data-warning/);
  assert.doesNotMatch(ctx.hyperspectralStage.innerHTML, /src="undefined"/);
  assert.equal(ctx.hyperspectralStage.innerHTML.match(/<img /g)?.length, 1);
});

test("hyperspectral chart renders finite coordinates from the full visual fixture", () => {
  const { ctx } = renderView("hyperspectral");

  assert.doesNotMatch(ctx.hyperspectralStage.innerHTML, /NaN|Infinity/);
});

test("operations derives its approved record years from observations", () => {
  const release = structuredClone(fullLegacyViewData);
  release.monitor.frames.forEach((frame, index) => { frame.date = `${2031 + index}-08-12`; });
  release.detect.date = "2033-08-12";
  release.detect.frame.date = "2033-08-12";

  const { panel } = renderView("operations", release);

  assert.match(panel.innerHTML, /2031–2033/);
  assert.doesNotMatch(panel.innerHTML, /2026 release window|approved 2026 observation/);
});

test("operations selection replaces prior cove geometry and markers on repeated clicks", () => {
  const tracked = {
    geometry: { layers: [], clearCalls: 0, clearLayers() { this.layers.length = 0; this.clearCalls += 1; } },
    markers: { layers: [], clearCalls: 0, clearLayers() { this.layers.length = 0; this.clearCalls += 1; } },
  };
  const map = {
    raster() {}, fit() {}, focus() {},
    coves() { tracked.geometry.layers.push("coves"); },
    numberedMarker() { tracked.markers.layers.push("marker"); },
    groups: { ...tracked, raster: { clearLayers() {} } },
  };
  const { panel } = renderView("operations", fullLegacyViewData, map);
  const rows = panel.querySelectorAll(".ops-priority");

  rows[0].click();
  rows[1].click();

  assert.equal(tracked.geometry.clearCalls, 2);
  assert.equal(tracked.geometry.layers.length, 1);
  assert.equal(tracked.markers.clearCalls, 2);
  assert.equal(tracked.markers.layers.length, 1);
});

function leafletAdapter() {
  const pendingTimeouts = new Set();
  let timeoutId = 0;
  const groups = [];
  const map = {
    fitBounds() {},
    invalidateSize() {},
    setView() {},
  };
  const layer = (kind) => ({
    kind,
    addTo(group) { group.layers.push(this); return this; },
    bindTooltip() { return this; },
    on() { return this; },
  });
  const L = {
    map: () => map,
    control: { zoom: () => ({ addTo() {} }) },
    layerGroup: () => {
      const group = {
        layers: [],
        addTo() { groups.push(this); return this; },
        clearLayers() { this.layers.length = 0; },
      };
      return group;
    },
    imageOverlay: () => layer("raster"),
    geoJSON: () => layer("geometry"),
    divIcon: () => ({}),
    marker: () => layer("marker"),
  };
  const window = {
    setTimeout() {
      timeoutId += 1;
      pendingTimeouts.add(timeoutId);
      return timeoutId;
    },
    clearTimeout(id) { pendingTimeouts.delete(id); },
  };
  return { L, window, groups, pendingTimeouts };
}

test("map adapter retains only current layers and one invalidation timer after three view transitions", () => {
  const adapter = leafletAdapter();
  const window = loadViews({ L: adapter.L, window: adapter.window });
  const map = new window.AppCore.MapView("map", fullLegacyViewData.caddo_geometry);

  for (const beat of ["monitor", "detect", "deploy"]) {
    map.clear();
    const ctx = {
      data: fullLegacyViewData,
      map,
      panel: fakeElement(),
      hyperspectralStage: fakeElement(),
      heading: () => {},
      legend: () => {},
      usePlayback: () => {},
    };
    window.AppViews[beat](ctx);
  }

  assert.deepEqual(adapter.groups.map((group) => group.layers.map((item) => item.kind)), [
    ["raster"], ["geometry"], [],
  ]);
  assert.equal(adapter.pendingTimeouts.size, 1);
});

const payload = {
  monitor: {
    minimum_patch_ha: 0.5,
    frames: [{ date: "2025-06-01", mat_ha: 12.3 }],
    bounds: [[32.7, -94.15], [32.85, -94.0]],
  },
  detect: {
    date: "2026-07-01",
    affected_count: 1,
    affected_cove_ids: [],
    largest: [{ cove_id: "cove-a", name: "Big Cove", lonlat: [-94.08, 32.76], detected_ha: 4.2, valid_fraction: 0.9 }],
    frame: {},
  },
  sites: [
    { label: 'Hostile <img src=x onerror=alert(1)>', status: "Monitoring", detail: "Active" },
  ],
  evidence: {
    monitor: { title: "Monitor evidence", lines: ["Checked against imagery"] },
    deploy: { title: "Deploy evidence", lines: [] },
  },
};

test("views render from the release payload supplied on the render context", () => {
  const window = loadViews();
  const headings = [];
  const ctx = {
    data: payload,
    map: fakeMap(),
    panel: fakeElement(),
    hyperspectralStage: fakeElement(),
    heading: (small, large) => headings.push([small, large]),
    legend: () => {},
    usePlayback: () => {},
  };

  window.AppViews.monitor(ctx);

  assert.deepEqual(headings, [["Monitor", "Jun 1, 2025–Jun 1, 2025 · approved floating-vegetation record"]]);
  assert.match(ctx.panel.innerHTML, /01 · Monitor/);
  assert.match(ctx.panel.innerHTML, /<strong>1<\/strong>/);
  assert.match(ctx.panel.innerHTML, /Monitor evidence/);
});

test("views escape API-controlled text before injecting it as HTML", () => {
  const window = loadViews();
  const ctx = {
    data: payload,
    map: fakeMap(),
    panel: fakeElement(),
    hyperspectralStage: fakeElement(),
    heading: () => {},
    legend: () => {},
    usePlayback: () => {},
  };

  window.AppViews.deploy(ctx);

  assert.match(ctx.panel.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(ctx.panel.innerHTML, /<img src=x/);
});

test("bounded views derive imagery provenance and dates from the monitor release", () => {
  const window = loadViews();
  const legends = [];
  const ctx = {
    data: {
      ...payload,
      monitor: {
        ...payload.monitor,
        frames: [
          { date: "2031-06-01", mat_ha: 10 },
          { date: "2034-06-01", mat_ha: 12 },
        ],
      },
      response: { state: "limited_history", message: "Only the published window is approved." },
      verification: { state: "limited_history", message: "Only the published window is approved." },
    },
    map: fakeMap(),
    panel: fakeElement(),
    hyperspectralStage: fakeElement(),
    heading: () => {},
    legend: items => legends.push(items),
    usePlayback: () => {},
  };

  window.AppViews.response(ctx);
  assert.match(ctx.panel.innerHTML, /History is intentionally bounded/);
  assert.match(ctx.panel.innerHTML, /2031–2034/);
  assert.doesNotMatch(ctx.panel.innerHTML, /Sentinel-2|2026/);
  assert.equal(legends.at(-1)[0].label, "Approved release imagery · 2031–2034");

  window.AppViews.verification(ctx);
  assert.match(ctx.panel.innerHTML, /Rapid-change candidates need observations/);
  assert.match(ctx.panel.innerHTML, /2031–2034/);
  assert.doesNotMatch(ctx.panel.innerHTML, /Sentinel-2|2026/);
  assert.equal(legends.at(-1)[0].label, "Approved release imagery · 2031–2034");
});

test("operations view is release-grounded and keeps the historical boundary explicit", () => {
  const window = loadViews();
  const ctx = {
    data: payload,
    map: fakeMap(),
    panel: fakeElement(),
    hyperspectralStage: fakeElement(),
    heading: () => {},
    legend: () => {},
    usePlayback: () => {},
  };

  window.AppViews.operations(ctx);
  assert.match(ctx.panel.innerHTML, /Caddo Lake operations/);
  assert.match(ctx.panel.innerHTML, /Ask the Salvinia Agent/);
  assert.match(ctx.panel.innerHTML, /field observations and management records/i);
  assert.doesNotMatch(ctx.panel.innerHTML, /That history has not been imported/);
  assert.match(ctx.panel.innerHTML, /Big Cove/);
});

test("hyperspectral view keeps unavailable legacy evidence explicit", () => {
  const window = loadViews();
  const ctx = {
    data: { ...payload, hyperspectral: { state: "not_available", message: "2025 evidence is not approved." } },
    map: fakeMap(),
    panel: fakeElement(),
    hyperspectralStage: fakeElement(),
    heading: () => {},
    legend: () => {},
    usePlayback: () => {},
  };
  window.AppViews.hyperspectral(ctx);
  assert.match(ctx.panel.innerHTML, /2025 evidence is not approved/);
  assert.match(ctx.panel.innerHTML, /separately approved and published/);
});

test("beat navigation preserves unrelated query parameters such as tenant", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /new URLSearchParams\(location\.search\)/);
  assert.match(app, /params\.set\("beat", id\)/);
  assert.match(app, /history\.replaceState\(null, "", `\?\$\{params\.toString\(\)\}\$\{location\.hash\}`\)/);
});

test("hyperspectral view reports unsupported controls without inventing a number", () => {
  const window = loadViews();
  const data = structuredClone(fullLegacyViewData);
  data.hyperspectral.open_water_control = { supported: false, excess_separation_degrees: null };
  const ctx = { data, map: fakeMap(), panel: fakeElement(), hyperspectralStage: fakeElement(), heading: () => {}, legend: () => {}, usePlayback: () => {} };
  window.AppViews.hyperspectral(ctx);
  assert.match(ctx.panel.innerHTML, /Open-water comparison lacks sufficient patch support/);
  assert.doesNotMatch(ctx.panel.innerHTML, /0.00° excess separation for open-water/);
});
