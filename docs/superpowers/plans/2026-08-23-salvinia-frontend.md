# Giant Salvinia Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Cloudflare-deployable, frontend-only Giant Salvinia application that securely loads the active tenant release from the unified data service.

**Architecture:** A static-assets Worker emits public runtime configuration and serves the Leaflet application. The browser bootstrap fetches the current release manifest with its Better Auth session, converts manifest asset references to authorized URLs, and only then initializes the existing views.

**Tech Stack:** Cloudflare Workers static assets, TypeScript, vanilla browser JavaScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-23-salvinia-frontend-design.md`

## Global Constraints

- The project contains no scientific processing, tenant bucket credentials, or API keys.
- Runtime configuration contains only `apiBaseUrl` and `tenantId`.
- API calls use `credentials: "include"`.
- Browser-loaded files use only URLs supplied by the release manifest.
- The deployment uses `giant-salvinia-v2` with staging and production environments.

---

### Task 1: Frontend-only project and deployment configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `src/index.ts`, `public/*`
- Modify: copied presentation asset files to replace static data bootstrap

**Interfaces:**
- Produces `GET /runtime-config.js` with `window.RUNTIME_CONFIG`.
- Produces static asset fallback for all application paths.

- [ ] **Step 1: Write failing Worker configuration test**

```js
assert.match(workerSource, /runtime-config\.js/);
assert.match(wrangler, /giant-salvinia-v2/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/worker.test.js`
Expected: FAIL because the Worker and configuration do not exist.

- [ ] **Step 3: Add the minimal static Worker and Wrangler configuration**

```ts
if (url.pathname === "/runtime-config.js") {
  return javascriptConfig(env.API_BASE_URL, env.TENANT_ID);
}
return env.ASSETS.fetch(request);
```

- [ ] **Step 4: Run the configuration test**

Run: `node --test tests/worker.test.js`
Expected: PASS.

### Task 2: Authenticated release client

**Files:**
- Create: `public/release-client.js`, `tests/release-client.test.js`

**Interfaces:**
- Produces `loadCurrentRelease(config, fetcher): Promise<object>`.
- Consumes `{ apiBaseUrl, tenantId }` and the unified service manifest response.

- [ ] **Step 1: Write failing release client tests**

```js
const payload = await loadCurrentRelease(config, fetcher);
assert.equal(calls[0].init.credentials, "include");
assert.equal(payload.monitor.frames[0].file, "/api/.../layers/monitor/frame.webp");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/release-client.test.js`
Expected: FAIL because the loader does not exist.

- [ ] **Step 3: Implement request, validation, and asset URL normalization**

```js
const response = await fetcher(endpoint, { credentials: "include", headers: { accept: "application/json" } });
const manifest = await response.json();
return replaceAssetReferences(manifest.payload, manifest.assets);
```

- [ ] **Step 4: Run release client tests**

Run: `node --test tests/release-client.test.js`
Expected: PASS.

### Task 3: Bootstrap the Leaflet interface from the live release

**Files:**
- Modify: `public/index.html`, `public/app.js`
- Create: `public/bootstrap.js`, `tests/bootstrap.test.js`

**Interfaces:**
- Consumes `window.RUNTIME_CONFIG` and `window.ReleaseClient.loadCurrentRelease`.
- Produces `window.startSalviniaApp(payload)` only after a complete payload is available.

- [ ] **Step 1: Write failing bootstrap tests**

```js
const state = await start({ config, loadRelease });
assert.equal(state.status, "ready");
assert.equal(renderedPayload.meta.version, 2);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL because the bootstrap is absent.

- [ ] **Step 3: Implement loading and API error states**

```js
try { return startApp(await loadRelease(config)); }
catch (error) { showReleaseError(error); return { status: "error" }; }
```

- [ ] **Step 4: Run bootstrap tests**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS.

### Task 4: Complete verification and handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document environment variables and required unified-service routes**
- [ ] **Step 2: Run all browser-unit tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Type-check the Worker**

Run: `npm run check`
Expected: exit code 0.

- [ ] **Step 4: Build static assets**

Run: `npm run build`
Expected: exits 0 with a deployable `public/` directory.
