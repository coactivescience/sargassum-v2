import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../public/app.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../public/bootstrap.js", import.meta.url), "utf8");

test("keeps the MFA form out of the landing sign-in panel until it is needed", () => {
  assert.match(css, /\.landing-auth-form\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
});

test("switches to a compact access layout instead of leaving sign-in below the marketing hero", () => {
  assert.match(html, /<h1 id="landing-title">Lake Intelligence<\/h1>/);
  assert.match(bootstrap, /landing-auth-active/);
  assert.match(css, /\.public-landing\.landing-auth-active \.landing-hero/);
});

test("keeps initial app-shell provenance neutral until the active release loads", () => {
  assert.doesNotMatch(html, /Sentinel-2|2017–2026/);
  assert.match(html, /<div class="record-badge"><span><\/span> Release record<\/div>/);
  assert.match(html, /<div class="map-source">Approved release imagery<\/div>/);
});

test("declares the map-first operations console shell", () => {
  for (const marker of [
    "site-list",
    "workspace-console",
    "workspace-briefing",
    "console-layer-control",
    "console-inspector",
    "console-timeline",
    "console-metrics",
    "console-granules",
    "console-observations",
    "console-source",
  ]) {
    assert.match(html, new RegExp(`id="${marker}"`));
  }
  assert.match(html, /<strong>Sargassum — US ACE<\/strong>/);
  assert.match(html, /Coactive Geospatial Intelligence/);
  assert.match(html, /<script src="console\.js"><\/script>/);
});
