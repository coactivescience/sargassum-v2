const REQUIRED_KEYS = [
  "meta",
  "sites",
  "caddo_geometry",
  "monitor",
  "detect",
  "response",
  "verification",
  "hyperspectral",
  "evidence",
];

const GEOJSON_COORDINATE_DEPTHS = new Map([
  ["Point", 0],
  ["MultiPoint", 1],
  ["LineString", 1],
  ["MultiLineString", 2],
  ["Polygon", 2],
  ["MultiPolygon", 3],
]);

const SOURCE_REVISION = /^[a-z0-9][a-z0-9-]{0,127}$/;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function resolvedAsset(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && /^\/api\/tenants\/[^/]+\/salvinia\/releases\/[^/]+\/assets\/[^/]+/.test(url.pathname);
  } catch {
    return false;
  }
}

function requireRecord(value, path, errors) {
  if (!isRecord(value)) errors.push(`${path} is required`);
  return isRecord(value);
}

function requireArray(value, path, errors) {
  if (!Array.isArray(value)) errors.push(`${path} must be an array`);
  return Array.isArray(value);
}

function requireNonEmptyArray(value, path, errors) {
  if (!requireArray(value, path, errors)) return false;
  if (value.length === 0) {
    errors.push(`${path} must not be empty`);
    return false;
  }
  return true;
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} is required`);
}

function requireNumber(value, path, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${path} must be a finite number`);
}

function requireCoveId(value, path, errors) {
  if (!Number.isInteger(value) || value < 1) errors.push(`${path} must be a positive integer`);
}

function requireLonlat(value, path, errors) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    errors.push(`${path} must be a [longitude, latitude] pair`);
  }
}

function requireBounds(value, path, errors) {
  if (!requireNonEmptyArray(value, path, errors)) return;
  if (value.length < 2) errors.push(`${path} must contain two map corners`);
  value.forEach((point, index) => {
    if (!Array.isArray(point) || point.length !== 2 || point.some((item) => typeof item !== "number" || !Number.isFinite(item))
      || point[0] < -90 || point[0] > 90 || point[1] < -180 || point[1] > 180) {
      errors.push(`${path}[${index}] must be a [latitude, longitude] pair`);
    }
  });
}

function requireDate(value, path, errors) {
  if (!validDate(value)) errors.push(`${path} must be a valid YYYY-MM-DD date`);
}

function requireAsset(value, path, errors) {
  if (!resolvedAsset(value)) errors.push(`${path} must be a resolved release asset URL`);
}

function validateFrames(frames, path, errors, { monitor = false } = {}) {
  if (!requireArray(frames, path, errors)) return;
  frames.forEach((frame, index) => {
    const framePath = `${path}[${index}]`;
    if (!requireRecord(frame, framePath, errors)) return;
    requireDate(frame.date, `${framePath}.date`, errors);
    requireAsset(frame.file, `${framePath}.file`, errors);
    if (monitor) requireNumber(frame.mat_ha, `${framePath}.mat_ha`, errors);
  });
}

function validateEvidence(value, path, errors) {
  if (!requireRecord(value, path, errors)) return;
  requireString(value.title, `${path}.title`, errors);
  requireNonEmptyArray(value.lines, `${path}.lines`, errors);
  if (value.comparison) {
    if (!requireArray(value.comparison, `${path}.comparison`, errors)) return;
    value.comparison.forEach((comparison, index) => {
      const comparisonPath = `${path}.comparison[${index}]`;
      if (!requireRecord(comparison, comparisonPath, errors)) return;
      requireString(comparison.method, `${comparisonPath}.method`, errors);
      requireNumber(comparison.median_overlap, `${comparisonPath}.median_overlap`, errors);
    });
  }
}

function validateSpectrum(value, path, errors) {
  if (!requireNonEmptyArray(value, path, errors)) return;
  value.forEach((point, index) => {
    const pointPath = `${path}[${index}]`;
    if (!requireRecord(point, pointPath, errors)) return;
    ["wavelength_nm", "normalized_q25", "normalized_median", "normalized_q75"].forEach((key) => {
      requireNumber(point[key], `${pointPath}.${key}`, errors);
    });
  });
}

