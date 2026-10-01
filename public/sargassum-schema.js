// Strict validation for Sargassum site releases (schema "sargassum-vertical-v1").
// The payload is produced by coactive_data_service's Sargassum container
// (containers/sargassum/app/runner.py) for one platform.sites row, and each
// timeline row's `file` has already been resolved to an authorized
// release-asset URL by release-client.js. Sites are data: nothing here names a place.

export const SARGASSUM_SCHEMA = "sargassum-vertical-v1";
export const SARGASSUM_APPLICATION_KEY = "sargassum";

const SEVERITIES = new Set(["low", "medium", "high"]);
const TRENDS = new Set(["baseline", "stable", "increasing", "decreasing"]);
const DATA_QUALITIES = new Set(["poor", "fair", "good"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REVISION = /^[a-z0-9][a-z0-9-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0;

function isDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function checker() {
  const errors = [];
  return {
    errors,
    require(condition, message) {
      if (!condition) errors.push(message);
      return Boolean(condition);
    },
  };
}

function optionalNumber(row, key) {
  return row[key] === null || row[key] === undefined || isNumber(row[key]);
}

function optionalMember(row, key, allowed) {
  return row[key] === null || row[key] === undefined || allowed.has(row[key]);
}

function validPosition(position) {
  return Array.isArray(position)
    && position.length >= 2
    && position.every(isNumber)
    && position[0] >= -180 && position[0] <= 180
    && position[1] >= -90 && position[1] <= 90;
}

function validRings(rings) {
  return Array.isArray(rings) && rings.length > 0
    && rings.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition));
}

function validPolygonGeometry(geometry) {
  if (!isObject(geometry)) return false;
  if (geometry.type === "Polygon") return validRings(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(validRings);
  }
  return false;
}

export function validBounds(bounds) {
  return isObject(bounds)
    && ["lon_min", "lat_min", "lon_max", "lat_max"].every((key) => isNumber(bounds[key]))
    && bounds.lon_min >= -180 && bounds.lon_max <= 180 && bounds.lat_min >= -90 && bounds.lat_max <= 90
    && bounds.lon_min < bounds.lon_max && bounds.lat_min < bounds.lat_max;
}

function validateRow(row, index, check) {
  const label = `timeline[${index}]`;
  if (!check.require(isObject(row), `${label} must be an object`)) return;
  check.require(isDate(row.date), `${label}.date must be YYYY-MM-DD`);
  check.require(SEVERITIES.has(row.severity), `${label}.severity must be low, medium, or high`);
  check.require(isNumber(row.coverage_pct) && row.coverage_pct >= 0 && row.coverage_pct <= 100, `${label}.coverage_pct must be a percentage`);
  for (const key of ["coverage_km2", "valid_pct", "cloud_cover_pct", "nfai_mean", "mci_mean", "arrival_probability_pct", "coastal_impact_pct", "days_until_peak_impact"]) {
    check.require(optionalNumber(row, key), `${label}.${key} must be a number or null`);
  }
  check.require(optionalMember(row, "trend", TRENDS), `${label}.trend is not a supported trend`);
  check.require(optionalMember(row, "data_quality", DATA_QUALITIES), `${label}.data_quality is not supported`);
  check.require(optionalMember(row, "alert_confidence", CONFIDENCES), `${label}.alert_confidence is not supported`);
  check.require(Number.isInteger(row.hotspot_count) && row.hotspot_count >= 0, `${label}.hotspot_count must be a non-negative integer`);
  check.require(typeof row.alert_active === "boolean", `${label}.alert_active must be a boolean`);
  check.require(row.origin_region === null || row.origin_region === undefined || isText(row.origin_region), `${label}.origin_region must be text or null`);
  check.require(isText(row.file), `${label}.file must reference a release asset`);
}

export const isSiteId = (value) => typeof value === "string" && UUID.test(value);

/**
 * Validate a resolved release payload; returns { ok, errors }.
 * When `siteId` is given, the payload must describe exactly that site.
 */
export function validateSargassumRelease(payload, { siteId } = {}) {
  const check = checker();
  if (!check.require(isObject(payload), "release payload must be an object")) return { ok: false, errors: check.errors };
  check.require(payload.schema === SARGASSUM_SCHEMA, `release schema must be ${SARGASSUM_SCHEMA}`);
  const meta = isObject(payload.meta) ? payload.meta : {};
  check.require(meta.application_key === SARGASSUM_APPLICATION_KEY, `release meta.application_key must be ${SARGASSUM_APPLICATION_KEY}`);
  check.require(isSiteId(meta.site_id), "release meta.site_id must be a site UUID");
  check.require(REVISION.test(meta.source_revision ?? ""), "release meta.source_revision is invalid");
  check.require(isObject(payload.site) && payload.site.id === meta.site_id && isText(payload.site.label), "release site must match meta.site_id and carry a label");
  if (siteId !== undefined) check.require(meta.site_id === siteId, "release belongs to another site");
  check.require(payload.detection_method === null || payload.detection_method === undefined || isText(payload.detection_method), "release detection_method must be text or null");

  const aoi = payload.aoi;
  check.require(
    isObject(aoi) && aoi.type === "FeatureCollection" && Array.isArray(aoi.features) && aoi.features.length > 0
      && aoi.features.every((feature) => isObject(feature) && feature.type === "Feature" && validPolygonGeometry(feature.geometry)),
    "release aoi must be a polygon FeatureCollection in WGS84",
  );
  check.require(payload.approach_zone === null || payload.approach_zone === undefined || validBounds(payload.approach_zone), "release approach_zone must be valid bounds or null");

  const timeline = payload.timeline;
  if (check.require(Array.isArray(timeline) && timeline.length > 0, "release timeline must list at least one day")) {
    timeline.forEach((row, index) => validateRow(row, index, check));
    const dates = timeline.map((row) => row?.date);
    check.require(dates.every((date, index) => index === 0 || date > dates[index - 1]), "release timeline dates must be unique and ascending");
  }

  const summary = payload.summary;
  if (check.require(isObject(summary), "release summary must be an object") && Array.isArray(timeline)) {
    check.require(summary.days === timeline.length, "release summary.days must match the timeline");
    check.require(summary.first_date === timeline[0]?.date && summary.last_date === timeline.at(-1)?.date, "release summary dates must match the timeline");
    check.require(Number.isInteger(summary.alert_days) && summary.alert_days === timeline.filter((row) => row?.alert_active === true).length, "release summary.alert_days must match the timeline");
    check.require(isObject(summary.severity_days) && ["low", "medium", "high"].every((key) => Number.isInteger(summary.severity_days[key])), "release summary.severity_days is invalid");
    check.require(isObject(summary.peak) && isDate(summary.peak.date) && isNumber(summary.peak.coverage_pct), "release summary.peak is invalid");
  }
  check.require(isObject(payload.latest) && payload.latest.date === timeline?.at?.(-1)?.date, "release latest must be the final timeline day");
  return { ok: check.errors.length === 0, errors: check.errors };
}

/** Validate one fetched day asset against its timeline row; returns { ok, errors }. */
export function validateSargassumDay(record, row) {
  const check = checker();
  if (!check.require(isObject(record), "day record must be an object")) return { ok: false, errors: check.errors };
  check.require(record.date === row?.date, "day record date must match its timeline row");
  check.require(SEVERITIES.has(record.severity), "day record severity is invalid");
  if (check.require(Array.isArray(record.hotspots), "day record hotspots must be a list")) {
    check.require(record.hotspots.every((spot) => isObject(spot)
      && isNumber(spot.lat) && spot.lat >= -90 && spot.lat <= 90
      && isNumber(spot.lon) && spot.lon >= -180 && spot.lon <= 180), "day record hotspots must be WGS84 points");
    check.require(record.hotspots.length === row?.hotspot_count, "day record hotspot count must match its timeline row");
  }
  for (const key of ["forecast", "alert", "origin", "corridor"]) {
    check.require(record[key] === undefined || record[key] === null || isObject(record[key]), `day record ${key} must be an object`);
  }
  const trajectories = record.forecast?.sample_trajectories;
  check.require(trajectories === undefined || (Array.isArray(trajectories) && trajectories.every((trajectory) => isObject(trajectory)
    && Array.isArray(trajectory.path) && trajectory.path.every((point) => isObject(point) && isNumber(point.lat) && isNumber(point.lon)))), "day record sample_trajectories are invalid");
  return { ok: check.errors.length === 0, errors: check.errors };
}
