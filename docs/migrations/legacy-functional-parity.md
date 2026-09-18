# Legacy migration parity review — 2026-09-07

## Implementation follow-up — 2026-09-07

The findings below record the original audit, before remediation. The authorized follow-up restores the missing capabilities in the frontend and service working trees while retaining tenant authorization, signed source inventories, immutable releases and bounded scientific claims. All identified in-scope implementation gaps are closed. No deployment or live data promotion has been performed.

| Audited capability | Current implementation and evidence |
| --- | --- |
| Intelligence workspace | Restored: rankings, map overlays, weights/presets, crew budgets/routes, CSV, infrastructure, sensors, sampling, EDRR, warnings, portfolio, Santee reference and deterministic questions. Unit and browser checks cover calculations, aliases, optional observations, geometry types, escaping, deep links and tenant disposal. |
| Intelligence input/export boundaries | Approved occurrence and annual reference context travels through the signed source inventory into both compiler paths. CSV requires `can_export`, tenant scope, displayed release ID/revision and an audited server grant; stale releases and delayed downloads after disposal are rejected. |
| Passing Hyperspectral evidence | Six-file verified optional package and actual legacy adapter now reach compiler, runner, promotion validator and authenticated browser. Named/numeric gates, consistent dates, spectra, checksums, image bounds and registered assets are checked. Missing/failed evidence remains unavailable; insufficient open-water controls remain explicitly unsupported. |
| Caddo GP-UCB | Original fitted sklearn GP restored. Same-input legacy golden cases cover varying and constant targets, curved fits, extrapolation and predictive uncertainty. |
| Monthly observation and verification selection | Shared original monthly tie rule and five-distinct-cove selector restored. Runnable audit probe reports zero differences on all three original sampled defects. |
| Response method comparison | Computed comparison now reaches `evidence.response`, the existing renderer's input. |
| Standalone complete-history analysis | Restored cove histories, calibration/invariance, backtests and response replay for verified complete inputs; smaller supported inputs retain bounded output. Actual compiler/runner checks execute the full 663+ acquisition synthetic fixture. Visual inspection remains pending. |
| Operations wording and bookmarks | Availability derives from the release's actual history. Treatment causality remains unproven. Unqualified legacy numeric bookmarks retain their original meanings; named/current-workspace routes remain supported. |
| Santee | Original 500 m buffered evaluation and reference algorithms retained; conditional/end-to-end tasks, 100/250/500 m controls, water diagnostics, baseline reproduction, pooled results, frozen presentation model, 2024↔2025 transfer, CSV and provenance restored. Real model fits and signed-operation tests pass; independent AST review confirms legacy numerical helpers. |
| Sam Rayburn | Annual image selection, top-five coves, side-by-side transfer imagery and a pending land/cloud/water/seam checklist restored inside the signed `analyse` operation. Detector thresholds and six-decimal coverage selection match legacy. Operational/species-accuracy exclusion retained. |
| Belews | Independent review found all ten scientific artifacts and both dates preserved, with unchanged scaling, wavelength matching, crop and quality-mask methods. Signed operation checks cover image/artifact hashes and malformed or substituted input. |
| Kolkata | Restored signed survey, mapped-water validation and exact November 12/13 acquisition diagnostics, including importer support. Legacy masks/thresholds retained, partial AOIs rejected, raw diagnostics published, control artifacts isolated, and passing six-file packages emitted only after both gates pass. Six real-ZIP regression checks pass. |
| Offline HTML/ZIP and browser provider keys | Intentionally excluded by the authenticated architecture. Current CSV export is authorized. No portable unauthenticated release or browser-held provider credential was restored. |

Reference import/preparation instructions are in [legacy-reference-inputs.md](legacy-reference-inputs.md). Checked-in scientific fixtures are labelled synthetic and must not be imported as field evidence.

Final verification: frontend **132 unit + 2 integration + 7 browser tests**, type check and build passed; service **1,115 passed, 14 environment-gated tests skipped**, type/static safety/generated type checks passed; Linux scientific/container boundary checks **24 passed**. Full-history compiler, runner publication and complete standalone analysis passed. Initial broad Python failures were two stale eligibility/registry assertions and four missing test-client dependency errors; all six are resolved and their tests pass. The final regression sweep passed **152 tests**; together with the **three expensive full-history checks** already passed in the preceding run, all **155 current Python cases** are covered. The six final Kolkata tests also pass in the Linux container. Both importers pass **33 tests** in total. Full-history runs use synthetic complete-history data, not a reprocessing of the live archive.

