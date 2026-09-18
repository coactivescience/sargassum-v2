(function () {
  "use strict";

  const C = window.AppCore;

  function baseCoves(map) {
    map.coves({ color: "rgba(190,215,204,.26)", weight: .55, fillOpacity: 0 });
  }

  function releaseYearRange(monitor) {
    const years = (monitor?.frames || [])
      .map(frame => typeof frame?.date === "string" ? frame.date.slice(0, 4) : "")
      .filter(year => /^\d{4}$/.test(year))
      .sort();
    if (!years.length) return null;
    return years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`;
  }

  function lakeLegend(monitor, detectedLabel, items) {
    const years = releaseYearRange(monitor);
    return [
      { color: C.colors.muted, label: `Approved release imagery${years ? ` · ${years}` : ""}` },
      { color: C.colors.lime, label: detectedLabel || "Detected floating vegetation" },
      ...(items || [])
    ];
  }

  function imageWarnings(frames, label) {
    return (frames || [])
      .filter(frame => !frame?.file)
      .map(frame => C.dataWarning(`${label} “${frame?.label || frame?.date || "unlabelled observation"}” has no published image.`))
      .join("");
  }

  function monitor(ctx) {
    const data = ctx.data.monitor;
    const first = data.frames[0];
    const last = data.frames.at(-1);
    const firstDate = C.formatDate(first.date);
    const lastDate = C.formatDate(last.date);
    ctx.heading("Monitor", `${firstDate}–${lastDate} · approved floating-vegetation record`);
    ctx.legend(lakeLegend(data, `Detected patches ≥ ${data.minimum_patch_ha} ha`));
    ctx.panel.innerHTML = `
      <div class="panel-kicker">01 · Monitor</div>
      <h1>See the lake change from ${firstDate} to ${lastDate}.</h1>
      <p class="lede">A consistent satellite record turns seasonal change into a view managers can revisit, compare, and act on.</p>
      <div class="metric-grid">
        <div class="metric"><span>Record</span><strong>${first.date.slice(0, 4)}–${last.date.slice(0, 4)}</strong></div>
        <div class="metric"><span>Observations</span><strong>${data.frames.length}</strong></div>
      </div>
      <div class="acquisition-list">${data.frames.map(frame => `
        <article class="acquisition-card"><span>${C.formatDate(frame.date)}</span><strong>${C.escapeHtml(frame.label || "Approved observation")}</strong><small>${C.hectares(frame.mat_ha)} detected</small></article>`).join("")}</div>
      <div class="control-card">
        <div class="control-row"><button class="primary-button" id="monitor-play">Play record</button><span class="control-date" id="monitor-date"></span></div>
        <input class="range" id="monitor-range" type="range" min="0" max="${data.frames.length - 1}" value="0" aria-label="Observation date">
        <strong id="monitor-area"></strong>
      </div>
      ${imageWarnings(data.frames, "Monitor observation")}
      <div class="boundary"><span>◈</span><span>This maps floating vegetation from satellite imagery. Species confirmation still requires field observation.</span></div>
      ${C.evidence(ctx.data.evidence.monitor)}`;
    baseCoves(ctx.map);
    ctx.map.fit(data.bounds);
    const button = ctx.panel.querySelector("#monitor-play");
    const range = ctx.panel.querySelector("#monitor-range");
    const date = ctx.panel.querySelector("#monitor-date");
    const area = ctx.panel.querySelector("#monitor-area");
    const playback = new C.Playback(data.frames, (frame, index) => {
      ctx.map.raster(frame, data.bounds);
      range.value = index;
      date.textContent = C.formatDate(frame.date);
      area.textContent = C.hectares(frame.mat_ha) + " detected";
      button.textContent = playback.running ? "Pause" : (index === data.frames.length - 1 ? "Replay" : "Play record");
    }, () => { button.textContent = "Replay"; }, 420);
    ctx.usePlayback(playback);
    playback.show(0);
    button.addEventListener("click", () => {
      if (playback.running) {
        playback.pause();
        button.textContent = "Continue";
      } else {
        playback.play();
        button.textContent = "Pause";
      }
    });
    range.addEventListener("input", () => {
      playback.pause();
      playback.show(Number(range.value));
      button.textContent = Number(range.value) === data.frames.length - 1 ? "Replay" : "Play";
    });
  }

  function detect(ctx) {
    const data = ctx.data.detect;
    const values = new Map(data.largest.map(row => [row.cove_id, row]));
    ctx.heading("Detect", `${C.formatDate(data.date)} · approved clear observation`);
    ctx.legend(lakeLegend(ctx.data.monitor, null, [
      { color: C.colors.amber, label: `${data.largest.length} largest affected coves`, dot: true }
    ]));
    ctx.panel.innerHTML = `
      <div class="panel-kicker">02 · Detect</div>
      <h1>Inspect candidates from ${C.formatDate(data.date)}.</h1>
      <p class="lede">This approved clear observation identifies ${data.affected_count} affected coves and brings the largest concentrations to the top.</p>
      <div class="metric-grid">
        <div class="metric"><span>Observation</span><strong>${C.formatDate(data.date).replace(/, \d{4}$/, "")}</strong></div>
        <div class="metric"><span>Affected coves</span><strong>${data.affected_count}</strong></div>
      </div>
      <div class="rank-list">${data.largest.map((row, index) => `
        <div class="rank-row"><span class="rank-number" style="background:var(--amber)">${index + 1}</span>
          <span><strong>${C.escapeHtml(row.name)}</strong><br><em>${Math.round(row.valid_fraction * 100)}% observed</em></span>
          <strong>${C.hectares(row.detected_ha, 1)}</strong></div>`).join("")}</div>
      ${imageWarnings([data.frame], "Detection")}
      <div class="boundary"><span>→</span><span>Send inspection teams to confirm giant salvinia before species-specific action.</span></div>
      ${C.evidence(ctx.data.evidence.detect)}`;
    ctx.map.raster(data.frame, ctx.data.monitor.bounds);
    ctx.map.coves(feature => {
      const id = feature.properties.id;
      if (values.has(id)) return { color: C.colors.amber, weight: 2.4, fillColor: C.colors.amber, fillOpacity: .16 };
      if (data.affected_cove_ids.includes(id)) return { color: C.colors.lime, weight: 1, fillColor: C.colors.lime, fillOpacity: .06 };
      return { color: "rgba(190,215,204,.22)", weight: .5, fillOpacity: 0 };
    }, null, feature => {
      const row = values.get(feature.properties.id);
      return row ? `${C.escapeHtml(row.name)} · ${C.hectares(row.detected_ha, 1)} · ${Math.round(row.valid_fraction * 100)}% observed` : C.escapeHtml(feature.properties.name);
    });
    data.largest.forEach((row, index) => ctx.map.numberedMarker(row.lonlat, index + 1, "amber", `${row.name} · ${C.hectares(row.detected_ha, 1)}`));
    ctx.map.fit(ctx.data.monitor.bounds);
  }

  function operations(ctx) {
    const monitor = ctx.data.monitor;
    const detected = ctx.data.detect;
    const latest = monitor.frames.at(-1);
    const priorities = detected.largest || [];
    const siteLabel = ctx.data.sites?.[0]?.label || "Caddo Lake";
    const recordLabel = releaseYearRange(monitor) || "published";
    ctx.heading("Caddo Lake Ops", `${siteLabel} · ${C.formatDate(detected.date)} · inspection picture`);
    ctx.legend(lakeLegend(monitor, null, [{ color: C.colors.amber, label: "Inspection priority", dot: true }]));
    ctx.panel.innerHTML = `
      <div class="panel-kicker">03 · Caddo Lake operations</div>
      <h1>Coordinate ${C.escapeHtml(siteLabel)}’s ${C.formatDate(detected.date)} field check.</h1>
      <p class="lede">This tenant-scoped workspace carries the current verified release into an operational view. It ranks places for inspection; field confirmation is still required before species-specific action.</p>
      <section class="ops-summary">
        <div><span>Active site</span><strong>${C.escapeHtml(siteLabel)}</strong></div>
        <div><span>Latest scene</span><strong>${C.formatDate(detected.date)}</strong></div>
        <div><span>Affected coves</span><strong>${detected.affected_count}</strong></div>
      </section>
      <div class="panel-kicker" style="margin-top:20px">Inspection priorities</div>
      <div class="rank-list">${priorities.map((row, index) => `
        <button class="rank-row ops-priority" data-index="${index}"><span class="rank-number" style="background:var(--amber)">${index + 1}</span>
          <span><strong>${C.escapeHtml(row.name)}</strong><br><em>${Math.round(row.valid_fraction * 100)}% observed</em></span>
          <strong>${C.hectares(row.detected_ha, 1)}</strong></button>`).join("") || '<p class="lede">No affected coves are present in the latest verified scene.</p>'}</div>
      <section class="ops-agent" aria-labelledby="ops-agent-title">
        <div><span class="panel-kicker">Salvinia agent</span><strong id="ops-agent-title">Release-grounded field briefing</strong></div>
        <p id="ops-agent-result">Generate a concise briefing from the currently published release. It does not infer species identity or treatment outcomes.</p>
        <button class="primary-button" id="ops-agent-button">Ask the Salvinia Agent</button>
      </section>
      ${imageWarnings([detected.frame], "Operational detection")}
      <div class="boundary"><span>?</span><span>${ctx.data.verification?.candidates?.length ? "Published before/after observations are available in Verify Results." : "No before/after candidate pairs are published in this release."} Establishing treatment effects requires field observations and management records; imagery alone does not establish causality.</span></div>
      ${C.evidence({ title: "Operational evidence", lines: [
        `The current priority list is calculated from ${C.formatDate(detected.date)} within the verified release.`,
        "A priority is a field-inspection order, not a giant salvinia identification or treatment recommendation.",
        latest ? `The release contains ${monitor.frames.length} approved ${recordLabel} observation${monitor.frames.length === 1 ? "" : "s"}; the latest mapped extent is ${C.hectares(latest.mat_ha)}.` : "No approved observation is available."
      ] })}`;
    const agentButton = ctx.panel.querySelector("#ops-agent-button");
    const agentResult = ctx.panel.querySelector("#ops-agent-result");
    function localBriefing() {
      const leading = priorities[0];
      agentResult.textContent = leading
        ? `Start at ${leading.name} (${C.hectares(leading.detected_ha, 1)} mapped; ${Math.round(leading.valid_fraction * 100)}% observed), then inspect the remaining ${Math.max(priorities.length - 1, 0)} listed cove${priorities.length === 2 ? "" : "s"}. Record species, extent, and management context; this release cannot verify earlier treatment outcomes.`
        : "No current hotspot is available. Use the next approved scene and field observations to establish an inspection plan.";
      agentButton.textContent = "Briefing ready";
      agentButton.disabled = true;
    }
    if (!ctx.requestBriefing) {
      /* Exported/offline releases retain a useful locally derived briefing. */
      agentButton?.addEventListener("click", localBriefing);
    } else agentButton?.addEventListener("click", async () => {
      agentButton.disabled = true;
      agentButton.textContent = "Preparing briefing…";
      try {
        const briefing = await ctx.requestBriefing();
        agentResult.textContent = briefing.message;
        agentButton.textContent = "Briefing ready";
      } catch (error) {
        agentResult.textContent = error instanceof Error ? error.message : "The release briefing is unavailable.";
        agentButton.textContent = "Try again";
        agentButton.disabled = false;
      }
    });
    const rows = Array.from(ctx.panel.querySelectorAll(".ops-priority"));
    rows.forEach((row, index) => row.addEventListener("click", () => {
      const priority = priorities[index];
      ctx.map.groups.geometry.clearLayers();
      ctx.map.groups.markers.clearLayers();
      ctx.map.coves(feature => feature.properties.id === priority.cove_id
        ? { color: C.colors.amber, weight: 3, fillColor: C.colors.amber, fillOpacity: .2 }
        : { color: "rgba(190,215,204,.18)", weight: .45, fillOpacity: 0 });
      ctx.map.numberedMarker(priority.lonlat, index + 1, "amber", priority.name);
      ctx.map.focus(priority.lonlat, 13);
    }));
    ctx.map.raster(detected.frame, monitor.bounds);
    ctx.map.coves(feature => priorities.some(row => row.cove_id === feature.properties.id)
      ? { color: C.colors.amber, weight: 1.8, fillColor: C.colors.amber, fillOpacity: .11 }
      : { color: "rgba(190,215,204,.2)", weight: .45, fillOpacity: 0 });
    priorities.forEach((row, index) => ctx.map.numberedMarker(row.lonlat, index + 1, "amber", row.name));
    ctx.map.fit(monitor.bounds);
  }

  function response(ctx) {
    const data = ctx.data.response;
    if (data.availability?.state === "limited_history" || data.state === "limited_history") {
      const years = releaseYearRange(ctx.data.monitor);
      ctx.heading("Plan response", "Historical outcome analysis is not in this release");
      ctx.legend(lakeLegend(ctx.data.monitor));
      ctx.panel.innerHTML = `
        <div class="panel-kicker">03 · Plan response</div>
        <h1>History is intentionally bounded.</h1>
        <p class="lede">${C.escapeHtml(data.availability?.message || data.message)}</p>
        <div class="boundary"><span>→</span><span>Only imagery from the approved ${years ? `${years} release window` : "release window"} is present. Importing additional approved imagery is required before ranking historical outcomes.</span></div>`;
      baseCoves(ctx.map);
      ctx.map.fit(ctx.data.monitor.bounds);
      return;
    }
    const priorityIds = new Set(data.priorities.map(row => row.cove_id));
    const hitIds = new Set(data.hit_cove_ids);
    const missedIds = new Set(data.missed_cove_ids);
    const priorityOnlyIds = new Set(data.priority_only_cove_ids);
    const treatments = Array.isArray(data.treatments) ? data.treatments : [];
    const validTreatments = treatments.filter(row => C.validDate(row?.start_date) && C.validDate(row?.end_date));
    const treatmentWarnings = treatments
      .filter(row => !C.validDate(row?.start_date) || !C.validDate(row?.end_date))
      .map(row => C.dataWarning(`Treatment chronology record “${row?.label || "unlabelled record"}” needs valid start and end dates.`))
      .join("");
    ctx.heading("Plan response", `${C.formatDate(data.frames[0].date)} · historical decision point`);
    ctx.panel.innerHTML = `
      <div class="panel-kicker">03 · Plan response</div>
      <h1>Plan from ${C.formatDate(data.frames[0].date)} for ${data.priorities.length} priority coves.</h1>
      <p class="lede">At this historical decision point, current detected extent gives crews a simple, evidence-backed inspection order.</p>
      <div class="control-card"><div class="control-row">
        <button class="primary-button" id="response-play">Show what happened</button>
        <span class="control-date" id="response-stage">Priority date</span>
      </div></div>
      <div class="rank-list">${data.priorities.map(row => `
        <div class="rank-row"><span class="rank-number">${row.rank}</span><span><strong>${C.escapeHtml(row.name)}</strong><br><em>${C.hectares(row.origin_ha, 1)} at priority date</em></span><strong>${row.growth_ha >= 0 ? "+" : ""}${C.hectares(row.growth_ha, 1)}</strong></div>`).join("")}</div>
      ${treatments.length ? `
        <div class="panel-kicker" style="margin-top:20px">Management chronology</div>
        <div class="treatment-list">${validTreatments.map(row => `
          <div class="treatment-row"><strong>${C.escapeHtml(row.label)}</strong><span>${C.formatDate(row.start_date)}–${C.formatDate(row.end_date)}</span><small>${C.escapeHtml(row.detail || "Management context record")}</small></div>`).join("")}</div>
        ${treatmentWarnings}` : ""}
      ${imageWarnings(data.frames, "Response observation")}
      <div class="boundary"><span>?</span><span>Later remote-sensing observations document change; they do not establish a treatment effect.</span></div>
      ${C.evidence(ctx.data.evidence.response)}`;
    const button = ctx.panel.querySelector("#response-play");
    const stage = ctx.panel.querySelector("#response-stage");
    const labels = ["Priority date", "Year 1", "Year 2", "Outcome"];

    function showPriorities() {
      ctx.map.groups.geometry.clearLayers();
      ctx.map.groups.markers.clearLayers();
      ctx.map.coves(feature => priorityIds.has(feature.properties.id)
        ? { color: C.colors.blue, weight: 2, fillColor: C.colors.blue, fillOpacity: .13 }
        : { color: "rgba(190,215,204,.2)", weight: .45, fillOpacity: 0 });
      data.priorities.forEach(row => ctx.map.numberedMarker(row.lonlat, row.rank, "", row.name));
      ctx.legend(lakeLegend(ctx.data.monitor, null, [
        { color: C.colors.blue, label: "Inspection priorities", dot: true }
      ]));
    }

    function showOutcome() {
      ctx.map.groups.geometry.clearLayers();
      ctx.map.groups.markers.clearLayers();
      ctx.map.coves(feature => {
        const id = feature.properties.id;
        if (hitIds.has(id)) return { color: C.colors.green, weight: 2.5, fillColor: C.colors.green, fillOpacity: .2 };
        if (missedIds.has(id)) return { color: C.colors.amber, weight: 2.5, fillColor: C.colors.amber, fillOpacity: .2 };
        if (priorityOnlyIds.has(id)) return { color: C.colors.blue, weight: 2, fillColor: C.colors.blue, fillOpacity: .12 };
        return { color: "rgba(190,215,204,.16)", weight: .4, fillOpacity: 0 };
      });
      data.priorities.forEach(row => ctx.map.numberedMarker(row.lonlat, row.rank, hitIds.has(row.cove_id) ? "green" : "", row.name));
      ctx.legend(lakeLegend(ctx.data.monitor, null, [
        { color: C.colors.green, label: `Correct priorities (${data.hit_cove_ids.length})` },
        { color: C.colors.blue, label: "Priority only" },
        { color: C.colors.amber, label: "Missed growth hotspot" }
      ]));
    }

    showPriorities();
    const playback = new C.Playback(data.frames, (frame, index) => {
      ctx.map.raster(frame, data.bounds);
      stage.textContent = `${frame.label || labels[index] || "Observation"} · ${C.formatDate(frame.date)}`;
      if (index === data.frames.length - 1) showOutcome();
    }, () => { button.textContent = "Show again"; }, 1050);
    ctx.usePlayback(playback);
    playback.show(0);
    ctx.map.fit(data.bounds);
    button.addEventListener("click", () => {
      showPriorities();
      playback.reset();
      playback.play();
      button.textContent = "Playing…";
    });
  }

  function verification(ctx) {
    const data = ctx.data.verification;
    if (data.availability?.state === "limited_history" || data.state === "limited_history") {
      const years = releaseYearRange(ctx.data.monitor);
      ctx.heading("Verify results", "Historical change screening is not in this release");
      ctx.legend(lakeLegend(ctx.data.monitor));
      ctx.panel.innerHTML = `
        <div class="panel-kicker">04 · Verify results</div>
        <h1>History is intentionally bounded.</h1>
        <p class="lede">${C.escapeHtml(data.availability?.message || data.message)}</p>
        <div class="boundary"><span>?</span><span>Rapid-change candidates need observations across the comparison period. This tenant release contains only the approved ${years ? `${years} window` : "release window"}.</span></div>`;
      baseCoves(ctx.map);
      ctx.map.fit(ctx.data.monitor.bounds);
      return;
    }
    let selected = 0;
    let moment = "before";
    const firstCandidate = data.candidates[0];
    ctx.heading("Verify results", `${firstCandidate.name} · ${C.formatDate(firstCandidate.before.date)}–${C.formatDate(firstCandidate.after.date)} · comparison`);
    ctx.legend(lakeLegend(ctx.data.monitor, null, [
      { color: C.colors.amber, label: "Selected decline candidate", dot: true }
    ]));
    ctx.panel.innerHTML = `
      <div class="panel-kicker">04 · Verify results</div>
      <h1>Verify change at ${C.escapeHtml(firstCandidate.name)}.</h1>
      <p class="lede">Rapid declines flag places to compare against treatment logs, inspection notes, and field outcomes.</p>
      <div class="candidate-list">${data.candidates.map(row => {
        const declinePct = row.area_before_ha > 0
          ? Math.round((1 - row.area_after_ha / row.area_before_ha) * 100)
          : 0;
        return `
        <button class="candidate-row" data-index="${row.number - 1}"><span class="rank-number">${row.number}</span>
          <span><strong>${C.escapeHtml(row.name)}</strong><small>${row.elapsed_days} days · ${declinePct}% decline</small></span>
          <strong>${C.hectares(row.area_before_ha, 1)} → ${C.hectares(row.area_after_ha, 1)}</strong></button>`;
      }).join("")}</div>
      <div class="control-card" id="candidate-detail"></div>
      ${imageWarnings(data.candidates.flatMap(candidate => [candidate.before, candidate.after]), "Verification observation")}
      <div class="boundary"><span>?</span><span>A decline is evidence of change, not proof of treatment. Supply management records to test that link.</span></div>
      ${C.evidence(ctx.data.evidence.verification)}`;
    const detail = ctx.panel.querySelector("#candidate-detail");
    const rows = Array.from(ctx.panel.querySelectorAll(".candidate-row"));

    function draw() {
      const candidate = data.candidates[selected];
      const frame = candidate[moment];
      rows.forEach((row, index) => row.classList.toggle("active", index === selected));
      detail.innerHTML = `
        <div class="control-row"><strong>${C.escapeHtml(candidate.name)}</strong><span class="control-date">NIR −${candidate.nir_decline.toFixed(3)}</span></div>
        <div class="toggle-group"><button class="toggle-button ${moment === "before" ? "active" : ""}" data-moment="before">Before · ${C.formatDate(candidate.before.date)}</button>
        <button class="toggle-button ${moment === "after" ? "active" : ""}" data-moment="after">After · ${C.formatDate(candidate.after.date)}</button></div>
        <p class="lede" style="margin:12px 0 0;font-size:12px">${C.hectares(candidate.area_before_ha, 1)} → ${C.hectares(candidate.area_after_ha, 1)} · ${C.escapeHtml(candidate.drift_status)}</p>`;
      detail.querySelectorAll("[data-moment]").forEach(button => button.addEventListener("click", () => {
        moment = button.dataset.moment;
        draw();
      }));
      ctx.map.groups.geometry.clearLayers();
      ctx.map.groups.markers.clearLayers();
      ctx.map.raster(frame, data.bounds);
      ctx.map.coves(
        feature => feature.properties.id === candidate.cove_id
          ? { color: C.colors.amber, weight: 3, fillColor: C.colors.amber, fillOpacity: .18 }
          : { color: "rgba(190,215,204,.18)", weight: .45, fillOpacity: 0 }
      );
      ctx.map.numberedMarker(candidate.lonlat, candidate.number, "amber", candidate.name);
      ctx.map.focus(candidate.lonlat, 13);
      ctx.heading("Verify results", `${candidate.name} · ${C.formatDate(candidate.before.date)}–${C.formatDate(candidate.after.date)} · ${moment} view`);
    }
    rows.forEach((row, index) => row.addEventListener("click", () => {
      selected = index;
      moment = "before";
      draw();
    }));
    draw();
  }

  function deploy(ctx) {
    const siteLabel = ctx.data.sites?.[0]?.label || "Caddo Lake";
    ctx.heading("Deploy", `${siteLabel} · pathway to operations`);
    ctx.legend(lakeLegend(ctx.data.monitor));
    ctx.panel.innerHTML = `
      <div class="panel-kicker">05 · Deploy</div>
      <h1>Put ${C.escapeHtml(siteLabel)} into operation.</h1>
      <p class="lede">Connect recurring monitoring, inspection priorities, and management records in one shared view.</p>
      <div class="site-list">${ctx.data.sites.map(site => `
        <div class="site-row" style="--tone:${C.colors.green}"><span class="status-dot"></span><span><strong>${C.escapeHtml(site.label)}</strong><small>${C.escapeHtml(site.status)} · ${C.escapeHtml(site.detail)}</small></span></div>`).join("")}</div>
      <div class="panel-kicker" style="margin-top:20px">What USACE provides next</div>
      <ul class="request-list">
        <li>Treatment dates, locations, methods, and quantities</li>
        <li>Inspection observations and species confirmations</li>
        <li>Operational thresholds for alerts and crew response</li>
      </ul>
      ${imageWarnings([ctx.data.detect.frame], "Deployment background")}
      ${C.evidence(ctx.data.evidence.deploy)}`;
    ctx.map.raster(ctx.data.detect.frame, ctx.data.monitor.bounds);
    baseCoves(ctx.map);
    ctx.map.fit(ctx.data.monitor.bounds);
  }

  const SPECTRAL_REGIONS = [
    {
      label: "Visible light",
      subtitle: "Released visible targets",
      includes: wavelength => wavelength >= 550 && wavelength < 690
    },
    {
      label: "Red edge",
      subtitle: "Released transition targets",
      includes: wavelength => wavelength >= 690 && wavelength < 800
    },
    {
      label: "Near-infrared",
      subtitle: "Released near-infrared targets",
      includes: wavelength => wavelength >= 800
    }
  ];

  function measuredRegionComparison(region, sites) {
    const first = new Map(sites[0].spectrum
      .filter(point => region.includes(point.wavelength_nm))
      .map(point => [point.wavelength_nm, point.normalized_median]));
    const second = new Map(sites[1].spectrum
      .filter(point => region.includes(point.wavelength_nm))
      .map(point => [point.wavelength_nm, point.normalized_median]));
    const shared = [...first.keys()].filter(wavelength => second.has(wavelength));
    let firstHigher = 0;
    let secondHigher = 0;
    let tied = 0;
    shared.forEach(wavelength => {
      if (first.get(wavelength) > second.get(wavelength)) firstHigher += 1;
      else if (second.get(wavelength) > first.get(wavelength)) secondHigher += 1;
      else tied += 1;
    });
    if (!shared.length) return "No shared released wavelength targets are available in this region.";
    return `${sites[0].label} median is higher at ${firstHigher} of ${shared.length} shared targets; ${sites[1].label} median is higher at ${secondHigher}; ${tied} are tied.`;
  }

  function spectralChart(sites) {
    const width = 1180;
    const height = 420;
    const margin = { top: 78, right: 118, bottom: 62, left: 56 };
    const gap = 24;
    const plotBottom = height - margin.bottom;
    const plotHeight = plotBottom - margin.top;
    const zoneWidth = (width - margin.left - margin.right - gap * 2) / 3;
    const yMinimum = .155;
    const yMaximum = .375;
    const y = value => margin.top + (yMaximum - value) / (yMaximum - yMinimum) * plotHeight;
    const ticks = [.18, .27, .36];
    const tones = ["#a8da5a", "#55b9e5"];
    const zoneTones = ["#a8da5a", "#e0bd68", "#66b7dc"];

    const zones = SPECTRAL_REGIONS.map((region, regionIndex) => {
      const xStart = margin.left + regionIndex * (zoneWidth + gap);
      const series = sites.map(site => site.spectrum.filter(point => region.includes(point.wavelength_nm)));
      const wavelengths = series.flat().map(point => point.wavelength_nm);
      const first = wavelengths.length ? Math.min(...wavelengths) : 0;
      const last = wavelengths.length ? Math.max(...wavelengths) : 1;
      const x = wavelength => first === last
        ? xStart + zoneWidth / 2
        : xStart + 18 + (wavelength - first) / (last - first) * (zoneWidth - 36);
      const grid = ticks.map(tick => `
        <line x1="${xStart}" y1="${y(tick)}" x2="${xStart + zoneWidth}" y2="${y(tick)}" class="spectral-grid-line"></line>`).join("");
      const difference = series.length === 2 && series[0].length && series[1].length
        ? series[0].map(point => `${x(point.wavelength_nm)},${y(point.normalized_median)}`)
          .concat(series[1].slice().reverse().map(point => `${x(point.wavelength_nm)},${y(point.normalized_median)}`))
        : [];
      const curves = series.map((points, siteIndex) => {
        const upper = points.map(point => `${x(point.wavelength_nm)},${y(point.normalized_q75)}`);
        const lower = points.slice().reverse().map(point => `${x(point.wavelength_nm)},${y(point.normalized_q25)}`);
        const median = points.map(point => `${x(point.wavelength_nm)},${y(point.normalized_median)}`).join(" ");
        const targets = points.map(point => `
          <circle cx="${x(point.wavelength_nm)}" cy="${y(point.normalized_median)}" r="3.4" fill="${tones[siteIndex]}" class="spectral-target"></circle>`).join("");
        return `
          <polygon points="${upper.concat(lower).join(" ")}" fill="${tones[siteIndex]}" class="spectral-range"></polygon>
          <polyline points="${median}" stroke="${tones[siteIndex]}" class="spectral-line"></polyline>
          ${targets}`;
      }).join("");
      return `
        <g class="spectral-zone-group">
          <rect x="${xStart}" y="${margin.top}" width="${zoneWidth}" height="${plotHeight}" rx="7" fill="${zoneTones[regionIndex]}" class="spectral-zone"></rect>
          <text x="${xStart + 4}" y="27" class="spectral-region-label">${region.label}</text>
          <text x="${xStart + 4}" y="48" class="spectral-region-subtitle">${region.subtitle}</text>
          ${grid}
          <polygon points="${difference.join(" ")}" class="spectral-difference"></polygon>
          ${curves}
          <text x="${xStart + zoneWidth / 2}" y="${height - 22}" text-anchor="middle" class="spectral-range-label">${first === last ? `${first} nm` : `${first}–${last} nm`}</text>
        </g>`;
    }).join("");

    const nearInfrared = sites
      .map(site => site.spectrum.filter(point => SPECTRAL_REGIONS[2].includes(point.wavelength_nm)).at(-1))
      .filter(point => point);
    const nearInfraredX = margin.left + 2 * (zoneWidth + gap) + zoneWidth - 18;
    const endY = nearInfrared.map(point => y(point.normalized_median));
    const directLabels = sites.length === 2 && endY.length === 2 ? (() => {
      const firstAbove = endY[0] <= endY[1];
      const labelY = firstAbove
        ? [endY[0] - 13, endY[1] + 21]
        : [endY[0] + 21, endY[1] - 13];
      return sites.map((site, siteIndex) => `
      <path d="M ${nearInfraredX + 2} ${endY[siteIndex]} L ${width - margin.right + 13} ${labelY[siteIndex] - 5}" stroke="${tones[siteIndex]}" class="spectral-leader"></path>
      <text x="${width - margin.right + 20}" y="${labelY[siteIndex]}" fill="${tones[siteIndex]}" class="spectral-direct-label">${C.escapeHtml(site.label)}</text>`).join("");
    })() : "";
    const breaks = [1, 2].map(index => {
      const center = margin.left + index * zoneWidth + (index - .5) * gap;
      return `<path d="M ${center - 7} ${plotBottom + 13} l 7 -10 M ${center + 2} ${plotBottom + 13} l 7 -10" class="spectral-axis-break"></path>`;
    }).join("");
    return `
      <svg class="spectral-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="spectral-chart-title spectral-chart-description">
        <title id="spectral-chart-title">Spectral fingerprints for ${sites.map(site => C.escapeHtml(site.label)).join(" and ")}</title>
        <desc id="spectral-chart-description">Released median normalized reflectance and interquartile ranges at observed wavelength targets for the declared reference areas.</desc>
        <text x="8" y="${margin.top + 5}" class="spectral-axis-cue">Higher</text>
        <text x="8" y="${plotBottom}" class="spectral-axis-cue">Lower</text>
        ${zones}
        ${breaks}
        ${directLabels}
      </svg>`;
  }

  function hyperspectralComparison(data) {
    const context = data.context || {};
    const siteLabels = data.sites.map(site => site.label);
    const contextLine = [
      context.location_label,
      context.sensor_label,
      context.capture_date ? C.formatDate(context.capture_date) : null,
      context.purpose_label || "Reference/evaluation material"
    ].filter(Boolean).map(C.escapeHtml).join(" · ");
    const vegetationPatches = data.sites.reduce((total, site) => total + site.vegetation_patches, 0);
    return `
      <div class="hyperspectral-content">
        <header class="hyperspectral-header">
          <div>
            <div class="panel-kicker">What hyperspectral sees</div>
            <h2>${siteLabels.map(C.escapeHtml).join(" and ")}. Two released spectra.</h2>
          </div>
          <p>${contextLine}</p>
        </header>
        <section class="spectral-card" aria-label="Spectral fingerprint comparison">
          <div class="spectral-card-header">
            <div>
              <strong>Released median and quartile values are shown at observed targets.</strong>
              <span>The comparison below reports only direct numeric relationships at shared wavelengths.</span>
            </div>
          </div>
          ${spectralChart(data.sites)}
          <p class="spectral-note">Dots are observed wavelength targets; lines connect adjacent targets. Reflectance is brightness-normalized, all zones share one vertical scale, and ribbons show the released q25–q75 ranges.</p>
        </section>
        <div class="spectral-insights">${SPECTRAL_REGIONS.map((region, index) => `
          <article style="--insight-tone:${index === 1 ? "var(--blue)" : "var(--lime)"}">
            <span>${region.label}</span>
            <strong>${C.escapeHtml(measuredRegionComparison(region, data.sites))}</strong>
          </article>`).join("")}</div>
        <section class="sample-context">
          <header>
            <div><span>Pixels included in the comparison</span><strong>${vegetationPatches} likely-vegetation patches across ${data.sites.length} mapped water areas</strong></div>
            <p>Gold marks likely aquatic vegetation; blue marks open-water context. These are analysis masks, not species maps.</p>
          </header>
          <div class="sample-grid">${data.sites.map(site => `
            <article class="sample-card">
              ${site.aquatic_cover?.file ? `<img src="${C.escapeHtml(site.aquatic_cover.file)}" alt="${C.escapeHtml(site.label)} analysis mask with likely vegetation and open-water context">` : ""}
              <div>
                <span>${C.escapeHtml(site.label)}</span>
                <strong>${site.vegetation_patches} likely-vegetation patches</strong>
                <small>${site.open_water_patches} open-water patches used as context</small>
              </div>
            </article>`).join("")}</div>
        </section>
      </div>`;
  }

  function hyperspectral(ctx) {
    const data = ctx.data.hyperspectral;
    const invalidSiteCount = data?.state !== "not_available"
      && (!Array.isArray(data?.sites) || data.sites.length !== 2);
    if (data?.state === "not_available" || data?.evidence_gate?.passes !== true || invalidSiteCount) {
      const message = invalidSiteCount
        ? "Hyperspectral comparison requires exactly two release-owned comparison sites."
        : data?.message || data?.evidence_gate?.label || "The comparison does not have an explicit passing evidence gate.";
      ctx.heading("Hyperspectral potential", "Reference/evaluation evidence not included in this release");
      ctx.legend([]);
      ctx.hyperspectralStage.replaceChildren();
      ctx.panel.innerHTML = `
        <div class="panel-kicker">07 · Hyperspectral potential</div>
        <h1>Reference/evaluation evidence is unavailable.</h1>
        ${C.dataWarning(message)}
        <div class="boundary"><span>?</span><span>The legacy evidence screen remains a supported release capability, but its source capture must be separately approved and published to this tenant before it can be displayed.</span></div>`;
      baseCoves(ctx.map);
      ctx.map.fit(ctx.data.monitor.bounds);
      return;
    }
    const vegetation = data.vegetation_separation;
    const control = data.open_water_control;
    const controlCopy = Number.isFinite(control.excess_separation_degrees) ? `The release reports ${control.excess_separation_degrees.toFixed(2)}° excess separation for open-water spectra.` : "Open-water comparison lacks sufficient patch support; no separation value is reported.";
    const siteLabels = data.sites.map(site => site.label);
    const context = data.context || {};
    const location = context.location_label || "the declared reference capture";
    const purpose = context.purpose_label || "Reference/evaluation material";
    ctx.heading("Hyperspectral potential", `${siteLabels.join(" and ")} · ${purpose}`);
    ctx.legend([]);
    ctx.hyperspectralStage.innerHTML = hyperspectralComparison(data);
    ctx.panel.innerHTML = `
      <div class="panel-kicker">06 · Hyperspectral potential</div>
      <h1>Evaluate ${siteLabels.map(C.escapeHtml).join(" and ")} as reference material.</h1>
      <p class="lede">This reference release provides brightness-normalized median and quartile spectra for ${siteLabels.map(C.escapeHtml).join(" and ")} in ${C.escapeHtml(location)}. Field labels are needed before assigning a species or cause.</p>
      <div class="takeaway-card">
        <span>Released separation values</span>
        <strong>Between-area angle ${vegetation.median_between_site_degrees.toFixed(2)}°; balanced within-area angle ${vegetation.balanced_within_site_degrees.toFixed(2)}°.</strong>
        <p>The reported excess is ${vegetation.excess_separation_degrees.toFixed(2)}°. This numeric comparison does not identify a species or cause.</p>
      </div>
      <div class="takeaway-card impact">
        <span>Open-water control</span>
        <strong>${C.escapeHtml(controlCopy)}</strong>
        <p>Site and water conditions therefore remain possible contributors; field-labelled evaluation is still required.</p>
      </div>
      ${imageWarnings(data.sites.map(site => site.aquatic_cover), "Hyperspectral reference")}
      <div class="boundary"><span>◈</span><span><strong>Reference/evaluation only:</strong> ${C.escapeHtml(location)} is not Caddo operational output.</span></div>
      <div class="boundary"><span>◈</span><span><strong>What this does not show:</strong> The vegetation was not field-labelled, so these data do not identify either species or prove what caused the difference. Water and local conditions also differ between the areas.</span></div>
      <div class="panel-kicker" style="margin-top:20px">What labels unlock</div>
      <ul class="request-list">
        <li>Collect same-date field polygons at USACE sites</li>
        <li>Label Salvinia, other vegetation, and open water</li>
        <li>Test the separation on new dates and locations</li>
      </ul>
      ${C.evidence({
        title: "How we checked the difference",
        lines: [
          `${data.sites[0].vegetation_patches + data.sites[1].vegetation_patches} released likely-vegetation patch summaries characterize variation within the two areas; they are not independent ecological sites.`,
          "Brightness-normalized spectral shape was compared between and within the two mapped water areas.",
          `Median between-area spectral angle was ${vegetation.median_between_site_degrees.toFixed(2)}°, versus ${vegetation.balanced_within_site_degrees.toFixed(2)}° balanced within-area variation (+${vegetation.excess_separation_degrees.toFixed(2)}°).`,
          controlCopy,
          ...data.limitations.map(row => row.text)
        ]
      })}`;
  }

  window.AppViews = { monitor, detect, operations, response, verification, deploy, hyperspectral };
}());
