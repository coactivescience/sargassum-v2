import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("declares a dedicated static-assets Worker and runtime configuration endpoint", () => {
  const workerPath = new URL("../src/index.ts", import.meta.url);
  const configPath = new URL("../wrangler.jsonc", import.meta.url);

  assert.equal(existsSync(workerPath), true);
  assert.equal(existsSync(configPath), true);
  assert.match(readFileSync(workerPath, "utf8"), /runtime-config\.js/);
  assert.match(readFileSync(configPath, "utf8"), /sargassum-v2/);
});

test("targets the isolated staging domain and API", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

  assert.equal(config.env.staging.vars.API_BASE_URL, "https://api.coactivescience.dev");
  assert.deepEqual(config.env.staging.routes, [
    { pattern: "sargassum.coactivescience.dev", custom_domain: true },
  ]);
});

test("emits public runtime configuration without tenant deployment settings", () => {
  const workerPath = new URL("../src/index.ts", import.meta.url);
  const source = readFileSync(workerPath, "utf8");

  assert.match(source, /API_BASE_URL/);
  assert.doesNotMatch(source, /AUTH_PORTAL_URL/);
  assert.doesNotMatch(source, /TENANT_ID/);
  assert.doesNotMatch(source, /tenantId/);
});