This is functional restoration with executable regression evidence. It does not certify live field accuracy, full same-input equivalence of every scientific product, a deployed auth/session flow, or an exhaustive identity/security audit. Browser tests use a local session and registered one-pixel asset responses for routing; Python checks separately decode generated imagery and validate image artifacts.

---

## Original audit (before remediation)

**Original audit verdict: functional parity was incomplete.** The core Caddo presentation is substantially retained, but the Operations Intelligence workspace is missing, the successful Hyperspectral publication path is unavailable, and some scientific behavior changed. Passing the current tests does not establish legacy parity.

This review compares the local working trees of:

| Role | Repository | HEAD |
| --- | --- | --- |
| Legacy source | `giant_salvinia` | `a1f28bcadd89f2513c5dc24767712e8c7dc8cdcf` |
| Authenticated frontend | `giant_salvinia_v2` | `d1bb4ba2c8f57bd9eef8e4bc7c45ae2fdb73f233` |
| Pipeline, authorization, releases | `coactive_data_service` | `ab70b782773f7adbb9e7b73889bdcc574deec006` |

The frontend intentionally delegates computation and authorization to the service. Missing Python files in the frontend alone are not evidence of a lost feature. The [migration scope](/Users/kishore/code/giant_salvinia_v2/docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md:1) requires both the legacy presentation and deterministic Intelligence experience.

## Confirmed gaps and changed behavior

### 1. P1 — The Operations Intelligence payload has no frontend

The service publishes Caddo intelligence, Santee reference context, portfolio/exclusion context, deterministic answers, and CSV data in [intelligence.py](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py:745). The frontend never consumes `release.intelligence`: [routing](/Users/kishore/code/giant_salvinia_v2/public/app.js:335) supports only Console and Briefing. An Intelligence deep link opens the map console instead. [Full-release validation](/Users/kishore/code/giant_salvinia_v2/public/release-schema.js:1) also permits an absent or invalid intelligence document.

Consequently, these legitimate legacy functions are inaccessible:

- Hotspot, growth, spread/front and infrastructure rankings and map overlays.
- Priority weights/presets, crew budget, routed stops and CSV export.
- Sensor placement and field-sampling recommendations.
- EDRR scenarios, surges/fronts/decline alerts.
- Santee reference trends, portfolio comparison and the visible Sam Rayburn exclusion explanation.
- Question input and deterministic answers grounded in those products.

Legacy implementations are in [priority/crew controls](/Users/kishore/code/giant_salvinia/salvinia_agent_source/console_template.html:614), [exports and sampling](/Users/kishore/code/giant_salvinia/salvinia_agent_source/console_template.html:687), and [deterministic Q&A](/Users/kishore/code/giant_salvinia/salvinia_agent_source/console_template.html:822). The current single field-briefing button does not implement them.

**Acceptance:** consume and validate the existing service payload; exercise every Intelligence view, reweighting, crew budget/routing, CSV, known questions, reference/excluded states and tenant switching. Reuse the backend products already present.

### 2. P2 — Passing Hyperspectral evidence cannot reach the full Caddo release

Legacy [presentation packaging](/Users/kishore/code/giant_salvinia/salvinia/presentation.py:148) includes the Kolkata comparison and assets when its evidence gate passes. The frontend retains an available renderer, but the service [historical compiler](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py:294) always emits `state: not_available`. More decisively, [runner validation](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/runner.py:798) accepts only that state. Both raw and prepared full-release paths use this compiler.

This is a missing delivery capability, not proof that the currently available Kolkata evidence should pass. The unavailable state is scientifically correct when evidence is absent or fails; the defect is that a future verified passing package cannot be published through this path either.

**Acceptance:** authorize and register an optional verified Kolkata package with the release; accept and render both passing and failing evidence states without weakening the gate.

### 3. P2 — Santee evaluation is incomplete and its holdout method changed

