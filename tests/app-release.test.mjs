import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { classifyRelease, loadCurrentRelease, ReleaseError } from "../public/release-client.js";

const fullLegacyRelease = JSON.parse(readFileSync(new URL("fixtures/full-legacy-release.json", import.meta.url)));
const summaryRelease = JSON.parse(readFileSync(new URL("fixtures/summary-release.json", import.meta.url)));

function matches(node, selector) {
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  const attribute = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if (attribute) return node.getAttribute(attribute[1]) === attribute[2];
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function element(tagName = "div", documentRef) {
  let ownText = "";
  const attributes = new Map();
  const listeners = new Map();
  const node = {
    tagName: tagName.toUpperCase(),
    id: "",
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    scrollTop: 0,
    parentNode: null,
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    append(...values) {
      values.forEach((value) => {
        if (value && typeof value === "object") this.appendChild(value);
        else {
          const textNode = element("#text", documentRef);
          textNode.textContent = value;
          this.appendChild(textNode);
        }
      });
    },
    replaceChildren(...children) {
      this.children.forEach((child) => { child.parentNode = null; });
      this.children = children;
      children.forEach((child) => { child.parentNode = this; });
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [
        ...(matches(child, selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    click() {
      (listeners.get("click") || []).forEach((listener) => listener({ currentTarget: this }));
      this.onclick?.({ currentTarget: this });
    },
    focus() { documentRef.activeElement = this; },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    },
  };
  Object.defineProperty(node, "textContent", {
    get() { return ownText + node.children.map((child) => child.textContent).join(""); },
    set(value) { ownText = String(value); node.replaceChildren(); },
  });
  node.classList = {
    add(...names) { node.className = [...new Set([...node.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
    remove(...names) { node.className = node.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" "); },
    toggle(name, force) {
      const present = node.className.split(/\s+/).includes(name);
      const add = force === undefined ? !present : force;
      this[add ? "add" : "remove"](name);
      return add;
    },
  };
  return node;
}

function loadApp(search = "") {
  const document = { activeElement: null };
  const elements = new Map([
    [".beat-nav", element("nav", document)], ["#panel", element("aside", document)],
    ["#map-title", element("strong", document)], ["#map-kicker", element("span", document)],
    ["#map-legend", element("div", document)], [".map-source", element("div", document)],
    [".record-badge", element("div", document)], [".workspace", element("main", document)],
    [".map-stage", element("section", document)], ["#map", element("div", document)],
    ["#hyperspectral-stage", element("div", document)], ["#release-status", element("section", document)],
    ["#release-status-version", element("dd", document)], ["#release-status-acquisitions", element("dd", document)],
    ["#release-status-capabilities", element("dd", document)], ["#release-status-guidance", element("p", document)],
    ["#public-landing", element("main", document)], [".app-shell", element("div", document)],
    ["#console-inspector", element("aside", document)], ["#console-layer-control", element("fieldset", document)],
    ["#workspace-console", element("button", document)], ["#workspace-briefing", element("button", document)],
  ]);
  elements.get("#release-status").appendChild(elements.get("#release-status-version"));
  elements.get("#release-status").appendChild(elements.get("#release-status-acquisitions"));
  elements.get("#release-status").appendChild(elements.get("#release-status-capabilities"));
  elements.get("#release-status").appendChild(elements.get("#release-status-guidance"));
  elements.get(".app-shell").hidden = true;
  const historyCalls = [];
  const location = { search, hash: "", origin: "https://app.example.test" };
  Object.assign(document, {
    querySelector(selector) { return elements.get(selector) ?? null; },
    createElement(tagName) { return element(tagName, document); },
  });
  const lifecycle = { playbackStops: 0, mapCreatedWhileVisualsHidden: null, consoleCreates: 0, consoleDisposals: 0, viewCalls: 0 };
  const map = { clearCalls: 0, clear() { this.clearCalls += 1; } };
  const AppCore = { MapView: class { constructor() {
    lifecycle.mapCreatedWhileVisualsHidden = [".app-shell", ".map-stage", "#map"]
      .some((selector) => elements.get(selector).hidden);
    return map;
  } }, legend: () => "" };
  const AppViews = Object.fromEntries(["monitor", "detect", "operations", "response", "verification", "deploy", "hyperspectral"].map((id) => [id, ({ panel, heading, usePlayback }) => {
    lifecycle.viewCalls += 1;
    heading(id, `${id} map`);
    const viewHeading = element("h1", document);
    viewHeading.textContent = `${id} view`;
    panel.replaceChildren(viewHeading);
    if (id === "monitor") usePlayback({ stop() { lifecycle.playbackStops += 1; } });
  }]));
  const AppConsole = {
    create() {
      lifecycle.consoleCreates += 1;
      return { dispose() { lifecycle.consoleDisposals += 1; }, activeObservation: "latest-scene" };
    },
  };
  const window = {
    addEventListener() {},
    AppCore,
    AppViews,
    AppConsole,
  };
  const history = {
    replaceState(_state, _title, url) {
      historyCalls.push(url);
      location.search = url.slice(0, url.indexOf("#") === -1 ? undefined : url.indexOf("#"));
    },
  };
  const context = vm.createContext({ window, document, location, history, AppCore, AppViews, AppConsole, URL, URLSearchParams, fetch: async () => {} });
  vm.runInContext(readFileSync(new URL("../public/app.js", import.meta.url), "utf8"), context);
  return { window, document, elements, historyCalls, lifecycle, map };
}

test("full release starts the complete visual workspace without duplicating navigation on refresh", () => {
  const { window, elements, lifecycle } = loadApp();

  window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  window.startSalviniaApp(classifyRelease(fullLegacyRelease));

  const nav = elements.get(".beat-nav");
  assert.deepEqual(nav.querySelectorAll("button").map((button) => button.textContent), [
    "01Monitor", "02Detect", "03Caddo Lake Ops", "04Plan Response", "05Verify Results", "06Deploy", "07Hyperspectral",
  ]);
  assert.equal(window.demoApp.activeWorkspace, "console");
  assert.equal(nav.hidden, true);
  assert.equal(elements.get("#console-inspector").hidden, false);
  assert.equal(lifecycle.consoleCreates, 2);
  assert.equal(lifecycle.consoleDisposals, 1);
  elements.get("#workspace-briefing").click();
  assert.equal(lifecycle.viewCalls, 1);
  assert.equal(elements.get("#map").hidden, false);
  assert.equal(elements.get("#public-landing").hidden, true);
  assert.equal(elements.get(".app-shell").hidden, false);
  assert.equal(elements.get("#release-status").hidden, true);
});

test("reveals the application shell before constructing the Leaflet map", () => {
  const { window, lifecycle } = loadApp();

  window.startSalviniaApp(classifyRelease(fullLegacyRelease));

  assert.equal(lifecycle.mapCreatedWhileVisualsHidden, false);
});

test("reveals map visuals before constructing Leaflet after a limited release", () => {
  const { window, lifecycle } = loadApp();

  window.startSalviniaApp(classifyRelease(summaryRelease));
  window.startSalviniaApp(classifyRelease(fullLegacyRelease));

  assert.equal(lifecycle.mapCreatedWhileVisualsHidden, false);
});

test("full release retains the declared unavailable Hyperspectral view and deep link", () => {
  const { window, elements } = loadApp("?beat=hyperspectral");
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral = { state: "not_available", message: "Evidence package not published." };

  window.startSalviniaApp(classifyRelease(release));

  assert.deepEqual(elements.get(".beat-nav").querySelectorAll("button").map((button) => button.textContent), [
    "01Monitor", "02Detect", "03Caddo Lake Ops", "04Plan Response", "05Verify Results", "06Deploy", "07Hyperspectral",
  ]);
  assert.equal(window.demoApp.activeBeat, "hyperspectral");
  assert.equal(elements.get("#panel").querySelector("h1").textContent, "hyperspectral view");
});

test("failed or missing hyperspectral gates expose only the bounded unavailable deep link", () => {
  for (const gate of [undefined, { passes: false, label: "Review failed" }]) {
    const { window, elements } = loadApp("?beat=hyperspectral");
    const release = structuredClone(fullLegacyRelease);
    release.hyperspectral.evidence_gate = gate;

    const classification = classifyRelease(release);
    assert.equal(classification.kind, "full");
    window.startSalviniaApp(classification);

    assert.equal(elements.get(".beat-nav").querySelectorAll("button")
      .some(button => button.dataset.beat === "hyperspectral"), true);
    assert.equal(window.demoApp.activeBeat, "hyperspectral");
    assert.equal(elements.get("#panel").querySelector("h1").textContent, "hyperspectral view");
  }
});

test("source and record badges use release frames and hyperspectral context", () => {
  const { window, elements } = loadApp();
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames = [
    { ...release.monitor.frames[0], date: "2031-02-03" },
    { ...release.monitor.frames[0], date: "2034-07-09" },
  ];
  release.hyperspectral.context = {
    location_label: "Review Site",
    sensor_label: "Review Sensor",
    capture_date: "2035-04-05",
    purpose_label: "Reference/evaluation material",
  };

  window.startSalviniaApp({ kind: "full", release, validation: { ok: true, errors: [] } });

  assert.equal(elements.get(".map-source").textContent, "2 approved release images · Feb 3, 2031–Jul 9, 2034");
  assert.equal(elements.get(".record-badge").textContent, "Caddo Lake record · 2031–2034");

  elements.get(".beat-nav").querySelectorAll("button")
    .find(button => button.dataset.beat === "hyperspectral").click();
  assert.equal(elements.get(".map-source").textContent, "Review Sensor · Apr 5, 2035");
  assert.equal(elements.get(".record-badge").textContent, "Review Site · Reference/evaluation material");
});

test("limited release stays honest about unavailable visual modules inside the app shell", () => {
  const { window, elements } = loadApp();

  window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  window.startSalviniaApp(classifyRelease(summaryRelease));

  assert.match(elements.get("#release-status").textContent, /complete release/i);
  assert.match(elements.get("#release-status-version").textContent, /not provided/i);
  assert.match(elements.get("#release-status-acquisitions").textContent, /1 acquisition/i);
  assert.match(elements.get("#release-status-capabilities").textContent, /Monitor/);
  assert.equal(elements.get(".beat-nav").querySelectorAll("button").length, 0);
  assert.equal(elements.get("#map").hidden, true);
  assert.equal(elements.get("#console-inspector").hidden, true);
  assert.equal(elements.get("#workspace-console").disabled, true);
  assert.equal(elements.get("#workspace-briefing").disabled, true);
  assert.equal(elements.get(".workspace").className.includes("console-mode"), false);
  assert.equal(elements.get("#public-landing").hidden, true);
  assert.equal(elements.get(".app-shell").hidden, false);
  assert.equal(elements.get("#release-status").hidden, false);
});

test("limited release reports an unmapped payload validation failure honestly", () => {
  const { window, elements } = loadApp();

  window.startSalviniaApp(classifyRelease(null));

  assert.equal(elements.get("#release-status-capabilities").textContent, "Release payload validation failed");
});

test("rejects an unregistered https frame before any release renderer mounts", async () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames[0].file = "https://unregistered.example.test/monitor-frame.webp";
  const { window, elements, map } = loadApp();

  await assert.rejects(
    loadCurrentRelease("https://api.example.test", tenantId, async () => Response.json({
      release: { id: "00000000-0000-4000-8000-000000000002" },
      payload: release,
      assets: {},
    })).then((classification) => window.startSalviniaApp(classification)),
    (error) => error instanceof ReleaseError
      && error.code === "invalid_release"
      && /unregistered asset/.test(error.message),
  );

  assert.equal(window.demoApp, undefined);
  assert.equal(elements.get(".beat-nav").querySelectorAll("button").length, 0);
  assert.equal(map.clearCalls, 0);
});

test("disposing the full app stops playback and clears active visual state", () => {
  const { window, document, elements, lifecycle, map } = loadApp();
  window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  window.demoApp.show("monitor");
  elements.get("#hyperspectral-stage").appendChild(element("div", document));
  elements.get(".map-stage").classList.add("comparison-mode");
  const clearCalls = map.clearCalls;

  window.demoApp.dispose();

  assert.equal(lifecycle.playbackStops, 1);
  assert.equal(map.clearCalls, clearCalls + 1);
  assert.equal(elements.get("#hyperspectral-stage").children.length, 0);
  assert.equal(elements.get(".map-stage").className.includes("comparison-mode"), false);
  assert.equal(window.demoApp.activeBeat, null);
});

test("defaults to the map console and preserves an explicit briefing deep link", () => {
  const initial = loadApp("?tenant=tenant-a");
  initial.window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  assert.equal(initial.window.demoApp.activeWorkspace, "console");
  assert.match(initial.historyCalls.at(-1), /workspace=console/);

  const briefing = loadApp("?tenant=tenant-a&workspace=briefing&beat=detect");
  briefing.window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  assert.equal(briefing.window.demoApp.activeWorkspace, "briefing");
  assert.equal(briefing.window.demoApp.activeBeat, "detect");
  assert.equal(briefing.elements.get(".beat-nav").hidden, false);
  assert.equal(briefing.elements.get("#console-inspector").hidden, true);
});

for (const [search, expected] of [["?beat=ops", "operations"], ["?beat=3", "response"], ["?beat=4", "verification"], ["?beat=5", "deploy"], ["?beat=6", "hyperspectral"], ["?workspace=briefing&beat=3", "operations"], ["?beat=unknown", "monitor"]]) {
  test(`resolves ${search} to the ${expected} workspace view`, () => {
    const { window, elements, historyCalls } = loadApp(search);

    window.startSalviniaApp(classifyRelease(fullLegacyRelease));

    assert.equal(window.demoApp.activeBeat, expected);
    assert.equal(elements.get(".beat-nav").querySelector('[aria-current="page"]')?.dataset.beat, expected);
    assert.match(historyCalls.at(-1), new RegExp(`beat=${expected}`));
  });
}

test("selecting a tab marks the current page and moves focus to the new view heading", () => {
  const { window, document, elements, historyCalls } = loadApp("?tenant=tenant-a&beat=monitor");

  window.startSalviniaApp(classifyRelease(fullLegacyRelease));
  elements.get(".beat-nav").querySelectorAll("button").find((button) => button.dataset.beat === "response").click();

  const selected = elements.get(".beat-nav").querySelector('[aria-current="page"]');
  assert.equal(selected.dataset.beat, "response");
  assert.equal(document.activeElement, elements.get("#panel").querySelector("h1"));
  assert.equal(document.activeElement.getAttribute("tabindex"), "-1");
  assert.match(historyCalls.at(-1), /tenant=tenant-a/);
  assert.match(historyCalls.at(-1), /beat=response/);
});
