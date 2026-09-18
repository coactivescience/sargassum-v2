import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { start } from "../../public/bootstrap.js";
import { loadCurrentRelease } from "../../public/release-client.js";
import { loadAccessibleTenants } from "../../public/tenant-client.js";

const API_ORIGIN = "https://api.example.test";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const RELEASE_ID = "00000000-0000-4000-8000-000000000002";
const ASSET_PREFIX = `${API_ORIGIN}/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/`;
const AUTHORIZED_ASSETS = {
  monitor2017: `${ASSET_PREFIX}monitor-2017.webp`,
  monitor2021: `${ASSET_PREFIX}monitor-2021.webp`,
  monitor2026: `${ASSET_PREFIX}monitor-2026.webp`,
  detect2026: `${ASSET_PREFIX}detect-2026.webp`,
  response2021: `${ASSET_PREFIX}response-2021.webp`,
  response2022: `${ASSET_PREFIX}response-2022.webp`,
  response2024: `${ASSET_PREFIX}response-2024.webp`,
  verifyBefore: `${ASSET_PREFIX}verify-before.webp`,
  verifyAfter: `${ASSET_PREFIX}verify-after.webp`,
  hyperspectralA: `${ASSET_PREFIX}hyperspectral-a.webp`,
  hyperspectralB: `${ASSET_PREFIX}hyperspectral-b.webp`,
};
const TENANT = { id: TENANT_ID, slug: "caddo", display_name: "Caddo Lake" };

function fullManifest() {
  const payload = JSON.parse(readFileSync(new URL("../fixtures/full-legacy-release.json", import.meta.url)));
  payload.monitor.frames[0].file = "monitor-2017";
  payload.monitor.frames[1].file = "monitor-2021";
  payload.monitor.frames[2].file = "monitor-2026";
  payload.detect.frame.file = "detect-2026";
  payload.response.frames[0].file = "response-2021";
  payload.response.frames[1].file = "response-2022";
  payload.response.frames[2].file = "response-2024";
  payload.verification.candidates[0].before.file = "verify-before";
  payload.verification.candidates[0].after.file = "verify-after";
  payload.hyperspectral.sites[0].aquatic_cover.file = "hyperspectral-a";
  payload.hyperspectral.sites[1].aquatic_cover.file = "hyperspectral-b";
  return {
    release: { id: RELEASE_ID, source_revision: "verified-caddo-test" },
    payload,
    assets: {
      "monitor-2017": AUTHORIZED_ASSETS.monitor2017,
      "monitor-2021": AUTHORIZED_ASSETS.monitor2021,
      "monitor-2026": AUTHORIZED_ASSETS.monitor2026,
      "detect-2026": AUTHORIZED_ASSETS.detect2026,
      "response-2021": AUTHORIZED_ASSETS.response2021,
      "response-2022": AUTHORIZED_ASSETS.response2022,
      "response-2024": AUTHORIZED_ASSETS.response2024,
      "verify-before": AUTHORIZED_ASSETS.verifyBefore,
      "verify-after": AUTHORIZED_ASSETS.verifyAfter,
      "hyperspectral-a": AUTHORIZED_ASSETS.hyperspectralA,
      "hyperspectral-b": AUTHORIZED_ASSETS.hyperspectralB,
    },
  };
}

function limitedManifest() {
  return {
    release: { id: RELEASE_ID, source_revision: "one-scene-test" },
    payload: JSON.parse(readFileSync(new URL("../fixtures/summary-release.json", import.meta.url))),
    assets: {},
  };
}

