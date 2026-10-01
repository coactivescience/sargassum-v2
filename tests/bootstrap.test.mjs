import assert from "node:assert/strict";
import test from "node:test";

import * as bootstrap from "../public/bootstrap.js";

const { start } = bootstrap;

const config = { apiBaseUrl: "https://api.example.test" };
const tenants = [
  { id: "tenant-a", slug: "alpha", display_name: "Alpha Lake" },
  { id: "tenant-b", slug: "bravo", display_name: "Bravo Lake" },
];

function classifiedRelease(tenantId = "tenant-a") {
  return {
    kind: "full",
    release: { meta: { tenant: tenantId } },
    validation: { ok: true, errors: [] },
  };
}

function browserStatusEnvironment() {
  let disposals = 0;
  const landing = { hidden: true, classList: { remove() {} } };
  const status = { hidden: true, textContent: "" };
  const signIn = { hidden: true, replaceChildren() {} };
  const auth = { hidden: false };
  const shell = { hidden: false };
  const documentRef = {
    querySelector(selector) {
      return {
        "#public-landing": landing,
        "#landing-release-status": status,
        "#landing-sign-in": signIn,
        "#landing-auth": auth,
        ".app-shell": shell,
      }[selector] || null;
    },
    createElement() { return { setAttribute() {}, textContent: "" }; },
  };
  const windowRef = { demoApp: { dispose() { disposals += 1; } } };
  return { auth, documentRef, landing, shell, signIn, status, windowRef, get disposals() { return disposals; } };
}

test("unwraps the classified release before starting the selected tenant workspace", async () => {
  const calls = [];
  let rendered;
  const result = await start(config, {
    loadTenants: async (origin) => {
      calls.push(["tenants", origin]);
      return tenants;
    },
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    loadRelease: async (origin, tenantId) => {
      calls.push(["release", origin, tenantId]);
      return classifiedRelease(tenantId);
    },
    renderTenantOptions: (available, selectedId) => {
      calls.push(["options", available.length, selectedId]);
    },
    startApp: (release, tenant, classification) => { rendered = { release, tenant, classification }; },
    showError: () => { throw new Error("unexpected error state"); },
  });

  assert.deepEqual(calls, [
    ["tenants", "https://api.example.test"],
    ["options", 2, "tenant-a"],
    ["release", "https://api.example.test", "tenant-a"],
  ]);
  assert.deepEqual(rendered, {
    release: { meta: { tenant: "tenant-a" } },
    tenant: tenants[0],
    classification: { kind: "full", validation: { ok: true, errors: [] } },
  });
  assert.deepEqual(result, { status: "ready", tenantId: "tenant-a" });
});

test("renders the signed-in user's name and role with an available workspace", async () => {
  let renderedIdentity;

  await start(config, {
    loadTenants: async () => [tenants[0]],
    loadSession: async () => ({ user: { name: "Kishore", role: "admin" } }),
    loadRelease: async () => classifiedRelease(),
    renderTenantOptions: () => {},
    renderUserIdentity: (identity) => { renderedIdentity = identity; },
    startApp: () => {},
    showError: () => { throw new Error("unexpected error state"); },
  });

  assert.deepEqual(renderedIdentity, { name: "Kishore", role: "admin" });
});

test("keeps an authorized workspace ready when its first release is not published", async () => {
  let emptyWorkspace;
  let renderedIdentity;
  const result = await start(config, {
    loadTenants: async () => [tenants[0]],
    loadSession: async () => ({ user: { name: "Kishore", role: "tenant_admin" } }),
    loadRelease: async () => { throw { status: 404, requestId: "release-absent" }; },
    renderTenantOptions: () => {},
    renderUserIdentity: (identity) => { renderedIdentity = identity; },
    showEmptyRelease: (tenant) => { emptyWorkspace = tenant; },
    startApp: () => { throw new Error("must not initialize a release that does not exist"); },
    showError: () => { throw new Error("a missing release is not an access error"); },
  });

  assert.deepEqual(result, { status: "empty", tenantId: "tenant-a" });
  assert.deepEqual(emptyWorkspace, tenants[0]);
  assert.deepEqual(renderedIdentity, { name: "Kishore", role: "tenant_admin" });
});

