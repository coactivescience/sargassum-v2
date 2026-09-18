import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { chromium } from "playwright-core";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const RELEASE_ID = "00000000-0000-4000-8000-000000000002";
const PUBLIC_ROOT = resolve(fileURLToPath(new URL("../../public", import.meta.url)));
const FIXTURE_URL = new URL("../fixtures/full-legacy-release.json", import.meta.url);
const RELEASE_MANIFEST = process.env.SALVINIA_RELEASE_MANIFEST;
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8q7WQAAAABJRU5ErkJggg==", "base64");

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function manifestFor(origin, passingComparison = false) {
  const providedManifest = RELEASE_MANIFEST && !passingComparison;
  const stored = JSON.parse(await readFile(providedManifest || FIXTURE_URL, "utf8"));
  const payload = providedManifest ? stored.payload : stored;
  const artifacts = providedManifest ? stored.artifacts : null;
  if (passingComparison) {
    payload.hyperspectral = JSON.parse(await readFile(new URL("../fixtures/hyperspectral-evidence.json", import.meta.url), "utf8")).payload;
  } else if (!providedManifest) {
    payload.hyperspectral.evidence_gate = {
      passes: false,
      label: "Review <script>failed</script>",
    };
  }
  const assets = {};
  let index = 0;
  if (artifacts) {
    for (const { checksum_sha256: token } of Object.values(artifacts)) {
      assets[token] = `${origin}/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/${token}`;
    }
  }
  const registerFiles = (value) => {
    if (Array.isArray(value)) return value.forEach(registerFiles);
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "file" && typeof item === "string") {
        const token = artifacts ? artifacts[item]?.checksum_sha256 : `asset-${index += 1}.webp`;
        if (!token) throw new Error(`Release manifest does not declare ${item}`);
        value[key] = token;
        assets[token] ||= `${origin}/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/${token}`;
      } else if (artifacts && typeof item === "string" && /^salvinia\/(?:raw|derived|releases)\//u.test(item)) {
        delete value[key];
      } else {
        registerFiles(item);
      }
    }
  };
  registerFiles(payload);
  return { release: { id: RELEASE_ID, source_revision: payload.meta.source_revision }, payload, assets };
}

async function serveWorkspace(passingComparison = false) {
  const assetRequests = [];
  let origin;
  let manifest;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    const authenticated = request.headers.cookie?.includes("browser-acceptance=authorized");
    if (url.pathname.startsWith("/api/") && !authenticated) return json(response, { error: "authentication_required" }, 401);
    if (url.pathname === "/api/tenants/accessible") {
      return json(response, { data: { tenants: [{ id: TENANT_ID, slug: "caddo", display_name: "Caddo Lake" }] } });
    }
    if (url.pathname === "/api/auth/get-session") {
      return json(response, { user: { name: "Browser Operator", role: "operator" } });
    }
    if (url.pathname === `/api/tenants/${TENANT_ID}/salvinia/releases/current/manifest`) {
      return json(response, manifest);
    }
    const assetPrefix = `/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/`;
    if (url.pathname.startsWith(assetPrefix)) {
      assetRequests.push(url.pathname);
      response.writeHead(200, { "content-type": "image/png" });
      return response.end(PIXEL);
    }
    if (url.pathname === "/runtime-config.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      return response.end(`window.RUNTIME_CONFIG = ${JSON.stringify({ apiBaseUrl: origin })};`);
    }

    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const file = resolve(join(PUBLIC_ROOT, relative));
    if (file !== PUBLIC_ROOT && !file.startsWith(`${PUBLIC_ROOT}${sep}`)) return json(response, { error: "not_found" }, 404);
    try {
      const content = await readFile(file);
      const contentType = {
        ".css": "text/css",
        ".html": "text/html",
        ".js": "text/javascript",
      }[extname(file)] || "application/octet-stream";
      response.writeHead(200, { "content-type": contentType });
      response.end(content);
    } catch {
      json(response, { error: "not_found" }, 404);
    }
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  manifest = await manifestFor(origin, passingComparison);
  return {
    assetRequests,
    manifest,
    origin,
    close: () => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())),
  };
}

