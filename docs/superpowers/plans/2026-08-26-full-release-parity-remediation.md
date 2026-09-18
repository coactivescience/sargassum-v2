# Full Release Parity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two residual blockers to a legacy-complete Caddo release: represent and enforce the complete approved acquisition record, and finish the release-owned intelligence parity contract.

**Architecture:** Keep the existing signed inventory digest/count flow, but size it for the authoritative service readiness record and enforce that readiness in the full compiler. Extend the existing strict `giant-salvinia-intelligence-v1` document with bounded Santee reference trend/portfolio recommendation, every deterministic legacy question family, and the bounded crew-route CSV that the legacy console exported.

**Tech Stack:** TypeScript, Python 3, Cloudflare Worker service contracts, locked Salvinia container, Node/Vitest, Python unittest.

**Spec:** docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md

## Global Constraints

- `coactive_data_service` remains the sole production backend; the legacy repository is read-only parity reference material.
- Caddo full releases must fail closed unless a server-verified approved inventory satisfies the service’s acquisition-readiness contract.
- Caddo outputs remain floating vegetation, not species confirmation; Santee is reference-only and Sam Rayburn remains excluded.
- Keep credentials, raw tenant-storage URLs, model keys, and arbitrary prompts out of payloads and browser code.
- Do not deploy, import AWS data, publish a release, or promote a release in this remediation.

---

### Task 1: Make the approved inventory capable of representing and enforcing a complete Caddo record

**Files:**

- Modify: ../coactive_data_service/src/salvinia-run.ts
- Modify: ../coactive_data_service/src/jobs.ts
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/runner.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Modify: ../coactive_data_service/tests/salvinia-run.test.ts
- Modify: ../coactive_data_service/tests/jobs.test.ts

**Interfaces:**

- `ApprovedInventory` has `version`, `acquisitionDigest`, `expectedAcquisitionCount`, and is carried unchanged in the signed `legacy-release` run plan.
- `COMPLETE_CADDO_ACQUISITIONS` is imported from the existing service site contract and is the minimum exact approved-acquisition count.
- Maximum approved acquisition identities and source objects are at least `COMPLETE_CADDO_ACQUISITIONS` plus the required hydrography sidecar, while retaining bounded manifest/event sizes.

- [ ] **Step 1: Write failing exact-boundary tests.**

~~~
it("accepts an approved inventory at the authoritative Caddo count", () => {
  const inventory = approvedInventory(COMPLETE_CADDO_ACQUISITIONS);
  expect(validateApprovedInventory(inventory)).toEqual(inventory);
});

it("rejects an approved inventory one acquisition short", () => {
  expect(() => validateApprovedInventory(approvedInventory(COMPLETE_CADDO_ACQUISITIONS - 1)))
    .toThrow(/complete Caddo acquisition count/i);
});
~~~

In the container, add matching source-manifest fixtures where exactly the authoritative count succeeds and one fewer identity fails before ingestion. Preserve the 437-object checked-in migration snapshot as `incomplete`; it must not become capability-eligible.

- [ ] **Step 2: Verify red tests.**

Run: `cd ../coactive_data_service && npm test -- --run tests/salvinia-run.test.ts tests/jobs.test.ts`

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m unittest app.test_runner`

Expected: the existing 511/512 bounds reject the authoritative count or the compiler accepts the one-short fixture.

- [ ] **Step 3: Replace fixed 511/512 caps with named complete-record bounds and enforce readiness.**

~~~
export const COMPLETE_CADDO_ACQUISITIONS = 663;
export const MAX_APPROVED_ACQUISITIONS = COMPLETE_CADDO_ACQUISITIONS + 64;
export const MAX_APPROVED_SOURCE_OBJECTS = MAX_APPROVED_ACQUISITIONS + 1;

export function validateApprovedInventory(value: ApprovedInventory) {
  if (value.expectedAcquisitionCount < COMPLETE_CADDO_ACQUISITIONS ||
      value.expectedAcquisitionCount > MAX_APPROVED_ACQUISITIONS) {
    throw new Error("approved inventory must satisfy complete Caddo acquisition count");
  }
  return value;
}
~~~

Mirror the values in the Python runner and keep a bounded byte/event budget independent of object count. In `compile_full_release`, require the canonical approved identity count to equal the signed count and meet `COMPLETE_CADDO_ACQUISITIONS` before parsing/analysis. Do not change the incomplete snapshot into an approved manifest.

- [ ] **Step 4: Run focused verification.**

Run: `cd ../coactive_data_service && npm test -- --run tests/salvinia-run.test.ts tests/jobs.test.ts tests/salvinia-source-capability.test.ts`

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m unittest app.test_runner`

Expected: a full-size approved fixture can cross the contract; a missing identity, substitution, sparse inventory, or one-short count has no release writes.

