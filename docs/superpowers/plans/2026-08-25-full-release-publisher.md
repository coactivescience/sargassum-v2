# Full Legacy Release Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the legacy Caddo payload, assets, and intelligence data from the AWS archive and publish them as a checksum-verified tenant release.

**Architecture:** `coactive_data_service` owns the migration backend. Its Salvinia heavy container compiles verified tenant raw inputs into the complete legacy-compatible payload, assets, and intelligence document. A Caddo-only `legacy-release` job writes the assigned immutable release prefix, and existing promotion activates it only after every output and manifest verifies. The legacy repository is read-only parity reference material, never a production dependency.

**Tech Stack:** Python 3, ported legacy-compatible analysis modules, AWS SSO/boto3, Cloudflare R2, Cloudflare Containers, TypeScript, Vitest.

**Spec:** docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md

## Global Constraints

- Keep AWS and R2 credentials out of the browser and container request payloads.
- Preserve tenant authorization, prefix confinement, checksums, immutable promotion, and audit logging.
- Retain demo as the one-scene fixture; it is never the full release operation.
- Caddo detections remain floating vegetation, not a species confirmation.
- Deliver to staging only.

---

### Task 1: Port the full-release compiler into coactive_data_service

**Files:**

- Create: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/demo.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/runner.py

**Interfaces:**

- Produces: `compile_full_release(request, guarded_storage) -> ReleaseOutput`
- Release schema: `giant-salvinia-legacy-v2`
- Required payload keys: meta, sites, caddo_geometry, monitor, detect, response, verification, hyperspectral, evidence, intelligence

- [ ] **Step 1: Write a failing export-contract test.**

~~~
def test_full_release_has_visual_and_intelligence_contract(guarded_storage):
    release = compile_full_release(full_release_request(), guarded_storage)
    assert release.payload["meta"]["schema"] == "giant-salvinia-legacy-v2"
    assert set(release.payload) >= REQUIRED_PAYLOAD_KEYS
    assert release.payload["intelligence"]["sites"][0]["status"] == "operational"
    assert all(not value.startswith(("http://", "https://", "s3://")) for value in file_values(release.payload))
~~~

- [ ] **Step 2: Verify the test fails because the compiler does not exist.**

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m pytest test_runner.py -q`

Expected: FAIL with an import error for `compile_full_release`.

- [ ] **Step 3: Implement the compiler.**

~~~
def compile_full_release(request, guarded_storage):
    inputs = read_verified_inputs(request.source_prefix, guarded_storage)
    payload, rendered_assets = build_legacy_compatible_payload(inputs)
    payload["meta"] = {**payload["meta"], "schema": "giant-salvinia-legacy-v2",
                       "source_revision": request.source_revision}
    payload["intelligence"] = build_intelligence_payload(inputs)
    return ReleaseOutput(payload, rendered_assets)
~~~

Port the legacy analytical, rendering, and intelligence algorithms as explicit container modules, with the legacy UI/data output used only as golden-reference fixtures. Input readers accept only verified raw-source manifest objects. Asset keys are relative names, reject traversal, and are generated from data rather than copied executable `data.js` text.

- [ ] **Step 4: Implement the intelligence builder as a container module.**

~~~
def build_intelligence_payload(inputs, crew_budget=CREW_BUDGET_DEFAULT):
    return {"sites": sites, "portfolio": engine.build_portfolio(sites),
            "reference": reference, "claim_boundaries": boundaries}
~~~

`salvinia/intelligence.py` serializes this function. Tests assert Caddo and Santee appear and Sam Rayburn remains excluded.

- [ ] **Step 5: Run legacy verification.**

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m pytest test_runner.py -q`

Expected: PASS.

- [ ] **Step 6: Commit.**

Run: `cd ../coactive_data_service && git add containers/salvinia-heavy/app && git commit -m "feat: compile full Salvinia tenant release"`

### Task 2: Import the AWS archive into a tenant raw-source revision

**Files:**

- Create: ../coactive_data_service/scripts/import-salvinia-archive.py
- Create: ../coactive_data_service/tests/salvinia-archive-import.test.ts
- Modify: ../coactive_data_service/src/salvinia-releases.ts

