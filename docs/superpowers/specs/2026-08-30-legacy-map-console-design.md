# Legacy Map Console Design

## Goal

Make the authenticated Caddo experience recognizably match the legacy map-first
operations console shown in the user-supplied August 30 screenshots, while
continuing to use only tenant-authorized, immutable release data produced from
the complete public Caddo archive.

The current guided Monitor/Detect/Response workspace remains available as a
secondary briefing. The map console becomes the default full-release view.

## Visual and interaction contract

At desktop widths the authenticated application has four persistent regions:

1. A compact dark header with product identity, signed-in identity, and logout.
2. A left site rail populated only from `/api/tenants/accessible`.
3. A central Leaflet map that owns the remaining width and height.
4. A right observation inspector with timeline, metrics, granules, dates, and
   source provenance.

The map includes an `Intensity` / `Zones` mode switch and independent
`Coverage`, `Footprint`, and `Water` checkboxes. Choosing an observation from
the timeline or date list updates the map, sample values, metrics, granules,
and source scene together. Layer state survives observation changes.

The site rail shows only authorized tenants. It must not recreate the four-site
legacy list unless those sites are actually returned for the signed-in user and
have valid active releases.

At narrow widths the site rail collapses first, then the inspector becomes a
drawer. The map remains usable by keyboard and touch.

## Release contract

A console-capable immutable release adds this top-level document:

```json
{
  "console": {
    "schema": "giant-salvinia-map-console-v1",
    "bounds": [[32.64, -94.25], [32.91, -93.91]],
    "metric_scope": "valid pixels inside the published Caddo basin",
    "observations": [
      {
        "id": "20260731T164859_R026",
        "date": "2026-07-31",
        "source_scene": "20260731T164859_R026",
        "granules": [
          {
            "satellite": "S2A",
            "tile": "T15SUS",
            "product_id": "S2A_MSIL2A_...SAFE"
          }
        ],
        "metrics": {
          "fai_mean": 0.0,
          "ndvi_mean": 0.0,
          "ndwi_mean": 0.0,
          "mndwi_mean": 0.0,
          "afai_mean": 0.0,
          "water_pixels": 0
        },
        "samples": [
          {
            "key": "pt-001",
            "lonlat": [-94.08, 32.69],
            "fai_mean": 0.0,
            "fai_max": 0.0,
            "radius_m": 50
          }
        ],
        "layers": {
          "base": { "file": "layers/console/.../base.webp" },
          "intensity": { "file": "layers/console/.../intensity.webp" },
          "zones": { "file": "layers/console/.../zones.webp" },
          "coverage": { "file": "layers/console/.../coverage.webp" },
          "footprint": { "file": "layers/console/.../footprint.webp" },
          "water": { "file": "layers/console/.../water.webp" }
        }
      }
    ]
  }
}
```

The published observations are the same 57 verified observations used by
`monitor.frames`. They are not a synthetic recent-date sequence. Each console
observation must have the same ID and date as its monitor frame.

Every number and raster is computed by the processor from the verified public
scene arrays:

- NDVI, NDWI, MNDWI, FAI, and AFAI use calibrated Sentinel-2 surface
  reflectance. AFAI uses the red-to-B12 baseline with B8A as NIR, matching the
  pipeline's 20 m grid.
- Means use finite, valid pixels inside the published basin; the payload states
  that scope explicitly.
- `water_pixels` counts valid basin pixels with `MNDWI > 0`.
- Sample statistics use a 50 m radius around the six released sampling-plan
  coordinates. Missing valid pixels produce `null`, never zero.
- `Coverage` is the geometric coverage mask.
- `Footprint` is the cloud/shadow-filtered valid mask.
- `Water` is the valid `MNDWI > 0` mask.
- `Intensity` is NDVI over the water-capable domain, clipped below the existing
  detector threshold and rendered with a transparent continuous ramp.
- `Zones` is a categorical rendering of open water, water-capable domain, and
  detected floating vegetation. It remains labelled floating vegetation, not
  confirmed giant salvinia.

All file values are logical release assets covered by the manifest's size and
SHA-256 checks. The browser receives no R2 credentials or direct storage URL.

## Source and compatibility boundaries

- Use the existing complete Element 84 Earth Search inventory and public USGS
  hydrography. Do not read the legacy AWS account.
- The accepted release `e57e3484-45c3-4d5e-821b-eadd45ee0d97` is immutable and
  remains the rollback target.
- Adding B12, AFAI, and console layers requires a new prepared-source format and
  a new immutable release. Existing `prepared-v1` inputs and legacy-v2 releases
  remain readable.
- The current guided workspace must continue to render older full releases.
  The map console is selected only for a validated console-capable release.
- No external satellite basemap provider is introduced in this work. The
  release-owned natural-color raster is the base layer; an external provider
  requires a separate licensing, privacy, and credential decision.
- Do not reproduce unsupported public sites, stale legacy numbers, a fabricated
  hex grid, or browser-held service credentials.

## Acceptance

- Desktop composition matches the supplied 1891×891 and 1554×774 references:
  header, left rail, dominant map, over-map layer control, and right inspector.
- The real 57 observations drive the timeline and date selection.
- Every layer toggle visibly changes the map using a manifest-declared asset.
- Timeline, date chip, map, metrics, granules, sample values, and source scene
  stay synchronized.
- Caddo reports 140 coves and the source revision of the newly published public
  release; all existing response, verification, sampling, route, EDRR, and
  hyperspectral gates continue to pass.
- Signed-out, unauthorized-tenant, malformed-release, keyboard, narrow-screen,
  and logout paths are covered.
- Staging acceptance uses the authenticated routed application and the real
  release. Fixtures are permitted only for automated regression tests.
