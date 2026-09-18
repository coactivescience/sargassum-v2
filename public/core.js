(function () {
  "use strict";

  const colors = {
    lime: "#a8da5a",
    blue: "#66b7dc",
    amber: "#f0b45f",
    green: "#72d69a",
    muted: "#8ba29a"
  };

  class Playback {
    constructor(frames, onFrame, onFinish, interval) {
      this.frames = frames;
      this.onFrame = onFrame;
      this.onFinish = onFinish || function () {};
      this.interval = interval || 650;
      this.index = 0;
      this.timer = null;
    }

    show(index) {
      this.index = Math.max(0, Math.min(index, this.frames.length - 1));
      this.onFrame(this.frames[this.index], this.index);
    }

    play() {
      if (this.timer) return;
      if (this.index >= this.frames.length - 1) this.show(0);
      const advance = () => {
        if (this.index >= this.frames.length - 1) {
          this.stop();
          this.onFinish();
          return;
        }
        this.show(this.index + 1);
      };
      this.timer = window.setInterval(advance, this.interval);
    }

    pause() {
      if (!this.timer) return;
      window.clearInterval(this.timer);
      this.timer = null;
    }

    stop() {
      this.pause();
    }

    reset() {
      this.stop();
      this.show(0);
    }

    get running() {
      return Boolean(this.timer);
    }
  }

  class MapView {
    constructor(element, coveGeometry) {
      this.coveGeometry = coveGeometry;
      this.map = L.map(element, {
        zoomControl: false,
        preferCanvas: true,
        zoomSnap: 0.25
      });
      L.control.zoom({ position: "bottomright" }).addTo(this.map);
      this.groups = {
        raster: L.layerGroup().addTo(this.map),
        geometry: L.layerGroup().addTo(this.map),
        markers: L.layerGroup().addTo(this.map)
      };
      this.invalidateTimer = null;
      this.map.setView([32.76, -94.08], 11);
    }

    clear() {
      if (this.invalidateTimer !== null) {
        window.clearTimeout(this.invalidateTimer);
        this.invalidateTimer = null;
      }
      Object.values(this.groups).forEach(group => group.clearLayers());
    }

    fit(bounds, options) {
      const container = this.map.getContainer?.();
      if (container && (!container.clientWidth || !container.clientHeight)) return;
      this.map.invalidateSize({ pan: false });
      if (bounds) this.map.fitBounds(bounds, Object.assign({ padding: [24, 24] }, options));
      if (this.invalidateTimer !== null) window.clearTimeout(this.invalidateTimer);
      this.invalidateTimer = window.setTimeout(() => {
        this.invalidateTimer = null;
        if (!container || (container.clientWidth && container.clientHeight)) this.map.invalidateSize({ pan: false });
      }, 0);
    }

    focus(lonlat, zoom) {
      this.map.setView([lonlat[1], lonlat[0]], zoom || 13, { animate: true });
    }

    raster(frame, bounds) {
      this.rasters([{ frame, bounds }]);
    }

    rasters(items) {
      this.groups.raster.clearLayers();
      items.forEach(item => {
        if (item.frame && item.frame.file) {
          L.imageOverlay(item.frame.file, item.bounds, { opacity: .92, interactive: false })
            .addTo(this.groups.raster);
        }
      });
    }

    coves(style, filter, tooltip) {
      const ids = filter ? new Set(filter) : null;
      return L.geoJSON(this.coveGeometry, {
        filter: feature => !ids || ids.has(feature.properties.id),
        style: feature => typeof style === "function" ? style(feature) : style,
        onEachFeature: (feature, layer) => {
          if (tooltip) {
            const text = typeof tooltip === "function" ? tooltip(feature) : tooltip;
            if (text) layer.bindTooltip(text, { className: "map-label", sticky: true });
          }
        }
      }).addTo(this.groups.geometry);
    }

    numberedMarker(lonlat, number, tone, label, onClick) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="number-marker ${tone || ""}">${escapeHtml(number)}</div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      });
      const marker = L.marker([lonlat[1], lonlat[0]], { icon }).addTo(this.groups.markers);
      if (label) marker.bindTooltip(escapeHtml(label), { className: "map-label", direction: "top" });
      if (onClick) marker.on("click", onClick);
      return marker;
    }

    site(feature, color) {
      L.geoJSON(feature.geometry, {
        style: { color, weight: 2, fillColor: color, fillOpacity: .16 }
      }).addTo(this.groups.geometry);
      const icon = L.divIcon({
        className: "",
        html: `<div class="site-marker" style="background:${color}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([feature.lonlat[1], feature.lonlat[0]], { icon })
        .bindTooltip(`<strong>${escapeHtml(feature.label)}</strong><br>${escapeHtml(feature.status)}`, {
          className: "map-label",
          permanent: true,
          direction: "top",
          offset: [0, -8]
        })
        .addTo(this.groups.markers);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return date.getUTCFullYear() === parts[0]
      && date.getUTCMonth() === parts[1] - 1
      && date.getUTCDate() === parts[2];
  }

  function formatDate(value) {
    if (!validDate(value)) return "Date unavailable";
    const parts = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
    }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
  }

  function hectares(value, digits) {
    return `${Number(value).toLocaleString("en-US", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits === undefined ? 1 : digits
    })} ha`;
  }

  function evidence(block) {
    const comparison = block.comparison ? block.comparison.map(row => `
      <div class="method-row"><span>${escapeHtml(row.method)}</span><strong>${Math.round(row.median_overlap * 100)}%</strong>
        <div class="method-bar"><span style="width:${row.median_overlap * 100}%"></span></div>
      </div>`).join("") : "";
    return `<details class="evidence"><summary>${escapeHtml(block.title)}</summary>
      <div class="evidence-body"><ul>${block.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>${comparison}</div>
    </details>`;
  }

  function dataWarning(message) {
    return `<div class="data-warning" role="status"><strong>Data unavailable</strong><span>${escapeHtml(message)}</span></div>`;
  }

  function legend(items) {
    return items.map(item => `<span class="legend-item" style="color:${item.color}">
      <i class="${item.dot ? "legend-dot" : "legend-swatch"}"></i><span style="color:#d4dfda">${escapeHtml(item.label)}</span>
    </span>`).join("");
  }

  window.AppCore = { Playback, MapView, colors, validDate, formatDate, hectares, evidence, dataWarning, legend, escapeHtml };
}());