test("browser error state disposes the active visual workspace before hiding it", () => {
  assert.equal(typeof bootstrap.showBrowserError, "function");
  const browser = browserStatusEnvironment();

  bootstrap.showBrowserError({ code: "authentication_required", requestId: "req-1" }, browser.documentRef, browser.windowRef);

  assert.equal(browser.disposals, 1);
  assert.equal(browser.shell.hidden, true);
  assert.equal(browser.landing.hidden, false);
});

test("browser empty-release state disposes the active visual workspace before hiding it", () => {
  assert.equal(typeof bootstrap.showBrowserEmptyRelease, "function");
  const browser = browserStatusEnvironment();

  bootstrap.showBrowserEmptyRelease(undefined, browser.documentRef, browser.windowRef);

  assert.equal(browser.disposals, 1);
  assert.equal(browser.shell.hidden, true);
  assert.equal(browser.landing.hidden, false);
});

test("writes only the signed-in user's name and role into the header", () => {
  assert.equal(typeof bootstrap.browserUserIdentity, "function");
  const badge = { hidden: true };
  const name = { textContent: "" };
  const role = { textContent: "" };
  const landingBadge = { hidden: true };
  const landingName = { textContent: "" };
  const landingRole = { textContent: "" };
  const render = bootstrap.browserUserIdentity({
    querySelector(selector) {
      return {
        "#user-identity": badge,
        "#user-name": name,
        "#user-role": role,
        "#landing-user-identity": landingBadge,
        "#landing-user-name": landingName,
        "#landing-user-role": landingRole,
      }[selector] || null;
    },
  });

  render({ name: "Kishore", role: "admin", email: "not-rendered@example.test" });

  assert.equal(badge.hidden, false);
  assert.equal(name.textContent, "Kishore");
  assert.equal(role.textContent, "admin");
  assert.equal(landingBadge.hidden, false);
  assert.equal(landingName.textContent, "Kishore");
  assert.equal(landingRole.textContent, "admin");
  assert.equal("email" in badge, false);
});

