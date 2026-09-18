# Giant Salvinia Legacy-Parity Migration Design

## Goal

Restore every user-facing, scientifically supported capability of the legacy Giant Salvinia product in the authenticated tenant application. The result must be reproducible from the archived source data, tenant scoped, and safe to release through the existing immutable-release workflow.

## Scope

### Caddo operational experience

The authenticated lake workspace must restore the legacy Caddo experience:

1. **Monitor** — replay the selected clear Caddo observations across the 2017–2026 record.
2. **Detect** — show the latest natural-color composite, detected floating vegetation, affected coves, and ranked inspection priorities.
3. **Plan Response** — replay the August 2021 decision point and its bounded later outcomes.
4. **Verify Results** — present rapid-decline candidates with before/after imagery, explicitly as change signals rather than proof of treatment.
5. **Deploy** — present the operationalization requirements and current Caddo picture.
6. **Hyperspectral Potential** — present the Kolkata comparison only when its evidence gate passes; otherwise show its bounded unavailable state.

The current Caddo Lake Ops release-grounded briefing remains an additional, clearly labelled operational feature. It must not replace the legacy workflows.

### Intelligence workspace

The application must provide the capabilities of the legacy Operations Intelligence console:

- Caddo hotspots, growth, spread/front, infrastructure-risk, sensor-placement, sampling, crew-routing, EDRR, early-warning, and portfolio views.
- Live priority-weight adjustment and CSV export where the legacy experience provided it.
- Deterministic, release-grounded briefing and question-answering.
- Santee Cooper reference-label context and portfolio comparison, marked as reference-label evidence rather than field ground truth.
- A visible explanation that Sam Rayburn was assessed but is excluded because the Caddo detector did not transfer credibly. Sam Rayburn is not selectable as an operational lake.

Optional generative answers may be added only behind an authenticated server endpoint. Browser-held provider API keys are out of scope and prohibited.

### Data and claim boundaries

- Caddo detections are floating vegetation, not confirmed giant salvinia.
- Historical response calculations may use only observations available at the historical decision point.
- Rapid decline is a candidate signal, not a demonstrated treatment effect.
- Santee values are ReMetrix image-interpretation labels, not field ground truth.
- Raw imagery in AWS or tenant R2 never makes a site operational by itself. A site is exposed only after its required validation and release contract pass.

## Evidence and source of truth

The AWS account `331757624849` has the historical Caddo Sentinel-2 source archive under the `coactivesatellitedata` bucket, beginning in 2017, and source imagery for additional sites. Discovery did not find a packaged legacy distribution, `data.js`, or presentation-layer bundle in that account. The migration must therefore reproduce the legacy results from source rather than copy a static site.

The legacy `giant_salvinia` repository remains the source of truth for:

- Caddo analysis and presentation construction (`salvinia/`).
- The visual contract (`demo/`).
- Intelligence calculations and deterministic answers (`salvinia_agent_source/`).
- Scientific acceptance criteria and transfer exclusions.

The existing `coactive_data_service` is the source of truth for authorization, tenant storage, job execution, immutable release verification, activation, and audit records. The existing `giant_salvinia_v2` project is the authenticated client application.

## Architecture

```text
AWS historical source archive
        |
        | controlled, auditable import (no AWS key in browser/container)
        v
tenant-scoped raw inputs in R2
        |
        v
versioned legacy analysis + presentation/intelligence compiler
        |
        | full payload + rendered assets + checksums
        v
immutable tenant Salvinia release
        |
        | existing verification, authorization, promotion, audit trail
        v
authenticated Lake Operations app
        |                         |
        v                         v
Caddo visual experience    Intelligence workspace
```

### Release format

The publisher will produce a single active Caddo release with a versioned payload. It must contain the existing full-client contract:

```json
{
  "meta": { "schema": "giant-salvinia-legacy-v2", "source_revision": "..." },
  "sites": [],
  "caddo_geometry": {},
  "monitor": {},
  "detect": {},
  "response": {},
  "verification": {},
  "hyperspectral": null,
  "evidence": {},
  "intelligence": {}
}
```

Every asset reference remains a logical `file` value. The release manifest enumerates every referenced object with content type, byte size, and SHA-256. The service resolves only those registered objects to tenant-authorized asset URLs.

`intelligence` is a validated, compact release-owned payload. It contains Caddo operational products, Santee reference context, portfolio information, deterministic-answer inputs, citations, and claim-boundary strings. It may not contain credentials, opaque model prompts, or an API key.

