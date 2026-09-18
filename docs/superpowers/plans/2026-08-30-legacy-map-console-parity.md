# Legacy Map Console Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated Caddo application open into the legacy-style map operations console, driven entirely by a new immutable release built from the complete public Caddo source.

**Architecture:** Extend the existing public-data processor with one versioned `console` document and release-owned raster layers for the 57 already-selected monitoring observations. Add one dependency-free browser module that renders the map console while reusing the current tenant discovery, release loader, Leaflet map, authentication, and guided workspace. Older releases continue to open the current guided workspace; a validated console-capable release opens the map console by default.

**Tech Stack:** Python, NumPy, Rasterio, Pillow, existing Cloudflare/R2 immutable-release workflow, browser JavaScript, CSS, Leaflet, Node test runner, Playwright Core. Add no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-30-legacy-map-console-design.md`

## Global Constraints

- Use only Element 84 Earth Search Sentinel-2 L2A data and public USGS hydrography. Never read the legacy AWS account.
- Do not mutate release `e57e3484-45c3-4d5e-821b-eadd45ee0d97`; keep it as the rollback target.
- All displayed values and rasters must be processor outputs covered by the immutable manifest. Fixtures are tests, never staging acceptance data.
- Preserve the existing guided Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy, and gated Hyperspectral views.
- Show only tenants returned by `/api/tenants/accessible`; do not recreate unauthorized legacy sites.
- Keep floating-vegetation and change-signal claim boundaries. Do not relabel detections as confirmed giant salvinia or declines as treatment effects.
- Fail closed on malformed console data. Never render partial metrics or silently substitute zero for missing values.
- Keep the browser credential-free. Asset references remain tenant-authorized logical release files.
- Add no basemap, charting, UI, or image-comparison dependency.
- Staging is the deployment target. Production is out of scope.

## File Responsibility Map

| Repository / file | Responsibility after this work |
| --- | --- |
| `../coactive_data_service/containers/salvinia-heavy/app/salvinia/indices.py` | Calibrated B12 and AFAI calculation alongside existing spectral indices. |
| `../coactive_data_service/containers/salvinia-heavy/app/salvinia/store.py` | Backward-compatible prepared-v2 scene arrays with the indices needed by the console. |
| `../coactive_data_service/containers/salvinia-heavy/app/salvinia/public_archive.py` | Write a new immutable prepared-v2 public bundle without changing prepared-v1. |
| `../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py` | Read prepared-v1/v2, validate the console contract, and retain old release compatibility. |
| `../coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py` | Compute observation metrics/samples and render the six console layers. |
| `../coactive_data_service/containers/salvinia-heavy/app/test_runner.py` | Processor, prepared-format, payload, asset, and compatibility regressions. |
| `../coactive_data_service/containers/salvinia-heavy/app/test_public_archive.py` | Public-bundle and real-output invariant checks. |
| `public/release-schema.js` | Strict browser validation for `giant-salvinia-map-console-v1`. |
| `public/console.js` | Console state, timeline, inspector, layer controls, and Leaflet overlays. |
| `public/core.js` | Minimal named-layer support in the existing `MapView`. |
| `public/app.js` | Default console / secondary briefing routing and shared lifecycle. |
| `public/bootstrap.js` | Authorized site rail, tenant changes, identity, and logout orchestration. |
| `public/auth-client.js` | Same-origin authenticated sign-out request. |
| `public/index.html` | Header, site rail, map, inspector, mobile drawer, and existing briefing shell. |
| `public/app.css` | Screenshot-shaped desktop layout and responsive/accessibility states. |
| `tests/fixtures/full-legacy-release.json` | Small deterministic console-capable contract fixture. |
| `tests/release-schema.test.mjs` | Console validation and fail-closed cases. |
| `tests/console.test.mjs` | Console state and DOM behavior. |
| `tests/app-release.test.mjs` | Console/briefing routing and lifecycle. |
| `tests/bootstrap.test.mjs` | Authorized site rail, tenant changes, and logout. |
| `tests/browser/full-release-workspace.spec.mjs` | Real-browser layout and synchronized interaction path. |

---

### Task 1: Add the missing spectral fields without changing existing science

**Files:**

- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/indices.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/store.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/test_runner.py`

