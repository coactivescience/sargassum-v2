# Task 1 Report: Full Visual Release Contract

## Result

Added a pure browser-side full-release validator and portable fixtures. `classifyRelease(release)` returns `{ kind, release, validation }`, while `loadCurrentRelease` still returns the resolved payload object expected by the current bootstrap consumer.

## TDD evidence

Red command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

The command failed as intended before production implementation: `release-client.js` did not export `classifyRelease`, and `public/release-schema.js` did not exist. The Node test runner reported 36 passing existing tests and 2 failing new test files.

Green command (run after implementation and again as the final test gate):

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

It passed with 50 tests, 0 failures. The package test script also expands `tests/*.test.mjs`, so this command runs the full discovered Node suite in addition to the named files.

## Test gates

```sh
npm run check
npm run build
git diff --check
```

All passed. The schema tests cover a complete fixture, the current one-acquisition summary fixture, malformed dates, non-array timelines, missing Caddo geometry, missing resolved frame assets, and direct `s3://` storage URLs. The release-client test confirms classification does not change the payload identity supplied to bootstrap.

## Manifest boundary

Asset reference resolution remains the only conversion of logical `file` keys into browser URLs. The validator accepts only resolved tenant release asset endpoints and makes no network requests or dynamic evaluation. Therefore raw storage keys and direct storage URLs remain rejected, while the existing unregistered-asset error remains in force before classification.

## Files

- `public/release-schema.js`
- `public/release-client.js`
- `tests/release-schema.test.mjs`
- `tests/release-client.test.mjs`
- `tests/fixtures/full-legacy-release.json`
- `tests/fixtures/summary-release.json`

## Commit

Focused Task 1 commit: `feat: define full visual release contract` (commit hash is reported in the task handoff).

## Concern / next task boundary

Task 2 must consume `classifyRelease` to render the explicit limited-release status. This task deliberately does not change bootstrap or app rendering, preserving the current payload interface until that lifecycle work is ready.

## Review fix round 1

`loadCurrentRelease` now returns the classification object itself: `{ kind, release, validation }`. Its async test calls the real loader against a manifest response and verifies both its limited classification and its resolved asset URLs.

The validator now rejects empty Monitor and Response timelines, empty Verify Results candidates, missing evidence records/lines, and missing renderer-dereferenced record fields. It also validates the renderer inputs for geometry, detection rows, response priorities, verification candidates, and a present hyperspectral comparison.

Red command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

The revised tests failed as intended before the fix: the loader result had no `kind`, and empty timelines/candidates plus omitted renderer fields still produced `ok: true`. The runner reported 48 passing tests and 3 focused failures. After adding the hyperspectral dereference assertion, the same red command continued to fail on the same missing validation behavior.

Green command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

It passed with 51 tests and 0 failures. The final static/type/build gate commands and focused commit are recorded in the task handoff.

This review fix supersedes the original bootstrap-compatibility note above: `loadCurrentRelease` now returns the required classification wrapper. Task 2 must adapt bootstrap and rendering to consume `result.release` and the limited/full state.

## Review fix round 2

Read `public/views.js` and `public/core.js` to derive the remaining full-admission checks from actual renderer inputs. The validator now requires at least two finite geographic corners for Monitor, Response, and Verification bounds; a finite `monitor.frames[*].mat_ha`; nonempty evidence line lists; and a nonempty spectrum for each hyperspectral site with finite `wavelength_nm`, `normalized_q25`, `normalized_median`, and `normalized_q75` values.

Red command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

The new negative cases failed before implementation: malformed bounds, `NaN` monitor area, empty evidence lines, empty spectra, and missing/non-finite spectral values still produced `ok: true`. The runner reported 51 passing tests and 2 focused failures.

Green command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

It passed with 53 tests and 0 failures. Final type, static-asset, and whitespace gates were run before committing the scoped fix.

## Review fix round 3

The validator now rejects nullable site, limitation, comparison, and Caddo-feature records before their fields reach the renderer. `evidence.*.comparison` is optional but, when truthy, must be an array of `{ method, median_overlap }` records. Sites require the Deploy fields `label`, `status`, and `detail`; limitations require `text`; supplied Caddo features require a geometry record and the feature-property `id` and `name` used by map callbacks.

A final source scan of `public/views.js` and `public/core.js` covered every release-payload array whose elements have property dereferences: Monitor and Response frames, Detect and Response cove rows, Verify candidates, sites, Caddo geometry features, evidence comparisons, hyperspectral sites/spectrum/limitations, plus the previously checked scalar arrays used without element-property access.

Red command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

The new tests failed before implementation: `sites: [null]`, truthy non-array comparison data, null limitation entries, and malformed supplied geometry features all still yielded `ok: true`. The runner reported 53 passing tests and 2 focused failures; the same red result persisted after extending the geometry property assertions.

Green command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

It passed with 55 tests and 0 failures. Final type, static-asset, and whitespace gates were run before committing the scoped correction.

## Review fix round 4

The validator now admits only the seven GeoJSON geometry types rendered by Leaflet: `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`, and `GeometryCollection`. Coordinate arrays are checked at the nesting depth required by each type, every position contains at least two finite numbers, and Geometry Collections are validated recursively. Unsupported type names, including inherited JavaScript object-property names, cannot bypass the allowlist.

A full release now requires `hyperspectral` to be an explicit object. It may contain the fully validated comparison payload or `{ state: "not_available", message }`; `null` and `undefined` are limited-release inputs because the full renderer contract cannot dereference them.

Initial red command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

Before implementation, the three new negative cases failed as intended: missing or unsupported geometry, malformed/non-finite coordinates nested in a Geometry Collection, and nullable hyperspectral data. The runner reported 57 passing tests and 3 failures. During the final audit, a focused regression for the inherited type name `constructor` failed with 15 passing schema tests and 1 failure before the type table was made prototype-safe.

Final green command:

```sh
npm test -- tests/release-schema.test.mjs tests/release-client.test.mjs
```

It passed with 60 tests and 0 failures. `npm run check`, `npm run build`, and `git diff --check` also passed.

The final renderer audit compared `public/release-schema.js` against Leaflet's geometry switch in `public/vendor/leaflet.js`, `MapView.coves` in `public/core.js`, and both hyperspectral branches in `public/views.js`. The accepted shapes cover those mount paths without changing `release-client.js`, asset resolution, or the registered authenticated asset boundary. Task 2 files and behavior remain untouched.
