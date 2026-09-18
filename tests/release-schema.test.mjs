import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateFullLegacyRelease } from "../public/release-schema.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const fullLegacyRelease = fixture("full-legacy-release.json");
const summaryRelease = fixture("summary-release.json");

test("accepts the complete verified Caddo visual payload", () => {
  const result = validateFullLegacyRelease(fullLegacyRelease);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("accepts the producer's site key and numeric cove identifiers", () => {
  const release = structuredClone(fullLegacyRelease);

  const result = validateFullLegacyRelease(release);

  assert.equal(release.sites[0].key, "caddo");
  assert.equal(typeof release.caddo_geometry.features[0].properties.id, "number");
  assert.equal(typeof release.response.priorities[0].cove_id, "number");
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("requires the declared legacy schema and a safe source revision", () => {
  for (const [schema, sourceRevision] of [
    ["giant-salvinia-v2", "caddo-legacy-v2-test"],
    ["giant-salvinia-legacy-v2", ""],
    ["giant-salvinia-legacy-v2", "../unverified"],
  ]) {
    const release = structuredClone(fullLegacyRelease);
    release.meta.schema = schema;
    release.meta.source_revision = sourceRevision;

    const result = validateFullLegacyRelease(release);

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /meta\.(schema|source_revision)/);
  }
});

test("requires a nonempty Caddo site and mapped Caddo geometry", () => {
  const release = structuredClone(fullLegacyRelease);
  release.sites = [];
  release.caddo_geometry.features = [];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /sites must not be empty/);
  assert.match(result.errors.join(" "), /caddo_geometry\.features must not be empty/);
});

test("requires distinct multi-observation monitor and response history", () => {
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames = [release.monitor.frames[0]];
  release.response.frames = [release.response.frames[0]];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor\.frames must contain at least two distinct observations/);
  assert.match(result.errors.join(" "), /response\.frames must contain at least two distinct observations/);
});

test("validates optional treatment records and reports invalid dates as nonfatal warnings", () => {
  const release = structuredClone(fullLegacyRelease);
  release.response.treatments = [{
    label: "Unsafe <script>alert(1)</script>",
    start_date: "2026-02-30",
    end_date: null,
    detail: "Context only",
  }];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join(" "), /response\.treatments\[0\]\.start_date/);
  assert.match(result.warnings.join(" "), /response\.treatments\[0\]\.end_date/);

  release.response.treatments = [null];
  const malformed = validateFullLegacyRelease(release);
  assert.equal(malformed.ok, false);
  assert.match(malformed.errors.join(" "), /response\.treatments\[0\]/);
});

test("classifies the one-acquisition fixture as limited", () => {
  const result = validateFullLegacyRelease(summaryRelease);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor/i);
});

test("reports malformed timeline dates and missing resolved frame assets", () => {
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames[0].date = "2026-02-30";
  delete release.response.frames[0].file;

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor\.frames\[0\]\.date/);
  assert.match(result.errors.join(" "), /response\.frames\[0\]\.file/);
});

test("reports non-array timelines and missing Caddo geometry", () => {
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames = {};
  delete release.caddo_geometry;

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor\.frames/);
  assert.match(result.errors.join(" "), /caddo_geometry/);
});

test("rejects empty renderer timelines and candidates", () => {
  const release = structuredClone(fullLegacyRelease);
  release.monitor.frames = [];
  release.response.frames = [];
  release.verification.candidates = [];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor\.frames must not be empty/);
  assert.match(result.errors.join(" "), /response\.frames must not be empty/);
  assert.match(result.errors.join(" "), /verification\.candidates must not be empty/);
});

test("requires evidence and fields dereferenced by existing renderers", () => {
  const release = structuredClone(fullLegacyRelease);
  delete release.evidence.monitor.lines;
  release.detect.largest = null;
  delete release.response.priorities[0].growth_ha;
  delete release.verification.candidates[0].nir_decline;
  delete release.hyperspectral.sites[0].spectrum;

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /evidence\.monitor\.lines/);
  assert.match(result.errors.join(" "), /detect\.largest/);
  assert.match(result.errors.join(" "), /response\.priorities\[0\]\.growth_ha/);
  assert.match(result.errors.join(" "), /verification\.candidates\[0\]\.nir_decline/);
  assert.match(result.errors.join(" "), /hyperspectral\.sites\[0\]\.spectrum/);
});