**Interfaces:**

- Produces scene arrays `ndwi`, `fai`, `afai`, and `B12` in addition to the current prepared fields.
- Keeps the existing NDVI/MNDWI detector thresholds and detection results unchanged.

- [ ] **Step 1: Write failing formula and ingest tests.**

  Add a synthetic reflectance test with known B03, B04, B8A, B11, and B12 values:

  ```python
  def test_scene_computes_afai_from_the_red_b8a_b12_baseline(self):
      scene = indices.Scene(
          product=None,
          grid=self.grid,
          refl={
              "B03": np.array([[0.10]], dtype="float32"),
              "B04": np.array([[0.08]], dtype="float32"),
              "B05": np.array([[0.11]], dtype="float32"),
              "B8A": np.array([[0.20]], dtype="float32"),
              "B11": np.array([[0.04]], dtype="float32"),
              "B12": np.array([[0.02]], dtype="float32"),
          },
          scl=np.array([[6]], dtype="uint8"),
          coverage=np.array([[True]]),
      )
      slope = (865 - 665) / (2190 - 665)
      assert_allclose(scene.afai, [[0.20 - (0.08 + (0.02 - 0.08) * slope)]])
  ```

  Assert `ingest_verified` persists all four new fields and that NDVI/MNDWI/detected-pixel results match the pre-change fixture.

- [ ] **Step 2: Run the focused test and observe failure.**

  Run:

  ```bash
  cd ../coactive_data_service/containers/salvinia-heavy/app
  python -m unittest test_runner.FullReleaseCompilerTests
  ```

  Expected: FAIL because `Scene.afai`, B12 loading, and the prepared fields do not exist.

- [ ] **Step 3: Implement the calibrated fields.**

  In `indices.py`, add B12 to `BANDS`/`WAVELENGTH_NM`, expose `afai`, and continue using B8A on the common 20 m grid:

  ```python
  BANDS = ("B03", "B04", "B05", "B8A", "B11", "B12")
  WAVELENGTH_NM = {
      "B03": 560, "B04": 665, "B05": 705,
      "B8A": 865, "B11": 1610, "B12": 2190,
  }

  @cached_property
  def afai(self) -> np.ndarray:
      return self._baseline_index("B12")
  ```

  In `ingest_verified`, persist `ndwi`, `fai`, `afai`, and `B12` as float32 arrays. Do not change the existing domain or detector formulas.

- [ ] **Step 4: Make prepared validation explicitly versioned.**

  Keep the current field set as `PREPARED_V1_LAYERS`; add `PREPARED_V2_LAYERS`. Change `_valid_prepared_scene(path, shape, format)` to require the exact set for the declared format. Do not accept a mixed or inferred field set.

- [ ] **Step 5: Run the focused tests.**

  Run the Task 1 command again. Expected: PASS, including the unchanged detector assertions.

- [ ] **Step 6: Commit the processor change.**

  ```bash
  cd ../coactive_data_service
  git add containers/salvinia-heavy/app/salvinia/indices.py containers/salvinia-heavy/app/salvinia/store.py containers/salvinia-heavy/app/test_runner.py
  git commit -m "feat: retain console spectral fields"
  ```

---

### Task 2: Publish a backward-compatible prepared-v2 public source bundle

**Files:**

- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/public_archive.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/runner.py`
- Modify: `../coactive_data_service/src/salvinia-run.ts`
- Modify: `../coactive_data_service/tests/salvinia-run.test.ts`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/test_runner.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/test_public_archive.py`

**Interfaces:**

- Consumes Task 1's exact prepared-v2 arrays.
- Produces source manifest format `prepared-v2` and source revision `earth-search-through-2026-07-31-14329ffb-console-v1` for the same 672 public acquisitions.

- [ ] **Step 1: Add failing manifest-format tests.**

  Assert the new bundle contains:

  ```json
  {
    "format": "prepared-v2",
    "sourceRevision": "earth-search-through-2026-07-31-14329ffb-console-v1"
  }
  ```

  Assert every scene has the prepared-v2 field set, the acquisition count remains 672, the public-inventory SHA remains unchanged, and prepared-v1 still validates through the existing reader.

