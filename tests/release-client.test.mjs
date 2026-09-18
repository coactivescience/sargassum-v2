import assert from "node:assert/strict";
import test from "node:test";

import { ReleaseError, loadCurrentRelease } from "../public/release-client.js";

const apiBaseUrl = "https://api.coactivescience.dev/";
const tenantId = "00000000-0000-4000-8000-000000000001";

const release = {
  release: { id: "00000000-0000-4000-8000-000000000002", source_revision: "abc123" },
  payload: {
    meta: { version: 2 },
    monitor: { frames: [{ file: "a".repeat(64) }] },
    sites: [{ thumbnail: { file: "b".repeat(64) } }],
  },
  assets: {
    ["a".repeat(64)]: "/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000002/assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ["b".repeat(64)]: "/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000002/assets/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  },
};

test("loads and classifies the current tenant release after resolving manifest assets", async () => {
  const calls = [];
  const result = await loadCurrentRelease(apiBaseUrl, tenantId, async (url, init) => {
    calls.push({ url, init });
    return Response.json(release);
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.coactivescience.dev/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/current/manifest");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers.accept, "application/json");
  assert.equal(result.kind, "limited");
  assert.equal(result.releaseId, release.release.id);
  assert.equal(result.validation.ok, false);
  assert.equal(result.release.monitor.frames[0].file, "https://api.coactivescience.dev/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000002/assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(result.release.sites[0].thumbnail.file, "https://api.coactivescience.dev/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000002/assets/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
});

test("rejects an unregistered payload asset without fetching arbitrary storage paths", async () => {
  await assert.rejects(
    loadCurrentRelease(apiBaseUrl, tenantId, async () => Response.json({
      ...release,
      payload: { monitor: { frames: [{ file: "c".repeat(64) }] } },
    })),
    (error) => error instanceof ReleaseError && error.code === "invalid_release",
  );
});

for (const [name, registeredUrl] of [
  ["another tenant", "/api/tenants/00000000-0000-4000-8000-000000000099/salvinia/releases/00000000-0000-4000-8000-000000000002/assets/frame.webp"],
  ["another release", "/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000099/assets/frame.webp"],
  ["a release ID prefix collision", "/api/tenants/00000000-0000-4000-8000-000000000001/salvinia/releases/00000000-0000-4000-8000-000000000002-extra/assets/frame.webp"],
]) {
  test(`rejects a same-origin registered asset scoped to ${name}`, async () => {
    await assert.rejects(
      loadCurrentRelease(apiBaseUrl, tenantId, async () => Response.json({
        ...release,
        payload: { monitor: { frames: [{ file: "registered" }] } },
        assets: { registered: registeredUrl },
      })),
      (error) => error instanceof ReleaseError
        && error.code === "invalid_release"
        && /selected tenant and release/.test(error.message),
    );
  });
}

test("requires a selected release identity before resolving registered assets", async () => {
  await assert.rejects(
    loadCurrentRelease(apiBaseUrl, tenantId, async () => Response.json({
      payload: release.payload,
      assets: release.assets,
    })),
    (error) => error instanceof ReleaseError && error.code === "invalid_release",
  );
});

test("preserves API status and request ID when release loading fails", async () => {
  await assert.rejects(
    loadCurrentRelease(apiBaseUrl, tenantId, async () => new Response(JSON.stringify({ error: "release_not_found", request_id: "req-123" }), {
      status: 404,
      headers: { "content-type": "application/json", "x-request-id": "req-123" },
    })),
    (error) => error instanceof ReleaseError && error.status === 404 && error.requestId === "req-123",
  );
});

test("requires an explicit tenant ID before loading a release", async () => {
  await assert.rejects(
    loadCurrentRelease(apiBaseUrl, "", async () => Response.json(release)),
    (error) => error instanceof ReleaseError && error.code === "invalid_configuration",
  );
});

for (const tenant of ["   ", 42, {}]) {
  test(`rejects an invalid explicit tenant ID: ${JSON.stringify(tenant)}`, async () => {
    await assert.rejects(
      loadCurrentRelease(apiBaseUrl, tenant, async () => Response.json(release)),
      (error) => error instanceof ReleaseError && error.code === "invalid_configuration",
    );
  });
}

test("normalizes malformed API base URLs to invalid configuration", async () => {
  await assert.rejects(
    loadCurrentRelease("not a URL", tenantId, async () => Response.json(release)),
    (error) => error instanceof ReleaseError && error.code === "invalid_configuration",
  );
});