test("authenticated manifest renders the map console and keeps the guided workspace available", async (context) => {
  const workspace = await serveWorkspace();
  let browser;
  context.after(async () => {
    try {
      await browser?.close();
    } finally {
      await workspace.close();
    }
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const browserContext = await browser.newContext();
  await browserContext.addCookies([{
    name: "browser-acceptance",
    value: "authorized",
    url: workspace.origin,
  }]);
    const page = await browserContext.newPage();
  const pageErrors = [];
  let currentAction = "startup";
  page.on("pageerror", (error) => pageErrors.push(`${currentAction}: ${error.stack || error.message}`));

  page.on("pageerror", (e) => console.log("[pageerror]", e.stack || e.message));
  page.on("console", (m) => console.log("[console]", m.type(), m.text()));
  page.on("requestfailed", (r) => console.log("[failed]", r.url(), r.failure()?.errorText));
  page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url()); });

  await page.goto(`${workspace.origin}/?tenant=${TENANT_ID}`);
  await page.locator("#console-observations button").first().waitFor({ timeout: 5000 })
    .catch(async () => {
      console.log("[body]", await page.locator("body").innerHTML());
      throw new Error("console never rendered");
    });

  if (RELEASE_MANIFEST) {
    assert.equal(workspace.manifest.payload.meta.source_revision, "earth-search-through-2026-07-31-14329ffb");
    assert.equal(workspace.manifest.payload.caddo_geometry.features.length, 140);
    assert.equal(workspace.manifest.payload.monitor.frames.length, 57);
    assert.ok(workspace.manifest.payload.intelligence.sites[0].edrr.length <= 15);
    assert.equal(workspace.manifest.payload.intelligence.sites[0].crew_plan.stops.length, 8);
  }

  const expectedObservations = workspace.manifest.payload.monitor.frames.length;
  assert.equal(await page.locator("#console-observations button").count(), expectedObservations);
  assert.equal(await page.locator("#console-inspector").isVisible(), true);
  assert.match(await page.locator("#console-metrics").textContent(), /Detected extent/i);
  assert.match(await page.locator("#console-granules").textContent(), /not published/i);
  assert.match(await page.locator("#console-source").textContent(), /Source scene|Observation record/i);
  assert.equal(await page.locator('[data-console-mode="zones"]').isDisabled(), true);
  assert.equal(await page.locator('#console-layer-control input[value="coverage"]').isDisabled(), true);
  assert.deepEqual(await page.locator("#site-list .site-button strong").allTextContents(), ["Caddo Lake"]);

  const desktopRail = await page.locator(".site-rail").boundingBox();
  const desktopMap = await page.locator(".map-stage").boundingBox();
  const desktopInspector = await page.locator("#console-inspector").boundingBox();
  assert.ok(desktopRail && desktopMap && desktopInspector);
  assert.ok(desktopRail.x < desktopMap.x && desktopMap.x < desktopInspector.x);

  await page.setViewportSize({ width: 700, height: 800 });
  const narrowMap = await page.locator(".map-stage").boundingBox();
  const narrowInspector = await page.locator("#console-inspector").boundingBox();
  assert.equal(await page.locator(".site-rail").isVisible(), false);
  assert.ok(narrowMap && narrowInspector && narrowMap.y < narrowInspector.y);
  await page.setViewportSize({ width: 1280, height: 720 });

  const firstObservation = workspace.manifest.payload.monitor.frames[0];
  const firstObservationId = firstObservation.id || firstObservation.date;
  await page.locator(`#console-observations button[data-observation="${firstObservationId}"]`).click();
  assert.match(await page.locator("#console-source").textContent(), new RegExp(firstObservationId));

  await page.locator("#workspace-briefing").click();
  await page.locator(".beat-tab").nth(6).waitFor();
  assert.equal(await page.locator("#console-layer-control").isVisible(), false);
  assert.deepEqual(await page.locator(".beat-tab strong").allTextContents(), [
    "Monitor", "Detect", "Caddo Lake Ops", "Plan Response", "Verify Results", "Deploy", "Hyperspectral",
  ]);
  await page.getByRole("button", { name: /Hyperspectral/ }).click();
  assert.equal(await page.locator('.beat-tab[aria-current="page"] strong').textContent(), "Hyperspectral");
  assert.match(await page.locator("#panel").textContent(), /reference\/evaluation evidence is unavailable/i);
  if (!RELEASE_MANIFEST) assert.match(await page.locator("#panel").textContent(), /Review <script>failed<\/script>/);
  assert.equal(await page.locator("#panel script").count(), 0);

  for (const label of ["Monitor", "Detect", "Caddo Lake Ops", "Plan Response", "Verify Results", "Deploy", "Hyperspectral"]) {
    currentAction = label;
    await page.getByRole("button", { name: new RegExp(label) }).click();
    assert.match(await page.locator('.beat-tab[aria-current="page"]').textContent(), new RegExp(label));
  }

  const assetPrefix = `/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/`;
  assert.ok(workspace.assetRequests.length > 0);
  assert.ok(workspace.assetRequests.every((path) => path.startsWith(assetPrefix)));
  assert.deepEqual(pageErrors, []);
});


test("verified passing legacy Hyperspectral evidence renders spectra and tenant assets", async (context) => {
  const workspace = await serveWorkspace(true);
  let browser;
  context.after(async () => {
    try { await browser?.close(); } finally { await workspace.close(); }
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const browserContext = await browser.newContext();
  await browserContext.addCookies([{ name: "browser-acceptance", value: "authorized", url: workspace.origin }]);
  const page = await browserContext.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  page.on("pageerror", (e) => console.log("[pageerror]", e.stack || e.message));
  page.on("console", (m) => console.log("[console]", m.type(), m.text()));
  page.on("requestfailed", (r) => console.log("[failed]", r.url(), r.failure()?.errorText));
  page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url()); });

  await page.goto(`${workspace.origin}/?tenant=${TENANT_ID}&workspace=briefing&beat=hyperspectral`);
  await page.locator(".spectral-chart").waitFor({ timeout: 5000 })
    .catch(async () => {
      console.log("[body #1 - before reload]", await page.locator("body").innerHTML());
      throw new Error("spectral chart never rendered (before reload)");
    });
  assert.match(await page.locator("#panel").textContent(), /Evaluate Area A and Area B as reference material/);
  assert.equal(await page.locator(".sample-card img").count(), 2);
  assert.doesNotMatch(await page.locator(".spectral-chart").innerHTML(), /NaN|Infinity/);
  assert.match(await page.locator("#panel").textContent(), /not Caddo operational output/);
  workspace.manifest.payload.hyperspectral.open_water_control = { supported: false, excess_separation_degrees: null };
  await page.reload();
  await page.locator(".spectral-chart").waitFor({ timeout: 5000 })
    .catch(async () => {
      console.log("[body #2 - after reload]", await page.locator("body").innerHTML());
      throw new Error("spectral chart never rendered (after reload)");
    });
  assert.match(await page.locator("#panel").textContent(), /Open-water comparison lacks sufficient patch support/);
  const prefix = `/api/tenants/${TENANT_ID}/salvinia/releases/${RELEASE_ID}/assets/`;
  assert.ok(workspace.assetRequests.length >= 2);
  assert.ok(workspace.assetRequests.every(path => path.startsWith(prefix)));
  assert.deepEqual(errors, []);
});