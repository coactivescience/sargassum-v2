(function () {
  "use strict";

  function observationsFor(release) {
    const published = release?.console?.observations;
    if (Array.isArray(published) && published.length) return published;
    const frames = Array.isArray(release?.monitor?.frames) ? release.monitor.frames : [];
    return frames.map(frame => ({
      id: frame.id || frame.date,
      date: frame.date,
      source_scene: frame.id || null,
      metrics: { detected_ha: frame.mat_ha },
      granules: [],
      samples: [],
      layers: {
        base: { file: frame.file },
        intensity: { file: frame.file },
      },
    }));
  }

  function add(root, parent, tag, className, text) {
    const element = root.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function number(value, digits = 4) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
  }

  function metricCards(root, target, observation) {
    target.replaceChildren();
    add(root, target, "h2", "console-section-title", `Spectral indices — ${observation.date}`);
    const grid = add(root, target, "div", "console-metric-grid");
    const metrics = observation.metrics || {};
    const definitions = [
      ["fai_mean", "FAI", "Floating Algae Index", 4],
      ["ndvi_mean", "NDVI", "Vegetation", 4],
      ["ndwi_mean", "NDWI", "Water", 4],
      ["mndwi_mean", "MNDWI", "Modified water", 4],
      ["afai_mean", "AFAI", "Alternate FAI", 4],
      ["water_pixels", "Water px", "Detected water", 0],
      ["detected_ha", "Detected extent", "Floating vegetation", 2],
    ].filter(([key]) => Object.hasOwn(metrics, key));
    definitions.forEach(([key, label, detail, digits]) => {
      const card = add(root, grid, "article", "console-metric-card");
      add(root, card, "span", "", label);
      add(root, card, "strong", "", number(metrics[key], digits));
      add(root, card, "small", "", detail);
    });
    if (!definitions.some(([key]) => key === "fai_mean")) {
      add(root, target, "p", "console-unavailable", "Spectral-index summaries are not published in this release.");
    }
  }

  function timeline(root, target, observations, selected, select) {
    target.replaceChildren();
    const values = observations.map(row => Number.isFinite(row.metrics?.fai_mean)
      ? row.metrics.fai_mean
      : row.metrics?.detected_ha);
    const finite = values.filter(Number.isFinite);
    if (!finite.length) {
      add(root, target, "p", "console-unavailable", "No timeline values were published.");
      return;
    }
    const width = 320;
    const height = 108;
    const low = Math.min(0, ...finite);
    const high = Math.max(0, ...finite);
    const span = high - low || 1;
    const x = index => 8 + index * ((width - 16) / Math.max(observations.length - 1, 1));
    const y = value => height - 10 - ((value - low) / span) * (height - 20);
    const svg = root.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Observation timeline");
    svg.classList.add("console-timeline-chart");
    const points = values.map((value, index) => Number.isFinite(value) ? `${x(index)},${y(value)}` : null).filter(Boolean);
    if (points.length > 1) {
      const line = root.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", points.join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
    }
    observations.forEach((observation, index) => {
      const value = values[index];
      if (!Number.isFinite(value)) return;
      const point = root.createElementNS("http://www.w3.org/2000/svg", "circle");
      point.setAttribute("cx", x(index));
      point.setAttribute("cy", y(value));
      point.setAttribute("r", observation.id === selected.id ? "4" : "3");
      point.setAttribute("tabindex", "0");
      point.setAttribute("role", "button");
      point.setAttribute("aria-label", `${observation.date}: ${number(value, 4)}`);
      point.addEventListener("click", () => select(observation.id));
      point.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") select(observation.id);
      });
      svg.appendChild(point);
    });
    target.appendChild(svg);
    add(root, target, "p", "console-timeline-note", `Click chart or date to select · ${observations.length} observations`);
  }

  function observationButtons(root, target, observations, selected, select) {
    target.replaceChildren();
    add(root, target, "h2", "console-section-title", "Observations");
    const list = add(root, target, "div", "console-observation-list");
    observations.forEach(observation => {
      const button = add(root, list, "button", "console-observation", observation.date);
      button.type = "button";
      button.dataset.observation = observation.id;
      if (observation.id === selected.id) {
        button.classList.add("active");
        button.setAttribute("aria-current", "date");
      }
      button.addEventListener("click", () => select(observation.id));
    });
  }

  function samples(root, target, observation) {
    target.replaceChildren();
    const rows = Array.isArray(observation.samples) ? observation.samples : [];
    if (!rows.length) {
      add(root, target, "p", "console-unavailable", "Sampling-point spectral summaries are not published in this release.");
      return;
    }
    const table = add(root, target, "table", "console-sample-table");
    const head = add(root, table, "thead");
    const headRow = add(root, head, "tr");
    ["Point", "Mean", "Max"].forEach(label => add(root, headRow, "th", "", label));
    const body = add(root, table, "tbody");
    rows.forEach(row => {
      const tr = add(root, body, "tr");
      add(root, tr, "th", "", row.key);
      add(root, tr, "td", "", number(row.fai_mean, 4));
      add(root, tr, "td", "", number(row.fai_max, 4));
    });
  }

  function granules(root, target, observation) {
    target.replaceChildren();
    add(root, target, "h2", "console-section-title", `Granules — ${observation.date}`);
    const rows = Array.isArray(observation.granules) ? observation.granules : [];
    if (!rows.length) {
      add(root, target, "p", "console-unavailable", "Per-granule identifiers are not published in this release.");
      return;
    }
    const chips = add(root, target, "div", "console-chips");
    rows.forEach(row => add(root, chips, "span", "console-chip", `${row.satellite} · ${row.tile}`));
  }

  function create({ root, map, release, requestedObservation }) {
    const observations = observationsFor(release);
    if (!observations.length) throw new Error("The release has no console observations.");
    const inspector = root.querySelector("#console-inspector");
    const controls = root.querySelector("#console-layer-control");
    const timelineTarget = root.querySelector("#console-timeline");
    const timelineTitle = root.querySelector("#console-timeline-title");
    const metricsTarget = root.querySelector("#console-metrics");
    const granulesTarget = root.querySelector("#console-granules");
    const observationsTarget = root.querySelector("#console-observations");
    const sourceTarget = root.querySelector("#console-source");
    const samplesTarget = root.querySelector("#console-samples");
    const modeButtons = [...controls.querySelectorAll("[data-console-mode]")];
    const signalInputs = [...controls.querySelectorAll('input[type="checkbox"]')];
    const bounds = release.console?.bounds || release.monitor?.bounds;
    let active = observations.find(row => row.id === requestedObservation) || observations.at(-1);
    let mode = active.layers?.intensity ? "intensity" : "zones";
    const enabledSignals = new Set();
    const listeners = [];

    const listen = (element, type, handler) => {
      element.addEventListener(type, handler);
      listeners.push([element, type, handler]);
    };

    function updateUrl() {
      if (!window.location || !window.history) return;
      const params = new URLSearchParams(window.location.search);
      params.set("workspace", "console");
      params.set("observation", active.id);
      params.delete("beat");
      window.history.replaceState(null, "", `?${params.toString()}${window.location.hash}`);
    }

    function renderMap() {
      const files = [];
      const addFile = layer => {
        const file = active.layers?.[layer]?.file;
        if (file && !files.includes(file)) files.push(file);
      };
      addFile("base");
      addFile(mode);
      enabledSignals.forEach(addFile);
      map.clear();
      map.rasters(files.map(file => ({ frame: { file }, bounds })));
      map.coves?.({ color: "rgba(126, 247, 191, .8)", weight: 1, fillOpacity: 0 });
      map.fit(bounds);
    }

    function renderControls() {
      modeButtons.forEach(button => {
        const id = button.dataset.consoleMode;
        const available = Boolean(active.layers?.[id]?.file);
        button.disabled = !available;
        button.classList.toggle("active", available && id === mode);
        if (!available) button.title = "This layer is not published in the active release.";
        else button.removeAttribute("title");
      });
      signalInputs.forEach(input => {
        const available = Boolean(active.layers?.[input.value]?.file);
        input.disabled = !available;
        input.checked = available && enabledSignals.has(input.value);
        input.parentElement?.classList.toggle("unavailable", !available);
      });
    }

    function render() {
      renderControls();
      renderMap();
      metricCards(root, metricsTarget, active);
      samples(root, samplesTarget, active);
      granules(root, granulesTarget, active);
      observationButtons(root, observationsTarget, observations, active, selectObservation);
      timelineTitle.textContent = Number.isFinite(active.metrics?.fai_mean)
        ? "Floating Algae Index (FAI) timeline"
        : "Detected extent timeline";
      timeline(root, timelineTarget, observations, active, selectObservation);
      sourceTarget.replaceChildren();
      add(root, sourceTarget, "h2", "console-section-title", active.source_scene ? "Source scene" : "Observation record");
      add(root, sourceTarget, "p", "console-source-id", active.source_scene || active.id);
      inspector.setAttribute("data-active-observation", active.id);
      updateUrl();
    }

    function selectObservation(id) {
      const selected = observations.find(row => row.id === id);
      if (!selected || selected === active) return;
      active = selected;
      if (!active.layers?.[mode]?.file) mode = active.layers?.intensity ? "intensity" : "zones";
      [...enabledSignals].forEach(signal => {
        if (!active.layers?.[signal]?.file) enabledSignals.delete(signal);
      });
      render();
    }

    modeButtons.forEach(button => listen(button, "click", () => {
      if (button.disabled) return;
      mode = button.dataset.consoleMode;
      render();
    }));
    signalInputs.forEach(input => listen(input, "change", () => {
      if (input.checked) enabledSignals.add(input.value);
      else enabledSignals.delete(input.value);
      render();
    }));
    render();

    return {
      get activeObservation() { return active.id; },
      selectObservation,
      setMode(value) {
        if (active.layers?.[value]?.file) {
          mode = value;
          render();
        }
      },
      setSignal(value, enabled) {
        if (!active.layers?.[value]?.file) return;
        if (enabled) enabledSignals.add(value);
        else enabledSignals.delete(value);
        render();
      },
      dispose() {
        listeners.forEach(([element, type, handler]) => element.removeEventListener(type, handler));
        map.clear();
      },
    };
  }

  window.AppConsole = { create, observationsFor };
}());
