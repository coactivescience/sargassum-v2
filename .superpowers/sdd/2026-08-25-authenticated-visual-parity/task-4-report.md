# Task 4 report: authenticated release integrity

## Outcome

The safe local portions of Task 4 are implemented. The Node integration
harness exercises the existing authenticated tenant and current-manifest
clients, release classification, complete workspace navigation, real view
renderers, the Monitor frame control, and intercepted image mounts without
adding a browser-test dependency.

No deployment, publication, promotion, staging mutation, or cloud-resource
change was performed.

## Coverage

- Intercepts only the authenticated accessible-tenant and tenant-scoped
  current-manifest service routes; both requests use `credentials: include`.
- Loads a full `giant-salvinia-legacy-v2` fixture whose eight image references
  resolve through the manifest registry to the configured API origin and the
  selected tenant/release asset prefix.
- Visits Monitor, Detect, Caddo Lake Ops, Plan Response, Verify Results, Deploy,
  and Hyperspectral, including a Monitor transition from the 2021 frame to the
  2022 frame and a verification transition to the after frame.
- Asserts that the complete set of intercepted renderer image mounts equals the
  registered asset URLs and that every URL remains under the authenticated
  tenant/release asset prefix.
- Loads the one-scene scientific fixture through the same authenticated flow
  and verifies the limited-release panel, one-acquisition status, hidden map,
  empty navigation, and absence of image mounts.
- Injects an unregistered direct `https://` Monitor frame into the manifest
  payload and asserts `ReleaseError("invalid_release")` before the application,
  navigation, or map renderer mounts.

## TDD evidence

Baseline before Task 4:

```text
npm test
PASS: 95 tests, 0 failures
```

RED — the plan's required e2e command had no runnable project entrypoint:

```text
npm run test:e2e -- tests/e2e/full-release-workspace.spec.mjs
exit 1: Missing script: "test:e2e"
```

The first focused harness run also caught an incorrect test-DOM lookup for the
verification after-frame control (1 pass, 1 failure). The lookup was corrected
to traverse the candidate-detail element, matching the browser DOM hierarchy.

GREEN — focused checks after the minimum harness and package script were added:

```text
npm run test:e2e -- tests/e2e/full-release-workspace.spec.mjs
PASS: 2 tests, 0 failures

node --test tests/app-release.test.mjs
PASS: 12 tests, 0 failures
```

Final local verification:

```text
npm run check && npm test && npm run build
PASS: TypeScript check; 96 tests, 0 failures; asset verification build

npm run test:e2e -- tests/e2e/full-release-workspace.spec.mjs
PASS: 2 tests, 0 failures
```

## Staging blocker

Staging acceptance was not attempted and cannot be claimed. There is no
verified and promoted full Caddo `giant-salvinia-legacy-v2` release: the source
inventory is incomplete and publisher-capacity redesign is still pending.
Consequently there is no release ID or promoted tenant payload against which to
verify `/ready`, normal sign-in, visual deep-link refreshes, expired or
unauthorized asset rejection, or the release audit trail. Those checks remain
blocked until the service has a verified full source inventory, the redesigned
publisher can safely build and promote it, and an authenticated staging tenant
has that full release active.