[Service evaluation](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/site_sentinel.py:94) runs conditional species classification only, with a 200 m buffer. Legacy [evaluation configuration](/Users/kishore/code/giant_salvinia/salvinia/santee_species.py:52) uses 500 m; its [fold reference](/Users/kishore/code/giant_salvinia/salvinia/santee_species.py:335) excludes open-water controls, while the service passes the whole end-to-end population. Identical source inputs therefore need not reproduce the same held-out metrics or evidence status.

The service also omits the legacy end-to-end task, 100/250/500 m open-water-distance sensitivity, water-screen diagnostics, baseline reproduction, pooled summaries, frozen presentation candidate, and [2024↔2025 temporal transfer](/Users/kishore/code/giant_salvinia/salvinia/santee_species.py:409). The [performance CSV](/Users/kishore/code/giant_salvinia/salvinia/santee_species.py:482) is no longer produced.

The [bounded rollout](/Users/kishore/code/coactive_data_service/docs/superpowers/specs/2026-08-25-santee-sam-rayburn-kolkata-migration-design.md:24) intentionally starts with a small scene/reference package. That explains limited evidence availability; it does not restore the missing orchestration when more years are supplied, or document the 500→200 m methodology change.

**Acceptance:** restore the legacy evaluation contract or explicitly version and scientifically validate the replacement; distinguish unavailable input-dependent results from computations not implemented.

### 4. P2 — GP-UCB is a different model, not a numerical port

Legacy [_fit_gp](/Users/kishore/code/giant_salvinia/salvinia/backtest.py:233) fits a standardized, normalized Gaussian process with optimizable constant/RBF/white-noise kernel parameters. The [replacement](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/backtest.py:231) fixes the RBF and noise parameters, removes hyperparameter fitting, changes predictive-variance calculation, and returns zero uncertainty for constant training targets.

That changes a scientific capability used by historical model comparison and the forecast inputs consumed by [Intelligence](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py:169). It can change forecasts, uncertainty and sensor recommendations. The source comment acknowledges the simplification, but this review found no same-input legacy/new equivalence evidence establishing its acceptability. No claim is made here about the size of the effect on the actual archive.

**Acceptance:** preserve the original model behavior or label/version the substitute and compare forecasts, uncertainty, rankings and evaluation metrics on the same approved inputs.

### 5. P2 — Verify Results can lose one of its five distinct coves

Legacy [selection](/Users/kishore/code/giant_salvinia/salvinia/display.py:153) skips repeat `cove_id` values and selects five distinct coves. The [new compiler](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py:218) takes the first five events. The shared decline scanner can emit several events for a cove.

With ranked cove IDs `[1, 1, 2, 3, 4, 5]`, executing the actual selection functions gives legacy `[1, 2, 3, 4, 5]` and migration `[1, 1, 2, 3, 4]`. The fifth distinct inspection location disappears. This is a reproduced input-dependent regression, not a claim that every current release contains duplicates.

**Acceptance:** preserve the distinct-cove selection before limiting the presentation to five candidates.

### 6. P2 — The historical method-comparison chart is computed but not delivered to its renderer

The new compiler computes `response.comparison` in [historical.py](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py:203), but omits it from `evidence.response` when building the [payload](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/historical.py:295). Legacy [evidence assembly](/Users/kishore/code/giant_salvinia/salvinia/presentation.py:436) copies it there.

The [Response view](/Users/kishore/code/giant_salvinia_v2/public/views.js:251) still renders only `evidence.response`, and [the evidence renderer](/Users/kishore/code/giant_salvinia_v2/public/core.js:194) uses that block's `comparison`. Real publisher output therefore loses the current-area/recent-growth/experimental/random comparison even though synthetic view fixtures can render it.

**Acceptance:** align publisher and consumer on one existing comparison field and test the actual producer contract through the frontend.

## Capability inventory

