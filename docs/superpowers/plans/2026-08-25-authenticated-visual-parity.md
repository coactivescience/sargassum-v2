# Authenticated Legacy Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restore the complete Caddo visual experience in the authenticated tenant app once a checksum-verified full legacy release is promoted.

**Architecture:** Keep the current manifest and signed-asset client as the sole data boundary. Add a small, pure full-release validator, then make the existing visual application render the historical Monitor, Detect, response, verification, deployment, and gated hyperspectral views from the verified payload. A one-acquisition scientific fixture remains visibly limited rather than masquerading as the full application.

**Tech Stack:** Browser JavaScript, Leaflet, existing CSS and view modules, Node test runner, Playwright for authenticated staging acceptance.

**Spec:** docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md

## Global Constraints

- Do not put R2, AWS, or admin credentials in browser code.
- Render only payload data and provenance that the promoted release supplies.
- Caddo detection labels remain floating vegetation rather than a species confirmation.
- Preserve the tenant-scoped manifest request and signed asset URLs supplied by the service.
- A summary-only fixture must show an explicit limited-release state; it must not remove the navigation without explanation.

---

### Task 1: Define and test the full visual release contract

**Files:**

- Create: public/release-schema.js
- Create: tests/release-schema.test.mjs
- Create: tests/fixtures/full-legacy-release.json
- Create: tests/fixtures/summary-release.json
- Modify: public/release-client.js

**Interfaces:**

- Exports: `validateFullLegacyRelease(payload) -> { ok, errors }`
- Full visual keys: `meta`, `sites`, `caddo_geometry`, `monitor`, `detect`, `response`, `verification`, `hyperspectral`, and `evidence`
- Client result: `{ kind: "full" | "limited", release, validation }`

- [ ] **Step 1: Write failing schema tests from portable fixtures.**

~~~
import { validateFullLegacyRelease } from "../public/release-schema.js";

test("accepts the complete verified Caddo visual payload", () => {
  const result = validateFullLegacyRelease(fullLegacyRelease);
  assert.equal(result.ok, true);
});

test("classifies the one-acquisition fixture as limited", () => {
  const result = validateFullLegacyRelease(summaryRelease);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor/i);
});
~~~

The full fixture contains the smallest representative frame, detection, treatment, verification, deployment, and hyperspectral records needed to exercise every renderer. File values use already-authorized test URLs, never production URLs.

- [ ] **Step 2: Implement a data-only validator.**

Reject malformed dates, non-array timelines, missing Caddo geometry, absolute raw-storage keys, and frames whose resolved asset fields are absent. Do not use `eval`, execute release text, or make network requests while validating. Return every missing field so the limited-release message can be useful to operators.

- [ ] **Step 3: Make release-client preserve the verified manifest boundary.**

After the current service response has resolved registered asset keys to authorized URLs, classify it with `validateFullLegacyRelease`. Do not let the browser construct object-store URLs or accept a file reference that the manifest did not register.

- [ ] **Step 4: Run focused tests.**

Run: `npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs`

Expected: PASS; only a complete fixture receives `kind: "full"`.

### Task 2: Restore the full workspace lifecycle and navigation

**Files:**

- Modify: public/app.js
- Modify: public/bootstrap.js
- Modify: public/index.html
- Modify: public/app.css
- Modify: tests/app-release.test.mjs

**Interfaces:**

- Full release navigation: Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy, and (when present) Hyperspectral.
- Deep link: `?beat=monitor|detect|ops|response|verification|deploy|hyperspectral`
- Limited state: named `release-status` panel with release version, acquisition count, missing capabilities, and publication guidance.

- [ ] **Step 1: Replace the staged-release regression test with two explicit behaviors.**

~~~
test("full release starts the complete visual workspace", () => {
  startSalviniaApp({ release: fullLegacyRelease });
  assert.match(nav.textContent, /Monitor/);
  assert.match(nav.textContent, /Plan Response/);
  assert.equal(map.hidden, false);
});

test("limited release stays honest about unavailable visual modules", () => {
  startSalviniaApp({ release: summaryRelease });
  assert.match(document.querySelector("#release-status").textContent, /complete release/i);
  assert.equal(nav.querySelectorAll("button").length, 0);
});
~~~

- [ ] **Step 2: Remove `isScientificRelease` as the production gate.**

Use the schema result rather than the old `!payload.monitor` heuristic. For `kind: "full"`, initialize the normal Leaflet map and the full navigation. For `kind: "limited"`, render the limited state without hiding the app shell or fabricating visual history.

- [ ] **Step 3: Preserve query-state and accessibility behavior.**