function matches(node, selector) {
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  const taggedAttribute = selector.match(/^([a-z]+)\[([^=]+)="([^"]+)"\]$/i);
  if (taggedAttribute) return node.tagName.toLowerCase() === taggedAttribute[1].toLowerCase()
    && node.getAttribute(taggedAttribute[2]) === taggedAttribute[3];
  const presentAttribute = selector.match(/^\[([^=]+)\]$/);
  if (presentAttribute) return node.hasAttribute(presentAttribute[1]);
  const attribute = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if (attribute) return node.getAttribute(attribute[1]) === attribute[2];
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function element(tagName = "div", documentRef, imageRequests) {
  let ownText = "";
  let html = "";
  const attributes = new Map();
  const listeners = new Map();
  const virtual = new Map();
  const node = {
    tagName: tagName.toUpperCase(), id: "", children: [], className: "", dataset: {},
    hidden: false, disabled: false, value: 0, scrollTop: 0, parentNode: null,
    appendChild(child) { child.parentNode = this; child.parentElement = this; this.children.push(child); return child; },
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
      html = "";
      virtual.clear();
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
    querySelectorAll(selector) {
      const descendants = this.children.flatMap((child) => [
        ...(matches(child, selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
      if (descendants.length || !html) return descendants;
      if (selector === "h1") {
        const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (!heading) return [];
        if (!virtual.has(selector)) {
          const item = element("h1", documentRef);
          item.textContent = heading[1].replace(/<[^>]+>/g, "").trim();
          virtual.set(selector, [item]);
        }
        return virtual.get(selector);
      }
      const selectors = {
        ".ops-priority": /class="[^"]*\bops-priority\b[^"]*"[^>]*data-index="([^"]+)"/g,
        ".candidate-row": /class="[^"]*\bcandidate-row\b[^"]*"[^>]*data-index="([^"]+)"/g,
        "[data-moment]": /data-moment="([^"]+)"/g,
      };
      if (selectors[selector]) {
        if (!virtual.has(selector)) {
          const items = [...html.matchAll(selectors[selector])].map((match) => {
            const item = element("button", documentRef);
            if (selector === "[data-moment]") item.dataset.moment = match[1];
            else item.dataset.index = match[1];
            return item;
          });
          virtual.set(selector, items);
        }
        return virtual.get(selector);
      }
      if (selector.startsWith("#") && html.includes(`id="${selector.slice(1)}"`)) {
        if (!virtual.has(selector)) {
          const item = element(selector === "#monitor-range" ? "input" : "div", documentRef);
          item.id = selector.slice(1);
          virtual.set(selector, [item]);
        }
        return virtual.get(selector);
      }
      return [];
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((listener) => listener({ ...event, currentTarget: this, target: this }));
    },
    click() { this.dispatchEvent({ type: "click" }); },
    focus() { documentRef.activeElement = this; },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    },
  };
  Object.defineProperties(node, {
    textContent: {
      get() { return ownText + node.children.map((child) => child.textContent).join(""); },
      set(value) { ownText = String(value); node.replaceChildren(); },
    },
    innerHTML: {
      get() { return html; },
      set(value) {
        html = String(value);
        ownText = "";
        virtual.clear();
        for (const match of html.matchAll(/<img\s[^>]*src="([^"]+)"/g)) imageRequests?.push(match[1]);
      },
    },
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

function browserEnvironment() {
  const imageRequests = [];
  const document = { activeElement: null };
  const elements = new Map([
    [".beat-nav", element("nav", document)], ["#panel", element("aside", document)],
    ["#map-title", element("strong", document)], ["#map-kicker", element("span", document)],
    ["#map-legend", element("div", document)], [".map-source", element("div", document)],
    [".record-badge", element("div", document)], [".workspace", element("main", document)],
    [".map-stage", element("section", document)], ["#map", element("div", document)],
    ["#hyperspectral-stage", element("div", document, imageRequests)], ["#release-status", element("section", document)],
    ["#release-status-version", element("dd", document)], ["#release-status-acquisitions", element("dd", document)],
    ["#release-status-capabilities", element("dd", document)], ["#release-status-guidance", element("p", document)],
    ["#release-status-title", element("h1", document)], ["#public-landing", element("main", document)],
    [".app-shell", element("div", document)], ["#workspace-console", element("button", document)],
    ["#workspace-briefing", element("button", document)], ["#console-inspector", element("aside", document)],
    ["#console-layer-control", element("fieldset", document)], ["#console-timeline", element("div", document)],
    ["#console-timeline-title", element("h2", document)], ["#console-metrics", element("section", document)],
    ["#console-granules", element("section", document)], ["#console-observations", element("section", document)],
    ["#console-source", element("section", document)], ["#console-samples", element("section", document)],
  ]);
  for (const mode of ["intensity", "zones"]) {
    const button = element("button", document);
    button.dataset.consoleMode = mode;
    button.setAttribute("data-console-mode", mode);
    elements.get("#console-layer-control").appendChild(button);
  }
  for (const signal of ["coverage", "footprint", "water"]) {
    const label = element("label", document);
    const input = element("input", document);
    input.value = signal;
    input.setAttribute("type", "checkbox");
    label.appendChild(input);
    elements.get("#console-layer-control").appendChild(label);
  }
  elements.get("#release-status-title").textContent = "The complete visual workspace has not been published.";
  elements.get("#release-status").appendChild(elements.get("#release-status-title"));
  for (const selector of ["#release-status-version", "#release-status-acquisitions", "#release-status-capabilities", "#release-status-guidance"]) {
    elements.get("#release-status").appendChild(elements.get(selector));
  }
  Object.assign(document, {
    querySelector(selector) { return elements.get(selector) ?? null; },
    createElement(tagName) { return element(tagName, document); },
    createElementNS(_namespace, tagName) { return element(tagName, document); },
  });

  const groups = [];
  const layer = () => ({
    addTo(group) { group.layers.push(this); return this; },
    bindTooltip() { return this; },
    on() { return this; },
  });
  const L = {
    map: () => ({ fitBounds() {}, invalidateSize() {}, setView() {} }),
    control: { zoom: () => ({ addTo() {} }) },
    layerGroup: () => {
      const group = { layers: [], addTo() { groups.push(this); return this; }, clearLayers() { this.layers.length = 0; } };
      return group;
    },
    imageOverlay: (url) => { imageRequests.push(url); return layer(); },
    geoJSON: () => layer(),
    divIcon: () => ({}),
    marker: () => layer(),
  };
  let timer = 0;
  const location = { search: `?tenant=${TENANT_ID}`, hash: "", origin: "https://app.example.test" };
  const history = {
    replaceState(_state, _title, url) {
      location.search = url.slice(0, url.indexOf("#") === -1 ? undefined : url.indexOf("#"));
    },
  };
  const window = {
    addEventListener() {},
    setTimeout() { timer += 1; return timer; }, clearTimeout() {},
    setInterval() { timer += 1; return timer; }, clearInterval() {},
  };
  const context = vm.createContext({
    window, document, location, history, L, URL, URLSearchParams,
    fetch: async () => { throw new Error("unexpected browser fetch"); },
  });
  vm.runInContext(readFileSync(new URL("../../public/core.js", import.meta.url), "utf8"), context);
  context.AppCore = window.AppCore;
  vm.runInContext(readFileSync(new URL("../../public/console.js", import.meta.url), "utf8"), context);
  context.AppConsole = window.AppConsole;
  vm.runInContext(readFileSync(new URL("../../public/views.js", import.meta.url), "utf8"), context);
  context.AppViews = window.AppViews;
  vm.runInContext(readFileSync(new URL("../../public/app.js", import.meta.url), "utf8"), context);
  return { document, elements, imageRequests, window };
}

async function loadWorkspace(manifest, environment) {
  const serviceRequests = [];
  const fetcher = async (url, init) => {
    serviceRequests.push({ url, init });
    if (url === `${API_ORIGIN}/api/tenants/accessible`) {
      return Response.json({ data: { tenants: [TENANT] } });
    }
    if (url === `${API_ORIGIN}/api/tenants/${TENANT_ID}/salvinia/releases/current/manifest`) {
      return Response.json(manifest);
    }
    throw new Error(`unexpected service request: ${url}`);
  };
  const result = await start({ apiBaseUrl: API_ORIGIN }, {
    loadTenants: (origin) => loadAccessibleTenants(origin, fetcher),
    loadRelease: (origin, tenantId) => loadCurrentRelease(origin, tenantId, fetcher),
    renderTenantOptions() {},
    startApp: (release, tenant, classification) => {
      environment.window.startSalviniaApp({ release, ...classification }, tenant, { apiBaseUrl: API_ORIGIN });
    },
    showError(state) { throw new Error(`unexpected workspace error: ${state.code}`); },
    getSearch: () => `?tenant=${TENANT_ID}`,
  });
  return { result, serviceRequests };
}

test("authenticated tenant manifest integrates every full-release tab with registered assets", async () => {
  const environment = browserEnvironment();
  const { result, serviceRequests } = await loadWorkspace(fullManifest(), environment);

  assert.deepEqual(result, { status: "ready", tenantId: TENANT_ID });
  assert.deepEqual(serviceRequests.map(({ url }) => url), [
    `${API_ORIGIN}/api/tenants/accessible`,
    `${API_ORIGIN}/api/tenants/${TENANT_ID}/salvinia/releases/current/manifest`,
  ]);
  assert.ok(serviceRequests.every(({ init }) => init.credentials === "include"));

  const nav = environment.elements.get(".beat-nav");
  const buttons = nav.querySelectorAll("button");
  assert.deepEqual(buttons.map((button) => button.textContent), [
    "01Monitor", "02Detect", "03Caddo Lake Ops", "04Plan Response", "05Verify Results", "06Deploy", "07Hyperspectral",
  ]);

  buttons[0].click();
  const range = environment.elements.get("#panel").querySelector("#monitor-range");
  range.value = 1;
  range.dispatchEvent({ type: "input" });
  assert.equal(environment.imageRequests.at(-1), AUTHORIZED_ASSETS.monitor2021);
  assert.equal(environment.elements.get("#panel").querySelector("#monitor-date").textContent, "Aug 15, 2021");

  for (const button of buttons) {
    button.click();
    assert.equal(environment.window.demoApp.activeBeat, button.dataset.beat);
    if (button.dataset.beat === "verification") {
      environment.elements.get("#panel").querySelector("#candidate-detail").querySelectorAll("[data-moment]")
        .find((choice) => choice.dataset.moment === "after").click();
    }
  }

  assert.ok(environment.imageRequests.length > 0);
  assert.ok(environment.imageRequests.every((url) => Object.values(AUTHORIZED_ASSETS).includes(url)));
  assert.ok(environment.imageRequests.every((url) => url.startsWith(ASSET_PREFIX)));
});

test("authenticated one-scene fixture renders the limited-release status panel", async () => {
  const environment = browserEnvironment();
  const { result, serviceRequests } = await loadWorkspace(limitedManifest(), environment);

  assert.deepEqual(result, { status: "ready", tenantId: TENANT_ID });
  assert.ok(serviceRequests.every(({ init }) => init.credentials === "include"));
  assert.equal(environment.elements.get("#release-status").hidden, false);
  assert.match(environment.elements.get("#release-status").textContent, /complete visual workspace has not been published/i);
  assert.match(environment.elements.get("#release-status-acquisitions").textContent, /1 acquisition/i);
  assert.equal(environment.elements.get(".beat-nav").querySelectorAll("button").length, 0);
  assert.equal(environment.elements.get("#map").hidden, true);
  assert.deepEqual(environment.imageRequests, []);
});
