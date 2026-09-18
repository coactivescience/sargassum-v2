# Legacy Intelligence Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Port the legacy operational intelligence console into the tenant application, preserving its deterministic analyses and replacing its browser-held model key with an optional protected server-side answer endpoint.

**Architecture:** `coactive_data_service` produces a bounded `intelligence` document alongside visual data in its Salvinia heavy container. A standalone browser module renders the legacy summary, prioritization, assets, sensors, sampling, EDRR, early-warning, and portfolio views from that document. Deterministic answers always run locally. Assisted answers are opt-in and route through the tenant-authenticated Worker, which supplies only release-scoped context to its Workers AI binding. The legacy console is parity reference material, not a runtime dependency.

**Tech Stack:** Browser JavaScript, existing Worker/TypeScript runtime, Workers AI binding, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-08-25-legacy-parity-migration-design.md

## Global Constraints

- Retain deterministic answers and their provenance even if assisted answers are unavailable.
- Never send a third-party model key, tenant credential, raw imagery URL, or unrestricted historical archive to the browser or model.
- Include Caddo operational data and Santee reference-label context only; maintain Sam Rayburn as explicitly excluded until a validated detector transfer exists.
- Treat all model output as assisted analysis, not a new scientific finding or operational instruction.
- Apply existing tenant authorization, rate limiting, audit logging, and error conventions to the new endpoint.

---

### Task 1: Freeze the portable intelligence release contract

**Files:**

- Create: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/intelligence.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/salvinia/full_release.py
- Modify: ../coactive_data_service/containers/salvinia-heavy/app/test_runner.py
- Create: public/intelligence-schema.js
- Create: tests/intelligence-schema.test.mjs
- Create: tests/fixtures/intelligence-release.json

**Interfaces:**

- Required fields: `sites`, `portfolio`, `reference`, `claim_boundaries`, `generated_at`, `schema_version`
- Site states: `operational`, `reference`, `excluded`
- Exports: `validateIntelligenceRelease(intelligence) -> { ok, errors }`

- [ ] **Step 1: Write failing cross-repository contract tests.**

~~~
test("intelligence payload preserves data-status boundaries", () => {
  const result = validateIntelligenceRelease(intelligence);
  assert.equal(result.ok, true);
  assert.equal(intelligence.sites.find((site) => site.key === "caddo").status, "operational");
  assert.equal(intelligence.sites.find((site) => site.key === "santee").status, "reference");
  assert.equal(intelligence.sites.find((site) => site.key === "sam-rayburn").status, "excluded");
});
~~~

- [ ] **Step 2: Emit a versioned, JSON-safe intelligence document.**

Have the legacy builder expose the same data the console used, with deterministic priority inputs, interventions, infrastructure/sensor records, sampling guidance, EDRR material, early-warning metrics, portfolio calculation inputs, question-answer patterns, and source/limitation text. Convert only JSON-native types; reject `NaN`, infinities, callable values, and absolute/raw-storage URLs.

- [ ] **Step 3: Implement browser validation.**

Validate status values, unique site keys, bounded metric arrays, numeric priority inputs, expected ranking fields, and required claim-boundary copy. It returns errors rather than rendering partial claims silently.

- [ ] **Step 4: Run contract tests.**

Run: `cd ../coactive_data_service/containers/salvinia-heavy/app && python -m pytest test_runner.py -q`

Run: `npm test -- tests/intelligence-schema.test.mjs`

Expected: PASS; the same generated document is accepted by the tenant app and excluded sites cannot become operational through the UI.

### Task 2: Extract and test the deterministic console logic

**Files:**

- Create: public/intelligence-core.js
- Create: tests/intelligence-core.test.mjs
- Modify: public/app.js

**Interfaces:**

- `rankSites(intelligence, weights) -> rankedSites`
- `buildPortfolio(intelligence, crewBudget) -> portfolio`
- `answerDeterministically(intelligence, question) -> { answer, citations, matched }`
- Workspace deep link: `?workspace=intelligence&intelView=summary|priorities|assets|sensors|sampling|edrr|early-warning|portfolio|ask`

- [ ] **Step 1: Write failing behavioral tests from legacy fixtures.**

