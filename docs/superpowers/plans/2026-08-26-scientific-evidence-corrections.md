# Scientific Evidence Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct the last three release-truthfulness defects: count grouped Caddo acquisitions, use documented Santee reference evidence, and test strict intelligence through promotion.

**Architecture:** Approved inventory carries the exact post-dedup acquisition identity set and separately bounds raw source objects/bytes. Santee trend values are source-backed ReMetrix aggregates only. Promotion fixtures use a validated `giant-salvinia-intelligence-v1` object emitted by the real compiler fixture.

**Tech Stack:** TypeScript, Python, Node/Vitest, locked Salvinia container.

**Spec:** docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md

## Global Constraints

- Do not deploy, import AWS data, publish, or promote a real release.
- Caddo is operational; Santee is reference-only; Sam Rayburn remains excluded.
- A full release requires the authoritative post-dedup acquisition readiness floor and must fail closed otherwise.

---

### Task 1: Count approved acquisitions after grouping raw ZIP products

**Files:**

- Modify: ../coactive_data_service/src/salvinia-run.ts
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/runner.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Modify: ../coactive_data_service/tests/salvinia-run.test.ts

- [ ] Write red fixtures with 663 grouped acquisition IDs represented by paired ZIP products, and one-short grouped identity fixture.
- [ ] Require a signed `expectedAcquisitionCount` equal to canonical post-dedup acquisition identity count; use raw-source-object limits high enough for paired tiles and a byte limit based on configured heavy runtime capacity, not 12 GiB if the approved record exceeds it.
- [ ] Prove 663 grouped acquisitions pass and 662 fail before science; prove duplicate processing copies cannot inflate count.
- [ ] Run focused TypeScript and locked container tests, then commit.

### Task 2: Use only documented Santee ReMetrix reference aggregates

**Files:**

- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py

- [ ] Write red golden tests for source-backed `2020`, `2025`, `112.6 ha`, and `1215.4 ha` reference values, including a citation/limitation that Santee is not operational.
- [ ] Replace unsupported frozen values and derive CAGR from those exact documented aggregates.
- [ ] Run locked full container tests and commit.

### Task 3: Prove strict intelligence survives full promotion

**Files:**

- Modify: ../coactive_data_service/tests/salvinia-releases.test.ts
- Modify: ../coactive_data_service/tests/salvinia-source-capability.test.ts

- [ ] Replace the stale `schema_version: 1` fixture with a full `giant-salvinia-intelligence-v1` fixture meeting strict Santee/recommendation/answer/crew-route requirements.
- [ ] Assert promotion retains the full strict payload and rejects stale/reduced intelligence.
- [ ] Run `npm run check`, full `npm test`, importer tests, locked container suite, and commit.
