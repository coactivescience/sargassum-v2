import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { chromium } from "playwright-core";

const PUBLIC_ROOT = resolve(fileURLToPath(new URL("../../public", import.meta.url)));
const fixture = JSON.parse(await readFile(new URL("../fixtures/sargassum-manifest.json", import.meta.url), "utf8"));
const days = JSON.parse(await readFile(new URL("../fixtures/sargassum-days.json", import.meta.url), "utf8"));
const TENANT_ID = fixture.release.tenant_id;
const RELEASE_ID = fixture.release.id;
const SITE_ROOT = `/api/tenants/${TENANT_ID}/salvinia/sites/puerto-rico/releases`;
const HOSTILE = "<img src=x onerror=window.__injected=1> Sargassum approaching the south coast";

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function serveWorkspace() {
  const requests = [];
  const dayByToken = new Map(fixture.payload.timeline.map((row) => [row.file, days[row.date]]));
  let origin;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    requests.push(url.pathname);
    const authenticated = request.headers.cookie?.includes("browser-acceptance=authorized");
    if (url.pathname.startsWith("/api/") && !authenticated) return json(response, { error: "authentication_required" }, 401);
    if (url.pathname === "/api/tenants/accessible") {
      return json(response, { data: { tenants: [{ id: TENANT_ID, slug: "puerto-rico-dner", display_name: "Puerto Rico DNER" }] } });
    }
    if (url.pathname === "/api/auth/get-session") return json(response, { user: { name: "Browser Operator", role: "operator" } });
    if (url.pathname === `${SITE_ROOT}/current/manifest`) {
      const manifest = structuredClone(fixture);
      for (const token of Object.keys(manifest.assets)) manifest.assets[token] = `${origin}${manifest.assets[token]}`;
      return json(response, manifest);
    }
    const asset = url.pathname.match(new RegExp(`^${SITE_ROOT}/${RELEASE_ID}/assets/([0-9a-f]{64})$`));
    if (asset && dayByToken.has(asset[1])) {
      const day = structuredClone(dayByToken.get(asset[1]));
      if (day.alert?.active) day.alert.message = HOSTILE;
      return json(response, day);
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
      response.writeHead(200, { "content-type": { ".css": "text/css", ".html": "text/html", ".js": "text/javascript" }[extname(file)] || "application/octet-stream" });
      response.end(content);
    } catch {
      json(response, { error: "not_found" }, 404);
    }
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, requests, close: () => new Promise((done, fail) => server.close((error) => error ? fail(error) : done())) };
}

test("an authenticated operator browses the Puerto Rico Sargassum release day by day", async (context) => {
  const workspace = await serveWorkspace();
  let browser;
  context.after(async () => {
    try { await browser?.close(); } finally { await workspace.close(); }
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const browserContext = await browser.newContext();
  await browserContext.addCookies([{ name: "browser-acceptance", value: "authorized", url: workspace.origin }]);
  const page = await browserContext.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));

  await page.goto(`${workspace.origin}/?tenant=${TENANT_ID}`);
  await page.locator("#sargassum-day-status", { hasText: "2025-05-17: 0 hotspots shown." }).waitFor({ timeout: 10000 });

  assert.equal(await page.locator("#public-landing").isHidden(), true);
  assert.equal(await page.locator("#sargassum-title").textContent(), "Puerto Rico Sargassum detections");
  assert.equal(await page.locator("#sargassum-timeline button").count(), 3);
  assert.equal(await page.locator("#sargassum-summary .sargassum-tile").count(), 4);
  assert.ok(await page.locator("#map .leaflet-pane").count() > 0, "Leaflet initialized the map");

  await page.locator('#sargassum-timeline button[data-date="2025-05-09"]').click();
  await page.locator("#sargassum-day-status", { hasText: "2025-05-09: 163 hotspots shown." }).waitFor({ timeout: 10000 });
  assert.match(await page.locator("#sargassum-detail").textContent(), /Medium severity · alert active/);
  assert.ok((await page.locator("#sargassum-detail .sargassum-alert p").textContent()).includes(HOSTILE));
  assert.equal(await page.locator("#sargassum-detail img").count(), 0, "alert text never becomes markup");
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  assert.equal(await page.locator('#sargassum-timeline button[data-date="2025-05-09"]').getAttribute("aria-pressed"), "true");

  assert.ok(workspace.requests.includes(`${SITE_ROOT}/current/manifest`));
  assert.ok(!workspace.requests.some((path) => path.includes("/salvinia/releases/current/manifest")), "the Caddo route is never requested");
  assert.deepEqual(pageErrors, []);
});
