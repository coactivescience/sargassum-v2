# Sargassum v2 frontend

This project is the frontend-only Cloudflare deployment for the Sargassum
workspace. It intentionally contains no analytical pipeline, database, bucket
binding, queue, workflow, container, tenant credentials, or API key. The
NFAI/MCI detection science runs upstream in `matsa_metrics_service`;
`coactive_data_service` imports those daily records for a tenant's site,
publishes them as a checksum-verified site release in its separate Sargassum
vertical, and serves them to this app.

Sites are data. Each site is a `platform.sites` row in the data service,
identified by UUID and labelled by its `display_name`, so this app contains no
place names. Puerto Rico is simply the first enabled site.

> **Note on naming:** this began as a rename of the `giant_salvinia_v2`
> frontend. The legacy Caddo modules (`app.js`, `core.js`, `console.js`, `views.js`,
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
authenticated Sargassum site list, manifest, and day assets locally, selects days on the
timeline, and confirms alert text is rendered as text, not markup. It does not
contact or mutate staging. `npm run test:integration` covers the same flow with
a fake DOM and a fake Leaflet in Node.

The Sargassum fixtures in `tests/fixtures/sargassum-*.json` are generated from
the data service's real publisher. Regenerate them with
`python tests/fixtures/generate-sargassum-fixtures.py [path/to/coactive_data_service]`.

## Local end-to-end development

1. In `coactive_data_service`, publish the fixture release and keep the API
   running on `http://localhost:8787`, trusting this app's origin
   `http://localhost:8788`:

   ```sh
   npm run local:sargassum:serve
   ```

2. Here, start the frontend against it:

   ```sh
   npx wrangler dev --port 8788 --var API_BASE_URL:http://localhost:8787
   ```

3. Open `http://localhost:8788` and sign in as `sargassum-local@example.test` /
   `sargassum-local-password`.

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

The app then lists the tenant's Sargassum sites, chooses one, and requests that
site's release:

```text
GET {API_BASE_URL}/api/tenants/{tenantId}/sargassum/sites
GET {API_BASE_URL}/api/tenants/{tenantId}/sargassum/sites/{siteId}/releases/current/manifest
GET {API_BASE_URL}/api/tenants/{tenantId}/sargassum/sites/{siteId}/releases/{releaseId}/assets/{sha256}
```

The sites route lists only sites enabled for Sargassum:
`{ "sites": [{ "id": "uuid", "label": "…", "bbox": [w, s, e, n], "can_initiate_processing": true, "current_release": { "id": "uuid", "source_revision": "…", "activated_at": "…" } }] }`.
The app picks `?site=<uuid>` when it is listed, otherwise the first site with a
current release, otherwise the first site. With several sites it shows a site
selector; choosing one reloads with `?site=`. A tenant with no enabled sites sees
a "no Sargassum sites are enabled" state.

Every endpoint requires the tenant `can_view` permission. The manifest has
this shape:

```json
{
  "release": { "id": "uuid", "site_id": "uuid", "application_key": "sargassum", "status": "active", "source_revision": "revision", "activated_at": "…" },
  "payload": {
    "schema": "sargassum-vertical-v1",
    "meta": { "application_key": "sargassum", "site_id": "uuid", "source_revision": "revision", "operation": "sargassum-detect" },
    "site": { "id": "uuid", "label": "<the site row's display name>" },
    "detection_method": "dual_index_NFAI_MCI",
    "aoi": { "type": "FeatureCollection", "features": [{ "type": "Feature", "properties": {}, "geometry": { "type": "Polygon", "coordinates": [] } }] },
    "approach_zone": { "lon_min": -69, "lat_min": 16.5, "lon_max": -63, "lat_max": 19.5 },
    "summary": { "first_date": "…", "last_date": "…", "days": 61, "alert_days": 10, "severity_days": {}, "peak": {} },
    "latest": {},
    "timeline": [{ "date": "2025-05-09", "severity": "medium", "coverage_pct": 0.65, "hotspot_count": 163, "alert_active": true, "file": "<sha256>" }]
  },
  "assets": { "<sha256>": "/api/tenants/<tenant>/sargassum/sites/<site>/releases/<release>/assets/<sha256>" }
}
```

`public/release-client.js` resolves each `file` token through `assets` and
accepts only same-origin URLs under the exact tenant, site, and release prefix.
It also requires the release's `site_id` to be the chosen site and its
`application_key` to be `sargassum`.
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
URL choice and reload its authorized release. A site with no release yet shows
the "still being prepared" state.

## Browser access

Register the deployed frontend origin as an exact origin in the data service's
`BETTER_AUTH_TRUSTED_ORIGINS` value, for example:

```text
BETTER_AUTH_TRUSTED_ORIGINS=https://sargassum.coactivescience.dev
```

Use the deployed origin with no path, wildcard, or trailing slash, and keep the
matching `.coactivescience.dev` cross-subdomain session-cookie setup. Do not
put an API key or any storage credential in this project.
