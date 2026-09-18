# Close legacy functional gaps

**Goal:** Close the audited legacy functional gaps while retaining tenant authorization, immutable verified releases, bounded scientific claims, current map console, accessibility, and credential isolation.

**Architecture:** Reuse the service-owned intelligence products and legacy scientific routines. Add the missing frontend workspace and repair producer/consumer mismatches. Restore research operations behind the existing signed-input, permission and evidence boundaries; never equate research availability with operational validation.

**Spec:** `docs/migrations/legacy-functional-parity.md` and `docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md`; the user's instruction to close gaps authorizes implementation of the audit recommendations.

## Constraints and execution decisions

- Preserve existing dirty work, especially unrelated InSAR and service migration changes. Do not reset, stash, deploy or commit those changes.
- Work against the current files in both repositories because the existing migration is partly uncommitted. Keep a task-specific baseline for review.
- No new frontend dependency, browser credential, direct bucket URL, or relaxed tenant check.
- Invalid/missing optional science remains visibly unavailable. Existing visual releases must keep working when Intelligence is absent.
- Scientific methods must match legacy calculations, not merely payload counts. Compare the same inputs and explicit edge cases.
- The legacy browser-held LLM key, false species/treatment claims, and unrestricted offline access are not to be restored. Export controls must use existing authorization semantics.
- Each task gets behavior checks before implementation, followed by relevant regression tests and independent review. No production deployment is implied by local implementation.

## Tasks

### Task 1: Restore the Intelligence frontend

- [x] Add native-JS intelligence calculations, payload validation and renderer, using the actual service schema and legacy console behavior.
- [x] Add a third workspace with deep links, Caddo operational and Santee reference states, summaries, map layers/overlays, priorities/weights/presets, crew budget/route, CSV, infrastructure, sensors, sampling, EDRR, warnings, portfolio and deterministic questions.
- [x] Preserve Console and Briefing, tenant disposal/history, text escaping, claim boundaries, accessibility, and bounded missing-data behavior.
- [x] Test real schema fixtures, slider and budget recalculation, CSV escaping, questions, map selections, switching/disposal and browser flows.

### Task 2: Repair Caddo presentation and scientific parity

- [x] Reuse legacy distinct-cove selection and monthly record selection; expose method comparison in the rendered evidence block.
- [x] Restore the legacy fitted GP with the already-declared sklearn runtime; compare normal, constant-response and extrapolation cases.
- [x] Replace the false missing-history claim with release-grounded availability and causality language; preserve legacy numeric links when no new workspace qualifier is present.
- [x] Reconcile standalone scientific analyse outputs with the complete legacy computation while preserving supported bounded input behavior.

### Task 3: Restore passing Hyperspectral publication

- [x] Trace signed source inventory, compiler, runner verification and service validation.
- [x] Add an optional manifest-declared evidence package and registered assets; reject escapes, unlisted files, altered checksums, invalid gate and malformed spectra.
- [x] Use the legacy available comparison contract and accept both explicitly unavailable and verified passing releases.
- [x] Test actual compiler/runner/service/browser flow, including failed gates and cross-tenant/asset restrictions.

### Task 4: Restore complete auxiliary scientific workflows

- [x] Restore Santee legacy 500 m buffering, conditional/end-to-end evaluation, water-control sensitivities, temporal transfer, baseline/model/provenance and CSV outputs using explicit tenant inputs.
- [x] Restore Sam Rayburn transfer-review as bounded research with annual imagery/checklist outputs and operational exclusion preserved.
- [x] Restore Kolkata survey, mapped-water validation and two-date diagnostic as explicitly gated research stages using signed inputs; keep species claims and operational readiness gated.
- [x] Verify preserved Belews scientific artifacts and all operation registry/dispatch contracts.

### Task 5: Verify and close the audit

- [x] Run focused legacy/new scientific checks in an available isolated Python runtime and container checks when available.
- [x] Run frontend unit/integration/browser/type/build checks and focused/full applicable service verification.
- [x] Review the implementation independently for scope compliance, scientific parity, regressions and auth/release containment.
- [x] Update the parity matrix with evidence for every item; leave any unverified requirement explicitly open and the goal active.

## Progress ledger

- 2026-09-07: Revalidated working-tree baselines. No implementation existed for the missing frontend; service contains substantial pre-existing uncommitted migration work. Previous audit was concrete progress (new findings and runnable evidence). All five tasks open.

- 2026-09-07 implementation: Caddo GP and selectors now match legacy golden cases; three sampled audit differences now zero. Full Caddo compiler passed (240 s), standalone full `analyse` real 663+ acquisition test passed (244 s with focused checks); full compiler then passed again (223 s) with newly signed occurrence/annual context propagated into the published Intelligence payload. Full analysis uses workspace-backed scene arrays and marks visual review pending rather than copying the legacy reviewed label.
- Hyperspectral: six-file optional signed package, complete legacy named/numeric gate validation, exact asset/date/hash checking, bounded PNG/WebP publication and real legacy manifest/potential adapter implemented. Python compiler/runner integration and Worker promotion checks pass; original unavailable state retained. Reviewer caught and fixes addressed anonymous gates, missing adapter and foreign area count maps. Unsupported open-water controls remain explicitly unsupported in UI.
- Intelligence: workspace and all main legacy controls implemented; browser checks passed, independent review surfaced fixes for geometry types, old question aliases, observation age/peak and production optional data. Implementation agent is closing these. CSV grants require can_export + tenant + displayed release ID and revision, and disposal prevents delayed download.
- Sam Rayburn: annual selector/top-five rules and workspace-local side-by-side comparison rendering implemented with pending checklist and operational exclusion. Focused tests in progress; final integration/review still open.
- Santee: implementation agent reports full products restored using legacy evaluation helpers and initial real-model + signed-operation checks pass; independent/final review remains open. Kolkata restoration remains open. No deployments or commits performed.

- Final frontend verification: 132 unit, 2 integration and 7 Chrome browser tests pass; type check/build pass. Passing legacy-derived Hyperspectral comparison now has a permanent browser acceptance case, including insufficient open-water controls.
- Independent reviewers found no remaining Intelligence, Santee, Sam, importer or Belews regressions. Sam remote-catalog test now patches the actual imagery import alias. Service full-suite initial run found three obsolete Kolkata rejection assertions (being updated) and an eager NumPy import in JSON-only reference validation; the latter was moved to the two scientific functions, with all 22 importer and 6 Intelligence checks passing.

- Closure: all five tasks complete. Final service verification: 1,115 passed / 14 environment-gated skipped; type, generated type, safety, acceptance corpus and container syntax checks pass. Python coverage: 152 final regression cases pass plus three expensive full-history cases passed in the preceding full run (155 current cases covered). The initial six failures were resolved and rerun. Importers: 22 Caddo + 11 site tests pass. Linux: 24 core/scientific boundary checks and 17 site/EDRR checks pass; six Kolkata cases rerun after the final control-artifact isolation pass.
- Kolkata review corrections: primary mask uses all feature bands, declared AOIs cannot be clipped, exact paired dates flow through the importer, mapped polygons are not described as independently verified, control images use a separate directory, and positive/blocked gates are explicitly tested. Independent core review completed; parent reviewed and verified the final artifact/test additions after reviewer usage limits interrupted their final follow-up.
- No unresolved in-scope implementation gap remains. Live archive equivalence, field validation, deployed-session acceptance and a comprehensive identity/security audit are not claimed. Offline unauthenticated distributions and browser provider keys remain intentional exclusions. No deployments, commits or live data promotions performed.
