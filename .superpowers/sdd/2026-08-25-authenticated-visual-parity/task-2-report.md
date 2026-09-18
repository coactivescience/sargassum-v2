# Task 2 report: Authenticated workspace lifecycle and navigation

## Scope

Implemented only the authenticated browser lifecycle and shell/navigation behavior from Task 2. Renderer modules, intelligence, service code, publishing, and deployment were not changed.

## TDD evidence

### Primary RED

The old scientific-only app regression was replaced with explicit full- and limited-release tests, and the bootstrap test was changed to require `loadCurrentRelease()` to be unwrapped into the release plus `{ kind, validation }` classification.

Command:

```sh
npm test -- tests/app-release.test.mjs tests/bootstrap.test.mjs
```

The first run exposed a test-harness setup error because the classic browser script resolves `AppCore` and `AppViews` globally. After correcting only the harness, the valid RED run reported 58 passing tests and 7 expected failures:

- bootstrap passed the classification wrapper unchanged;
- repeated full starts duplicated navigation;
- limited releases entered the normal visual workspace;
- `?beat=ops` fell back to Monitor;
- active tabs had no `aria-current="page"`;
- numeric and invalid deep links did not expose a current tab under the new assertion; and
- selection did not focus the newly rendered view heading.

### Initial Hyperspectral interpretation (superseded by review fix round 1)

Command:

```sh
node --test tests/app-release.test.mjs
```

The initial implementation interpreted `not_available` as an omitted capability. Review fix round 1 below corrects that interpretation: an explicit unavailable state is a declared capability whose bounded explanatory view remains reachable.

### GREEN

Commands:

```sh
node --test tests/app-release.test.mjs
npm test -- tests/app-release.test.mjs tests/bootstrap.test.mjs
```

Results: 7/7 focused app lifecycle tests passed. The requested npm command expands the repository test glob and passed all 66 discovered tests with 0 failures.

## Exact behavior

- Bootstrap unwraps `{ kind, release, validation }`, passes the release separately to the selected tenant app, and forwards `{ kind, validation }` without reclassifying browser data.
- `window.startSalviniaApp` uses only the supplied classification as its full/limited gate; the removed `isScientificRelease`/`!payload.monitor` heuristic is no longer present.
- A full release initializes or reuses the Leaflet workspace, replaces navigation on refresh, stops prior playback, and renders these tabs in order: Monitor, Detect, Caddo Lake Ops (`operations`), Plan Response, Verify Results, Deploy, and Hyperspectral whenever the release declares that supported capability. An explicit `state: "not_available"` retains the tab and renders its bounded unavailable view.
- A limited release keeps the authenticated app shell visible, clears navigation, hides the map and story panel, and shows the named `#release-status` panel. The panel reports release version (or honestly says it was not provided), acquisition count, schema-derived missing capabilities, and guidance to publish a complete release.
- The one-acquisition scientific fixture remains limited and no timeline, map history, response outcome, or verification history is fabricated from it.
- `?beat=ops` resolves to `operations`; existing one-based numeric links remain supported; unknown or unavailable beats resolve to Monitor. URL replacement preserves unrelated parameters and the hash.
- The active navigation button receives `aria-current="page"`. Activating a tab renders its view, gives the new panel `h1` `tabindex="-1"`, and focuses it. Navigation labels are created with DOM nodes rather than injected label HTML.
- Landing authentication/error status now uses `#landing-release-status`, leaving `#release-status` uniquely owned by the authenticated app shell.

## Verification gates

The final commit was prepared only after running the requested lifecycle suite, TypeScript check, static asset build, and `git diff --check`. Exact final results are recorded in the task handoff.

## Commit

Focused Task 2 commit message: `feat: restore authenticated release lifecycle`.

## Concern

The summary fixture does not declare a release version. The limited panel therefore displays `Not provided` rather than inventing one. A future publisher can populate `meta.version`, `meta.schema`, or the top-level `version` field and the same panel will display it.

## Review fix round 1

Three lifecycle findings were reproduced and corrected without changing renderer modules:

1. An explicit Hyperspectral `not_available` object is a declared supported capability. The tab and `?beat=hyperspectral` deep link now remain active so the existing bounded unavailable renderer can explain the evidence gate.
2. Browser error and empty-release transitions now dispose the current app before hiding its shell. Full-app disposal stops playback, clears Leaflet and Hyperspectral state, removes comparison mode, and clears the active beat. The existing single unload-listener guard remains in place.
3. Limited classifications whose validation errors do not map to a named capability now report `Release payload validation failed` instead of the contradictory `Complete visual workspace` fallback.

Focused RED command:

```sh
node --test tests/app-release.test.mjs tests/bootstrap.test.mjs
```

Before implementation, 16 tests passed and 5 failed for the expected reasons: the unavailable Hyperspectral tab was absent; the unmapped fallback claimed the workspace was complete; disposal left Hyperspectral/active state behind; and the browser error and empty-release renderers had no testable disposal behavior.

Focused GREEN used the same command and passed 21/21 tests. Final verification ran:

```sh
npm test -- tests/app-release.test.mjs tests/bootstrap.test.mjs
npm run check
npm run build
git diff --check
```

The requested npm command expanded the repository suite and passed 70/70 tests with 0 failures. TypeScript and static-asset verification exited successfully; the final whitespace gate is recorded in the review-fix handoff.