- [ ] **Step 2: Run the public-archive and Worker contract tests and observe failure.**

  ```bash
  cd ../coactive_data_service
  cd containers/salvinia-heavy/app && python -m unittest test_public_archive && cd ../../..
  npm test -- tests/salvinia-run.test.ts
  ```

  Expected: FAIL because only `prepared-v1` is accepted.

- [ ] **Step 3: Write prepared-v2 without overwriting prepared-v1.**

  Parameterize `write_prepared_bundle` with the declared format and revision. For this console build, write `coactive-caddo-prepared-v2` metadata and a new prefix ending in `-console-v1/`. Preserve all existing prepared-v1 branches for rollback and old tests.

- [ ] **Step 4: Extend request and runner validation narrowly.**

  Accept only `prepared-v1` or `prepared-v2` in the TypeScript request schema and Python runner. Pass the declared format to `_valid_prepared_scene`; reject mixed field sets, unknown formats, and a v2 revision using a v1 manifest.

- [ ] **Step 5: Run the focused checks.**

  Run the Task 2 commands. Expected: PASS for v1 compatibility, v2 completeness, and the unchanged 672-acquisition contract.

- [ ] **Step 6: Commit the versioned source format.**

  ```bash
  cd ../coactive_data_service
  git add containers/salvinia-heavy/app/salvinia/public_archive.py containers/salvinia-heavy/app/salvinia/full_release.py containers/salvinia-heavy/app/runner.py containers/salvinia-heavy/app/test_runner.py containers/salvinia-heavy/app/test_public_archive.py src/salvinia-run.ts tests/salvinia-run.test.ts
  git commit -m "feat: add prepared v2 Caddo source"
  ```

---

### Task 3: Compile the real map-console payload and layers

**Files:**

- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/test_runner.py`
- Modify: `../coactive_data_service/containers/salvinia-heavy/app/test_public_archive.py`

**Interfaces:**

- Consumes `monitor.frames`, prepared-v2 scene arrays, record product names, the water-capable domain, and the six released `sampling_plan` coordinates.
- Produces `console.schema === "giant-salvinia-map-console-v1"` and six logical layer assets for each of the same 57 monitor observations.

- [ ] **Step 1: Add failing payload invariants.**

  Add assertions equivalent to:

  ```python
  console = payload["console"]
  self.assertEqual(console["schema"], "giant-salvinia-map-console-v1")
  self.assertEqual(
      [(row["id"], row["date"]) for row in console["observations"]],
      [(row["id"], row["date"]) for row in payload["monitor"]["frames"]],
  )
  self.assertEqual(len(console["observations"]), 57)
  self.assertTrue(all(len(row["samples"]) == 6 for row in console["observations"]))
  self.assertTrue(all(set(row["layers"]) == {
      "base", "intensity", "zones", "coverage", "footprint", "water"
  } for row in console["observations"]))
  ```

  Also assert all metric values are finite numbers or `None`, `water_pixels` is a non-negative integer, granules match the selected record's declared products, and every file is present exactly once in the release asset map.

- [ ] **Step 2: Run the compiler test and observe failure.**

  ```bash
  cd ../coactive_data_service/containers/salvinia-heavy/app
  python -m unittest test_runner.FullReleaseCompilerTests
  ```

  Expected: FAIL because `console` is absent.

- [ ] **Step 3: Add pure observation summary helpers.**

  In `historical.py`, implement `_finite_mean`, `_sample_window`, `_granules`, and `_console_observation`. Use:

  ```python
  metric_mask = ingest.basin & scene["valid"]
  water = metric_mask & np.isfinite(scene["mndwi"]) & (scene["mndwi"] > 0)
  metrics = {
      "fai_mean": _finite_mean(scene["fai"], metric_mask),
      "ndvi_mean": _finite_mean(scene["ndvi"], metric_mask),
      "ndwi_mean": _finite_mean(scene["ndwi"], metric_mask),
      "mndwi_mean": _finite_mean(scene["mndwi"], metric_mask),
      "afai_mean": _finite_mean(scene["afai"], metric_mask),
      "water_pixels": int(water.sum()),
  }
  ```

  Round index means to four decimals. Convert each record product name into `{satellite, tile, product_id}` using the existing Sentinel product-name parser; do not parse it again with a second regex.

- [ ] **Step 4: Compute the six real sample rows.**

  Reuse `intelligence.sites[caddo].sampling_plan` in rank order. Convert each lon/lat through the scene grid transform, select pixels whose centers fall within 50 m, and calculate FAI mean/max over valid pixels. Emit `None` for both values when the window has no valid pixel. Keys are deterministic `pt-001` through `pt-006`.

- [ ] **Step 5: Render the six layer assets.**

  Reuse the existing presentation grid, reprojection, Pillow encoder, and natural-color function. Emit one base WebP plus transparent WebPs for:

  - intensity: NDVI over the existing water-capable domain, transparent at or below 0.4;
  - zones: open water, water-capable domain, and detected floating vegetation;
  - coverage: `scene.coverage & basin`;
  - footprint: `scene.valid & basin`;
  - water: `scene.valid & basin & (scene.mndwi > 0)`.

  Do not add a renderer class or dependency; small functions beside `_composite` are sufficient.

- [ ] **Step 6: Require console only for prepared-v2.**

  `build_legacy_compatible_payload` must require and validate `console` for prepared-v2. Prepared-v1 continues producing `giant-salvinia-legacy-v2` without console. Prepared-v2 produces `giant-salvinia-legacy-v3` and adds every console file to the existing manifest/checksum path.

- [ ] **Step 7: Strengthen functional parity.**

  For v3 releases, extend `validate_functional_parity` with 57 console observations, exact monitor ID/date equality, six samples per observation, six layers per observation, non-empty granules, and finite-or-null metrics. Keep all existing 140-cove, response, verification, route, sampling, EDRR, and hyperspectral gates.

- [ ] **Step 8: Run processor tests.**

  ```bash
  cd ../coactive_data_service/containers/salvinia-heavy/app
  python -m unittest test_runner.FullReleaseCompilerTests test_public_archive.PublicArchiveTests
  ```

  Expected: PASS with no change to existing detector outputs.

- [ ] **Step 9: Commit the console publisher.**

  ```bash
  cd ../coactive_data_service
  git add containers/salvinia-heavy/app/salvinia/historical.py containers/salvinia-heavy/app/salvinia/full_release.py containers/salvinia-heavy/app/test_runner.py containers/salvinia-heavy/app/test_public_archive.py
  git commit -m "feat: publish Caddo map console assets"
  ```

---

### Task 4: Validate the console release contract in the browser

**Files:**

- Modify: `public/release-schema.js`
- Modify: `tests/fixtures/full-legacy-release.json`
- Modify: `tests/release-schema.test.mjs`

**Interfaces:**

- Consumes the Task 3 JSON contract after the release client resolves logical `file` values.
- Produces `validation.capabilities.console === true` only for a complete, safe console document.

- [ ] **Step 1: Add a small console-capable fixture.**

  Extend the existing fixture with three observations matching its three monitor frames, two granules per observation, six samples, finite metrics, and the six resolved layer URLs. Keep it intentionally small; it is a contract fixture, not acceptance evidence.

- [ ] **Step 2: Add failing strict-validation tests.**

  Cover: missing observation, monitor mismatch, duplicate ID/date, unknown metric key, `NaN`/infinity, negative or non-integer water pixels, malformed granule, duplicate sample key, sample outside bounds, unknown layer, missing layer, unregistered URL, and unsafe scheme.

  ```js
  test("console observations must match monitor observations", () => {
    const release = structuredClone(fullLegacyRelease);
    release.console.observations[0].id = "different-scene";
    const result = validateFullLegacyRelease(release);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /console observations must match monitor frames/);
  });
  ```

- [ ] **Step 3: Implement `validateConsole`.**

  Validate only fields the UI dereferences, exact schema/layer names, finite-or-null index metrics, bounds, unique IDs, and the exact monitor ID/date sequence. Reuse `requireAsset`, `requireBounds`, `requireLonlat`, and the existing URL/credential protections.

- [ ] **Step 4: Preserve older-release behavior.**

  A valid v2 full release without console remains `full` with `capabilities.console === false`. A v3 release without a valid console is rejected, not downgraded silently.

- [ ] **Step 5: Run contract tests.**

  ```bash
  npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
  ```

  Expected: PASS.

- [ ] **Step 6: Commit the client contract.**

  ```bash
  git add public/release-schema.js tests/fixtures/full-legacy-release.json tests/release-schema.test.mjs
  git commit -m "feat: validate map console releases"
  ```

---

### Task 5: Build one native map-console module

**Files:**

- Create: `public/console.js`
- Create: `tests/console.test.mjs`
- Modify: `public/core.js`
- Modify: `public/index.html`
- Modify: `scripts/verify-assets.mjs`

**Interfaces:**

```js
window.AppConsole = {
  create({ root, map, release, onOpenBriefing }),
};

