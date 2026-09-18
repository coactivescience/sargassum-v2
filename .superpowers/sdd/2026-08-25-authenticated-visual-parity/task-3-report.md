# Task 3 Report: Authenticated Visual Renderer Parity

## Result

Ported the seven authenticated visual views to the complete release payload and added a portable full-view fixture. Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy, and Hyperspectral now expose nonempty panel headings and map headings derived from release dates or labels.

The renderer remains fail-closed at the release boundary while degrading clearly in place if a view is called directly with an incomplete optional image or management-chronology record. Warning content is HTML escaped. Kolkata context is shown only from declared payload context and a passing evidence gate, and is explicitly labelled reference/evaluation material rather than Caddo operational output.

## TDD evidence

### Primary RED

Command:

```sh
node --test tests/views-render.test.mjs
```

Before production changes, the focused suite reported 9 passing tests and 7 expected failures:

- Monitor still used the hard-coded “A decade” heading instead of the 2017–2026 fixture dates.
- Operations omitted the payload site label from its heading.
- Verification exposed only the selected frame date rather than the candidate comparison range.
- Hyperspectral used a hard-coded Kolkata heading rather than the supplied area labels and reference/evaluation purpose.
- A missing Monitor image produced no in-panel warning.
- A management chronology record without an end date produced no in-panel warning.
- Three view transitions left three pending map invalidation timers instead of one current timer.

The map-adapter assertion simultaneously showed that raster, geometry, and marker layer groups were already cleared correctly. Production lifecycle changes were therefore limited to cancelling the stale `invalidateSize` timeout in `MapView.clear()` and before scheduling a new one.

### Additional RED checks

The Hyperspectral evidence-gate regression failed because a declared failed gate still mounted the comparison. The operations date regression failed because 2026 remained hard-coded when the observation fixture was changed to 2031–2033. The Monitor acquisition-card regression failed because the existing scrubber had no per-observation cards.

Commands:

```sh
node --test --test-name-pattern='hyperspectral comparison stays gated' tests/views-render.test.mjs
node --test --test-name-pattern='operations derives its approved record years' tests/views-render.test.mjs
node --test --test-name-pattern='monitor renders a payload-labelled acquisition card' tests/views-render.test.mjs
```

### GREEN

Command:

```sh
node --test tests/views-render.test.mjs
```

Result: 20 tests passed, 0 failed. The tests cover every visual view, payload-derived headings and acquisition cards, escaped image and chronology warnings, failed Hyperspectral gating, finite spectral-chart coordinates for sparse bands, derived operations record years, and three deterministic map transitions.

The plan-specified repository command also passed:

```sh
npm test -- tests/views-render.test.mjs
```

Result: 84 tests passed, 0 failed. The package script expands the full `tests/*.test.mjs` suite and then includes the focused view file supplied on the command line.

## Renderer behavior

- Monitor derives its range heading and record metric from the first and last approved frame dates, renders one payload-labelled acquisition card per observation, retains playback/date scrubbing, and warns for unpublished frame images.
- Detect derives its observation copy and ranked-cove label from the payload and warns if its release image is missing.
- Caddo Lake Ops derives site/date/readiness copy from the supplied site, Monitor, and Detect records; it no longer hard-codes the approved record year.
- Plan Response derives its decision date and priority count, uses payload frame labels during playback, renders optional management chronology, and states that remote-sensing change does not establish treatment effect.
- Verify Results derives its heading from the selected candidate name and before/after dates and keeps the decline-versus-causation boundary next to the comparison.
- Deploy derives the operating site label and uses only the supplied Detect frame as its map background.
- Hyperspectral derives area, location, sensor, date, and purpose labels from the payload, blocks a failed evidence gate, avoids non-finite chart coordinates for one-point spectral regions, escapes image attributes, and labels Kolkata reference/evaluation material as not Caddo operational output.

All map overlays and sample images continue to consume only existing release-owned `.file` fields. No renderer constructs a storage or asset URL.

## Files

- `public/views.js`
- `public/core.js`
- `public/app.css`
- `tests/views-render.test.mjs`
- `tests/fixtures/full-legacy-view-data.json`

## Commit

Focused Task 3 commit message: `feat: restore release-grounded visual parity`.

## Concerns and boundaries at the initial commit

The review-fix section below supersedes the source-badge and evidence-gate notes in this initial snapshot.

