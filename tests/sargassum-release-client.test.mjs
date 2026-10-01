import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadSargassumDay, loadSargassumRelease, loadSargassumSites, ReleaseError, selectSargassumSite } from "../public/release-client.js";

const apiBaseUrl = "https://api.coactivescience.dev/";
const fixture = JSON.parse(readFileSync(new URL("fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("fixtures/sargassum-days.json", import.meta.url)));
const tenantId = fixture.fixture.tenant_id;
const site = fixture.fixture.site;
const releaseId = fixture.release.id;
const otherSite = { id: "00000000-0000-4000-8000-000000000303", label: "Another coast", current_release: null };
const sitesUrl = `https://api.coactivescience.dev/api/tenants/${tenantId}/sargassum/sites`;
const manifestUrl = (siteId) => `${sitesUrl}/${siteId}/releases/current/manifest`;
const assetPrefix = `https://api.coactivescience.dev/api/tenants/${tenantId}/sargassum/sites/${site.id}/releases/${releaseId}/assets/`;

function manifest() {
  const { fixture: _fixture, ...response } = structuredClone(fixture);
  return response;
}

function server({ sites = [site], manifestFor = () => Response.json(manifest()) } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === sitesUrl) return Response.json({ sites, request_id: "req-sites" });
    const match = String(url).match(/\/sargassum\/sites\/([^/]+)\/releases\/current\/manifest$/u);
    return match ? manifestFor(match[1]) : new Response("unexpected", { status: 500 });
  };
  return { calls, fetcher };
}

test("lists the tenant's Sargassum sites, then loads the chosen site's release with authorized day URLs", async () => {
  const { calls, fetcher } = server();
  const result = await loadSargassumRelease(apiBaseUrl, tenantId, { fetcher });

  assert.deepEqual(calls.map(({ url }) => url), [sitesUrl, manifestUrl(site.id)]);
  assert.ok(calls.every(({ init }) => init.credentials === "include"));
  assert.equal(result.kind, "sargassum");
  assert.equal(result.releaseId, releaseId);
  assert.equal(result.sourceRevision, "fixture-v1");
  assert.equal(result.site.id, site.id);
  assert.deepEqual(result.sites, [site]);
  assert.equal(result.validation.ok, true);
  for (const row of result.release.timeline) {
    assert.ok(row.file.startsWith(assetPrefix), row.file);
    assert.equal(row.file, `${assetPrefix}${fixture.payload.timeline.find((candidate) => candidate.date === row.date).file}`);
  }
});

test("still accepts a bare fetcher as the third argument", async () => {
  const { fetcher } = server();
  assert.equal((await loadSargassumRelease(apiBaseUrl, tenantId, fetcher)).site.id, site.id);
});

test("chooses ?site= when listed, else the first site with a release, else the first site", () => {
  const withRelease = { ...otherSite, id: "00000000-0000-4000-8000-000000000304", current_release: { id: "r" } };
  assert.equal(selectSargassumSite([otherSite, withRelease], `?site=${otherSite.id}`).site.id, otherSite.id);
  assert.equal(selectSargassumSite([otherSite, withRelease], `?site=${otherSite.id}`).source, "url");
  assert.equal(selectSargassumSite([otherSite, withRelease], "?site=00000000-0000-4000-8000-000000000999").site.id, withRelease.id);
  assert.equal(selectSargassumSite([otherSite, withRelease], "").site.id, withRelease.id);
  assert.equal(selectSargassumSite([otherSite], "").site.id, otherSite.id);
  assert.equal(selectSargassumSite([], ""), null);
});

test("loads the site named in ?site= and checks the release belongs to it", async () => {
  const { calls, fetcher } = server({ sites: [otherSite, site] });
  await assert.rejects(
    loadSargassumRelease(apiBaseUrl, tenantId, { fetcher, search: `?site=${otherSite.id}` }),
    (error) => error instanceof ReleaseError && /another site/.test(error.message),
  );
  assert.equal(calls[1].url, manifestUrl(otherSite.id));
});

test("reports a tenant with no enabled sites as a distinct 404 without requesting a manifest", async () => {
  const { calls, fetcher } = server({ sites: [] });
  await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, { fetcher }), (error) => error.status === 404 && error.code === "no_sargassum_sites");
  assert.equal(calls.length, 1);
});

test("surfaces a missing release as a 404 carrying the chosen site and the API error code", async () => {
  const { fetcher } = server({ manifestFor: () => Response.json({ error: { code: "release_not_found", request_id: "req-1" } }, { status: 404 }) });
  await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, { fetcher }), (error) => (
    error.status === 404 && error.code === "release_not_found" && error.requestId === "req-1" && error.site.id === site.id
  ));
});

test("rejects a malformed site list", async () => {
  for (const sites of [[{ id: "not-a-uuid", label: "x" }], [{ id: site.id, label: "" }], "nope"]) {
    const { fetcher } = server({ sites });
    await assert.rejects(loadSargassumSites(apiBaseUrl, tenantId, fetcher), /site list is invalid/);
  }
});

for (const [label, mutate] of [
  ["the old Salvinia site route", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = `/api/tenants/${tenantId}/salvinia/sites/puerto-rico/releases/${releaseId}/assets/${token}`; }],
  ["another site", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = value.assets[token].replace(site.id, otherSite.id); }],
  ["another tenant", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = value.assets[token].replace(tenantId, "00000000-0000-4000-8000-000000000009"); }],
  ["another origin", (value) => { const token = value.payload.timeline[0].file; value.assets[token] = `https://evil.example${value.assets[token]}`; }],
  ["an unregistered token", (value) => { value.payload.timeline[0].file = "f".repeat(64); }],
]) {
  test(`rejects a day asset from ${label}`, async () => {
    const value = manifest();
    mutate(value);
    const { fetcher } = server({ manifestFor: () => Response.json(value) });
    await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, { fetcher }), (error) => error instanceof ReleaseError && error.code === "invalid_release");
  });
}

for (const [label, mutate] of [
  ["for another site", (value) => { value.release.site_id = otherSite.id; }],
  ["for another application", (value) => { value.release.application_key = "salvinia"; }],
]) {
  test(`rejects a release ${label} before rendering`, async () => {
    const value = manifest();
    mutate(value);
    const { fetcher } = server({ manifestFor: () => Response.json(value) });
    await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, { fetcher }), /another site or application/);
  });
}

test("reports a schema-invalid payload as invalid_release with its validation", async () => {
  const value = manifest();
  value.payload.schema = "giant-salvinia-legacy-v2";
  const { fetcher } = server({ manifestFor: () => Response.json(value) });
  await assert.rejects(loadSargassumRelease(apiBaseUrl, tenantId, { fetcher }), (error) => {
    assert.equal(error.code, "invalid_release");
    assert.equal(error.validation.ok, false);
    return true;
  });
});

test("fetches a day asset with credentials and validates it against its row", async () => {
  const { fetcher } = server();
  const release = await loadSargassumRelease(apiBaseUrl, tenantId, { fetcher });
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