// Returned controller
{
  selectObservation(id),
  setMode("intensity" | "zones"),
  setSignal("coverage" | "footprint" | "water", enabled),
  dispose(),
}
```

- [ ] **Step 1: Write failing state/DOM tests.**

  Test the default latest observation, Intensity mode, all signals off, one selected date/timeline point, synchronized metrics/granules/source/samples, preserved signal state after changing date, and complete listener/layer disposal.

- [ ] **Step 2: Add named overlays to `MapView`.**

  Replace the single raster group with `base`, `mode`, and `signals` groups while retaining `raster(frame, bounds)` for existing views. Add only:

  ```js
  setConsoleLayers({ base, mode, signals, bounds })
  clearConsoleLayers()
  ```

  Existing guided views must continue calling `raster` unchanged.

- [ ] **Step 3: Render the inspector without a chart dependency.**

  Build the FAI timeline as an accessible inline SVG polyline and buttons. Its x-axis follows observation order; its y-domain includes zero and the finite FAI range. Each point is a real `<button>` in the adjacent date list and the SVG point has the same accessible label. Missing FAI produces a gap, not zero.

- [ ] **Step 4: Render controls and synchronized details.**

  Use native buttons and checkboxes for mode/signals. On selection, call `map.setConsoleLayers`, then replace the metric cards, granule chips, sample table, date selected state, and source scene text from that one observation object.

- [ ] **Step 5: Add semantic shell elements.**

  Add `#console-workspace`, `#console-layer-control`, `#console-inspector`, `#console-timeline`, `#console-metrics`, `#console-granules`, `#console-observations`, `#console-source`, and `#console-samples` to `index.html`. Load `console.js` after `core.js` and before `app.js`. Keep the existing map and guided panel rather than creating a second Leaflet instance.

- [ ] **Step 6: Verify keyboard and unsafe text behavior.**

  Test arrow-key movement through observations, Space/Enter for checkboxes/tabs, visible selected state, polite observation-change announcement, and release strings rendered with text nodes/`escapeHtml`.

- [ ] **Step 7: Run focused tests.**

  ```bash
  npm test -- tests/console.test.mjs tests/views-render.test.mjs
  npm run build
  ```

  Expected: PASS and asset verification includes `console.js`.

- [ ] **Step 8: Commit the console component.**

  ```bash
  git add public/console.js public/core.js public/index.html scripts/verify-assets.mjs tests/console.test.mjs
  git commit -m "feat: add legacy-style map console"
  ```

---

### Task 6: Make the console the authenticated default without losing the guided workspace

**Files:**

- Modify: `public/app.js`
- Modify: `public/bootstrap.js`
- Modify: `public/auth-client.js`
- Modify: `public/index.html`
- Modify: `tests/app-release.test.mjs`
- Modify: `tests/bootstrap.test.mjs`
- Modify: `tests/auth-client.test.mjs`
- Modify: `tests/integration/full-release-workspace.test.mjs`

**Routing contract:**

- `?tenant=<id>&workspace=console&observation=<id>` — map console.
- `?tenant=<id>&workspace=briefing&beat=<existing-beat>` — current guided workspace.
- Console-capable releases default to `workspace=console` and their latest observation.
- Older v2 releases default to the current briefing behavior.

