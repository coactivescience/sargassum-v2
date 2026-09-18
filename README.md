# Sargassum v2 frontend

This project is the frontend-only Cloudflare deployment for the Sargassum
Leaflet presentation. It intentionally contains no analytical pipeline,
database, bucket binding, queue, workflow, container, tenant credentials, or
API key.

> **Note on naming:** this is a rename of the original
> `giant_salvinia_v2` frontend. The unified backend's release schema
> identifiers, manifest field names, and API route segments (e.g.
> `giant-salvinia-legacy-v2`, `giant-salvinia-intelligence-v1`, `salvinia_ha`)
> are unchanged and must stay unchanged here, since the backend service that
> emits and validates them was not ported. Only display text, package/worker
> identity, and deploy configuration were renamed. See "Unified-service
> contract" below for the routes actually in use.

## Local checks

```sh
npm install
npm test
npm run test:integration
npm run test:e2e
npm run check
npm run build
```

`npm run test:e2e` is the real-browser acceptance check. It launches an
installed Google Chrome through Playwright, serves the frontend and an
authenticated tenant manifest locally, exercises every workspace tab, and
confirms failed Hyperspectral evidence stays in the bounded unavailable view.
It does not contact or mutate staging. Use `npm run test:integration` for the
faster Node VM/fake-DOM integration coverage.

## Required runtime configuration

The Worker emits `runtime-config.js` from public, non-secret bindings:

- `API_BASE_URL` — the `coactive_data_service` API origin, such as
  `https://api.coactivescience.dev`.

For local development, set these values in `.dev.vars`. For deployment, define
them as Wrangler vars for the matching environment before running
`npm run deploy:staging` or `npm run deploy`.

## Unified-service contract

The landing page submits sign-in and authenticator codes directly to the
unified service with `credentials: include`; it does not navigate to the
platform-admin application:

```text
POST {API_BASE_URL}/api/auth/sign-in/email
POST {API_BASE_URL}/api/auth/two-factor/verify-totp
```

The frontend first discovers the signed-in account's allowed tenant choices:

```text
GET {API_BASE_URL}/api/tenants/accessible
```

with `credentials: include`. It returns the authorized tenant metadata used by
the switcher (`id`, `slug`, and `display_name`), never a deployment-selected
tenant. The selected tenant's release is then requested from:

```text
GET {API_BASE_URL}/api/tenants/{tenantId}/salvinia/releases/current/manifest
GET {API_BASE_URL}/api/tenants/{tenantId}/salvinia/releases/{releaseId}/assets/{objectKey}
```

These paths keep the `salvinia` route segment because the backend service has
not been ported; it still owns and serves under that resource name. Every
endpoint requires the existing tenant `can_view` permission. The manifest has
the following shape:

```json
{
  "release": { "id": "uuid", "source_revision": "revision" },
  "payload": { "meta": {}, "sites": [], "caddo_geometry": {}, "monitor": {}, "detect": {}, "response": {}, "verification": {}, "hyperspectral": null, "evidence": {} },
  "assets": {
    "layers/monitor/frame.webp": "/api/tenants/<tenant>/salvinia/releases/<release>/assets/layers/monitor/frame.webp"
  }
}
```

Each `file` value inside `payload` must exist in `assets`. The client rejects
unknown paths and accepts only same-origin URLs under the exact selected
tenant and manifest release prefix shown above.
The unified service re-authorizes every discovery, manifest, and asset request.
Tenant UUIDs in the browser are identifiers, not secrets; they never grant
access on their own.

## Scientific and full visual releases

A one-scene Caddo scientific release is intentionally limited: it can report
the approved acquisition and analysis summary, but it cannot enable the full
map, timeline, response, verification, deployment, or hyperspectral workspace.
A full visual release is available only after a payload with the
`giant-salvinia-legacy-v2` schema has passed service-side validation and been
promoted as the tenant's current release. This schema identifier is a
service-side contract and is not renamed on the frontend.

Operators queue that release through the data service's authenticated
**Publish full legacy Caddo release** action, which is exposed only when the
service has a verified source revision for the tenant. The browser then reads
the authenticated current-manifest and asset routes documented above. It
never reads raw tenant storage, R2, or S3 objects directly.

## Tenant selection and browser history

The browser prefers `?tenant=<uuid>` when it is in the accessible-tenant list,
then a remembered session selection, then the first accessible tenant. A missing
or stale URL value is replaced with the valid choice. Changing the labelled
tenant selector creates a browser-history entry; Back and Forward revalidate
the URL choice and reload its authorized release. The visualization initializes
only after that tenant's release manifest has loaded successfully.

## Browser access

Register the deployed frontend origin as an exact origin in the data service's
`BETTER_AUTH_TRUSTED_ORIGINS` value, for example:

```text
BETTER_AUTH_TRUSTED_ORIGINS=https://sargassum.coactivescience.dev
```

Use the deployed origin with no path, wildcard, or trailing slash, and retain
the matching `.coactivescience.dev` cross-subdomain session-cookie setup. Do
not put an API key or any storage credential in this project.

## What was renamed vs. preserved

This was a frontend-only, cosmetic port. To keep the client working against
the existing backend without changes, the following distinction was kept
throughout the codebase:

**Renamed** (display text, package/deploy identity — safe to change locally):
- `package.json` / `package-lock.json` package name
- Wrangler worker names and route pattern in `wrangler.jsonc`
- On-page display strings (e.g. header text, status text)
- Matching test assertions for the above

**Preserved as-is** (contract with `coactive_data_service` — do not rename
without a corresponding backend change):
- API route segments, e.g. `/salvinia/releases/...`
- Release schema identifiers, e.g. `giant-salvinia-legacy-v2`,
  `giant-salvinia-intelligence-v1`, `giant-salvinia-map-console-v1`
- Manifest/payload field names, e.g. `salvinia_ha` and sibling species-area
  fields in the Santee reference dataset

If sargassum is meant to become a genuinely distinct backend resource type
(its own schema, its own payload shape, its own route segment) rather than a
relabeled view of salvinia data, that requires changes in
`coactive_data_service` first — see that project's contribution docs.

# sargassum_v2