test("renders every accessible tenant in the site rail without inventing locations", () => {
  assert.equal(typeof bootstrap.browserTenantSwitcher, "function");
  if (typeof bootstrap.browserTenantSwitcher !== "function") return;
  const replacements = [];
  const list = { replaceChildren(...children) { replacements.push(children); } };
  const count = { textContent: "" };
  const label = { hidden: true };
  const control = { hidden: true, disabled: true, replaceChildren() {} };
  const documentRef = {
    querySelector(selector) {
      return {
        "#tenant-switcher-label": label,
        "#tenant-switcher": control,
        "#site-list": list,
        "#site-count": count,
      }[selector] || null;
    },
    createElement(tag) {
      return {
        tag,
        className: "",
        dataset: {},
        listeners: {},
        append() {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
        setAttribute(name, value) { this[name] = value; },
      };
    },
  };
  const selected = [];

  bootstrap.browserTenantSwitcher(documentRef).render(tenants, "tenant-b", (id) => selected.push(id));

  assert.equal(replacements[0].length, 2);
  assert.deepEqual(replacements[0].map((item) => item.dataset.tenant), ["tenant-a", "tenant-b"]);
  assert.equal(replacements[0][1].className.includes("active"), true);
  assert.equal(replacements[0][1]["aria-current"], "page");
  assert.equal(count.textContent, "2 authorized locations");
  replacements[0][0].listeners.click();
  assert.deepEqual(selected, ["tenant-a"]);
});

test("logout ends the API session, clears the selected tenant, and returns to discovery", async () => {
  assert.equal(typeof bootstrap.setupBrowserLogout, "function");
  if (typeof bootstrap.setupBrowserLogout !== "function") return;
  const button = {
    disabled: false,
    addEventListener(_type, handler) { this.handler = handler; },
  };
  const calls = [];
  bootstrap.setupBrowserLogout(config, async () => { calls.push("reload"); }, {
    documentRef: { querySelector: () => button },
    windowRef: { demoApp: { dispose: () => calls.push("dispose") } },
    storage: { removeItem: (key) => calls.push(`remove:${key}`) },
    signOutAction: async (origin) => calls.push(`signout:${origin}`),
  });

  await button.handler();

  assert.deepEqual(calls, [
    "signout:https://api.example.test",
    "remove:tenant",
    "dispose",
    "reload",
  ]);
  assert.equal(button.disabled, false);
});

test("shows no-tenant-access without requesting a release for an empty discovery result", async () => {
  let errorState;
  const result = await start(config, {
    loadTenants: async () => [],
    loadSession: async () => ({ user: { id: "user-a" } }),
    loadRelease: async () => { throw new Error("must not request a manifest"); },
    renderTenantOptions: () => {},
    startApp: () => { throw new Error("must not start"); },
    showError: (state) => { errorState = state; },
  });

  assert.deepEqual(result, { status: "error", code: "no_tenant_access" });
  assert.deepEqual(errorState, { code: "no_tenant_access", requestId: undefined });
});

test("shows the sign-in state when empty tenant discovery has no browser session", async () => {
  let errorState;
  const result = await start(config, {
    loadTenants: async () => [],
    loadSession: async () => null,
    loadRelease: async () => { throw new Error("must not request a manifest"); },
    renderTenantOptions: () => {},
    startApp: () => { throw new Error("must not start"); },
    showError: (state) => { errorState = state; },
  });

  assert.deepEqual(result, { status: "error", code: "authentication_required" });
  assert.deepEqual(errorState, { code: "authentication_required", requestId: undefined });
});

test("refreshes tenants once after a forbidden release and loads the next authorized tenant", async () => {
  let discoveryCount = 0;
  const releases = [];
  const saved = [];
  const result = await start(config, {
    loadTenants: async () => {
      discoveryCount += 1;
      return discoveryCount === 1 ? tenants : [tenants[1]];
    },
    selectTenant: (available) => ({ tenant: available[0], source: "default" }),
    persistSelection: (tenantId, { replace }) => { saved.push([tenantId, replace]); },
    loadRelease: async (_origin, tenantId) => {
      releases.push(tenantId);
      if (tenantId === "tenant-a") throw { status: 403, requestId: "forbidden-1" };
      return classifiedRelease(tenantId);
    },
    renderTenantOptions: () => {},
    startApp: () => {},
    showError: () => { throw new Error("expected recovery"); },
  });

  assert.equal(discoveryCount, 2);
  assert.deepEqual(releases, ["tenant-a", "tenant-b"]);
  assert.deepEqual(saved, [["tenant-a", true], ["tenant-b", true]]);
  assert.deepEqual(result, { status: "ready", tenantId: "tenant-b" });
});

test("maps unauthenticated tenant discovery failures to the sign-in state", async () => {
  let rendered;
  const result = await start(config, {
    loadTenants: async () => { throw { status: 401, requestId: "req-1" }; },
    loadRelease: async () => { throw new Error("must not request a manifest"); },
    renderTenantOptions: () => {},
    startApp: () => { throw new Error("must not start"); },
    showError: (state) => { rendered = state; },
  });

  assert.deepEqual(result, { status: "error", code: "authentication_required" });
  assert.deepEqual(rendered, { code: "authentication_required", requestId: "req-1" });
});

test("uses the session-scoped tenant preference instead of local storage", async () => {
  const priorLocalStorage = globalThis.localStorage;
  const priorSessionStorage = globalThis.sessionStorage;
  Object.defineProperties(globalThis, {
    localStorage: {
      configurable: true,
      value: { getItem: () => "tenant-a" },
    },
    sessionStorage: {
      configurable: true,
      value: { getItem: () => "tenant-b" },
    },
  });

  try {
    let requestedTenant;
    const result = await start(config, {
      loadTenants: async () => tenants,
      getSearch: () => "",
      loadRelease: async (_origin, tenantId) => {
        requestedTenant = tenantId;
        return classifiedRelease(tenantId);
      },
      renderTenantOptions: () => {},
      startApp: () => {},
      showError: () => { throw new Error("unexpected error state"); },
    });

    assert.equal(requestedTenant, "tenant-b");
    assert.deepEqual(result, { status: "ready", tenantId: "tenant-b" });
  } finally {
    Object.defineProperties(globalThis, {
      localStorage: { configurable: true, value: priorLocalStorage },
      sessionStorage: { configurable: true, value: priorSessionStorage },
    });
  }
});

test("does not initialize a stale release after a newer selection starts loading", async () => {
  let signalReleaseStart;
  const releaseStarted = new Promise((resolve) => { signalReleaseStart = resolve; });
  let resolveRelease;
  const pendingRelease = new Promise((resolve) => { resolveRelease = resolve; });
  let current = true;
  const result = start(config, {
    loadTenants: async () => [tenants[0]],
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    loadRelease: async () => {
      signalReleaseStart();
      return pendingRelease;
    },
    renderTenantOptions: () => {},
    startApp: () => { throw new Error("stale release must not initialize the app"); },
    showError: () => { throw new Error("unexpected error state"); },
    isCurrent: () => current,
  });

  await releaseStarted;
  current = false;
  resolveRelease(classifiedRelease());
  assert.deepEqual(await result, { status: "stale" });
});

test("classifies an invalid Sargassum release separately from an unavailable one", async () => {
  const shown = [];
  const result = await start(config, {
    loadTenants: async () => [tenants[0]],
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    loadRelease: async () => { throw { code: "invalid_release", status: undefined, requestId: "req-invalid" }; },
    startApp: () => { throw new Error("an invalid release must not start the workspace"); },
    showError: (state) => shown.push(state),
  });
  assert.deepEqual(result, { status: "error", code: "release_invalid" });
  assert.deepEqual(shown, [{ code: "release_invalid", requestId: "req-invalid" }]);

  const environment = browserStatusEnvironment();
  bootstrap.showBrowserError({ code: "release_invalid", requestId: "req-invalid" }, environment.documentRef, environment.windowRef);
  assert.match(environment.status.textContent, /Sargassum release is invalid.*Reference: req-invalid\./);
});

test("loads the tenant's Sargassum sites, then the selected site's release route, by default", async () => {
  const priorFetch = globalThis.fetch;
  const requested = [];
  const siteId = "00000000-0000-4000-8000-000000000302";
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith("/sargassum/sites")) return Response.json({ sites: [{ id: siteId, label: "Test coast", current_release: null }] });
    return Response.json({ error: { code: "release_not_found", request_id: "req-1" } }, { status: 404 });
  };
  try {
    const empty = [];
    const result = await start(config, {
      loadTenants: async () => [tenants[0]],
      selectTenant: (available) => ({ tenant: available[0], source: "url" }),
      showEmptyRelease: (tenant, reason) => empty.push(reason),
      showError: () => { throw new Error("a missing release is an empty state"); },
    });
    assert.deepEqual(result, { status: "empty", tenantId: "tenant-a" });
    assert.deepEqual(requested, [
      "https://api.example.test/api/tenants/tenant-a/sargassum/sites",
      `https://api.example.test/api/tenants/tenant-a/sargassum/sites/${siteId}/releases/current/manifest`,
    ]);
    assert.equal(empty[0].code, "release_not_found");
    assert.equal(empty[0].site.label, "Test coast");
  } finally {
    globalThis.fetch = priorFetch;
  }
});

