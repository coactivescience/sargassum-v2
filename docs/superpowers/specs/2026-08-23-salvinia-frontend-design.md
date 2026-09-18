# Giant Salvinia Frontend Design

## Goal

Deploy the Giant Salvinia Leaflet presentation as a frontend-only Cloudflare
Worker that obtains each tenant's published release from `coactive_data_service`
without duplicating data-processing infrastructure or exposing tenant storage.

## Scope

The new project contains the existing static user interface, a small browser
application bootstrap, test coverage, and Cloudflare static-asset deployment
configuration. It does not copy Python analysis code, D1, R2, Queues,
Workflows, Containers, raw data, or scientific processing code.

## Architecture

The Worker serves immutable static assets and a generated `runtime-config.js`.
That script contains only public deployment configuration: the API origin and
the tenant UUID. On startup, the browser requests the active Salvinia release
with `credentials: "include"`, then loads its release manifest through the
unified service. The manifest provides the presentation payload and resource
URLs. The existing Leaflet views receive the normalized payload and render
unchanged.

`coactive_data_service` remains the authorization and storage boundary. It
must provide an authenticated manifest endpoint plus authenticated asset URLs
for files registered on the selected release. This frontend never uses R2 keys,
R2 credentials, or an API key.

## Release contract

The frontend expects the following response from:
`GET /api/tenants/:tenantId/salvinia/releases/current/manifest`.

```json
{
  "release": { "id": "uuid", "source_revision": "string" },
  "payload": { "meta": {}, "sites": [], "caddo_geometry": {}, "monitor": {}, "detect": {}, "response": {}, "verification": {}, "hyperspectral": null, "evidence": {} },
  "assets": {
    "layers/monitor/example.webp": "/api/tenants/uuid/salvinia/releases/uuid/assets/layers/monitor/example.webp"
  }
}
```

Before passing the payload to the views, the client replaces every `file`
reference with the matching URL in `assets`. Absent or unregistered asset
references are treated as a release error and are never fetched directly.

## Browser authentication

The deployed frontend origin must be added to
`BETTER_AUTH_TRUSTED_ORIGINS` in the matching data-service environment. Browser
requests include credentials. In staging and production, the frontend should
use the matching `*.coactivescience.com` domain so the service's configured
cross-subdomain Better Auth session cookie is available. No client secret is
configured.

## Failure behavior

The bootstrap shows distinct, accessible messages for authentication failure
(401), authorization failure (403), absent active release (404), and all other
release failures. It preserves the error request ID when supplied by the API.
The user interface only starts once a complete payload has loaded.

## Deployment

Use a dedicated static-asset Cloudflare Worker named `giant-salvinia-v2` with
separate staging and production environments. A lightweight Worker handler
returns `runtime-config.js`; all other paths are fetched from the `ASSETS`
binding with SPA fallback. The runtime values are non-secret Wrangler vars.

## Verification

Unit tests cover release URL resolution and startup error mapping. A testable
bootstrap verifies that API requests use `credentials: "include"` and the
configured API/tenant path. Type checking validates the Worker configuration.