- [ ] **Step 1: Add failing route/lifecycle tests.**

  Assert default selection, explicit briefing links, observation deep links, invalid observation fallback, Back/Forward, tenant parameter preservation, no duplicate listeners on reload, and disposal when switching workspaces/tenants.

- [ ] **Step 2: Add console/briefing switch controls.**

  Let `app.js` own only these two workspaces. Mount `AppConsole.create` for console and the existing beat renderer for briefing. Reuse the same `MapView`; call the active controller's `dispose` before switching.

- [ ] **Step 3: Render the authorized site rail in bootstrap.**

  Extend `browserTenantSwitcher().render` to populate `#site-list` from the same `tenants` array used by the native select. Each site button uses the tenant ID already returned by the API and triggers the existing tenant-selection/reload path. Keep the `<select>` as the compact/mobile control.

- [ ] **Step 4: Add logout using the existing auth boundary.**

  Add:

  ```js
  export async function signOut(apiBaseUrl, fetcher = fetch) {
    const response = await fetcher(new URL("/api/auth/sign-out", apiBaseUrl), {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw await responseError(response);
  }
  ```

  On success dispose the app, clear tenant session storage, hide identity, and rerun the existing signed-out bootstrap. On failure keep the workspace visible and show an inline error.

- [ ] **Step 5: Run integration tests.**

  ```bash
  npm test -- tests/auth-client.test.mjs tests/bootstrap.test.mjs tests/app-release.test.mjs tests/integration/full-release-workspace.test.mjs
  ```

  Expected: PASS.

- [ ] **Step 6: Commit the integrated shell.**

  ```bash
  git add public/app.js public/bootstrap.js public/auth-client.js public/index.html tests/app-release.test.mjs tests/bootstrap.test.mjs tests/auth-client.test.mjs tests/integration/full-release-workspace.test.mjs
  git commit -m "feat: make map console the default workspace"
  ```

---

### Task 7: Match the legacy desktop composition and keep it usable responsively

**Files:**

- Modify: `public/app.css`
- Modify: `tests/browser/full-release-workspace.spec.mjs`
- Modify: `tests/landing-layout.test.mjs`

- [ ] **Step 1: Add failing real-browser layout assertions.**

  At 1891×891 and 1554×774, assert: header spans the viewport; site rail is left of the map; inspector is right of the map; map occupies at least 55% of viewport width and all space below the header; layer control overlays the map; no horizontal document scroll exists.

- [ ] **Step 2: Implement the screenshot-shaped desktop grid.**

  Use one CSS grid:

  ```css
  .app-shell { grid-template-rows: 54px minmax(0, 1fr); }
  .console-layout {
    display: grid;
    grid-template-columns: 306px minmax(0, 1fr) 365px;
    min-height: 0;
  }
  ```

  Match the legacy information density, dark header/site rail, white inspector, compact controls, and dominant map. Reuse existing colors and system fonts; do not add a design system.

- [ ] **Step 3: Add two responsive states.**

  Below 1100 px, collapse the site rail behind a labelled Sites button. Below 760 px, make the inspector a focus-trapped bottom drawer and keep the map at least 55svh tall. Respect `prefers-reduced-motion`.

- [ ] **Step 4: Add accessibility checks.**

  Verify logical tab order, landmark labels, 44 px touch targets on narrow screens, visible focus, Escape closing drawers, focus restoration, and inspector content remaining available at 200% zoom.

- [ ] **Step 5: Capture review screenshots.**

  Have Playwright write `test-results/legacy-console-1891x891.png` and `test-results/legacy-console-1554x774.png`. Compare them side by side with the user-supplied references. Do not add pixel-comparison software; the DOM geometry assertions are the automated gate.

- [ ] **Step 6: Run the complete frontend gate.**

  ```bash
  npm run check
  npm test
  npm run build
  npm run test:e2e
  ```

  Expected: PASS with zero page errors, zero external legacy requests, and no browser-held storage credential.

- [ ] **Step 7: Commit the visual contract.**

  ```bash
  git add public/app.css tests/browser/full-release-workspace.spec.mjs tests/landing-layout.test.mjs
  git commit -m "style: restore legacy map console layout"
  ```

