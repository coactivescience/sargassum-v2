import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantError,
  loadAccessibleTenants,
  selectTenant,
  writeTenantSelection,
} from "../public/tenant-client.js";

const tenants = [
  { id: "tenant-a", slug: "alpha", display_name: "Alpha Lake" },
  { id: "tenant-b", slug: "bravo", display_name: "Bravo Lake" },
];

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("selects an authorized URL tenant before a stored tenant", () => {
  const storage = memoryStorage({ tenant: "tenant-a" });

  assert.deepEqual(
    selectTenant(tenants, { search: "?tenant=tenant-b", storage }),
    { tenant: tenants[1], source: "url" },
  );
});

test("uses an authorized stored tenant when the URL tenant is not accessible", () => {
  const storage = memoryStorage({ tenant: "tenant-b" });

  assert.deepEqual(
    selectTenant(tenants, { search: "?tenant=not-authorized", storage }),
    { tenant: tenants[1], source: "storage" },
  );
});

test("falls back to the first backend-sorted tenant when stored state is not accessible", () => {
  const storage = memoryStorage({ tenant: "not-authorized" });

  assert.deepEqual(
    selectTenant(tenants, { search: "", storage }),
    { tenant: tenants[0], source: "default" },
  );
});

test("returns null when no accessible tenants are available", () => {
  assert.equal(selectTenant([], { search: "", storage: memoryStorage() }), null);
});

test("loads the documented accessible-tenant envelope with the browser session", async () => {
  const calls = [];
  const result = await loadAccessibleTenants("https://api.example.test/base", async (url, init) => {
    calls.push({ url, init });
    return Response.json({ data: { tenants }, request_id: "req-123" });
  });

  assert.deepEqual(result, tenants);
  assert.deepEqual(calls, [{
    url: "https://api.example.test/api/tenants/accessible",
    init: { credentials: "include", headers: { accept: "application/json" } },
  }]);
});

test("rejects a tenant discovery response outside the documented envelope", async () => {
  await assert.rejects(
    loadAccessibleTenants("https://api.example.test", async () => Response.json({ tenants })),
    (error) => error instanceof TenantError && error.code === "invalid_tenant_response",
  );
});

for (const status of [401, 403]) {
  test(`preserves a ${status} tenant discovery status`, async () => {
    await assert.rejects(
      loadAccessibleTenants("https://api.example.test", async () => new Response(JSON.stringify({ error: "access_denied" }), { status })),
      (error) => error instanceof TenantError && error.status === status,
    );
  });
}

test("writes only the selected tenant query key and stores a valid selection", () => {
  const calls = [];
  const storage = memoryStorage();
  const history = { pushState(...args) { calls.push(args); } };
  const location = { pathname: "/", search: "?view=map&tenant=old", hash: "#monitor" };

  writeTenantSelection("tenant-b", { history, location, storage, replace: false });

  assert.deepEqual(calls, [[null, "", "/?view=map&tenant=tenant-b#monitor"]]);
  assert.equal(storage.getItem("tenant"), "tenant-b");
});

test("replaces history and survives unavailable storage during recovery", () => {
  const calls = [];
  const history = { replaceState(...args) { calls.push(args); } };
  const storage = {
    getItem() { throw new Error("Storage is disabled"); },
    setItem() { throw new Error("Storage is disabled"); },
  };

  writeTenantSelection("tenant-a", {
    history,
    location: { pathname: "/dashboard", search: "?view=map", hash: "" },
    storage,
    replace: true,
  });

  assert.deepEqual(calls, [[null, "", "/dashboard?view=map&tenant=tenant-a"]]);
});