test("rejects invalid map bounds, monitor areas, and empty evidence lines", () => {
  const release = structuredClone(fullLegacyRelease);
  release.monitor.bounds = [];
  release.response.bounds = [[32.69, -94.21]];
  release.verification.bounds = [[32.69, -94.21], [Number.NaN, -93.85]];
  release.monitor.frames[0].mat_ha = Number.NaN;
  release.evidence.detect.lines = [];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /monitor\.bounds/);
  assert.match(result.errors.join(" "), /response\.bounds/);
  assert.match(result.errors.join(" "), /verification\.bounds/);
  assert.match(result.errors.join(" "), /monitor\.frames\[0\]\.mat_ha/);
  assert.match(result.errors.join(" "), /evidence\.detect\.lines must not be empty/);
});

test("requires complete finite hyperspectral spectrum records", () => {
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral.sites[0].spectrum = [];
  release.hyperspectral.sites[1].spectrum[0].wavelength_nm = Number.NaN;
  delete release.hyperspectral.sites[1].spectrum[0].normalized_median;
  release.hyperspectral.sites[1].spectrum[0].normalized_q75 = Number.POSITIVE_INFINITY;

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /hyperspectral\.sites\[0\]\.spectrum must not be empty/);
  assert.match(result.errors.join(" "), /hyperspectral\.sites\[1\]\.spectrum\[0\]\.wavelength_nm/);
  assert.match(result.errors.join(" "), /hyperspectral\.sites\[1\]\.spectrum\[0\]\.normalized_median/);
  assert.match(result.errors.join(" "), /hyperspectral\.sites\[1\]\.spectrum\[0\]\.normalized_q75/);
});

test("requires exactly two hyperspectral comparison sites", () => {
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral.sites.push({
    ...structuredClone(release.hyperspectral.sites[0]),
    label: "Area 3",
  });

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /hyperspectral\.sites must contain exactly two comparison areas/);
});

test("requires release-owned context only for an explicitly gated hyperspectral comparison", () => {
  for (const hyperspectral of [
    {},
    { evidence_gate: null },
    { evidence_gate: {} },
    { evidence_gate: { passes: false } },
    { evidence_gate: { passes: false, label: "" } },
    { evidence_gate: { passes: false, label: "Review failed" } },
  ]) {
    const release = structuredClone(fullLegacyRelease);
    release.hyperspectral = hyperspectral;

    const result = validateFullLegacyRelease(release);

    assert.equal(result.ok, true);
  }

  const release = structuredClone(fullLegacyRelease);
  delete release.hyperspectral.context;
  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /hyperspectral\.context/);
});

test("rejects a malformed declared hyperspectral gate", () => {
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral.evidence_gate.passes = "yes";

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /hyperspectral\.evidence_gate\.passes/);
});

test("requires renderer records inside sites, evidence comparisons, and limitations", () => {
  const release = structuredClone(fullLegacyRelease);
  release.sites = [null];
  release.evidence.monitor.comparison = {};
  release.evidence.detect.comparison = [null];
  release.hyperspectral.limitations = [null];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /sites\[0\]/);
  assert.match(result.errors.join(" "), /evidence\.monitor\.comparison/);
  assert.match(result.errors.join(" "), /evidence\.detect\.comparison\[0\]/);
  assert.match(result.errors.join(" "), /hyperspectral\.limitations\[0\]/);
});

test("requires Caddo geometry feature records when the collection has entries", () => {
  const release = structuredClone(fullLegacyRelease);
  release.caddo_geometry.features = [{ type: "Feature", geometry: null, properties: { id: "", name: "" } }];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[0\]\.geometry/);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[0\]\.properties\.id/);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[0\]\.properties\.name/);
});