test("shows a distinct empty state when no Sargassum sites are enabled", async () => {
  const empty = [];
  const result = await start(config, {
    loadTenants: async () => [tenants[0]],
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    loadRelease: async () => { const error = new Error("none"); error.status = 404; error.code = "no_sargassum_sites"; throw error; },
    showEmptyRelease: (tenant, reason) => empty.push(reason),
    showError: () => { throw new Error("no sites is an empty state"); },
  });
  assert.deepEqual(result, { status: "empty", tenantId: "tenant-a" });
  assert.equal(empty[0].code, "no_sargassum_sites");

  const environment = browserStatusEnvironment();
  bootstrap.showBrowserEmptyRelease(undefined, environment.documentRef, environment.windowRef, { code: "no_sargassum_sites" });
  assert.match(environment.status.textContent, /No Sargassum sites are enabled for this workspace/);
  bootstrap.showBrowserEmptyRelease(undefined, environment.documentRef, environment.windowRef, { code: "release_not_found", site: { label: "Test coast" } });
  assert.match(environment.status.textContent, /first Sargassum release for Test coast is still being prepared/);
});

test("passes the page search to the release loader so ?site= selects the site", async () => {
  const calls = [];
  await start(config, {
    loadTenants: async () => [tenants[0]],
    selectTenant: (available) => ({ tenant: available[0], source: "url" }),
    getSearch: () => "?tenant=tenant-a&site=00000000-0000-4000-8000-000000000303",
    loadRelease: async (...args) => { calls.push(args); const error = new Error("none"); error.status = 404; throw error; },
    showEmptyRelease: () => {},
  });
  assert.deepEqual(calls[0][2], { search: "?tenant=tenant-a&site=00000000-0000-4000-8000-000000000303" });
});

