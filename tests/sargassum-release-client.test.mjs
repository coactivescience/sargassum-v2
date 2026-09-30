import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadSargassumDay, loadSargassumRelease, ReleaseError } from "../public/release-client.js";

const apiBaseUrl = "https://api.coactivescience.dev/";
const fixture = JSON.parse(readFileSync(new URL("fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("fixtures/sargassum-days.json", import.meta.url)));
const tenantId = fixture.release.tenant_id;
const releaseId = fixture.release.id;
const sitePrefix = `https://api.coactivescience.dev/api/tenants/${tenantId}/salvinia/sites/puerto-rico/releases/${releaseId}/assets/`;
const manifest = () => structuredClone(fixture);

test("loads the site-scoped Puerto Rico manifest and resolves day assets to authorized URLs", async () => {
  const calls = [];
  const result = await loadSargassumRelease(apiBaseUrl, tenantId, async (url, init) => {
    calls.push({ url, init });
    return Response.json(manifest());
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.coactivescience.dev/api/tenants/${tenantId}/salvinia/sites/puerto-rico/releases/current/manifest`);
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(result.kind, "sargassum");
  assert.equal(result.releaseId, releaseId);
  assert.equal(result.sourceRevision, "fixture-v1");
  assert.equal(result.validation.ok, true);
  for (const row of result.release.timeline) {
    assert.ok(row.file.startsWith(sitePrefix), row.file);
    assert.equal(row.file, `${sitePrefix}${fixture.payload.timeline.find((candidate) => candidate.date === row.date).file}`);
  }
});

for (const [label, mutate] of [
  ["the tenant-level Caddo asset route", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = `/api/tenants/${tenantId}/salvinia/releases/${releaseId}/assets/${token}`; }],
  ["another tenant", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = value.assets[token].replace(tenantId, "00000000-0000-4000-8000-000000000009"); }],
  ["another origin", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = `https://evil.example${value.assets[token]}`; }],
  ["an unregistered token", (value) => { value.payload.timeline[0].file = "f".repeat(64); }],
]) {
  test(`rejects a day asset from ${label}`, async () => {
    const value = manifest();
    mutate(value);
    await assert.rejects(
      loadSargassumRelease(apiBaseUrl, tenantId, async () => Response.json(value)),
      (error) => error instanceof ReleaseError && error.code === "invalid_release",
    );
  });
}

test("rejects a manifest for another site before rendering", async () => {
  const value = manifest();
  value.release.site_key = "caddo";
  await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, async () => Response.json(value)), /another site/);
});

test("reports a schema-invalid payload as invalid_release with its validation", async () => {
  const value = manifest();
  value.payload.schema = "giant-salvinia-legacy-v2";
  await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, async () => Response.json(value)), (error) => {
    assert.equal(error.code, "invalid_release");
    assert.equal(error.validation.ok, false);
    return true;
  });
});

test("surfaces a missing release as a 404 with its request reference", async () => {
  await assert.rejects(
    loadSargassumRelease(apiBaseUrl, tenantId, async () => Response.json({ error: "release_not_found", request_id: "req-1" }, { status: 404 })),
    (error) => error.status === 404 && error.code === "release_not_found" && error.requestId === "req-1",
  );
});

test("fetches a day asset with credentials and validates it against its row", async () => {
  const release = await loadSargassumRelease(apiBaseUrl, tenantId, async () => Response.json(manifest()));
  const row = release.release.timeline[0];
  const calls = [];
  const record = await loadSargassumDay(row, async (url, init) => {
    calls.push({ url, init });
    return Response.json(days[row.date]);
  });
  assert.equal(calls[0].url, row.file);
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(record.hotspots.length, row.hotspot_count);

  await assert.rejects(loadSargassumDay(row, async () => Response.json(days[release.release.timeline[1].date])), /date must match/);
  await assert.rejects(loadSargassumDay(row, async () => new Response("nope", { status: 503 })), (error) => error.status === 503);
});