function validateCoveRows(rows, path, errors, { response = false } = {}) {
  if (!requireArray(rows, path, errors)) return;
  rows.forEach((row, index) => {
    const rowPath = `${path}[${index}]`;
    if (!requireRecord(row, rowPath, errors)) return;
    requireCoveId(row.cove_id, `${rowPath}.cove_id`, errors);
    requireString(row.name, `${rowPath}.name`, errors);
    requireLonlat(row.lonlat, `${rowPath}.lonlat`, errors);
    if (response) {
      requireNumber(row.rank, `${rowPath}.rank`, errors);
      requireNumber(row.origin_ha, `${rowPath}.origin_ha`, errors);
      requireNumber(row.growth_ha, `${rowPath}.growth_ha`, errors);
    } else {
      requireNumber(row.detected_ha, `${rowPath}.detected_ha`, errors);
      requireNumber(row.valid_fraction, `${rowPath}.valid_fraction`, errors);
    }
  });
}

function validateSites(sites, errors) {
  if (!requireNonEmptyArray(sites, "sites", errors)) return;
  sites.forEach((site, index) => {
    const path = `sites[${index}]`;
    if (!requireRecord(site, path, errors)) return;
    ["key", "label", "status", "detail"].forEach((key) => requireString(site[key], `${path}.${key}`, errors));
  });
  if (!sites.some((site) => site?.key === "caddo")) errors.push("sites must include the Caddo site");
}

function validateCoordinates(value, depth, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length === 0) {
    errors.push(`${path} must not be empty`);
    return;
  }
  if (depth === 0) {
    if (value.length < 2 || value.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate))) {
      errors.push(`${path} must be a finite GeoJSON position`);
    }
    return;
  }
  value.forEach((coordinates, index) => validateCoordinates(coordinates, depth - 1, `${path}[${index}]`, errors));
}

function validateGeometry(geometry, path, errors) {
  if (!requireRecord(geometry, path, errors)) return;
  const coordinateDepth = GEOJSON_COORDINATE_DEPTHS.get(geometry.type);

  if (coordinateDepth !== undefined) {
    validateCoordinates(geometry.coordinates, coordinateDepth, `${path}.coordinates`, errors);
    return;
  }
  if (geometry.type === "GeometryCollection") {
    if (!requireNonEmptyArray(geometry.geometries, `${path}.geometries`, errors)) return;
    geometry.geometries.forEach((member, index) => validateGeometry(member, `${path}.geometries[${index}]`, errors));
    return;
  }
  errors.push(`${path}.type must be a supported GeoJSON geometry type`);
}

function validateGeometryFeatures(features, errors) {
  if (!requireNonEmptyArray(features, "caddo_geometry.features", errors)) return;
  features.forEach((feature, index) => {
    const path = `caddo_geometry.features[${index}]`;
    if (!requireRecord(feature, path, errors)) return;
    if (feature.type !== "Feature") errors.push(`${path}.type must be Feature`);
    validateGeometry(feature.geometry, `${path}.geometry`, errors);
    if (requireRecord(feature.properties, `${path}.properties`, errors)) {
      requireCoveId(feature.properties.id, `${path}.properties.id`, errors);
      requireString(feature.properties.name, `${path}.properties.name`, errors);
    }
  });
}

function validateHistory(frames, path, errors) {
  if (!Array.isArray(frames)) return;
  const dates = new Set(frames.map((frame) => frame?.date).filter(validDate));
  if (dates.size < 2) errors.push(`${path} must contain at least two distinct observations`);
}

function validateTreatments(treatments, errors, warnings) {
  if (treatments === undefined || treatments === null) return;
  if (!requireArray(treatments, "response.treatments", errors)) return;
  treatments.forEach((treatment, index) => {
    const path = `response.treatments[${index}]`;
    if (!requireRecord(treatment, path, errors)) return;
    requireString(treatment.label, `${path}.label`, errors);
    if (treatment.detail !== undefined) requireString(treatment.detail, `${path}.detail`, errors);
    ["start_date", "end_date"].forEach((key) => {
      if (!validDate(treatment[key])) warnings.push(`${path}.${key} must be a valid YYYY-MM-DD date`);
    });
  });
}