- [ ] **Step 5: Commit.**

Run: `cd ../coactive_data_service && git add src containers tests && git commit -m "fix: enforce complete Caddo inventory readiness"`

### Task 2: Complete strict intelligence parity for Santee, deterministic Q&A, and crew-route CSV

**Files:**

- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Create: ../coactive_data_service/containers/salvinia-heavy/app/testdata/intelligence-parity.json

**Interfaces:**

- `build_intelligence_payload(...) -> dict` includes strict `santee_reference`, `portfolio.recommendation`, `deterministic_answers`, and `csv_exports.crew_route`.
- `deterministic_answers` includes: extent, hotspot, fastest_growth, spread_front, infrastructure_risk, sensor_placement, sampling, crew_deployment, edrr_early_wins, early_warning, portfolio_recommendation, santee_boundary, sam_rayburn_exclusion, and claim_boundary.
- `csv_exports.crew_route` has columns `order`, `cove_id`, `leg_distance_km`, `current_extent_ha`, `growth_ha_per_year`, `priority`, `action`.

- [ ] **Step 1: Add failing golden parity tests.**

~~~
def test_intelligence_has_reference_trend_answers_and_crew_csv():
    payload = build_intelligence_payload(full_inputs())
    assert payload["santee_reference"]["operational"] is False
    assert payload["santee_reference"]["trend"]["first_year"] < payload["santee_reference"]["trend"]["latest_year"]
    assert payload["portfolio"]["recommendation"]["site_key"] == "caddo"
    assert set(payload["deterministic_answers"]) >= REQUIRED_ANSWER_IDS
    assert payload["csv_exports"]["crew_route"]["columns"] == CREW_ROUTE_COLUMNS
~~~

Add negative tests that a missing Santee trend, portfolio recommendation, answer family, CSV field, incorrect CSV column order, or Sam operational flag fails schema validation. The golden fixture contains only bounded reference aggregates/citations, no raw URL or credential-looking values.

- [ ] **Step 2: Verify red tests.**

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m unittest app.test_runner`

Expected: current six-answer/cove-priority-only payload fails parity assertions.

- [ ] **Step 3: Implement bounded reference and deterministic products.**

~~~
CREW_ROUTE_COLUMNS = [
    "order", "cove_id", "leg_distance_km", "current_extent_ha",
    "growth_ha_per_year", "priority", "action",
]

payload["santee_reference"] = {
    "operational": False,
    "trend": {"first_year": 2017, "latest_year": 2026,
              "first_extent_ha": first, "latest_extent_ha": latest, "cagr": cagr},
    "citations": SANTEE_REFERENCE_CITATIONS,
    "boundary": "Reference-label context only; not a Caddo operational detection.",
}
payload["csv_exports"]["crew_route"] = {
    "columns": CREW_ROUTE_COLUMNS,
    "rows": crew_route_rows,
}
~~~

Build every deterministic answer only from the corresponding bounded payload product and attach citations/boundaries. Add the portfolio recommendation based on priority/operational status; it may recommend Caddo but must state Santee is reference-only and Sam Rayburn excluded. Make the recursive strict validator require every field and exact row shape.

- [ ] **Step 4: Run parity and full compiler checks.**

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m unittest app.test_runner`

Expected: the strict schema accepts full parity golden output, rejects all drift cases, and the hermetic full historical compiler succeeds with reference content while incomplete history still fails.

- [ ] **Step 5: Commit.**

Run: `cd ../coactive_data_service && git add containers/salvinia-heavy/app && git commit -m "feat: complete Salvinia intelligence parity"`

### Task 3: Full regression and review gate

**Files:**

- Modify: ../coactive_data_service/tests/salvinia-releases.test.ts
- Modify: ../coactive_data_service/tests/worker-routes.test.ts

- [ ] **Step 1: Add cross-boundary regression tests.**

Assert that capability calculation rejects the incomplete 437-object snapshot, accepts only a full-count approved manifest, and that a promoted full release retains the strict `intelligence` document without raw URLs/credentials. Confirm ordinary tenant job creation still rejects `legacy-release`.

- [ ] **Step 2: Run complete local verification.**

Run: `cd ../coactive_data_service && npm run check && npm test && python3 scripts/test_import_salvinia_archive.py && npm run local:containers:syntax`

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && docker build --platform linux/amd64 -f ../Dockerfile -t coactive/salvinia-full-release:parity .. && docker run --rm coactive/salvinia-full-release:parity python -m unittest app.test_runner`

Expected: all tests pass. Existing unrelated lint, missing optical testdata, and stale generated Wrangler types are reported separately and not concealed.

- [ ] **Step 3: Commit and request review.**

Run: `cd ../coactive_data_service && git add tests containers src && git commit -m "test: verify complete legacy release parity"`
