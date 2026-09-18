# Multi-tenant Giant Salvinia SaaS Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-tenant Giant Salvinia deployment with a shared SaaS frontend that discovers authorized tenants from the unified backend and lets users switch safely.

**Architecture:** `coactive_data_service` owns tenant discovery, access control, manifest construction, and asset delivery. The static frontend receives only the API origin, derives its selected tenant from the URL with session-storage fallback, and supplies that identifier on individually authorized backend requests.

**Tech Stack:** Cloudflare Workers, Hono, PostgreSQL/Hyperdrive, tenant-scoped R2 through the existing service helpers, vanilla browser modules, Node’s built-in test runner, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-23-multitenant-saas-frontend-design.md`

## Global Constraints

- Never expose tenant bucket names, R2 paths, R2 credentials, Cloudflare tokens, or API keys to the browser.
- `API_BASE_URL` is the only public frontend runtime variable; remove `TENANT_ID` completely.
- Treat `?tenant=<UUID>` as canonical selection state and `sessionStorage` only as a validated convenience cache.
- The service must derive all tenant listings from `listAuthorizedObjects(..., "can_view", "tenant")`; never use the platform-admin workspace projection for this app.
- Re-run authorization on tenant discovery, manifest, and asset requests. A browser-held UUID is never evidence of access.
- Preserve the existing `credentials: "include"` request mode and API-origin-only asset validation.
- Do not modify the unrelated dirty changes already present in `/Users/kishore/code/coactive_data_service`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `/Users/kishore/code/coactive_data_service/src/index.ts` | Add browser-safe tenant discovery plus authenticated Salvinia manifest and asset routes. |
| `/Users/kishore/code/coactive_data_service/tests/worker-routes.test.ts` | Verify route-level authorization, limited metadata, manifest construction, and asset access. |
| `/Users/kishore/code/giant_salvinia_v2/src/index.ts` | Emit API origin only in runtime configuration. |
| `/Users/kishore/code/giant_salvinia_v2/public/tenant-client.js` | Isolate tenant discovery, selection validation, URL synchronization, and safe storage access. |
| `/Users/kishore/code/giant_salvinia_v2/public/release-client.js` | Load a release for an explicit selected tenant, retaining manifest-asset validation. |
| `/Users/kishore/code/giant_salvinia_v2/public/bootstrap.js` | Coordinate discovery, switcher state, release loading, history navigation, and user-visible errors. |
| `/Users/kishore/code/giant_salvinia_v2/public/index.html` | Provide a semantic, accessible tenant switcher control. |
| `/Users/kishore/code/giant_salvinia_v2/public/app.css` | Style the switcher consistently with the existing header and status UI. |
| `/Users/kishore/code/giant_salvinia_v2/tests/tenant-client.test.mjs` | Test deterministic selection and state persistence independent of the DOM. |
| `/Users/kishore/code/giant_salvinia_v2/tests/release-client.test.mjs` | Update release-client contract to pass tenant ID explicitly. |
| `/Users/kishore/code/giant_salvinia_v2/tests/bootstrap.test.mjs` | Verify startup, switching, revocation recovery, and no-tenant states. |
| `/Users/kishore/code/giant_salvinia_v2/tests/worker.test.mjs` | Prove the runtime config cannot require or emit a tenant ID. |
| `/Users/kishore/code/giant_salvinia_v2/README.md` | Document shared-app deployment and the two unified-backend contracts. |

### Task 1: Expose only authorized tenant switcher metadata from the unified backend

**Files:**

- Modify: `/Users/kishore/code/coactive_data_service/src/index.ts`
- Modify: `/Users/kishore/code/coactive_data_service/tests/worker-routes.test.ts`

**Interfaces:**

- Consumes: `listAuthorizedObjects(env, principal, "can_view", "tenant")`.
- Produces: `GET /api/tenants/accessible` → `{ data: { tenants: Array<{ id: string; slug: string; display_name: string }> }, request_id: string }`.

- [ ] **Step 1: Write the failing route tests**

  Add a `describe("accessible tenant discovery")` block in `worker-routes.test.ts`. Mock `listAuthorizedObjects` to return two authorized IDs and make the `withDb` mock return matching tenant rows plus an unlisted row. Assert the response is `200` and exactly contains the two `{ id, slug, display_name }` records ordered by the query result. Add assertions that an empty authorized-ID result returns `[]` and does not query tenant metadata.

  ```ts
  const response = await fetchPath("/api/tenants/accessible");
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    data: { tenants: [{ id: tenantId, slug: "lake-ops", display_name: "Lake Operations" }] },
    request_id: expect.any(String),
  });
  expect(mockedListAuthorizedObjects).toHaveBeenCalledWith(env, principal, "can_view", "tenant");
  ```

  Add a separate unauthenticated request test that sets `mocks.authenticate.mockResolvedValue(null)` and expects the existing `401` middleware behavior.

- [ ] **Step 2: Run the focused tests and verify they fail for the missing route**

  Run:

  ```bash
  npm test -- --run tests/worker-routes.test.ts
  ```

  Expected: the new assertions fail with `404`, before route implementation exists.

- [ ] **Step 3: Implement the minimal discovery endpoint**

  In `src/index.ts`, after the generic resource route and before admin routes, add the authenticated `GET /api/tenants/accessible` handler. Read the already-authenticated `principal`; call `listAuthorizedObjects` with `can_view` and `tenant`; return an empty envelope immediately when no IDs are authorized. Otherwise query only `id::text`, `slug`, and `display_name` from active, non-deleted tenant rows whose IDs are in the authorized list, sorted by `display_name, id`. Return the JSON envelope with the existing request ID.

  ```ts
  const tenantIds = await listAuthorizedObjects(c.env, c.get("principal"), "can_view", "tenant");
  if (!tenantIds.length) return json({ data: { tenants: [] }, request_id: c.get("requestId") });
  const result = await withDb(c.env, (db) => db.query<TenantOption>(
    `SELECT id::text, slug, display_name FROM tenants
     WHERE id = ANY($1::uuid[]) AND status = 'active' AND deleted_at IS NULL
     ORDER BY display_name, id`,
    [tenantIds],
  ));
  return json({ data: { tenants: result.rows }, request_id: c.get("requestId") });
  ```

- [ ] **Step 4: Run focused and service verification**

  Run:

  ```bash
  npm test -- --run tests/worker-routes.test.ts
  npm run check
  ```

  Expected: all route tests and TypeScript checks pass.

- [ ] **Step 5: Commit only the backend route change**

  From `/Users/kishore/code/coactive_data_service`, stage only `src/index.ts` and `tests/worker-routes.test.ts` after confirming the index contains no unrelated dirty files.

  ```bash
  git add src/index.ts tests/worker-routes.test.ts
  git commit -m "feat: expose authorized tenant options"
  ```

### Task 2: Add authenticated presentation-manifest and release-asset routes

**Files:**

- Modify: `/Users/kishore/code/coactive_data_service/src/index.ts`
- Modify: `/Users/kishore/code/coactive_data_service/tests/worker-routes.test.ts`

**Interfaces:**

- Consumes: `protectedResource(..., "tenant", tenantId, "can_view")`, `getArtifact(env, tenantId, key)`, `salvinia_releases`, and `salvinia_release_artifacts`.
- Produces: `GET /api/tenants/:tenantId/salvinia/releases/current/manifest` and `GET /api/tenants/:tenantId/salvinia/releases/:releaseId/assets/:objectKey`.

- [ ] **Step 1: Write failing manifest and asset authorization tests**

  Add tests that mock an authorized tenant, active release, manifest JSON body, and two release-artifact database rows. Assert the manifest response has the stored presentation payload and an `assets` map whose values are API-relative URLs for only those two recorded keys. Add tests asserting `403` returns before any storage read, unknown object keys return `404`, and an authorized object response streams the body with its stored content type and `private, no-store` cache policy.

  ```ts
  const response = await fetchPath(
    `/api/tenants/${tenantId}/salvinia/releases/current/manifest`,
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    payload: { meta: { version: 2 } },
    assets: {
      "layers/site.webp": expect.stringMatching(new RegExp(`^/api/tenants/${tenantId}/salvinia/releases/`)),
    },
  });
  ```

- [ ] **Step 2: Run focused tests and verify they fail**

  Run:

  ```bash
  npm test -- --run tests/worker-routes.test.ts
  ```

  Expected: the new manifest and asset assertions fail with `404`.

- [ ] **Step 3: Implement a shared release lookup and manifest response**

  Refactor the existing release lookup so metadata, manifest, and asset routes share one release-record query and never duplicate authorization. For the manifest route, require `can_view`, find the active release, load `manifest_key` through `getArtifact`, parse JSON, reject non-object or malformed manifest data as a controlled unavailable response, and create the asset map solely from `salvinia_release_artifacts` rows for that release. Preserve payload data; do not pass through any pre-signed, cross-origin, or bucket URL.

  ```ts
  const assets = Object.fromEntries(artifacts.map(({ object_key }) => [
    object_key,
    `/api/tenants/${tenantId}/salvinia/releases/${release.id}/assets/${object_key}`,
  ]));
  return json({ release: publicRelease(release), payload: parsedManifest.payload, assets,
    request_id: c.get("requestId") }, 200, { "cache-control": "no-store" });
  ```

- [ ] **Step 4: Implement the asset route with release membership validation**

  Define the object-key path parameter as a catch-all supported by Hono. Require `can_view` before release lookup. Query the requested `object_key` joined to the requested release and tenant; reject a missing row with `404`; validate the stored key with `assertSalviniaObjectKey`; fetch with `getArtifact`; and return a streaming `Response` with the database-recorded content type (or `application/octet-stream`), optional content length, `cache-control: private, no-store`, and `x-content-type-options: nosniff`. Never accept a key that is not in `salvinia_release_artifacts`.

- [ ] **Step 5: Run focused and full backend verification**

  Run:

  ```bash
  npm test -- --run tests/worker-routes.test.ts
  npm run verify
  ```

  Expected: manifest/asset authorization tests pass; all backend checks and Vitest suites pass.

- [ ] **Step 6: Commit only the manifest/asset contract work**

  Stage only the files from this task after reviewing the diff:

  ```bash
  git add src/index.ts tests/worker-routes.test.ts
  git commit -m "feat: serve authorized salvinia release manifests"
  ```

### Task 3: Remove tenant configuration and introduce a testable tenant-selection client

**Files:**

- Create: `/Users/kishore/code/giant_salvinia_v2/public/tenant-client.js`
- Create: `/Users/kishore/code/giant_salvinia_v2/tests/tenant-client.test.mjs`
- Modify: `/Users/kishore/code/giant_salvinia_v2/src/index.ts`
- Modify: `/Users/kishore/code/giant_salvinia_v2/public/release-client.js`
- Modify: `/Users/kishore/code/giant_salvinia_v2/tests/release-client.test.mjs`
- Modify: `/Users/kishore/code/giant_salvinia_v2/tests/worker.test.mjs`

**Interfaces:**

- Produces `loadAccessibleTenants(apiBaseUrl, fetcher)`, `selectTenant(tenants, { search, storage })`, and `writeTenantSelection(tenantId, { history, location, storage, replace })`.
- Changes `loadCurrentRelease` to `loadCurrentRelease(apiBaseUrl, tenantId, fetcher = fetch)`.

- [ ] **Step 1: Write failing tenant-client tests**

  In `tests/tenant-client.test.mjs`, use a fake `URLSearchParams` search string and memory storage object. Test that an authorized URL tenant wins over storage, an unauthorized URL is replaced by an authorized storage value, an unauthorized stored value falls back to the first backend-sorted tenant, and no tenants produces `null`. Test that discovery sends `credentials: "include"`, accepts only the documented envelope, and preserves `401`/`403` response status in a `TenantError`.

  ```js
  assert.deepEqual(
    selectTenant(tenants, { search: "?tenant=tenant-b", storage }),
    { tenant: tenants[1], source: "url" },
  );
  assert.equal(selectTenant([], { search: "", storage }), null);
  ```

  Update `release-client.test.mjs` so its production call is `loadCurrentRelease(apiBaseUrl, tenantId, fetcher)` and add a failure assertion for a missing explicit tenant ID. Update `worker.test.mjs` to assert `src/index.ts` contains `API_BASE_URL` but no `TENANT_ID` or `tenantId` runtime emission.

- [ ] **Step 2: Run the frontend tests and verify RED**

  Run:

  ```bash
  npm test
  ```

  Expected: tests fail because `tenant-client.js` and the changed release-client interface do not exist yet.

- [ ] **Step 3: Implement the minimal tenant client**

  Add `tenant-client.js` with no DOM dependency. `loadAccessibleTenants` builds `/api/tenants/accessible` from the configured origin, sends credentials and JSON accept headers, verifies `body.data.tenants` is an array of non-empty `id`, `slug`, and `display_name` strings, and returns it. `selectTenant` validates candidates against this returned array only. Read storage through `try/catch` so browser privacy settings cannot prevent startup. `writeTenantSelection` updates only the `tenant` query key, calls `history.pushState` for explicit switch events and `replaceState` for invalid/default recovery, and mirrors a valid ID to session storage.

- [ ] **Step 4: Make runtime and release configuration tenant-free**

  In `src/index.ts`, remove `TENANT_ID` from `Env`, require only `API_BASE_URL`, and emit `{ apiBaseUrl }`. Change `release-client.js` to accept `apiBaseUrl` and `tenantId` separately, validate both before forming the tenant-scoped manifest URL, and retain the current safe asset-map resolver exactly.

- [ ] **Step 5: Run the frontend test suite and static checks**

  Run:

  ```bash
  npm test
  npm run check
  npm run build
  ```

  Expected: all Node tests pass, TypeScript emits no diagnostics, and public assets verify successfully.

- [ ] **Step 6: Commit the isolated frontend contract change if the project is placed under Git**

  This project currently has no `.git` directory. If it is initialized or attached to its intended repository before execution, stage only Task 3 files and commit:

  ```bash
  git add src/index.ts public/tenant-client.js public/release-client.js tests/tenant-client.test.mjs tests/release-client.test.mjs tests/worker.test.mjs
  git commit -m "feat: derive salvinia tenant from authorized context"
  ```

### Task 4: Render the accessible tenant switcher and reload releases safely

**Files:**

- Modify: `/Users/kishore/code/giant_salvinia_v2/public/index.html`
- Modify: `/Users/kishore/code/giant_salvinia_v2/public/app.css`
- Modify: `/Users/kishore/code/giant_salvinia_v2/public/bootstrap.js`
- Modify: `/Users/kishore/code/giant_salvinia_v2/tests/bootstrap.test.mjs`
- Modify: `/Users/kishore/code/giant_salvinia_v2/README.md`

**Interfaces:**

- Consumes: `loadAccessibleTenants`, `selectTenant`, `writeTenantSelection`, and `loadCurrentRelease(apiBaseUrl, tenantId)`.
- Produces: a labelled select control that reloads the correct release and synchronizes URL/history/storage.

- [ ] **Step 1: Write failing bootstrap coordination tests**

  Refactor `start` to receive dependency-injected `loadTenants`, `loadRelease`, `selectTenant`, `persistSelection`, `renderTenantOptions`, and `startApp` functions. Add tests showing it loads tenants before a release, passes the selected tenant ID into `loadRelease`, does not call `loadRelease` for an empty list, selects the next valid tenant after a `403` refresh, and maps tenant discovery `401` to `authentication_required`.

  ```js
  const result = await start({ apiBaseUrl }, {
    loadTenants: async () => tenants,
    selectTenant: () => ({ tenant: tenants[0], source: "first" }),
    loadRelease: async (origin, id) => ({ meta: { tenant: id } }),
    startApp,
    showError,
  });
  assert.deepEqual(result, { status: "ready", tenantId: "tenant-a" });
  ```

- [ ] **Step 2: Run the focused test and verify RED**

  Run:

  ```bash
  node --test tests/bootstrap.test.mjs
  ```

  Expected: the test fails because startup still expects tenant configuration and does not discover tenant options.

- [ ] **Step 3: Add the accessible header control and visual treatment**

  Add a hidden `<label>` and `<select id="tenant-switcher">` to the app header, before the existing record badge. The select must use tenant `display_name` as option text and UUID only as option value, have an explicit accessible label, and remain disabled during startup/switching. Add focused CSS that matches existing header controls without changing map layout at desktop or mobile breakpoints.

- [ ] **Step 4: Implement startup, switching, and browser history behavior**

  Make `bootstrap.js` discover tenants first; render and reveal the switcher only after success; select through the precedence helper; synchronize default/stale selection with `replaceState`; then load the release. On `change`, use `pushState`, save selection, disable the control, and reload the new release. On `popstate`, revalidate the URL selection against the last accessible list and reload without writing a new history entry. On release `403`, refresh tenant options once and either recover to another authorized tenant or render no-tenant-access. Ensure stale asynchronous loads cannot initialize the Leaflet UI after a newer selection has been made.

- [ ] **Step 5: Update documentation**

  Revise `README.md` to remove every `TENANT_ID` instruction and tenant-specific deployment claim. Document `API_BASE_URL`, `GET /api/tenants/accessible`, the manifest/asset endpoints, exact Better Auth trusted-origin registration, and the URL-first selection behavior. State explicitly that UUIDs in the browser are not secrets and are re-authorized by the unified backend.

- [ ] **Step 6: Verify frontend behavior and deployment configuration**

  Run:

  ```bash
  npm test
  npm run check
  npm run build
  API_BASE_URL=https://api.staging.coactivescience.com wrangler deploy --dry-run --env staging
  ```

  Expected: tests and checks pass; dry run accepts `API_BASE_URL` without `TENANT_ID`.

- [ ] **Step 7: Commit the frontend UI/docs work if Git is available**

  If this directory has been attached to its intended Git repository, stage only Task 4 files and commit:

  ```bash
  git add public/index.html public/app.css public/bootstrap.js tests/bootstrap.test.mjs README.md
  git commit -m "feat: add authorized tenant switcher"
  ```

### Task 5: End-to-end staging verification after both deployments

**Files:**

- Modify: `/Users/kishore/code/coactive_data_service/scripts/verify-staging-ui.mjs` only if its current checks cannot exercise the new shared frontend origin.
- Modify: `/Users/kishore/code/giant_salvinia_v2/README.md` only if the deployed URL differs from the documented staging origin.

**Interfaces:**

- Consumes: deployed data-service routes and deployed static frontend runtime configuration.
- Produces: an operator verification record that requires a genuine authenticated browser session and does not use secrets in source control.

- [ ] **Step 1: Define the release-verification scenarios in a failing check or documented command**

  Verify with an authenticated account that can view exactly one tenant, an account with two tenants, and an account with no tenant access. The two-tenant scenario must load one release, select another tenant, update `?tenant=`, and reload only that tenant’s manifest. The no-access scenario must display no-tenant-access without requesting a manifest.

- [ ] **Step 2: Verify backend and frontend deployment readiness before mutation**

  Run:

  ```bash
  cd /Users/kishore/code/coactive_data_service && npm run verify && npm run verify:staging:config
  cd /Users/kishore/code/giant_salvinia_v2 && npm test && npm run check && npm run build
  ```

  Expected: both codebases are green before any staging deployment.

- [ ] **Step 3: Deploy in dependency order**

  Deploy the unified backend first so tenant-discovery and manifest routes exist, then deploy the frontend with only `API_BASE_URL`. Register the exact frontend origin in `BETTER_AUTH_TRUSTED_ORIGINS` before browser verification. Do not set `TENANT_ID`.

- [ ] **Step 4: Perform the authenticated browser checks**

  Confirm request traces show calls only to `api.staging.coactivescience.com`; responses never contain R2 details; asset requests remain API-relative before the browser resolves them; changing or fabricating `?tenant=` cannot access an unauthorized release; and browser back/forward restores authorized selections.

- [ ] **Step 5: Record the verified deployment outcome**

  Add the verified shared-frontend URL and date to the project deployment notes only after all three tenant-access scenarios pass. Do not record user cookies, tenant data, or credentials.
