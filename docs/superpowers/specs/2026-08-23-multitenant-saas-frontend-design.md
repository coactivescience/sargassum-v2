# Multi-tenant Giant Salvinia SaaS Frontend Design

## Goal

Turn Giant Salvinia into one shared, authenticated frontend that lets a user
select among only the tenants they are authorized to view. No tenant UUID,
tenant storage path, or credential is configured in the frontend Worker.

## Scope

- Keep the static-assets Worker and Leaflet presentation layer.
- Retain `API_BASE_URL` as the sole public runtime Worker variable.
- Add a least-privilege tenant-discovery API to `coactive_data_service`.
- Add authenticated Salvinia manifest and release-asset endpoints to
  `coactive_data_service`.
- Add a tenant switcher to the frontend and make it resilient to direct links,
  browser navigation, expired sessions, and revoked access.

The existing fixed `TENANT_ID` variable and all single-tenant bootstrap logic
are removed. This work does not create, seed, or modify tenants or releases.

## Architecture

The unified backend remains the tenant and authorization boundary. After the
browser authenticates with its Better Auth session, the frontend calls
`GET /api/tenants/accessible`. The endpoint determines the caller from the
session, uses the existing `can_view` authorization policy, and returns only
the safe metadata needed by the switcher:

```json
{
  "data": {
    "tenants": [
      {
        "id": "tenant UUID",
        "slug": "tenant-slug",
        "display_name": "Tenant name"
      }
    ]
  }
}
```

The endpoint must query the tenant IDs returned by
`listAuthorizedObjects(env, principal, "can_view", "tenant")`; it must not
reuse the platform-admin workspace query, which returns global tenant data.
It returns active, non-deleted tenants sorted by display name and no tenant
records when the caller has no access.

The browser owns only its currently selected tenant context. It chooses the
first valid source in this order:

1. `tenant` query parameter in the current URL, if it belongs to the
   accessible-tenant response.
2. The last selection in `sessionStorage`, if it belongs to that response.
3. The first accessible tenant, sorted by the backend.

The selected UUID is written to `?tenant=<uuid>` with the History API and
mirrored to `sessionStorage` as a convenience. The URL is canonical; stored
state is never used as permission. UUIDs are identifiers rather than secrets,
and the backend re-authorizes every API request.

## Release Contract

When a tenant is selected, the frontend calls:

```
GET /api/tenants/:tenantId/salvinia/releases/current/manifest
```

The backend verifies `can_view` for that tenant before reading the active
release. It returns the presentation payload plus an asset map of
tenant-scoped API-relative URLs. Each asset endpoint also verifies `can_view`
before reading an object from the resolved tenant bucket. The browser accepts
only asset URLs on `API_BASE_URL`; it never receives a bucket name, R2 path,
credential, or API key.

## Frontend Components

`src/index.ts` emits runtime configuration containing only `apiBaseUrl`.

`public/tenant-client.js` owns tenant discovery, validates a candidate against
the backend response, reads and writes the `tenant` URL parameter, and safely
uses session storage when available.

`public/release-client.js` receives an API base URL and a selected tenant ID as
separate inputs. It no longer accepts or validates a tenant ID from runtime
configuration.

`public/bootstrap.js` coordinates initial tenant discovery, renders the
switcher, loads the selected release, responds to switch events and browser
back/forward navigation, and maps authentication, authorization, no-tenant,
and no-release states to clear UI copy. It must not initialize Leaflet until
the selected tenant's release payload has loaded successfully.

`public/index.html` adds an accessible labelled tenant select control alongside
the existing loading/error region. The control is hidden until the accessible
tenant list has loaded and is disabled while a tenant switch is in progress.

## Error Handling

- Tenant discovery `401`: show the existing sign-in-required state.
- Tenant discovery `403`: show the existing authorization-denied state.
- Tenant discovery succeeds with no tenants: show a dedicated no-tenant-access
  message and do not call a release endpoint.
- A URL or storage tenant not in the accessible list: ignore it and use the
  next selection source; replace the URL with the valid selection.
- Release `404`: retain the selected tenant and show no-published-release.
- Release `403`: refresh accessible tenants once; if the tenant was revoked,
  select a remaining valid tenant or show no-tenant-access.
- Any malformed tenant, manifest, or asset map response is treated as
  unavailable and does not initialize the visualization.

## Testing

Backend tests prove that the accessible-tenant endpoint returns metadata only
for `can_view` tenants, including delegated and support access, and that its
manifest and asset endpoints reject unauthorized tenants.

Frontend tests prove selection precedence (URL, then storage, then first
tenant), rejection of stale selections, URL/storage synchronization, switcher
reload behavior, and the existing asset-origin guarantees. Worker tests prove
runtime configuration contains `apiBaseUrl` but not `tenantId`.

## Deployment

Set only `API_BASE_URL=https://api.staging.coactivescience.com` on the staging
frontend Worker. Register the deployed frontend origin as an exact value in
`BETTER_AUTH_TRUSTED_ORIGINS`; retain the existing cross-subdomain cookie
configuration. Do not configure `TENANT_ID`.
