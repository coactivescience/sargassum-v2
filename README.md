# Sargassum v2 frontend

This project is the frontend-only Cloudflare deployment for the Puerto Rico
Sargassum workspace. It intentionally contains no analytical pipeline,
database, bucket binding, queue, workflow, container, tenant credentials, or
API key. The NFAI/MCI detection science runs upstream in
`matsa_metrics_service`; `coactive_data_service` imports those daily records,
publishes them as a checksum-verified `puerto-rico` site release, and serves
them to this app.

> **Note on naming:** this began as a rename of the `giant_salvinia_v2`
> frontend. The Puerto Rico workspace now reads its own `sargassum-vertical-v1`
> release from the site-scoped route below. The data service still groups
> sites under its `salvinia` route segment, so that segment is unchanged. The
> legacy Caddo modules (`app.js`, `core.js`, `console.js`, `views.js`,
> `intelligence*.js`, `release-schema.js`) remain in `public/` with their unit
> tests, but `index.html` no longer loads them.

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
installed Google Chrome through Playwright, serves the frontend with an
authenticated Puerto Rico manifest and day assets locally, selects days on the
timeline, and confirms alert text is rendered as text, not markup. It does not
contact or mutate staging. `npm run test:integration` covers the same flow with
a fake DOM and a fake Leaflet in Node.

## Local end-to-end development

1. In `coactive_data_service`, start PostgreSQL and MinIO and publish the Puerto
   Rico fixture release (`npm run local:sargassum:smoke`), or run its Worker
   with `wrangler dev --port 8787` against the local stack.
2. Add this app's origin to the data service's `BETTER_AUTH_TRUSTED_ORIGINS`
   (for example `http://localhost:8788`). Otherwise the service rejects browser
   API calls with `origin_not_allowed`, and session cookies are not accepted.
3. Here, create `.dev.vars` with `API_BASE_URL=http://localhost:8787`, then run:

   ```sh
   npx wrangler dev --port 8788
   ```

4. Open `http://localhost:8788`, sign in with a user who belongs to the tenant
   that owns the Puerto Rico release, and pick that tenant.

## Required runtime configuration

The Worker emits `runtime-config.js` from public, non-secret bindings:

- `API_BASE_URL` — the `coactive_data_service` API origin, such as
  `https://api.coactivescience.dev`.

For local development, set these values in `.dev.vars`. For deployment, define
them as Wrangler vars for the matching environment before running
`npm run deploy:staging` or `npm run deploy`. Staging serves
`https://sargassum.coactivescience.dev` against `https://api.coactivescience.dev`.

## Unified-service contract

The landing page submits sign-in and authenticator codes directly to the
unified service with `credentials: include`:

```text
POST {API_BASE_URL}/api/auth/sign-in/email
POST {API_BASE_URL}/api/auth/two-factor/verify-totp
GET  {API_BASE_URL}/api/tenants/accessible
```

The selected tenant's Puerto Rico release is then requested from the
site-scoped routes:

```text
GET {API_BASE_URL}/api/tenants/{tenantId}/salvinia/sites/puerto-rico/releases/current/manifest
GET {API_BASE_URL}/api/tenants/{tenantId}/salvinia/sites/puerto-rico/releases/{releaseId}/assets/{sha256}
```

Every endpoint requires the tenant `can_view` permission. The manifest has
this shape:

```json
{
  "release": { "id": "uuid", "site_key": "puerto-rico", "source_revision": "revision" },
  "payload": {
    "schema": "sargassum-vertical-v1",
    "meta": { "site_key": "puerto-rico", "source_revision": "revision", "operation": "sargassum-detect" },
    "site": { "key": "puerto-rico", "label": "Puerto Rico", "species": "Sargassum" },
    "aoi": { "type": "FeatureCollection", "features": [] },
    "approach_zone": { "lon_min": -69, "lat_min": 16.5, "lon_max": -63, "lat_max": 19.5 },
    "summary": { "first_date": "…", "last_date": "…", "days": 61, "alert_days": 10, "severity_days": {}, "peak": {} },
    "latest": {},
    "timeline": [{ "date": "2025-05-09", "severity": "medium", "coverage_pct": 0.65, "hotspot_count": 163, "alert_active": true, "file": "<sha256>" }]
  },
  "assets": { "<sha256>": "/api/tenants/<tenant>/salvinia/sites/puerto-rico/releases/<release>/assets/<sha256>" }
}
```

`public/release-client.js` resolves each `file` token through `assets` and
accepts only same-origin URLs under the exact tenant, site, and release prefix.
`public/sargassum-schema.js` validates the payload strictly. An invalid release
shows a "release is invalid" state instead of rendering. Each timeline `file` is
one day's full upstream detection record (hotspots, forecast, trajectories,
corridor, alert, origin). The workspace fetches a day only when it is selected,
validates it against its timeline row, and caches it for the session. The
service re-authorizes every discovery, manifest, and asset request. Tenant UUIDs
in the browser are identifiers, not secrets.

## Tenant selection and browser history

The browser prefers `?tenant=<uuid>` when it is in the accessible-tenant list,
then a remembered session selection, then the first accessible tenant. A
missing or stale URL value is replaced with the valid choice. Changing the
tenant selector creates a browser-history entry; Back and Forward revalidate the
URL choice and reload its authorized release. A tenant with no Puerto Rico
release sees the "still being prepared" state.

## Browser access

Register the deployed frontend origin as an exact origin in the data service's
`BETTER_AUTH_TRUSTED_ORIGINS` value, for example:

```text
BETTER_AUTH_TRUSTED_ORIGINS=https://sargassum.coactivescience.dev
```

Use the deployed origin with no path, wildcard, or trailing slash, and keep the
matching `.coactivescience.dev` cross-subdomain session-cookie setup. Do not
put an API key or any storage credential in this project.
