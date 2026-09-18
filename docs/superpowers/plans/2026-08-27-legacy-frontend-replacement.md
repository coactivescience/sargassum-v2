# Native Legacy Frontend Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make `giant_salvinia_v2` the authenticated, tenant-scoped native replacement for the legacy Unified Giant Salvinia application, including the current Lake Operations story and the missing Operations Intelligence workspace.

**Architecture:** Keep the current static Cloudflare application and immutable release flow. The active tenant release remains the only scientific data source. Extend the existing full-release validator to require the already-produced `intelligence` document, render its products with one browser module, and let `app.js` own only top-level workspace/view lifecycle. Reuse `/api/tenants/accessible`, `/api/auth/get-session`, `/api/auth/sign-out`, and the existing tenant-scoped operational-briefing endpoint. Do not embed, proxy, or execute the legacy application.

**Tech Stack:** Existing HTML/CSS/browser JavaScript, Leaflet, Cloudflare Workers static assets, Node test runner, Playwright Core. Add no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md`

## Global Constraints

- Native migration only: no iframe, copied legacy bundle, browser-held model key, or cross-origin dependency on the ELB application.
- Render only tenants returned by `/api/tenants/accessible`; tenant selection is convenience state, never authorization.
- Render intelligence only from the active release's validated `intelligence` payload.
- Caddo is operational; Santee is visibly reference-only; Sam Rayburn stays excluded and cannot be selected as an operational lake.
- Keep the existing Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy, and evidence-gated Hyperspectral views intact.
- Preserve claim boundaries in every actionable view and export.
- Fail closed on malformed intelligence. Do not render a partial ranking, route, or answer.
- Use DOM text nodes or the existing `AppCore.escapeHtml` at every release-data boundary.
- Keep user choices (view, weights, crew budget, theme) local to the page/session. They must not mutate a release.
- No production deployment. Staging is the acceptance target.

## File Responsibility Map

| File | Responsibility after migration |
| --- | --- |
| `public/release-schema.js` | Validate both the existing visual contract and the release-owned intelligence contract. |
| `public/intelligence.js` | Pure priority/route/CSV/answer functions plus all Intelligence workspace renderers and map overlays. |
| `public/app.js` | Own Lake Operations versus Intelligence mode, deep links, shared map lifecycle, and top-level navigation. |
| `public/bootstrap.js` | Own authenticated tenant/session loading, tenant switching, sign-out, and identity display. |
| `public/index.html` | Declare the shared application shell and every element required by the JavaScript contract. |
| `public/app.css` | Style the shared shell, intelligence controls, responsive layouts, focus states, and light/dark themes. |
| `tests/fixtures/full-legacy-release.json` | One complete, validated browser fixture including the producer-owned `intelligence` document. |
| `tests/release-schema.test.mjs` | Contract and fail-closed tests. |
| `tests/intelligence.test.mjs` | Pure calculation and renderer interaction tests. |
| `tests/app-release.test.mjs` | Workspace-mode lifecycle and deep-link tests. |
| `tests/bootstrap.test.mjs` | Tenant and sign-out behavior. |
| `tests/browser/full-release-workspace.spec.mjs` | Authenticated, real-browser parity path. |

---

### Task 1: Freeze the actual full-release contract in the client

**Files:**

- Modify: `public/release-schema.js`
- Modify: `tests/fixtures/full-legacy-release.json`
- Modify: `tests/release-schema.test.mjs`
- Modify: `tests/release-client.test.mjs`

**Existing producer contract:** `coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py` emits `giant-salvinia-intelligence-v1` with `sites`, `santee_reference`, `portfolio`, `deterministic_answers`, `csv_exports`, `reference`, and `claim_boundaries`.

- [ ] **Step 1: Add a failing complete-release test.**

  Add `intelligence` to the required full-release keys and assert the current fixture is rejected until it contains the producer-owned document.

  ```js
  test("requires intelligence for a complete replacement release", () => {
    const release = structuredClone(fullLegacyRelease);
    delete release.intelligence;
    const result = validateFullLegacyRelease(release);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /intelligence is required/);
  });
  ```

- [ ] **Step 2: Populate the fixture from the producer output.**

  Copy a complete generated `intelligence` object from the data-service full-release test output into `tests/fixtures/full-legacy-release.json`. Do not hand-invent a second schema or reduce it to a UI-specific mock. Confirm the fixture contains all 14 deterministic answer IDs, both CSV exports, Caddo and Santee site records, and the Sam Rayburn exclusion.

- [ ] **Step 3: Add the minimum strict browser validator.**

  Extend `validateFullLegacyRelease` with `validateIntelligence`. Validate fields the UI dereferences, exact site statuses (`operational`, `reference`, `excluded`), finite numeric metrics, unique cove IDs, route references to known coves, CSV column/row shape, citation IDs, non-empty claim boundaries, and the exact schema string. Reject URL/credential-looking values anywhere inside `intelligence`.

- [ ] **Step 4: Add negative contract cases.**

  Test a missing Caddo site, Santee marked operational, absent Sam Rayburn exclusion, duplicate cove ID, non-finite priority component, route stop for an unknown cove, malformed answer/citation, and a raw `s3://`, `r2://`, `https://...`, bearer token, or API-key-looking value.