**Interfaces:**

- Consumes: `--source-revision`, AWS SSO profile, R2 endpoint, and explicit tenant bucket.
- Produces: `salvinia/raw/caddo/<revision>/source-manifest.json` and only verified raw image/supporting-data objects.

- [ ] **Step 1: Write a failing key-confinement test.**

~~~
def test_import_keys_are_confined_to_declared_revision():
    assert source_keys("caddo-legacy-v2-deadbeef", ["sentinel/2017-01-01.tif"]) == [
        "salvinia/raw/caddo/caddo-legacy-v2-deadbeef/sentinel/2017-01-01.tif",
    ]
~~~

- [ ] **Step 2: Implement source-key confinement and the import subcommand.**

~~~
def source_keys(revision, names):
    root = "salvinia/raw/caddo/" + revision + "/"
    return [root + name for name in names if safe_relative_path(name)]
~~~

Use AWS SSO only for source reads and explicitly supplied local R2 credentials only for writes. Do not print either. Inventory and filter only the Caddo source set recorded in the migration manifest; other site imagery is not imported or operationalized by this command. After every put, `head_object` must match bytes and SHA-256 metadata, and the final source manifest lists every object, checksum, size, content type, and source date.

- [ ] **Step 3: Run unit tests and the dry run.**

Run: `cd ../coactive_data_service && npm test -- --run tests/salvinia-archive-import.test.ts`

Run: `python scripts/import-salvinia-archive.py --dry-run --source-revision caddo-legacy-v2-<commit> --tenant-bucket <staging-bucket> --r2-endpoint <r2-endpoint>`

Expected: PASS; dry run lists only the declared Caddo raw-source prefix.

### Task 3: Route a full release operation through the existing job system

**Files:**

- Modify: ../coactive_data_service/src/salvinia.ts
- Modify: ../coactive_data_service/src/salvinia-run.ts
- Modify: ../coactive_data_service/src/jobs.ts
- Modify: ../coactive_data_service/tests/salvinia.test.ts
- Modify: ../coactive_data_service/tests/salvinia-run.test.ts

**Interfaces:**

- Consumes: { siteKey: "caddo", operation: "legacy-release", sourceRevision }.
- Produces: a heavy job plan with releaseId and releasePrefix.

- [ ] **Step 1: Write a failing operation-plan test.**

~~~
it("allocates a release prefix for a full legacy Caddo package", () => {
  const plan = createSalviniaRunPlan({ jobId, siteKey: "caddo", operation: "legacy-release",
    sourceRevision: "caddo-legacy-v2-deadbeef", releaseId });
  expect(plan.releasePrefix).toBe("salvinia/releases/" + releaseId + "/");
});
~~~

- [ ] **Step 2: Define one release-producing predicate and use it everywhere.**

~~~
export const SALVINIA_CADDO_OPERATIONS = ["inventory", "ingest", "analyse", "natural-color", "demo", "legacy-release"] as const;
export const producesRelease = (operation) => operation === "demo" || operation === "legacy-release";
export const salviniaExecutionTarget = (operation) => operation === "analyse" || operation === "legacy-release" ? "heavy" : "light";
~~~

Use producesRelease in run-plan creation and job dispatch. A non-Caddo site or missing release ID must continue to fail.

- [ ] **Step 3: Run focused tests.**

Run: cd ../coactive_data_service && npm test -- --run tests/salvinia.test.ts tests/salvinia-run.test.ts

Expected: PASS.

### Task 4: Compile and publish the full release in SalviniaHeavyContainer

**Files:**

- Modify: ../coactive_data_service/containers/salvinia-heavy/app/runner.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/main.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Modify: ../coactive_data_service/tests/salvinia-pipeline.test.ts
- Modify: ../coactive_data_service/tests/salvinia-releases.test.ts

**Interfaces:**

- Consumes: verified raw `source-manifest.json` and source objects in `request.source_prefix`.
- Produces: release-prefix objects and manifest.json with artifact records matching every output.

- [ ] **Step 1: Add failing importer tests.**