### Publisher and import boundary

The current `demo` operation emits a one-scene fixture; it is retained as a smoke-test fixture and must not be presented as the legacy product. A new, separately named full-release operation will:

1. consume a declared AWS-source revision already staged into the tenant bucket;
2. reproduce the validated legacy Caddo results, image composites, optional Kolkata evidence, and intelligence payload;
3. write only within its assigned immutable release prefix;
4. emit the manifest and all assets for existing checksum verification; and
5. activate only when the complete release validates.

The source import runs outside browser code and outside the Cloudflare processor's credentials. It uses the local AWS SSO session or a dedicated least-privilege importer to read the AWS archive, then writes through a scoped tenant ingestion path. The processor receives only its existing short-lived release capability.

### Client behavior

The summary-only scientific-release branch is transitional and must not be selected for a full legacy payload. The client will:

- validate the full release schema before initializing a map;
- preserve the Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy, and gated Hyperspectral navigation;
- expose the Intelligence workspace as an authenticated application route, using the release-owned `intelligence` data;
- preserve tenant selection and browser navigation semantics;
- show a clear unavailable/limited state when an optional evidence package is absent rather than fabricate an analysis; and
- reject malformed or incomplete releases instead of rendering a partial screen.

### Intelligence answers

Deterministic answers stay client-side and use only the active release's intelligence payload. A generative-answer endpoint, if enabled later, must require tenant `can_view` permission, use a server-held provider credential, receive a bounded release-derived context, rate-limit and audit requests, and fall back to deterministic answers on failure. It must enforce the same claim boundaries.

## Delivery sequence

This migration is decomposed into independently releasable workstreams:

1. **Reproducible data recovery** — document the exact AWS source revision, stage it into tenant scope, and reproduce the legacy Caddo data products without publishing them.
2. **Full release publisher** — add the non-fixture operation, manifest validation, integrity tests, and staged promotion of a full Caddo release.
3. **Visual app parity** — remove the staged-summary route for the full contract, restore and test every legacy visual workflow, including gated unavailable states.
4. **Intelligence parity** — port the deterministic intelligence payload and UI, release it as an authenticated workspace, and add secure optional generative answering only after deterministic parity works.
5. **Additional-site posture** — preserve Santee reference context and Sam Rayburn exclusion; create per-site readiness contracts before exposing any other AWS/R2 imagery as an operational experience.

No workstream may skip the previous workstream's validation gate. A production deployment is not part of the first migration release; staging is the target until its full release, authenticated client flow, and claim boundaries are verified.

## Verification

### Data and publisher

- Re-run the legacy analysis, presentation, and intelligence test suites against the staged source revision.
- Compare the new full-release payload's required fields, cove references, asset references, and claim-boundary strings against the legacy validators.
- Verify every release object is within the assigned prefix, matches its recorded size and SHA-256, and is registered by the manifest.
- Confirm a failed build cannot replace the active release.

### Client

- Add contract fixtures for a valid full legacy release, unavailable Kolkata evidence, malformed releases, and the one-scene fixture.
- Run visual and interaction tests for all navigation sections, monitor playback reset, response replay, verification candidate switching, and asset resolution.
- Verify tenant changes and browser history never bypass tenant authorization.
- Verify the intelligence route renders Caddo operational and Santee reference states and refuses unvalidated sites.

### Staging acceptance

- Confirm the authenticated current-manifest request returns the active full release and no direct storage URL.
- Exercise the same authenticated user path that previously rendered the summary-only screen; it must render the complete navigation and map.
- Confirm the service readiness endpoint, service UI verification, bindings, and the exact app flow pass after deployment.
- Record release ID, source revision, test evidence, and rollback target in the release audit trail.

## Rollback

The existing activation model retires the prior active release only while promoting the new one. Before promotion, retain the current staged release and record its release ID. If acceptance fails, reactivate the previous verified release through an audited administrative operation; do not edit objects in place.

## Non-goals

- Treating raw AWS/R2 imagery as a validated salvinia result.
- Making Sam Rayburn operational without new calibration or labels.
- Reintroducing a client-side provider API key.
- Deploying credentials, AWS access keys, or tenant storage credentials to the browser.
- Rebuilding all possible sites before the legacy-supported Caddo, Santee-reference, and Kolkata capabilities pass their own validation gates.