- [ ] **Step 5: Run the contract checks.**

  Run: `npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs`

  Expected: PASS. The fixture classifies as `full`; every unsafe or incomplete intelligence mutation classifies as limited.

---

### Task 2: Port the legacy interactive logic as one dependency-free module

**Files:**

- Create: `public/intelligence.js`
- Create: `tests/intelligence.test.mjs`
- Modify: `public/index.html`

**Interface:** expose one global, matching the existing application style:

```js
window.AppIntelligence = {
  createWorkspace,
  recomputePriorities,
  buildCrewRoute,
  answerDeterministically,
  rowsToCsv,
};
```

- [ ] **Step 1: Write failing pure-function parity tests.**

  Use the complete release fixture. Assert:

  - Default weights preserve the release's priority ordering.
  - Changing one weight re-ranks from each cove's `priority_components` using `100 * weighted_mean(...)`.
  - Zero total weight falls back to the release defaults.
  - Crew budget is clamped to 1–32.
  - Crew candidates are `current_ha >= 1 || priority >= 55`, then ordered by nearest neighbor from the nearest released boat ramp with deterministic ID tie-breaking.
  - Known prompts return the corresponding `deterministic_answers` entry with citations and boundary.
  - Unknown prompts return an honest unmatched result.
  - CSV escapes quotes, commas, CR/LF, and formula-leading cells (`=`, `+`, `-`, `@`).

- [ ] **Step 2: Port only the verified legacy formulas.**

  Implement the functions directly from `giant_salvinia/salvinia_agent_source/console_template.html` and the release producer. Reuse `priority_components`, released assets, and deterministic answers. Do not recalculate scientific products such as growth, spread pressure, sensor placement, or EDRR in the browser.

- [ ] **Step 3: Add deterministic prompt matching.**

  Match the legacy suggested questions and conservative keyword aliases to an existing answer ID. Never synthesize a scientific answer. The unmatched state should invite the user to choose a supported question and must preserve the question text safely.

- [ ] **Step 4: Add the script to the existing shell.**

  Load `intelligence.js` after `core.js` and before `app.js`. Update `scripts/verify-assets.mjs` if it enumerates browser assets.

- [ ] **Step 5: Run the focused checks.**

  Run: `npm test -- tests/intelligence.test.mjs`

  Expected: PASS without browser or network access.

---

### Task 3: Add the native Intelligence workspace and map views

**Files:**

- Modify: `public/intelligence.js`
- Modify: `public/index.html`
- Modify: `public/app.css`
- Modify: `tests/intelligence.test.mjs`

