import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSargassumDay, validateSargassumRelease } from "../public/sargassum-schema.js";

const manifest = JSON.parse(readFileSync(new URL("fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("fixtures/sargassum-days.json", import.meta.url)));
const payload = () => structuredClone(manifest.payload);

test("accepts the payload the Sargassum release publisher produces", () => {
  assert.deepEqual(validateSargassumRelease(payload()), { ok: true, errors: [] });
  assert.deepEqual(validateSargassumRelease(payload(), { siteId: manifest.payload.site.id }), { ok: true, errors: [] });
});

test("treats the site as data: any UUID-identified site with a label is valid", () => {
  const value = payload();
  value.site = { id: "00000000-0000-4000-8000-000000000999", label: "Any coastline" };
  value.meta.site_id = value.site.id;
  assert.deepEqual(validateSargassumRelease(value), { ok: true, errors: [] });
});

test("rejects a payload for a site other than the one requested", () => {
  const result = validateSargassumRelease(payload(), { siteId: "00000000-0000-4000-8000-000000000303" });
  assert.ok(result.errors.some((error) => /belongs to another site/.test(error)), result.errors.join("; "));
});

for (const [label, mutate, message] of [
  ["a Caddo legacy schema", (value) => { value.schema = "giant-salvinia-legacy-v2"; }, /schema must be sargassum-vertical-v1/],
  ["another application", (value) => { value.meta.application_key = "salvinia"; }, /meta.application_key must be sargassum/],
  ["a site key instead of a site UUID", (value) => { value.meta.site_id = "puerto-rico"; }, /meta.site_id must be a site UUID/],
  ["a site that disagrees with meta", (value) => { value.site.id = "00000000-0000-4000-8000-000000000303"; }, /site must match meta.site_id/],
  ["a site without a label", (value) => { value.site.label = " "; }, /site must match meta.site_id and carry a label/],
  ["an unsupported severity", (value) => { value.timeline[0].severity = "extreme"; }, /severity must be low, medium, or high/],
  ["a coverage outside 0–100", (value) => { value.timeline[1].coverage_pct = 140; }, /coverage_pct must be a percentage/],
  ["a non-boolean alert flag", (value) => { value.timeline[0].alert_active = "yes"; }, /alert_active must be a boolean/],
  ["descending dates", (value) => { value.timeline.reverse(); }, /unique and ascending/],
  ["a summary that disagrees with the timeline", (value) => { value.summary.alert_days = 3; }, /summary.alert_days must match/],
  ["a non-WGS84 AOI", (value) => { value.aoi.features[0].geometry.coordinates[0][0] = [500000, 2000000]; }, /aoi must be a polygon FeatureCollection/],
  ["a missing asset reference", (value) => { delete value.timeline[2].file; }, /file must reference a release asset/],
  ["an empty timeline", (value) => { value.timeline = []; }, /at least one day/],
]) {
  test(`rejects ${label}`, () => {
    const value = payload();
    mutate(value);
    const result = validateSargassumRelease(value);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => message.test(error)), result.errors.join("; "));
  });
}

test("rejects a non-object payload without throwing", () => {
  assert.equal(validateSargassumRelease(null).ok, false);
  assert.equal(validateSargassumRelease([]).ok, false);
});

test("validates a day asset against its timeline row", () => {
  const row = manifest.payload.timeline[0];
  assert.deepEqual(validateSargassumDay(days[row.date], row), { ok: true, errors: [] });

  const wrongDate = structuredClone(days[row.date]);
  wrongDate.date = "2025-05-10";
  assert.match(validateSargassumDay(wrongDate, row).errors.join(), /date must match/);

  const badPoint = structuredClone(days[row.date]);
  badPoint.hotspots[0].lat = "17.9";
  assert.match(validateSargassumDay(badPoint, row).errors.join(), /WGS84 points/);

  const missingSpot = structuredClone(days[row.date]);
  missingSpot.hotspots.pop();
  assert.match(validateSargassumDay(missingSpot, row).errors.join(), /hotspot count must match/);

  assert.equal(validateSargassumDay("not a record", row).ok, false);
});