~~~
test("priority sliders reorder only eligible operational sites", () => {
  const rows = rankSites(intelligence, { spread: 2, growth: 1, infrastructure: 0.5 });
  assert.equal(rows[0].key, "caddo");
  assert.equal(rows.some((row) => row.key === "sam-rayburn"), false);
});

test("known analyst question returns a cited deterministic answer", () => {
  const result = answerDeterministically(intelligence, "What should crews sample first?");
  assert.equal(result.matched, true);
  assert.equal(result.citations.length > 0, true);
});
~~~

- [ ] **Step 2: Port calculations rather than scraping rendered legacy HTML.**

Move the legacy rank, crew allocation, portfolio, and pattern-match logic into pure functions. Preserve input defaults and tie-breaking in tests. Normalize question text and return `matched: false` for unknown questions without implying a model answer.

- [ ] **Step 3: Add URL state and workspace switching.**

Keep the visual workspace as the default. `workspace=intelligence` mounts the console only when the current release has a valid intelligence document; invalid or absent data shows a release status panel and leaves visual views available. Validate `intelView` and fall back to summary.

- [ ] **Step 4: Run core tests.**

Run: `npm test -- tests/intelligence-core.test.mjs tests/app-release.test.mjs`

Expected: PASS; deterministic legacy behaviors are reproducible without network access.

### Task 3: Render all intelligence console screens accessibly

**Files:**

- Create: public/intelligence.js
- Modify: public/index.html
- Modify: public/app.css
- Modify: public/app.js
- Create: tests/intelligence-render.test.mjs

**Interfaces:**

- Screens: Summary, Priorities, Assets, Sensors, Sampling, EDRR, Early Warning, Portfolio, Ask an Analyst.
- Controls: accessible tablist, range inputs with labels/output, crew-budget input, downloadable deterministic ranking CSV, and question form.

- [ ] **Step 1: Write renderer coverage for every screen.**

~~~
for (const view of INTELLIGENCE_VIEWS) {
  test("renders " + view, () => {
    const root = renderIntelligenceWorkspace(intelligence, { view });
    assert.equal(root.querySelector("h1").textContent.length > 0, true);
  });
}
~~~

Assert that each non-operational site carries its status/limitation label and that no release raw-prefix or credential-looking string appears in DOM text.

- [ ] **Step 2: Port summary, priority, and portfolio screens.**

Show provenance, data-status badges, claim boundaries, priority weights, eligible ranking, crew budget, allocation, and CSV download generated entirely in the browser. Recalculate on input events without external dependencies. CSV escaping must cover quotes, commas, and newlines.

- [ ] **Step 3: Port assets through early-warning screens.**

Render source-backed infrastructure, sensors, sampling plans, EDRR playbook, and early-warning thresholds. Include the exact limitation/provenance language from the release and keep reference or excluded data visually distinct from operational actions.

- [ ] **Step 4: Port Ask an Analyst deterministic mode.**

Render known-question suggestions, an accessible form, deterministic result text, citations, and a clear unknown-question state. Show the optional assisted-answer control only when the release and tenant capability indicate it is enabled.

- [ ] **Step 5: Run UI tests.**

Run: `npm test -- tests/intelligence-render.test.mjs tests/intelligence-core.test.mjs`

Expected: PASS; every legacy screen renders, controls update state, and exclusions remain visible.

### Task 4: Add protected, release-bounded assisted answers

**Files:**

- Create: ../coactive_data_service/src/salvinia-intelligence.ts
- Modify: ../coactive_data_service/src/index.ts
- Modify: ../coactive_data_service/src/types.ts
- Modify: ../coactive_data_service/wrangler.staging.toml
- Create: ../coactive_data_service/tests/salvinia-intelligence.test.ts
- Modify: ../coactive_data_service/tests/index.test.ts

**Interfaces:**

- Endpoint: `POST /api/tenants/:tenantId/salvinia/releases/current/intelligence/questions`
- Request: `{ question: string }`
- Response: `{ answer: string, citations: string[], limitations: string[], mode: "assisted" }`
- Configuration: Workers AI binding already named `AI`; non-secret environment variable `SALVINIA_INTELLIGENCE_MODEL` selects the approved model identifier.