~~~
def test_legacy_release_rejects_unregistered_generated_asset(tmp_path):
    request = full_release_request("caddo-legacy-v2-deadbeef")
    write_source_fixture(tmp_path, source_manifest=manifest_missing_required_input())
    with pytest.raises(CompatibilityError, match="unknown asset"):
        compile_full_release(request, guarded_storage)
~~~

Add equivalent cases for a raw-input hash mismatch, traversal path, absolute URL, oversized object, missing intelligence key, and an unreferenced generated asset.

- [ ] **Step 2: Add strict source-manifest parsing and container compilation.**

~~~
FULL_RELEASE_SCHEMA = "giant-salvinia-legacy-v2"
REQUIRED_PAYLOAD_KEYS = {"meta", "sites", "caddo_geometry", "monitor", "detect",
                         "response", "verification", "hyperspectral", "evidence", "intelligence"}
~~~

Validate lower-case 64-character hashes, content types, byte sizes, raw-prefix keys, source metadata, logical generated file references, and all required payload fields before writing any release object. The compiler must produce a complete result from the verified source set; it does not accept a browser-formatted package from an external repository.

- [ ] **Step 3: Copy verified assets and construct the service manifest.**

~~~
output = guarded.put_bytes(request.release_prefix + relative_asset, generated_bytes, content_type)
artifacts[output["key"]] = {"checksum_sha256": output["checksumSha256"],
                             "content_type": output["contentType"], "size_bytes": output["sizeBytes"]}
release_manifest = {"payload": rewritten_payload, "artifacts": artifacts}
~~~

Rewrite only generated file values to release keys. Emit every object, including manifest.json, in the completion event so existing workflow verification can activate it.

- [ ] **Step 4: Extend end-to-end fixture assertions and run verification.**

~~~
expect(result.release.payload).toMatchObject({
  meta: { schema: "giant-salvinia-legacy-v2" },
  monitor: expect.any(Object), detect: expect.any(Object), response: expect.any(Object),
  verification: expect.any(Object), intelligence: expect.any(Object),
});
~~~

Run: cd ../coactive_data_service && npm run verify && npm test -- --run tests/salvinia-releases.test.ts tests/salvinia-pipeline.test.ts tests/workflows.test.ts tests/containers.test.ts

Expected: PASS; any raw-input tampering prevents release activation.

### Task 5: Add a staging-only admin publishing action and commit the backend

**Files:**

- Modify: ../coactive_data_service/src/index.ts
- Modify: ../coactive_data_service/public/console.js
- Modify: ../coactive_data_service/tests/console-ui.test.ts
- Modify: ../coactive_data_service/tests/index.test.ts
- Modify: ../coactive_data_service/scripts/verify-staging-ui.mjs

**Interfaces:**

- Consumes: POST /api/admin/tenants/:tenantId/salvinia/caddo-legacy-release with source_revision.
- Produces: a queued heavy legacy-release job.

- [ ] **Step 1: Add route tests.**

~~~
await request(app, "POST", "/api/admin/tenants/" + tenantId + "/salvinia/caddo-legacy-release",
  { source_revision: "caddo-legacy-v2-deadbeef" }).expect(202);
await request(app, "POST", "/api/admin/tenants/" + tenantId + "/salvinia/caddo-legacy-release",
  { source_revision: "../bad" }).expect(422);
~~~

- [ ] **Step 2: Implement the action using the existing admin mutation guard, rate limiter, active-storage check, createJob, and publishOutbox flow.**

The action copy is Publish full legacy Caddo release. It passes target heavy, workload salvinia, siteKey caddo, operation legacy-release, and the validated source revision.

- [ ] **Step 3: Run staging acceptance and commit.**

Run: cd ../coactive_data_service && npm run verify && npm run verify:staging:config && npm run verify:staging:ui

Run: npx wrangler whoami && npm run deploy:staging

Expected: staging account 0d80409324f0ffb6c359817bbb92d95b, then an authenticated current-manifest request returns a full release with no direct storage URLs.

Run: cd ../coactive_data_service && git add src containers public tests scripts && git commit -m "feat: publish full legacy Caddo releases"
