# Publishing optional legacy reference evidence

The service imports optional Intelligence context and passing Kolkata Hyperspectral evidence into the same immutable, tenant-owned Caddo source revision as the acquisition inventory. Neither input changes the approved acquisition count or digest. These instructions describe local preparation and the existing import path; this migration work has not uploaded or promoted a release.

Run commands from `coactive_data_service` with its Salvinia Python dependencies installed and `PYTHONPATH=containers/salvinia-heavy`. The importer adds the application path itself. Use approved inputs, an approved complete migration manifest, a new revision, and the existing AWS SSO/R2 credentials. Do not use checked-in synthetic test fixtures as source evidence.

## Intelligence context

Supply `--intelligence-context /absolute/path/context.json --context-date YYYY-MM-DD` to `scripts/import-salvinia-archive.py`. The date is the declared reference-input date. The JSON may contain only `occurrences` and `santee_reference`; its content must satisfy the service's existing Intelligence reference schema. The importer and compiler both validate it. The object is bounded to 4 MiB and becomes `intelligence-context.json` beneath the selected raw revision.

The occurrence entries and historical Santee annual measurements must come from approved data. An omitted input remains absent; the compiler does not fabricate observations. Historical EDRR planning costs are separately labelled as reference estimates, and Santee remains reference material.

## Hyperspectral evidence

Supply `--hyperspectral-output /absolute/path/kolkata-output` to the importer. The directory must contain the legacy `manifest.json`, `hyperspectral-potential.json`, and the five images referenced by the potential payload. The adapter checks the actual named/numeric legacy gate, matching conclusion, primary capture date, confined image paths, image formats and dimensions. Failed or incomplete evidence is rejected before storage calls.

For local inspection without uploading, the adapter also supports:

```sh
PYTHONPATH=containers/salvinia-heavy python -m app.salvinia.hyperspectral \
  /absolute/path/kolkata-output /absolute/path/prepared-evidence \
  --source-prefix salvinia/raw/caddo/approved-revision/
```

This writes the six bounded evidence files and a `source-objects.json` inventory fragment. It does not publish a release. The importer performs the same conversion directly, so separate preparation is optional.

## Import and release contract

Add the optional flags to the normal importer invocation, alongside `--migration-manifest`, `--source-revision`, `--tenant-bucket`, `--r2-endpoint`, and `--aws-sso-profile`. First using `--dry-run` validates the local inputs and prints the intended keys without storage access. An actual import still requires the existing credentials and approved acquisition inventory.

Reference bytes are SHA-256 bound, uploaded through the existing verified-write helper, and listed in the source manifest written last. Both prepared and raw Caddo compilation accept the optional package. The compiler, execution runner and release promotion validator reject altered, undeclared, mismatched or insufficient evidence. Browser assets are served through the authenticated tenant/release route.

An available Hyperspectral screen remains Kolkata reference evaluation: it does not establish species identity, treatment causality or Caddo operational readiness. Insufficient open-water control support is displayed explicitly and is not promoted to a measured zero.

## Restored Kolkata research operations

The existing site importer (`scripts/import-salvinia-site.py`) accepts the primary `2025-11-13` capture alone or the exact pair `2025-11-12` and `2025-11-13`, together with `kolkata-windows.geojson` and `kolkata-water-screen.geojson`. It binds local ZIP members and sidecars by checksum; its default mode writes a local manifest, and remote import requires explicit `--upload`.

Use the registered `kolkata-survey`, `kolkata-validate` and `kolkata-feasibility` operations through the existing authorized service job path. Survey scans the frozen 500 m grid using 150 m windows. Validation reports support from the supplied mapped-water polygons and geographic separation. Feasibility uses two predefined windows and, with both captures, restores the seven-shared-band acquisition diagnostic. A second date is not interpreted as vegetation change. A passing evidence package is generated only when both the spectral and mapped-water gates pass.

Signed polygons establish source integrity; they do not establish independent field validation. Survey, validation and feasibility outputs remain research artifacts, with raw quality codes uninterpreted and species/operational claims disabled.