function validateLimitations(limitations, errors) {
  if (!requireArray(limitations, "hyperspectral.limitations", errors)) return;
  limitations.forEach((limitation, index) => {
    const path = `hyperspectral.limitations[${index}]`;
    if (!requireRecord(limitation, path, errors)) return;
    requireString(limitation.text, `${path}.text`, errors);
  });
}

export function validateFullLegacyRelease(payload) {
  const errors = [];
  const warnings = [];
  if (!isRecord(payload)) return { ok: false, errors: ["release payload must be an object"], warnings };

  REQUIRED_KEYS.forEach((key) => {
    if (!(key in payload)) errors.push(`${key} is required`);
  });

  if (requireRecord(payload.meta, "meta", errors)) {
    if (payload.meta.schema !== "giant-salvinia-legacy-v2") errors.push("meta.schema must be giant-salvinia-legacy-v2");
    if (typeof payload.meta.source_revision !== "string" || !SOURCE_REVISION.test(payload.meta.source_revision)) {
      errors.push("meta.source_revision must be a valid source revision");
    }
  }
  validateSites(payload.sites, errors);
  if (requireRecord(payload.caddo_geometry, "caddo_geometry", errors)) {
    if (payload.caddo_geometry.type !== "FeatureCollection") errors.push("caddo_geometry.type must be FeatureCollection");
    validateGeometryFeatures(payload.caddo_geometry.features, errors);
  }
  if (requireRecord(payload.evidence, "evidence", errors)) {
    ["monitor", "detect", "response", "verification", "deploy"].forEach((key) => {
      validateEvidence(payload.evidence[key], `evidence.${key}`, errors);
    });
  }

  if (requireRecord(payload.monitor, "monitor", errors)) {
    if (requireNonEmptyArray(payload.monitor.frames, "monitor.frames", errors)) {
      validateFrames(payload.monitor.frames, "monitor.frames", errors, { monitor: true });
      validateHistory(payload.monitor.frames, "monitor.frames", errors);
    }
    requireBounds(payload.monitor.bounds, "monitor.bounds", errors);
    requireNumber(payload.monitor.minimum_patch_ha, "monitor.minimum_patch_ha", errors);
  }

  if (requireRecord(payload.detect, "detect", errors)) {
    requireDate(payload.detect.date, "detect.date", errors);
    if (requireRecord(payload.detect.frame, "detect.frame", errors)) {
      requireDate(payload.detect.frame.date, "detect.frame.date", errors);
      requireAsset(payload.detect.frame.file, "detect.frame.file", errors);
    }
    requireNumber(payload.detect.affected_count, "detect.affected_count", errors);
    if (requireArray(payload.detect.affected_cove_ids, "detect.affected_cove_ids", errors)) {
      payload.detect.affected_cove_ids.forEach((id, index) => requireCoveId(id, `detect.affected_cove_ids[${index}]`, errors));
    }
    validateCoveRows(payload.detect.largest, "detect.largest", errors);
  }

  if (requireRecord(payload.response, "response", errors)) {
    if (requireNonEmptyArray(payload.response.frames, "response.frames", errors)) {
      validateFrames(payload.response.frames, "response.frames", errors);
      validateHistory(payload.response.frames, "response.frames", errors);
    }
    requireBounds(payload.response.bounds, "response.bounds", errors);
    validateCoveRows(payload.response.priorities, "response.priorities", errors, { response: true });
    ["hit_cove_ids", "missed_cove_ids", "priority_only_cove_ids"].forEach((key) => {
      if (requireArray(payload.response[key], `response.${key}`, errors)) {
        payload.response[key].forEach((id, index) => requireCoveId(id, `response.${key}[${index}]`, errors));
      }
    });
    validateTreatments(payload.response.treatments, errors, warnings);
  }

  if (requireRecord(payload.verification, "verification", errors)) {
    requireBounds(payload.verification.bounds, "verification.bounds", errors);
    if (requireNonEmptyArray(payload.verification.candidates, "verification.candidates", errors)) {
      payload.verification.candidates.forEach((candidate, index) => {
        const path = `verification.candidates[${index}]`;
        if (!requireRecord(candidate, path, errors)) return;
        requireNumber(candidate.number, `${path}.number`, errors);
        requireCoveId(candidate.cove_id, `${path}.cove_id`, errors);
        requireString(candidate.name, `${path}.name`, errors);
        requireNumber(candidate.area_before_ha, `${path}.area_before_ha`, errors);
        requireNumber(candidate.area_after_ha, `${path}.area_after_ha`, errors);
        requireNumber(candidate.elapsed_days, `${path}.elapsed_days`, errors);
        requireNumber(candidate.nir_decline, `${path}.nir_decline`, errors);
        requireString(candidate.drift_status, `${path}.drift_status`, errors);
        requireLonlat(candidate.lonlat, `${path}.lonlat`, errors);
        ["before", "after"].forEach((moment) => {
          const framePath = `${path}.${moment}`;
          if (!requireRecord(candidate[moment], framePath, errors)) return;
          requireDate(candidate[moment].date, `${framePath}.date`, errors);
          requireAsset(candidate[moment].file, `${framePath}.file`, errors);
        });
      });
    }
  }

  if (requireRecord(payload.hyperspectral, "hyperspectral", errors)) {
    if (payload.hyperspectral.state === "not_available") {
      requireString(payload.hyperspectral.message, "hyperspectral.message", errors);
    } else {
      const gate = payload.hyperspectral.evidence_gate;
      if (gate !== undefined && gate !== null && requireRecord(gate, "hyperspectral.evidence_gate", errors)) {
        if (gate.passes !== undefined && typeof gate.passes !== "boolean") {
          errors.push("hyperspectral.evidence_gate.passes must be a boolean");
        }
        if (gate.passes === true) {
          requireString(gate.label, "hyperspectral.evidence_gate.label", errors);
        } else if (gate.label !== undefined && (typeof gate.label !== "string" || !gate.label.trim())) {
          warnings.push("hyperspectral.evidence_gate.label must be a nonempty string when supplied");
        }
      }
      if (gate?.passes === true) {
        if (requireRecord(payload.hyperspectral.context, "hyperspectral.context", errors)) {
          requireString(payload.hyperspectral.context.location_label, "hyperspectral.context.location_label", errors);
          requireString(payload.hyperspectral.context.sensor_label, "hyperspectral.context.sensor_label", errors);
          requireDate(payload.hyperspectral.context.capture_date, "hyperspectral.context.capture_date", errors);
          requireString(payload.hyperspectral.context.purpose_label, "hyperspectral.context.purpose_label", errors);
        }
        if (requireNonEmptyArray(payload.hyperspectral.sites, "hyperspectral.sites", errors)) {
          if (payload.hyperspectral.sites.length !== 2) errors.push("hyperspectral.sites must contain exactly two comparison areas");
          payload.hyperspectral.sites.forEach((site, index) => {
            const path = `hyperspectral.sites[${index}]`;
            if (!requireRecord(site, path, errors)) return;
            requireString(site.label, `${path}.label`, errors);
            requireNumber(site.vegetation_patches, `${path}.vegetation_patches`, errors);
            requireNumber(site.open_water_patches, `${path}.open_water_patches`, errors);
            if (requireRecord(site.aquatic_cover, `${path}.aquatic_cover`, errors)) {
              requireAsset(site.aquatic_cover.file, `${path}.aquatic_cover.file`, errors);
            }
            validateSpectrum(site.spectrum, `${path}.spectrum`, errors);
          });
        }
        if (requireRecord(payload.hyperspectral.vegetation_separation, "hyperspectral.vegetation_separation", errors)) {
          ["median_between_site_degrees", "balanced_within_site_degrees", "excess_separation_degrees"].forEach((key) => {
            requireNumber(payload.hyperspectral.vegetation_separation[key], `hyperspectral.vegetation_separation.${key}`, errors);
          });
        }
        if (requireRecord(payload.hyperspectral.open_water_control, "hyperspectral.open_water_control", errors)) {
          const control = payload.hyperspectral.open_water_control;
          if (!(control.supported === false && control.excess_separation_degrees === null)) requireNumber(control.excess_separation_degrees, "hyperspectral.open_water_control.excess_separation_degrees", errors);
        }
        if (requireRecord(payload.hyperspectral.robustness, "hyperspectral.robustness", errors)) {
          requireArray(payload.hyperspectral.robustness.summary, "hyperspectral.robustness.summary", errors);
        }
        validateLimitations(payload.hyperspectral.limitations, errors);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