- `response.treatments`, `hyperspectral.context`, and `hyperspectral.evidence_gate` are optional renderer inputs. The mount-safe Task 1 contract still guarantees the original required fields; releases without these optional records retain the existing response UI and generic reference/evaluation wording.
- Task 2 deliberately retains an explicit unavailable Hyperspectral tab so the bounded explanation remains reachable. Task 3 preserves that lifecycle decision and gates only the comparison contents.
- The application-level source badge in `public/app.js` remains outside this renderer task and still carries legacy source-summary copy. No Task 4, Intelligence, service, publishing, or deployment files were changed.

## Review fix round 1

### Ruling

Hyperspectral comparison is now fail-closed at both navigation and renderer boundaries:

- `{ state: "not_available", message }` remains a declared capability. Task 2's Hyperspectral tab and deep link remain available so the bounded explanation can be read; no comparison is mounted.
- A comparison object with a missing gate or `evidence_gate.passes: false` remains a valid full release for the six Caddo views, but the Hyperspectral tab is omitted. A `?beat=hyperspectral` deep link resolves to Monitor. Calling the renderer directly produces the same escaped unavailable panel and an empty comparison stage.
- Only `evidence_gate.passes: true` exposes the tab and comparison. A passing gate also requires release-owned location, sensor, capture-date, and purpose context so application badges cannot fall back to fixed capture claims.

This reconciles the Task 3 instruction to omit ungated Kolkata comparison material with Task 2's deliberate exception for an explicit unavailable capability.

### Review RED

Tests were added before production changes to `tests/views-render.test.mjs`, `tests/app-release.test.mjs`, and `tests/release-schema.test.mjs`.

Command:

```sh
node --test tests/views-render.test.mjs tests/release-schema.test.mjs tests/app-release.test.mjs
```

Initial result: 45 passed and 7 failed for the intended reasons:

- missing Hyperspectral gates still mounted the comparison;
- failed or missing gates still exposed the navigation item and accepted a Hyperspectral deep link;
- application source/record badges still contained fixed Sentinel/Pixxel source and date copy;
- the validator did not validate a declared gate or the context needed by an approved comparison;
- hard-coded crossing/convergence and shoreline-robustness claims were assigned to deliberately contradictory arbitrary spectra;
- a missing Hyperspectral image emitted `<img src="undefined">`; and
- repeated Operations priority clicks cleared markers but accumulated cove geometry.

### Review GREEN

Focused command:

```sh
node --test tests/views-render.test.mjs tests/release-schema.test.mjs tests/app-release.test.mjs
```

Result: 53 passed, 0 failed.

Final repository verification:

```sh
npm run check && npm test && npm run build && git diff --check
```

Result: TypeScript check passed; 92 tests passed with 0 failures; the asset build verification passed; and the diff check was clean.

### Review behavior changes

- Replaced fixed spectral interpretations with comparisons computed from the two released median spectra at exactly shared wavelength targets in each displayed region. The UI reports higher/tied target counts and the release's numeric separation/control values without species or cause attribution.
- Stopped rendering `hyperspectral.robustness.summary`. It has no machine-checkable relationship to the released spectra, so arbitrary release prose can no longer supply crossing, convergence, alternate-band, or shoreline-exclusion conclusions.
- Derived non-Hyperspectral badges from `monitor.frames` and the active site label. Derived approved Hyperspectral badges from `hyperspectral.context`. Fixed years, sensor, and capture date were removed from `public/app.js`.
- Omitted a Hyperspectral sample image when its release-owned `.file` is missing while keeping the escaped in-panel data warning. No asset URL is synthesized.
- Cleared the Operations geometry layer group as well as its marker group before each selected-cove redraw. The adapter regression clicks two priorities and asserts exactly one geometry and one marker layer remain; the existing three-transition adapter regression remains in place.
- Added passing gate/context metadata to the portable full-release contract fixture. Existing authorized asset URLs were not changed and no direct/raw URL construction was introduced.

### Review files

- `public/app.js`
- `public/release-schema.js`
- `public/views.js`
- `tests/app-release.test.mjs`
- `tests/release-schema.test.mjs`
- `tests/views-render.test.mjs`
- `tests/fixtures/full-legacy-release.json`
- `.superpowers/sdd/2026-08-25-authenticated-visual-parity/task-3-report.md`

Focused review commit message: `fix: fail closed on hyperspectral evidence`.

### Review concerns and boundaries

