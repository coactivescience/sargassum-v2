(function () {
  "use strict";

  const CAPABILITY_LABELS = {
    meta: "Release metadata",
    sites: "Deploy",
    caddo_geometry: "Caddo map geometry",
    monitor: "Monitor",
    detect: "Detect",
    response: "Plan Response",
    verification: "Verify Results",
    hyperspectral: "Hyperspectral",
    evidence: "Evidence provenance"
  };

  function releaseVersion(release) {
    const value = release?.meta?.version ?? release?.meta?.schema ?? release?.version;
    return typeof value === "string" || typeof value === "number" ? String(value) : "Not provided";
  }

  function acquisitionCount(release) {
    const value = release?.inventory?.acquisitionCount;
    return typeof value === "number" && Number.isFinite(value)
      ? `${value} acquisition${value === 1 ? "" : "s"}`
      : "Not provided";
  }

  function displayDate(value) {
    const [year, month, day] = String(value || "").split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return "Date not provided";
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  function releaseBadges(release, beat) {
    if (beat === "hyperspectral") {
      const context = release.hyperspectral?.context;
      if (!context) return ["Hyperspectral evidence unavailable", "Reference/evaluation availability"];
      return [
        `${context.sensor_label} · ${displayDate(context.capture_date)}`,
        `${context.location_label} · ${context.purpose_label}`
      ];
    }
    const frames = Array.isArray(release.monitor?.frames) ? release.monitor.frames : [];
    const dates = frames.map(frame => frame?.date).filter(Boolean).sort();
    const first = dates[0];
    const last = dates.at(-1);
    const dateLabel = first && last
      ? `${displayDate(first)}${first === last ? "" : `–${displayDate(last)}`}`
      : "Dates not provided";
    const yearLabel = first && last
      ? `${first.slice(0, 4)}${first === last ? "" : `–${last.slice(0, 4)}`}`
      : "Dates not provided";
    const siteLabel = release.sites?.[0]?.label || "Release site";
    return [
      `${frames.length} approved release image${frames.length === 1 ? "" : "s"} · ${dateLabel}`,
      `${siteLabel} record · ${yearLabel}`
    ];
  }

  function missingCapabilities(validation) {
    const labels = new Set();
    (validation?.errors || []).forEach((error) => {
      if (typeof error !== "string") return;
      const root = error.match(/^([a-z_]+)/)?.[1];
      if (CAPABILITY_LABELS[root]) labels.add(CAPABILITY_LABELS[root]);
    });
    return labels.size ? [...labels].join(", ") : "Release payload validation failed";
  }

  function showApplicationShell() {
    const landing = document.querySelector("#public-landing");
    const shell = document.querySelector(".app-shell");
    if (landing) landing.hidden = true;
    if (shell) shell.hidden = false;
  }

  function startLimitedRelease(release, validation) {
    const retainedMap = window.demoApp?.map;
    window.demoApp?.dispose?.();

    const nav = document.querySelector(".beat-nav");
    const workspace = document.querySelector(".workspace");
    const mapStage = document.querySelector(".map-stage");
    const mapElement = document.querySelector("#map");
    const hyperspectralStage = document.querySelector("#hyperspectral-stage");
    const panel = document.querySelector("#panel");
    const status = document.querySelector("#release-status");
    const shell = document.querySelector(".app-shell");
    const consoleInspector = document.querySelector("#console-inspector");
    const layerControl = document.querySelector("#console-layer-control");
    const consoleButton = document.querySelector("#workspace-console");
    const briefingButton = document.querySelector("#workspace-briefing");
    const intelligenceButton = document.querySelector("#workspace-intelligence");
    const intelligenceRoot = document.querySelector("#intelligence-root");

    if (intelligenceRoot) { intelligenceRoot.hidden = true; intelligenceRoot.replaceChildren(); }
    nav?.replaceChildren();
    panel?.replaceChildren();
    hyperspectralStage?.replaceChildren();
    if (mapElement) mapElement.hidden = true;
    if (mapStage) mapStage.hidden = true;
    if (hyperspectralStage) hyperspectralStage.hidden = true;
    if (panel) panel.hidden = true;
    if (consoleInspector) consoleInspector.hidden = true;
    if (layerControl) layerControl.hidden = true;
    if (status) status.hidden = false;
    for (const button of [consoleButton, briefingButton, intelligenceButton]) {
      if (!button) continue;
      button.disabled = true;
      button.onclick = null;
    }
    workspace?.classList.remove("console-mode", "intelligence-mode");
    workspace?.classList.add("limited-release-mode");
    shell?.classList.add("limited-release-mode");

    const version = document.querySelector("#release-status-version");
    const acquisitions = document.querySelector("#release-status-acquisitions");
    const capabilities = document.querySelector("#release-status-capabilities");
    const guidance = document.querySelector("#release-status-guidance");
    if (version) version.textContent = releaseVersion(release);
    if (acquisitions) acquisitions.textContent = acquisitionCount(release);
    if (capabilities) capabilities.textContent = missingCapabilities(validation);
    if (guidance) guidance.textContent = "Publish a complete release to enable the map, visual history, response, verification, and deployment workspace.";

    const record = document.querySelector(".record-badge");
    if (record) record.textContent = "Limited release";
    showApplicationShell();
    window.demoApp = { kind: "limited", map: retainedMap, activeBeat: null, dispose() {} };
  }

  window.startSalviniaApp = function startSalviniaApp(classification, tenant, config) {
    const release = classification?.release || {};
    if (classification?.kind !== "full") {
      startLimitedRelease(release, classification?.validation);
      return;
    }

    const existingMap = window.demoApp?.map;
    window.demoApp?.dispose?.();

    const DATA = release;
    const requestBriefing = async () => {
      if (!tenant || typeof tenant.id !== "string") throw new Error("The selected tenant is unavailable.");
      const base = typeof config?.apiBaseUrl === "string" && config.apiBaseUrl.trim()
        ? config.apiBaseUrl
        : location.origin;
      const endpoint = new URL(
        `/api/tenants/${encodeURIComponent(tenant.id)}/salvinia/releases/current/operational-briefing`,
        base
      ).toString();
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: "{}"
      });
      let result = null;
      try { result = await response.json(); } catch { /* an unavailable service may not return JSON */ }
      if (!response.ok || !result?.briefing) throw new Error(result?.error || "The release briefing is unavailable.");
      return result.briefing;
    };

    const beats = [
      { id: "monitor", label: "Monitor" },
      { id: "detect", label: "Detect" },
      { id: "operations", label: "Caddo Lake Ops" },
      { id: "response", label: "Plan Response" },
      { id: "verification", label: "Verify Results" },
      { id: "deploy", label: "Deploy" },
      { id: "hyperspectral", label: "Hyperspectral" }
    ];

    const nav = document.querySelector(".beat-nav");
    const panel = document.querySelector("#panel");
    const title = document.querySelector("#map-title");
    const kicker = document.querySelector("#map-kicker");
    const legend = document.querySelector("#map-legend");
    const source = document.querySelector(".map-source");
    const record = document.querySelector(".record-badge");
    const workspace = document.querySelector(".workspace");
    const mapStage = document.querySelector(".map-stage");
    const mapElement = document.querySelector("#map");
    const hyperspectralStage = document.querySelector("#hyperspectral-stage");
    const status = document.querySelector("#release-status");
    const shell = document.querySelector(".app-shell");
    const consoleInspector = document.querySelector("#console-inspector");
    const layerControl = document.querySelector("#console-layer-control");
    const consoleButton = document.querySelector("#workspace-console");
    const briefingButton = document.querySelector("#workspace-briefing");
    const intelligenceButton = document.querySelector("#workspace-intelligence");
    const intelligenceRoot = document.querySelector("#intelligence-root");
    for (const button of [consoleButton, briefingButton, intelligenceButton]) {
      if (button) button.disabled = false;
    }
    showApplicationShell();
    if (mapElement) mapElement.hidden = false;
    if (mapStage) mapStage.hidden = false;
    if (hyperspectralStage) hyperspectralStage.hidden = false;
    if (panel) panel.hidden = false;
    if (consoleInspector) consoleInspector.hidden = true;
    if (layerControl) layerControl.hidden = true;
    if (status) status.hidden = true;
    workspace?.classList.remove("limited-release-mode");
    shell?.classList.remove("limited-release-mode");
    const map = existingMap || new AppCore.MapView("map", DATA.caddo_geometry);
    map.coveGeometry = DATA.caddo_geometry;
    let activePlayback = null;
    let activeBeat = null;
    let activeWorkspace = null;
    let activeConsole = null;
    let activeIntelligence = null;
    const requestExport = tenant?.id && classification.releaseId && DATA.meta?.source_revision ? async ({ kind, weights, budget }) => {
      const response = await fetch(new URL(
        `/api/tenants/${encodeURIComponent(tenant.id)}/salvinia/releases/current/intelligence/export`,
        config?.apiBaseUrl || location.origin
      ), { method: "POST", credentials: "include", headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ kind, weights, budget, source_revision: DATA.meta.source_revision, release_id: classification.releaseId }) });
      let result;
      try { result = await response.json(); } catch { /* bounded failure below */ }
      if (!response.ok || result?.authorized !== true || result?.source_revision !== DATA.meta.source_revision || result?.release_id !== classification.releaseId)
        throw new Error(result?.error || "Export authorization is unavailable or the active release changed. Reload before exporting.");
      return result;
    } : null;

    function leaveIntelligence() {
      activeIntelligence?.dispose?.();
      activeIntelligence = null;
      if (intelligenceRoot) intelligenceRoot.hidden = true;
      workspace?.classList.remove("intelligence-mode");
      mapStage.hidden = false;
    }

    nav.replaceChildren();
    beats.forEach((beat, index) => {
      const button = document.createElement("button");
      const number = document.createElement("span");
      const label = document.createElement("strong");
      button.className = "beat-tab";
      button.dataset.beat = beat.id;
      number.textContent = String(index + 1).padStart(2, "0");
      label.textContent = beat.label;
      button.appendChild(number);
      button.appendChild(label);
      button.addEventListener("click", () => showBeat(beat.id, { focusHeading: true }));
      nav.appendChild(button);
    });

    function markWorkspace(selected) {
      [[consoleButton, "console"], [briefingButton, "briefing"], [intelligenceButton, "intelligence"]].forEach(([button, id]) => {
        if (!button) return;
        const current = selected === id;
        button.classList.toggle("active", current);
        if (current) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }

    function showBeat(id, { focusHeading = false } = {}) {
      leaveIntelligence();
      const selected = beats.some((beat) => beat.id === id) ? id : "monitor";
      id = selected;
      if (activePlayback) activePlayback.stop();
      activePlayback = null;
      activeConsole?.dispose?.();
      activeConsole = null;
      activeWorkspace = "briefing";
      activeBeat = selected;
      map.clear();
      nav.hidden = false;
      panel.hidden = false;
      hyperspectralStage.hidden = false;
      if (consoleInspector) consoleInspector.hidden = true;
      if (layerControl) layerControl.hidden = true;
      workspace?.classList.remove("console-mode", "intelligence-mode");
      markWorkspace("briefing");
      panel.scrollTop = 0;
      hyperspectralStage.replaceChildren();
      hyperspectralStage.scrollTop = 0;
      mapStage.classList.toggle("comparison-mode", selected === "hyperspectral");
      mapStage.setAttribute(
        "aria-label",
        selected === "hyperspectral" ? "Hyperspectral evidence comparison" : "Lake map"
      );
      nav.querySelectorAll(".beat-tab").forEach((button) => {
        const current = button.dataset.beat === selected;
        button.classList.toggle("active", current);
        if (current) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      const params = new URLSearchParams(location.search);
      params.set("workspace", "briefing");
      params.set("beat", id);
      history.replaceState(null, "", `?${params.toString()}${location.hash}`);
      const [sourceLabel, recordLabel] = releaseBadges(DATA, selected);
      source.textContent = sourceLabel;
      const recordIndicator = document.createElement("span");
      recordIndicator.setAttribute("aria-hidden", "true");
      record.replaceChildren(recordIndicator);
      record.append(recordLabel);
      AppViews[selected]({
        map,
        panel,
        hyperspectralStage,
        data: DATA,
        requestBriefing,
        heading: (small, large) => { kicker.textContent = small; title.textContent = large; },
        legend: items => { legend.innerHTML = AppCore.legend(items); },
        usePlayback: playback => { activePlayback = playback; }
      });
      panel.scrollTop = 0;
      hyperspectralStage.scrollTop = 0;
      if (focusHeading) {
        const viewHeading = panel.querySelector("h1");
        if (viewHeading) {
          viewHeading.setAttribute("tabindex", "-1");
          viewHeading.focus();
        }
      }
    }

    function showConsole() {
      leaveIntelligence();
      if (activePlayback) activePlayback.stop();
      activePlayback = null;
      activeConsole?.dispose?.();
      activeConsole = null;
      activeWorkspace = "console";
      activeBeat = null;
      map.clear();
      nav.hidden = true;
      panel.hidden = true;
      hyperspectralStage.hidden = true;
      hyperspectralStage.replaceChildren();
      mapStage.classList.remove("comparison-mode");
      mapStage.setAttribute("aria-label", "Caddo observation map");
      if (consoleInspector) consoleInspector.hidden = false;
      if (layerControl) layerControl.hidden = false;
      workspace?.classList.add("console-mode");
      markWorkspace("console");
      const [sourceLabel, recordLabel] = releaseBadges(DATA, "monitor");
      source.textContent = sourceLabel;
      const recordIndicator = document.createElement("span");
      recordIndicator.setAttribute("aria-hidden", "true");
      record.replaceChildren(recordIndicator);
      record.append(recordLabel);
      kicker.textContent = "Observation console";
      title.textContent = DATA.sites?.[0]?.label || "Caddo Lake";
      legend.replaceChildren();
      const params = new URLSearchParams(location.search);
      params.set("workspace", "console");
      params.delete("beat");
      history.replaceState(null, "", `?${params.toString()}${location.hash}`);
      activeConsole = AppConsole.create({
        root: document,
        map,
        release: DATA,
        requestedObservation: params.get("observation"),
      });
    }

    function showIntelligence() {
      if (!intelligenceRoot || !window.AppIntelligence) return;
      activePlayback?.stop();
      activePlayback = null;
      activeConsole?.dispose?.();
      activeConsole = null;
      activeIntelligence?.dispose?.();
      map.clear();
      activeWorkspace = "intelligence";
      activeBeat = null;
      nav.hidden = true;
      panel.hidden = true;
      mapStage.hidden = true;
      hyperspectralStage.hidden = true;
      hyperspectralStage.replaceChildren();
      if (consoleInspector) consoleInspector.hidden = true;
      if (layerControl) layerControl.hidden = true;
      workspace?.classList.remove("console-mode");
      workspace?.classList.add("intelligence-mode");
      intelligenceRoot.hidden = false;
      markWorkspace("intelligence");
      const params = new URLSearchParams(location.search);
      params.set("workspace", "intelligence");
      params.delete("beat");
      history.replaceState(null, "", `?${params.toString()}${location.hash}`);
      record.textContent = "Release-owned Intelligence";
      activeIntelligence = window.AppIntelligence.create({ root: intelligenceRoot, release: DATA, releaseId: classification.releaseId, requestExport });
    }

    const requestedParams = new URLSearchParams(location.search);
    const requested = requestedParams.get("beat");
    const alias = requested === "ops" ? "operations" : requested;
    const numeric = Number(alias);
    const numberedBeats = requestedParams.has("workspace") ? beats : beats.filter(beat => beat.id !== "operations");
    const initial = beats.some((beat) => beat.id === alias)
      ? alias
      : (Number.isInteger(numeric) && numberedBeats[numeric - 1] ? numberedBeats[numeric - 1].id : "monitor");
    if (consoleButton) consoleButton.onclick = showConsole;
    if (briefingButton) briefingButton.onclick = () => showBeat(activeBeat || "monitor", { focusHeading: true });
    if (intelligenceButton) intelligenceButton.onclick = showIntelligence;
    if (requestedParams.get("workspace") === "intelligence") showIntelligence();
    else if (requestedParams.get("workspace") === "briefing" || requested) showBeat(initial);
    else showConsole();

    window.demoApp = {
      kind: "full",
      map,
      show: showBeat,
      showWorkspace(id) { id === "intelligence" ? showIntelligence() : id === "briefing" ? showBeat(activeBeat || "monitor") : showConsole(); },
      get activeBeat() { return activeBeat; },
      get activeWorkspace() { return activeWorkspace; },
      dispose() {
        leaveIntelligence();
        if (intelligenceButton) intelligenceButton.onclick = null;
        if (activePlayback) activePlayback.stop();
        activePlayback = null;
        activeConsole?.dispose?.();
        activeConsole = null;
        map.clear();
        hyperspectralStage.replaceChildren();
        mapStage.classList.remove("comparison-mode");
        activeBeat = null;
        activeWorkspace = null;
      }
    };
    if (!window.salviniaUnloadBound) {
      window.addEventListener("beforeunload", () => window.demoApp?.dispose?.());
      window.salviniaUnloadBound = true;
    }
  };
}());