---

### Task 8: Build, publish, deploy, and accept one real staging release

**Files:**

- Modify only version/config fields proven necessary by the new prepared-v2 source and v3 release.
- Record: `../coactive_data_service/docs/releases/<acceptance-date>-caddo-map-console.md`

- [ ] **Step 1: Run both repository gates before external writes.**

  ```bash
  cd ../coactive_data_service
  npm run verify
  npm run verify:staging:config
  cd ../giant_salvinia_v2
  npm run check && npm test && npm run build && npm run test:e2e
  ```

  Expected: PASS.

- [ ] **Step 2: Inspect release units and authenticate staging.**

  Run `git status --short` in both repositories and state every dirty file. Do not deploy unrelated changes. In `coactive_data_service`, run `npx wrangler whoami` and require account `0d80409324f0ffb6c359817bbb92d95b`.

- [ ] **Step 3: Build the prepared-v2 bundle from the existing public inventory.**

  Re-run the existing public-archive build for all 672 basin-usable acquisitions and public hydrography, producing revision `earth-search-through-2026-07-31-14329ffb-console-v1`. Verify every source object checksum and confirm no request targets the legacy AWS account.

- [ ] **Step 4: Upload and submit exactly one authenticated legacy-release job.**

  Use the supported tenant ingestion/retry path with the prepared-v2 source. Record the new job ID, Workflow instance, source prefix/revision, and new immutable release ID. Do not retry while an attempt is active.

- [ ] **Step 5: Verify the new immutable release before activation.**

  Require:

  - 672 acquisitions, 140 coves, 57 monitor frames, and 57 matching console observations;
  - all six console layers and six samples for every observation;
  - populated finite-or-null spectral metrics and real product IDs;
  - 4 response frames, 5 verification candidates, 6 sampling sites, 8 crew stops, 15 EDRR candidates, and explicit hyperspectral gating;
  - every payload/asset reference present in the manifest with matching byte size and SHA-256.

- [ ] **Step 6: Deploy the data service staging release.**

  From `coactive_data_service`, use `npm run deploy:staging`. Then require `/ready`, `npm run verify:staging:ui`, binding inspection for the deployed version, and the exact authenticated release/asset requests. Capture `x-request-id` for any failure.

- [ ] **Step 7: Deploy the frontend staging release.**

  From `giant_salvinia_v2`, deploy with `npm run deploy:staging`. Record the version ID and confirm the routed URL serves the new HTML, CSS, `console.js`, and existing application modules as one release unit.

- [ ] **Step 8: Perform authenticated staging acceptance.**

  With the intended tenant user:

  1. Open Caddo and confirm the console is the default.
  2. Select all 57 dates through timeline/date controls and sample early, middle, and latest assets.
  3. Toggle Intensity/Zones and each observation signal; confirm a distinct manifest asset request and visible map change.
  4. Confirm metrics, six sample rows, granules, and source scene change with observation selection.
  5. Switch to every existing briefing beat and back without page errors.
  6. Confirm only authorized sites appear, tenant switching cannot reuse an asset URL, and logout ends the session.
  7. Repeat the two desktop viewport checks and one narrow viewport check.

- [ ] **Step 9: Record evidence and rollback.**

  Write the acceptance record with commit SHAs, Worker versions, image digest, job/workflow/release IDs, source revision, manifest digest, commands, request IDs, screenshot paths, and result. Record `e57e3484-45c3-4d5e-821b-eadd45ee0d97` as the rollback target. Report success only after the authenticated routed path passes.

---

## Self-Review Results

- **Spec coverage:** Tasks 1–3 provide actual public-data metrics/layers and a new immutable release; Tasks 4–7 provide the legacy map shell, synchronization, authorization, routing, responsiveness, and logout; Task 8 proves the complete authenticated staging path and rollback.
- **Compatibility:** prepared-v1 and legacy-v2 remain readable; the current accepted release remains immutable and usable.
- **No fabricated parity:** the plan does not copy legacy numbers, sites, imagery, or credentials. Missing pixels remain null; every displayed artifact is processor-owned.
- **Dependency check:** no new runtime or test dependency is required.