- `hyperspectral.robustness.summary` remains accepted for upstream contract compatibility but is intentionally not displayed. Showing narrative interpretations later should require a release-owned validation contract tied to computed comparison invariants.
- Missing image fields still fail full-release admission under Task 1's mount-safe contract. The direct-renderer fallback is retained and tested so incomplete optional data degrades safely instead of throwing.
- Kolkata remains reference/evaluation material and never Caddo operational output. Caddo imagery remains labelled floating vegetation rather than species confirmation.
- No Task 4, Intelligence, service, publisher, deployment, or direct-storage work was performed.

## Review fix round 2

### Ruling

The Monitor contract validates dates and authorized image fields but does not declare a sensor name. The shared map legend therefore uses the scientifically neutral provenance label `Approved release imagery` and appends a year or year range derived from `monitor.frames`. Bounded Response and Verification explanations use the same derived release window. They no longer assign Sentinel-2 or 2026 to mutated or future releases.

The Hyperspectral renderer is a two-area comparison throughout its chart, numeric summaries, and evidence copy. The smallest safe contract is therefore exactly two `hyperspectral.sites`. The schema rejects over-cardinality, and the direct renderer independently fails closed with an escaped in-panel warning. The existing explicit `{ state: "not_available", message }` path bypasses comparison-site validation and remains supported.

### Round 2 RED

Tests were changed first in `tests/views-render.test.mjs` and `tests/release-schema.test.mjs`.

The combined focused run exposed the fixed-provenance and renderer-cardinality failures:

```sh
node --test tests/views-render.test.mjs tests/release-schema.test.mjs
```

The bounded-view regression changed Monitor dates to 2031 and 2034 but received fixed `Sentinel-2` / `2026` output. A three-site renderer fixture mounted the comparison, emitted a contradictory “two released spectra” heading, and generated an undefined third series color.

The schema regression was then isolated against the actual over-cardinality defect:

```sh
node --test --test-name-pattern='requires exactly two hyperspectral' tests/release-schema.test.mjs
```

Result before the contract fix: the three-site payload returned `ok: true`, failing `true !== false`.

### Round 2 GREEN

Focused command:

```sh
node --test tests/views-render.test.mjs tests/release-schema.test.mjs
```

Result: 44 passed, 0 failed. Coverage now mutates the Monitor record to 2031–2034 and verifies both bounded views and their legends follow the payload, with no fixed Sentinel-2/2026 output. It also proves that the schema rejects a third comparison site and that direct rendering leaves the Hyperspectral stage empty for any non-two-site input.

Final repository verification:

```sh
npm run check && npm test && npm run build
```

Result: TypeScript check passed; 94 tests passed with 0 failures; and the asset build verification passed. A subsequent `git diff --check` was clean.

### Round 2 files and boundaries

- `public/views.js`
- `public/release-schema.js`
- `tests/views-render.test.mjs`
- `tests/release-schema.test.mjs`
- `.superpowers/sdd/2026-08-25-authenticated-visual-parity/task-3-report.md`

No new provenance, asset, or sensor fields were invented. No asset URLs are constructed. Floating-vegetation, treatment-causation, and Kolkata reference/evaluation boundaries remain unchanged. No Task 4, Intelligence, service, publisher, or deployment files were modified.

Focused round 2 commit message: `fix: derive visual provenance from release`.

## Review fix round 3

The hidden pre-bootstrap application shell still contained fixed `Sentinel-2` and `2017–2026` source text even though `public/app.js` replaces those nodes from the active release after startup. The static shell now uses only `Release record` and `Approved release imagery` placeholders, consistent with the neutral release-driven UI.

### Round 3 RED/GREEN

The static-shell regression was written first in `tests/landing-layout.test.mjs`:

```sh
node --test tests/landing-layout.test.mjs
```

RED result: 2 passed and 1 failed because `public/index.html` still contained both fixed claims.

After replacing only the two initial shell strings, the same focused command passed 3 tests with 0 failures. The regression also asserts the exact neutral placeholder values so fixed provenance cannot silently return.

Final repository verification:

```sh
npm run check && npm test && npm run build
```

Result: TypeScript check passed; 95 tests passed with 0 failures; and asset verification passed. A subsequent `git diff --check` was clean.

Round 3 files:

- `public/index.html`
- `tests/landing-layout.test.mjs`
- `.superpowers/sdd/2026-08-25-authenticated-visual-parity/task-3-report.md`

No runtime release logic, renderer, service, Task 4, Intelligence, publisher, asset, or deployment behavior changed.

Focused round 3 commit message: `fix: neutralize initial release shell provenance`.