Validate `beat` against the available navigation items, select Monitor by default, update the URL with `history.replaceState`, mark the active tab with `aria-current="page"`, and move focus to the new view heading after a keyboard tab selection.

- [ ] **Step 4: Run application lifecycle tests.**

Run: `npm test -- tests/app-release.test.mjs tests/bootstrap.test.mjs`

Expected: PASS; both full and limited states are stable on refresh and bad deep links fall back to Monitor.

### Task 3: Port each legacy visual view to the verified payload

**Files:**

- Modify: public/views.js
- Modify: public/core.js
- Modify: public/app.css
- Modify: tests/views-render.test.mjs
- Create: tests/fixtures/full-legacy-view-data.json

**Interfaces:**

- `renderMonitor`, `renderDetect`, `renderOps`, `renderResponse`, `renderVerification`, `renderDeploy`, `renderHyperspectral`
- Every map and image layer resolves through an asset field already authorized by `release-client`.

- [ ] **Step 1: Expand renderer tests before changing the views.**

~~~
for (const beat of ["monitor", "detect", "ops", "response", "verification", "deploy", "hyperspectral"]) {
  test("renders " + beat + " from a full release", () => {
    const root = renderView(beat, fullLegacyRelease, mapAdapter);
    assert.equal(root.querySelector("h1").textContent.length > 0, true);
  });
}
~~~

Add negative cases proving that a missing image or a treatment record without dates renders a clear in-panel data warning instead of throwing.

- [ ] **Step 2: Reconstruct Monitor and Detect from the legacy timeline.**

Port the date scrubber, acquisition cards, temporal layer swaps, monitoring metrics, threshold explanation, detection mask, and candidate context. Read observation dates and metric labels from the payload; do not retain hard-coded “latest” dates from the legacy demo.

- [ ] **Step 3: Reconstruct Caddo Lake Ops, Plan Response, and Verify Results.**

Port the operational briefing, treatment chronology, crew/readiness context, verification comparison, and documented decline metrics. Add wording from claim boundaries next to remote-sensing results. Preserve any current V2 operational additions only if their source fields exist in the new release.

- [ ] **Step 4: Reconstruct Deploy and the gated hyperspectral view.**

Restore deployment procedure, evidence and supporting layers. Present Kolkata hyperspectral material only when the payload declares it and its gate condition; otherwise omit the tab. Label it as reference/evaluation material, never Caddo operational output.

- [ ] **Step 5: Make map teardown deterministic.**

When a beat changes, remove old Leaflet layers, controls, timers, and event listeners before installing new ones. Add a test map adapter that records add/remove operations and asserts no stale layer remains after three transitions.

- [ ] **Step 6: Run renderer tests.**

Run: `npm test -- tests/views-render.test.mjs`

Expected: PASS; every legacy view renders with a full fixture, and incomplete optional inputs degrade in place.

### Task 4: Verify release integrity and authenticated staging behavior

**Files:**

- Modify: README.md
- Modify: tests/app-release.test.mjs
- Create: tests/e2e/full-release-workspace.spec.mjs
- Modify: package.json

- [ ] **Step 1: Add an end-to-end authenticated workspace test.**

Seed or intercept a tenant-scoped current manifest containing a full fixture with registered assets. Verify navigation to every tab, a Monitor timeline transition, image requests only to registered authorized URLs, and a limited-fixture status panel. Do not use an unauthenticated fallback endpoint in this test.

- [ ] **Step 2: Add a release-integrity regression.**

Attempt to inject an unregistered `https://` frame URL in the payload fixture. Assert `release-client` reports a load error and no renderer mounts the layer.

- [ ] **Step 3: Document the operator expectation.**

In the README, distinguish a one-scene Caddo scientific release from a promoted `giant-salvinia-legacy-v2` full visual release. Link to the publish action and state that the browser never reads raw tenant storage directly.

- [ ] **Step 4: Run the frontend verification suite.**

Run: `npm run check && npm test && npm run build`

Run: `npm run test:e2e -- tests/e2e/full-release-workspace.spec.mjs`

Expected: PASS; the full UI is available only to the authenticated tenant after promotion.

- [ ] **Step 5: Conduct staging acceptance.**

With a staging tenant full release promoted, verify `/ready`, sign in normally, visit the tenant app, exercise every visual tab, refresh each deep link, and confirm an expired/unauthorized asset cannot render. Record the release ID and validation result in the existing audit trail.

### Task 5: Commit the frontend migration

- [ ] **Step 1: Inspect changed files and formatting.**

Run: `git diff --check && git status --short`

- [ ] **Step 2: Commit the focused frontend changes.**

Run: `git add public README.md tests package.json && git commit -m "feat: restore full Salvinia visual workspace"`