test("rejects unsupported GeoJSON geometries and missing coordinate arrays", () => {
  const release = structuredClone(fullLegacyRelease);
  release.caddo_geometry.features = [
    {
      type: "Feature",
      geometry: { type: "Polygon" },
      properties: { id: "missing-coordinates", name: "Missing coordinates" },
    },
    {
      type: "Feature",
      geometry: { type: "BogusGeometry", coordinates: [-94.08, 32.76] },
      properties: { id: "bogus-type", name: "Bogus type" },
    },
    {
      type: "Feature",
      geometry: { type: "constructor", coordinates: [] },
      properties: { id: "inherited-type", name: "Inherited type" },
    },
  ];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[0\]\.geometry\.coordinates/);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[1\]\.geometry\.type/);
  assert.match(result.errors.join(" "), /caddo_geometry\.features\[2\]\.geometry\.type/);
});

test("rejects malformed and non-finite coordinates inside GeometryCollection", () => {
  const release = structuredClone(fullLegacyRelease);
  release.caddo_geometry.features = [{
    type: "Feature",
    geometry: {
      type: "GeometryCollection",
      geometries: [
        { type: "Point", coordinates: [-94.08, Number.NaN] },
        { type: "LineString", coordinates: [[-94.08]] },
      ],
    },
    properties: { id: "collection", name: "Collection" },
  }];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /geometry\.geometries\[0\]\.coordinates/);
  assert.match(result.errors.join(" "), /geometry\.geometries\[1\]\.coordinates\[0\]/);
});

test("rejects empty nested geometry coordinates and empty GeometryCollections", () => {
  const release = structuredClone(fullLegacyRelease);
  release.caddo_geometry.features = [
    {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: { id: "empty-polygon", name: "Empty polygon" },
    },
    {
      type: "Feature",
      geometry: { type: "GeometryCollection", geometries: [] },
      properties: { id: "empty-collection", name: "Empty collection" },
    },
  ];

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /features\[0\]\.geometry\.coordinates must not be empty/);
  assert.match(result.errors.join(" "), /features\[1\]\.geometry\.geometries must not be empty/);
});

test("accepts each renderer-supported GeoJSON geometry type", () => {
  const geometries = [
    { type: "Point", coordinates: [-94.08, 32.76] },
    { type: "MultiPoint", coordinates: [[-94.08, 32.76]] },
    { type: "LineString", coordinates: [[-94.08, 32.76], [-94.07, 32.77]] },
    { type: "MultiLineString", coordinates: [[[-94.08, 32.76], [-94.07, 32.77]]] },
    { type: "Polygon", coordinates: [[[-94.08, 32.76], [-94.07, 32.76], [-94.08, 32.76]]] },
    { type: "MultiPolygon", coordinates: [[[[-94.08, 32.76], [-94.07, 32.76], [-94.08, 32.76]]]] },
    {
      type: "GeometryCollection",
      geometries: [{
        type: "GeometryCollection",
        geometries: [{ type: "Point", coordinates: [-94.08, 32.76] }],
      }],
    },
  ];
  const release = structuredClone(fullLegacyRelease);
  release.caddo_geometry.features = geometries.map((geometry, index) => ({
    type: "Feature",
    geometry,
    properties: { id: index + 1, name: `Geometry ${index}` },
  }));

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("requires an explicit hyperspectral object for a full release", () => {
  for (const value of [null, undefined]) {
    const release = structuredClone(fullLegacyRelease);
    release.hyperspectral = value;

    const result = validateFullLegacyRelease(release);

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /hyperspectral/);
  }
});

test("accepts an explicit unavailable hyperspectral state", () => {
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral = { state: "not_available", message: "Capture not approved for this tenant." };

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("rejects direct raw-storage asset URLs", () => {
  const release = structuredClone(fullLegacyRelease);
  release.verification.candidates[0].before.file = "s3://tenant-private/verify-before.webp";

  const result = validateFullLegacyRelease(release);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /verification\.candidates\[0\]\.before\.file/);
});

test("accepts a gated comparison with explicitly unsupported open-water controls", () => {
  const release = structuredClone(fullLegacyRelease);
  release.hyperspectral.open_water_control = { supported: false, excess_separation_degrees: null };
  assert.equal(validateFullLegacyRelease(release).ok, true);
  release.hyperspectral.open_water_control.supported = true;
  assert.equal(validateFullLegacyRelease(release).ok, false);
});