- [ ] **Step 1: Write failing authorization and containment tests.**

~~~
it("answers only with the caller's current release intelligence document", async () => {
  const response = await requestAsTenantA("POST", route, { question: "Summarize priorities" });
  expect(response.status).toBe(200);
  expect(ai.run).toHaveBeenCalledWith(modelName, expect.objectContaining({ messages: expect.any(Array) }));
  expect(JSON.stringify(ai.run.mock.calls)).not.toContain("tenant-b-raw");
});
~~~

Add cases for unauthenticated access, cross-tenant route guessing, malformed/oversize input, missing or invalid intelligence, rate-limit exhaustion, model timeout, and model output that lacks required limitation text.

- [ ] **Step 2: Implement a narrow service module.**

Use the existing current-release lookup and tenant authorization before reading the manifest. Validate the intelligence document with a service-side schema. Bound questions (trimmed UTF-8 length and control characters), select only release-derived context needed to answer, and call `env.AI.run(env.SALVINIA_INTELLIGENCE_MODEL, request)`. Use an instruction that requires citations/limitations and forbids asserting unprovided facts; cap response length and normalize model output into the documented response shape.

- [ ] **Step 3: Apply service controls.**

Reuse the established POST mutation/auth middleware, per-tenant rate limiter, structured audit event, request ID, and error response convention. Do not log question content or raw model prompts unless the existing privacy policy permits an explicitly redacted diagnostic. Failure returns a bounded unavailable response; the browser falls back to deterministic answers.

- [ ] **Step 4: Wire the browser control.**

In `public/intelligence.js`, make assisted answers an explicit user action after displaying the deterministic result. Send same-origin authenticated JSON, show a pending state, render returned citations/limitations, and never persist questions or answers in local storage. A 401/403/429/5xx response leaves deterministic output intact with a concise status message.

- [ ] **Step 5: Prove no browser model key remains.**

Run: `rg -n -i 'anthropic|x-api-key|api[_-]?key|api\.anthropic\.com' public tests`

Expected: no browser model provider endpoint or secret-header implementation; legitimate instructional prose may be excluded only by an explicit reviewed test fixture comment.

- [ ] **Step 6: Run focused Worker checks.**

Run: `cd ../coactive_data_service && npm run verify && npm test -- --run tests/salvinia-intelligence.test.ts tests/index.test.ts`

Expected: PASS; the AI binding receives only bounded context from the authorized current release.

### Task 5: Verify full workspace staging behavior and commit

**Files:**

- Create: tests/e2e/intelligence-workspace.spec.mjs
- Modify: README.md
- Modify: package.json

- [ ] **Step 1: Add tenant end-to-end coverage.**

With an intercepted or seeded authenticated full release, visit every intelligence screen, change a priority weight and crew budget, download/inspect the CSV, ask a known deterministic question, then simulate an assisted-answer failure. Assert the visual workspace remains reachable and the deterministic answer survives.

- [ ] **Step 2: Document boundaries and operator controls.**

Document the operational/reference/excluded taxonomy, deterministic versus assisted modes, and the server-side configuration toggle. State that assisted output requires review and never replaces field verification.

- [ ] **Step 3: Run complete verification.**

Run: `npm run check && npm test && npm run build && npm run test:e2e -- tests/e2e/intelligence-workspace.spec.mjs`

Run: `cd ../coactive_data_service && npm run verify && npm run verify:staging:config`

Expected: PASS; no account secret reaches browser bundles, and all feature states remain tenant scoped.

- [ ] **Step 4: Conduct staging acceptance.**

Publish a full Caddo release, authenticate as the intended tenant, verify the visual and intelligence workspace deep links, inspect one assisted response's citation/limitation presentation, confirm access fails for a different tenant, and record the release ID in the audit log.

- [ ] **Step 5: Commit focused changes.**

Run: `git add public tests README.md package.json && git commit -m "feat: add tenant Salvinia intelligence workspace"`

Run: `cd ../coactive_data_service && git add src tests wrangler.staging.toml && git commit -m "feat: secure Salvinia assisted answers"`