**Views:** Overview, Map, Priorities, Sensors & Sampling, Infrastructure, Response Guidance, Portfolio, Methods & Data, and Ask.

- [ ] **Step 1: Add failing renderer coverage.**

  For every view, mount `createWorkspace` with the fixture and assert a single named heading, the expected release-owned content, visible provenance, and the applicable claim boundary. Assert Santee always says reference-only and Sam Rayburn always says excluded.

- [ ] **Step 2: Render Overview and Map.**

  Overview shows release date, detected extent, affected coves, leading priority, briefing, top actions, and status-aware portfolio cards. Map reuses the existing `AppCore.MapView` and Caddo geometry; its native layer selector colors released cove polygons by extent, growth, spread, infrastructure risk, uncertainty, or live priority. Selecting a row focuses its cove. Do not recreate a hex grid because no validated hex geometry exists in the release; the cove choropleth is the authenticated equivalent.

- [ ] **Step 3: Render live Priorities and crew planning.**

  Add five labelled native range inputs, the Balanced/Protect infrastructure/EDRR/Contain spread presets, ranking tabs, a 1–32 crew-budget number input, recomputed route, and CSV download. Announce re-ranking through a polite status region and retain keyboard focus after updates.

- [ ] **Step 4: Render science and infrastructure products.**

  Sensors & Sampling renders released sensor and species-confirmation plans with ranked markers. Infrastructure renders released assets and asset-threat scores. Every approximate/rough asset coordinate retains its confidence label.

- [ ] **Step 5: Render response guidance, portfolio, and methods.**

  Response Guidance combines released crew actions, EDRR rows, surges, emerging fronts, and rapid-decline candidates without promoting them to treatment proof. Portfolio shows Caddo operational, Santee reference-only, and Sam Rayburn excluded. Methods & Data exposes the released formula, provenance, citations, inventory count, and every claim boundary.

- [ ] **Step 6: Render Ask as a release-grounded drawer.**

  Preserve the legacy global-agent interaction: an open/close control, suggested prompts for executive brief, hotspots, sensors, crew deployment, EDRR, portfolio, and claim boundaries, plus a free-form field. Executive brief uses the existing tenant-scoped `requestBriefing`; all scientific questions use released deterministic answers. If the briefing endpoint fails, keep the drawer open and show the released briefing plus a bounded unavailable message.

- [ ] **Step 7: Verify accessibility and injection boundaries.**

  Test keyboard tab selection, Escape closing the agent drawer, labelled inputs, `aria-current`/`aria-selected`, focus restoration, visible focus rings, and malicious release strings rendered as text rather than markup.

- [ ] **Step 8: Run focused UI tests.**

  Run: `npm test -- tests/intelligence.test.mjs tests/views-render.test.mjs`

  Expected: PASS; every Intelligence capability works from one validated release.

---

### Task 4: Integrate Lake Operations and Intelligence into one product shell

**Files:**

- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/app.css`
- Modify: `tests/app-release.test.mjs`
- Modify: `tests/integration/full-release-workspace.test.mjs`

**Deep-link contract:**

- `?tenant=<id>&workspace=operations&beat=monitor|detect|operations|response|verification|deploy|hyperspectral`
- `?tenant=<id>&workspace=intelligence&intel=overview|map|priorities|science|infrastructure|guidance|portfolio|methods|ask`

- [ ] **Step 1: Add failing mode/deep-link tests.**

  Assert the default remains Lake Operations, both mode buttons are present, a valid Intelligence link selects its view, invalid values fall back safely, tenant and unrelated query parameters survive navigation, browser Back/Forward restores the mode, and repeated starts do not duplicate listeners or navigation.

- [ ] **Step 2: Add a two-mode product switcher.**

  Add `Lake Operations` and `Intelligence` controls above the local view navigation. Keep the existing seven Lake Operations beats unchanged. Mount one Intelligence workspace instance when selected and dispose its listeners/map layers when leaving it.

- [ ] **Step 3: Make URL ownership explicit.**

  `app.js` updates only `workspace`, `beat`, and `intel`; `bootstrap.js` continues to own `tenant`. Use `pushState` for user navigation and `replaceState` only for normalization. A single `popstate` path re-renders without re-authorizing locally.

- [ ] **Step 4: Preserve limited-release honesty.**

  A visual-only or malformed-intelligence release remains limited and cannot enter either complete replacement mode. Show the validator's missing capability labels. Do not let the existing visual branch silently mask a missing Intelligence contract.

- [ ] **Step 5: Run lifecycle tests.**

  Run: `npm test -- tests/app-release.test.mjs tests/integration/full-release-workspace.test.mjs`

  Expected: PASS; both modes coexist without regressing map/playback disposal.

---

### Task 5: Complete the authenticated shell behavior that still makes sense

**Files:**

- Modify: `public/auth-client.js`
- Modify: `public/bootstrap.js`
- Modify: `public/index.html`
- Modify: `public/app.css`
- Modify: `tests/auth-client.test.mjs`
- Modify: `tests/bootstrap.test.mjs`
- Modify: `tests/tenant-client.test.mjs`

- [ ] **Step 1: Add failing tenant/sign-out/theme tests.**

  Assert only accessible tenants appear, selecting one reloads its current release, a 403 refreshes accessible tenants, sign-out posts same-origin JSON with credentials then clears the workspace, and theme selection changes only a `data-theme` attribute plus session storage.

- [ ] **Step 2: Replace the bare selector with the authenticated lake switcher.**

  Keep the native `<select>` for accessibility. When the session has six or more accessible tenants, add a searchable workspace panel that filters `display_name` and `slug` client-side. Do not recreate the legacy public categories because the authorization response does not contain a validated category taxonomy.

- [ ] **Step 3: Add sign-out.**

  Add `signOut(apiBaseUrl)` to `auth-client.js`, posting `{}` to `/api/auth/sign-out` with `credentials: "include"`. On success dispose `window.demoApp`, clear tenant session storage, hide user identity, and return to the signed-out landing state. On failure retain the workspace and show an inline error.

- [ ] **Step 4: Add the native theme control.**

  Use CSS custom properties and `data-theme="dark|light"`; default to `prefers-color-scheme` when no session choice exists. No theme library and no server persistence.

- [ ] **Step 5: Run authentication-shell checks.**

  Run: `npm test -- tests/auth-client.test.mjs tests/bootstrap.test.mjs tests/tenant-client.test.mjs`

  Expected: PASS; no UI path manufactures or retains tenant authorization.

---

### Task 6: Add one real-browser legacy-parity acceptance path

**Files:**

- Modify: `tests/browser/full-release-workspace.spec.mjs`
- Modify: `package.json` only if the existing test script needs the file path corrected
- Modify: `scripts/verify-assets.mjs`

- [ ] **Step 1: Extend the local authenticated browser server.**

  Serve the complete intelligence fixture, implement the briefing and sign-out test routes, and record every API/asset request. Keep the existing cookie-gated tenant behavior.

- [ ] **Step 2: Exercise the complete replacement journey.**

  In Chrome:

  1. Load a deep-linked authorized tenant.
  2. Visit all seven Lake Operations views.
  3. Switch to Intelligence and visit all nine views.
  4. Change a priority weight and confirm ranking changes.
  5. Change crew budget and confirm the route changes.
  6. Download and inspect the CSV.
  7. Ask a known question and an unknown question.
  8. Open Santee context and confirm reference-only wording.
  9. Confirm Sam Rayburn has no operational navigation action.
  10. Switch tenant, use Back, toggle theme, and sign out.

- [ ] **Step 3: Assert security and lifecycle invariants.**

  Assert all release assets use the selected tenant/release route, no request reaches the legacy ELB or a model provider, no page errors occur, and sign-out prevents the next protected request.

- [ ] **Step 4: Run the full local gate.**

  Run: `npm run check && npm test && npm run build && npm run test:e2e`

  Expected: PASS with zero page errors and no external legacy runtime dependency.

---

### Task 7: Compare against the loaded legacy app and close only real gaps

**Files:**

- Modify only files already listed above when an acceptance gap is proven
- Update: `docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md` only if the approved scope itself changes

- [ ] **Step 1: Use the user's existing signed-in browser session.**

  Compare the legacy `/unified` application with the local replacement side by side. Record a compact matrix for: lake switching, Lake Operations beats, overview, map layers, priorities/presets, crew plan/CSV, sensors, sampling, infrastructure, response guidance, portfolio, methods/provenance, agent prompts, theme, identity, and sign-out.

- [ ] **Step 2: Classify each apparent gap before coding.**

  Mark it as one of: already present; native authenticated equivalent; intentionally excluded by evidence/auth boundary; or missing. Implement only `missing` items. In particular, do not add an iframe, public unauthorized site directory, fabricated hex layer, operational Sam Rayburn view, or browser model credential.

- [ ] **Step 3: Add one failing regression per confirmed gap.**

  Reproduce the gap in the smallest existing test, implement the fix at the shared root, then rerun the focused and full gates.

- [ ] **Step 4: Re-run the full local gate.**

  Run: `npm run check && npm test && npm run build && npm run test:e2e`

  Expected: PASS after the browser comparison matrix has no unexplained missing capability.

---

### Task 8: Deploy and verify staging as the replacement candidate

**Files:**

- No planned source files

- [ ] **Step 1: Inspect the exact release unit.**

  Run: `git status --short`

  State every dirty file. Do not deploy unrelated changes. Confirm the active staging release contains `intelligence.schema === "giant-salvinia-intelligence-v1"`; otherwise stop and report the release prerequisite instead of weakening the client.

- [ ] **Step 2: Deploy the complete static application to staging.**

  Run: `npm run deploy:staging`

  Record the Worker/version identifier and routed URL from Wrangler. Do not deploy production.

- [ ] **Step 3: Verify the routed authenticated flow.**

  With the intended tenant user, repeat the Task 6 journey against the routed staging URL. Capture the current-manifest request, selected tenant ID, release ID/source revision, any `x-request-id`, console errors, and failed network requests.

- [ ] **Step 4: Verify authorization boundaries.**

  Confirm signed-out access returns the landing/sign-in experience, another authorized tenant cannot reuse the first tenant's release or asset URLs, and Santee/Sam Rayburn remain bounded exactly as specified.

- [ ] **Step 5: Report completion only with evidence.**

  Report the commands that passed, staging URL, version, authenticated tenant/release IDs, and browser acceptance result. If any exact authenticated flow fails, keep the task open with its request ID and reproducible step.

## Completion Criteria

- The replacement has no iframe or runtime dependency on the legacy ELB.
- The full release is rejected unless both visual and intelligence contracts validate.
- Every existing Lake Operations view still works.
- Every Intelligence view, live priority control, crew plan, CSV export, map interaction, and deterministic agent prompt works from the active release.
- Accessible-tenant switching, identity, theme, Back/Forward, and sign-out work.
- Caddo/Santee/Sam Rayburn evidence states cannot be confused.
- `npm run check && npm test && npm run build && npm run test:e2e` passes.
- The exact authenticated staging journey passes and its release/version evidence is recorded.

## Explicitly Deferred

- Optional generative answers. The deterministic release-owned agent plus the existing protected briefing endpoint covers the replacement requirement; add a new model endpoint only after a separate approved design.
- A synthetic hex grid. Add it only when a verified release publishes grid geometry/metrics.
- Public discovery of unauthorized lakes or speculative product categories.
- Production deployment.