| Legacy capability | Migration status |
| --- | --- |
| Monitor map, timeline, play/pause/restart | Retained; monthly equal-coverage tie selection differs (legacy closest to day 15; new compiler latest timestamp). |
| Detect raster, affected coves, top locations | Retained in the full visual release. |
| August 2021 response replay and later observations | Retained; method-comparison delivery gap above. |
| Verify Results before/after switching | Retained; distinct-cove selection regression above. |
| Deploy and bounded claim language | Retained. |
| Hyperspectral available/unavailable UI | Renderer retained; available publication path missing. |
| Intelligence operational products, controls and Q&A | Service data present; frontend absent. |
| Caddo inventory, ingestion, imagery and historical release | Present in service; full numerical equivalence is not established. |
| Legacy standalone `analyse` result contract | Reduced in the registered service operation: [runner](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/runner.py:1090) calls `analyse_verified`, whose [output](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/analysis.py:67) is basin/scene metrics. Legacy cove histories, calibration/invariance reports, backtests and replay are not returned by that operation. Full-release compilation restores a subset separately. |
| Santee scientific evaluation | Partial, with methodology/output differences above. |
| Belews Pixxel preparation | Registered and ported with signed local inputs; full artifact/numerical equivalence was not rerun. |
| Sam Rayburn `transfer-review` | Not ported. Legacy [annual overlays, top coves and review checklist](/Users/kishore/code/giant_salvinia/salvinia/transfer.py:67) are not reproduced by the bounded service `analyse` operation. Deliberately narrower initial rollout. |
| Kolkata survey and mapped-water validation | Explicitly deferred/rejected by the rollout design, despite existing legacy implementations. |
| Kolkata two-capture comparison | Reduced to the documented one-capture feasibility workload; the [service](/Users/kishore/code/coactive_data_service/containers/salvinia-heavy/app/salvinia/kolkata.py:19) requires one November capture. |
| Offline distributable HTML/ZIP | Legacy supported this. The replacement browser intentionally requires authenticated service access; portable/offline product parity is not provided. |

Other compatibility details:

- [Caddo Lake Ops](/Users/kishore/code/giant_salvinia_v2/public/views.js:157) still unconditionally says historical observations have not been imported, including when the full historical release is loaded. Correct the availability claim separately from the valid warning that imagery does not establish treatment causality.
- Numeric bookmarks shifted after inserting Operations: legacy `beat=3/4/5/6` meant Response/Verify/Deploy/Hyperspectral; the new app maps them to Operations/Response/Verify/Deploy. Current tests explicitly expect the new ordinal behavior. Named links remain usable; whether old numeric bookmarks must remain compatible needs a product decision.
- Browser-held model-provider keys, operational Sam Rayburn claims, and treating Santee labels as field ground truth are deliberate exclusions, not features to restore. Future roadmap suggestions in the legacy README are not implemented legacy functionality.

## Verification and limits

Executed during this review:

- Frontend `npm test`: **118 passed**.
- Frontend `npm run test:integration`: **2 passed**.
- Frontend `npm run test:e2e`: **1 passed** in installed Chrome.
- Frontend `npm run check` and `npm run build`: passed.
- Service focused tests (`salvinia`, `salvinia-run`, `salvinia-releases`, `salvinia-ops`, `salvinia-source-capability`): **54 passed**.
- Dependency-free [parity probe](/Users/kishore/code/giant_salvinia_v2/docs/migrations/legacy-parity-check.py): reproduces distinct-cove loss, monthly tie drift and missing response evidence comparison. Exit 1 is expected while those differences exist. It executes selected source functions with raster rendering stubbed; it is not a full pipeline test.

The browser acceptance test supplies a local session and manifest, and returns a one-pixel image for each asset request. It tests navigation and asset routing, not imagery correctness, live login/CORS/cookies, real tenant permissions, or source-data equivalence. Its default fixture deliberately fails the Hyperspectral gate, so it cannot detect the missing successful publisher path.

No live release was promoted, no production data was modified, and no complete archive was reprocessed. The local Python environments inspected lack the geospatial/scientific stack needed for full legacy and migrated pipeline runs. This is a source/behavioral parity audit with focused executable evidence, not certification of scientific equivalence or a comprehensive identity/security audit.

Recommended order: restore the existing Intelligence payload's frontend; repair the producer/consumer and distinct-cove defects; resolve scientific-method differences and the passing Hyperspectral path; then explicitly accept or schedule the documented research/offline exclusions. Final parity acceptance should use the same approved inputs on both pipelines and an authenticated real-release browser run.
