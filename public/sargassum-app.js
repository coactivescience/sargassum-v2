// Puerto Rico Sargassum workspace: summary, daily timeline, Leaflet map, and day detail.
// Every data value reaches the DOM through textContent or element attributes; the
// module never assigns innerHTML, so upstream text (alert messages) cannot inject markup.
import { loadSargassumDay } from "./release-client.js";
import { validBounds } from "./sargassum-schema.js";

export const SEVERITY_COLORS = Object.freeze({ low: "#72d69a", medium: "#f0b45f", high: "#e87868" });
const CORRIDOR_ZONES = Object.freeze([
  ["acr_upstream", "#66b7dc"],
  ["entry", "#a8da5a"],
  ["transit", "#f0b45f"],
  ["approach", "#e87868"],
]);

function formatNumber(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}

function formatPercent(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value, digits)}%` : "—";
}

function titleCase(value) {
  return typeof value === "string" && value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
}

function create(documentRef, tagName, { className, text, attributes } = {}, children = []) {
  const node = documentRef.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  if (children.length) node.append(...children);
  return node;
}

function tile(documentRef, label, value, detail) {
  return create(documentRef, "div", { className: "sargassum-tile" }, [
    create(documentRef, "span", { text: label }),
    create(documentRef, "strong", { text: value }),
    ...(detail ? [create(documentRef, "small", { text: detail })] : []),
  ]);
}

function facts(documentRef, rows) {
  return create(documentRef, "dl", { className: "sargassum-facts" }, rows.map(([term, value]) => create(documentRef, "div", {}, [
    create(documentRef, "dt", { text: term }),
    create(documentRef, "dd", { text: value }),
  ])));
}

function boundsToLatLng(bounds) {
  return [[bounds.lat_min, bounds.lon_min], [bounds.lat_max, bounds.lon_max]];
}

/**
 * Render the Sargassum workspace for an already-validated release classification.
 * Returns a controller with selectDate() and dispose(); the controller is also
 * published as window.demoApp so bootstrap's error paths can dispose it.
 */
export function startSargassumWorkspace(classification, tenant, _config, dependencies = {}) {
  const {
    documentRef = document,
    windowRef = window,
    loadDay = loadSargassumDay,
    leaflet = windowRef.L,
  } = dependencies;
  windowRef.demoApp?.dispose?.();

  const release = classification.release;
  const timeline = release.timeline;
  const query = (selector) => documentRef.querySelector(selector);
  const landing = query("#public-landing");
  const shell = query(".app-shell");
  if (landing) landing.hidden = true;
  if (shell) shell.hidden = false;

  const summary = release.summary;
  const siteLabel = release.site.label;
  query("#sargassum-species").textContent = `${release.site.species || "Sargassum"} · ${tenant?.display_name ?? "Workspace"}`;
  query("#sargassum-title").textContent = `${siteLabel} Sargassum detections`;
  query("#sargassum-coverage").textContent = `${summary.first_date} – ${summary.last_date} · ${summary.days} daily record${summary.days === 1 ? "" : "s"}`;
  query("#sargassum-revision").textContent = `Release ${classification.releaseId ?? "—"} · source ${classification.sourceRevision ?? release.meta.source_revision}`;
  const badge = query(".record-badge");
  if (badge) badge.replaceChildren(create(documentRef, "span"), ` ${siteLabel} · ${summary.last_date}`);

  const latest = release.latest;
  query("#sargassum-summary").replaceChildren(
    tile(documentRef, "Days observed", String(summary.days), `${summary.first_date} – ${summary.last_date}`),
    tile(documentRef, "Alert days", String(summary.alert_days), summary.alert_days ? "Coastal arrival alerts issued" : "No alerts issued"),
    tile(documentRef, "Peak coverage", formatPercent(summary.peak.coverage_pct, 3), `${summary.peak.date} · ${formatNumber(summary.peak.coverage_km2, 1)} km²`),
    tile(documentRef, "Latest severity", titleCase(latest.severity), `${latest.date} · ${latest.hotspot_count} hotspot${latest.hotspot_count === 1 ? "" : "s"}`),
  );

  let map = null;
  let staticLayers = null;
  let dayLayers = null;
  const mapElement = query("#map");
  if (leaflet && mapElement) {
    map = leaflet.map(mapElement, { preferCanvas: true, zoomControl: true, attributionControl: false });
    staticLayers = leaflet.layerGroup().addTo(map);
    dayLayers = leaflet.layerGroup().addTo(map);
    const aoi = leaflet.geoJSON(release.aoi, { style: { color: "#c9f47d", weight: 2, fillOpacity: 0.12 } }).addTo(staticLayers);
    let extent = aoi.getBounds();
    if (validBounds(release.approach_zone)) {
      const zone = leaflet.rectangle(boundsToLatLng(release.approach_zone), { color: "#66b7dc", weight: 1, dashArray: "6 6", fill: false }).addTo(staticLayers);
      extent = zone.getBounds();
    }
    map.fitBounds(extent, { padding: [16, 16] });
    query("#map-kicker").textContent = "Approach zone";
    query("#map-title").textContent = `${siteLabel} coast`;
  }
  const legend = query("#map-legend");
  legend?.replaceChildren(...[
    ["Coast AOI", "#c9f47d"],
    ["Approach zone", "#66b7dc"],
    ...Object.entries(SEVERITY_COLORS).map(([severity, color]) => [`${titleCase(severity)} hotspot day`, color]),
  ].map(([label, color]) => create(documentRef, "span", { className: "sargassum-legend-item" }, [
    create(documentRef, "i", { attributes: { style: `background:${color}`, "aria-hidden": "true" } }),
    label,
  ])));

  const timelineRoot = query("#sargassum-timeline");
  const buttons = timeline.map((row) => {
    const button = create(documentRef, "button", {
      className: `sargassum-day severity-${row.severity}${row.alert_active ? " alert" : ""}`,
      attributes: {
        type: "button",
        "data-date": row.date,
        "aria-label": `${row.date}: ${row.severity} severity, ${formatPercent(row.coverage_pct, 3)} coverage${row.alert_active ? ", alert active" : ""}`,
        title: `${row.date} · ${row.severity}${row.alert_active ? " · alert" : ""}`,
      },
    }, [
      create(documentRef, "span", { className: "sargassum-day-bar", attributes: { style: `height:${Math.max(8, Math.min(100, row.coverage_pct * 25))}%` } }),
      create(documentRef, "small", { text: row.date.slice(5) }),
    ]);
    button.addEventListener("click", () => { void selectDate(row.date); });
    return button;
  });
  timelineRoot.replaceChildren(...buttons);

  const detail = query("#sargassum-detail");
  const dayStatus = query("#sargassum-day-status");
  const cache = new Map();
  let disposed = false;
  let selection = 0;

  function renderDay(row, record) {
    const forecast = record?.forecast ?? {};
    const alert = record?.alert ?? {};
    const origin = record?.origin ?? {};
    const alertMessage = typeof alert.message === "string" && alert.message.trim()
      ? alert.message
      : record?.alert_context && typeof record.alert_context.message === "string" ? record.alert_context.message : "No alert message for this day.";
    detail.replaceChildren(
      create(documentRef, "p", { className: "panel-kicker", text: row.date }),
      create(documentRef, "h2", { text: `${titleCase(row.severity)} severity${row.alert_active ? " · alert active" : ""}` }),
      create(documentRef, "section", { className: `sargassum-alert${row.alert_active ? " active" : ""}`, attributes: { "aria-label": "Alert" } }, [
        create(documentRef, "strong", { text: row.alert_active ? `Alert · ${titleCase(row.alert_confidence)} confidence` : "No active alert" }),
        create(documentRef, "p", { text: alertMessage }),
      ]),
      create(documentRef, "h3", { text: "Forecast" }),
      facts(documentRef, [
        ["Arrival probability", formatPercent(row.arrival_probability_pct ?? forecast.arrival_probability_pct, 1)],
        ["Coastal impact", formatPercent(row.coastal_impact_pct ?? forecast.coastal_impact_pct, 2)],
        ["Days until peak impact", formatNumber(row.days_until_peak_impact ?? forecast.days_until_peak_impact, 0)],
      ]),
      create(documentRef, "h3", { text: "Detection" }),
      facts(documentRef, [
        ["Coverage", `${formatPercent(row.coverage_pct, 3)} · ${formatNumber(row.coverage_km2, 1)} km²`],
        ["Hotspots", String(row.hotspot_count)],
        ["Trend", titleCase(row.trend)],
        ["NFAI mean", formatNumber(row.nfai_mean, 5)],
        ["MCI mean", formatNumber(row.mci_mean, 5)],
      ]),
      create(documentRef, "h3", { text: "Origin and data quality" }),
      facts(documentRef, [
        ["Most likely origin", row.origin_region ?? (typeof origin.most_likely_region === "string" ? origin.most_likely_region : "—")],
        ["Data quality", titleCase(row.data_quality)],
        ["Valid pixels", formatPercent(row.valid_pct, 1)],
        ["Cloud cover", formatPercent(row.cloud_cover_pct, 1)],
      ]),
    );
  }

  function renderDayLayers(record) {
    if (!map || !dayLayers) return;
    dayLayers.clearLayers();
    for (const [zone, color] of CORRIDOR_ZONES) {
      const bounds = record?.corridor?.[zone]?.bounds;
      if (validBounds(bounds)) {
        leaflet.rectangle(boundsToLatLng(bounds), { color, weight: 1, fillOpacity: record.corridor[zone].active ? 0.08 : 0, dashArray: "2 4" }).addTo(dayLayers);
      }
    }
    const color = SEVERITY_COLORS[record.severity] ?? SEVERITY_COLORS.low;
    for (const spot of record.hotspots) {
      leaflet.circleMarker([spot.lat, spot.lon], { radius: 3, color, weight: 1, fillColor: color, fillOpacity: 0.75 }).addTo(dayLayers);
    }
    for (const trajectory of record.forecast?.sample_trajectories ?? []) {
      if (trajectory.path.length > 1) {
        leaflet.polyline(trajectory.path.map((point) => [point.lat, point.lon]), { color: "#f2f6ef", weight: 1, opacity: 0.6 }).addTo(dayLayers);
      }
    }
  }

  async function selectDate(date) {
    const row = timeline.find((candidate) => candidate.date === date) ?? timeline.at(-1);
    const version = ++selection;
    buttons.forEach((button) => {
      const active = button.getAttribute("data-date") === row.date;
      button.classList?.toggle?.("active", active);
      if (active) button.setAttribute("aria-pressed", "true");
      else button.setAttribute("aria-pressed", "false");
    });
    renderDay(row, null);
    dayStatus.textContent = `Loading ${row.date} detections…`;
    try {
      if (!cache.has(row.file)) cache.set(row.file, loadDay(row));
      const record = await cache.get(row.file);
      if (disposed || version !== selection) return;
      renderDay(row, record);
      renderDayLayers(record);
      dayStatus.textContent = `${row.date}: ${row.hotspot_count} hotspot${row.hotspot_count === 1 ? "" : "s"} shown.`;
    } catch (error) {
      cache.delete(row.file);
      if (disposed || version !== selection) return;
      dayLayers?.clearLayers();
      dayStatus.textContent = `The ${row.date} detections could not be loaded${error?.requestId ? ` (reference ${error.requestId})` : ""}.`;
    }
  }

  const controller = {
    kind: "sargassum",
    map,
    selectDate,
    dispose() {
      disposed = true;
      map?.remove();
      if (windowRef.demoApp === controller) windowRef.demoApp = null;
    },
  };
  windowRef.demoApp = controller;
  controller.ready = selectDate(latest.date);
  return controller;
}
