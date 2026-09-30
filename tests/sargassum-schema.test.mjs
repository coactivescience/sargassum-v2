import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSargassumDay, validateSargassumRelease } from "../public/sargassum-schema.js";

const manifest = JSON.parse(readFileSync(new URL("fixtures/sargassum-manifest.json", import.meta.url)));
const days = JSON.parse(readFileSync(new URL("fixtures/sargassum-days.json", import.meta.url)));
const payload = () => structuredClone(manifest.payload);

test("accepts the payload the Puerto Rico release publisher produces", () => {
  assert.deepEqual(validateSargassumRelease(payload()), { ok: true, errors: [] });
});

for (const [label, mutate, message] of [
  ["a Caddo legacy schema", (value) => { value.schema = "giant-salvinia-legacy-v2"; }, /schema must be sargassum-vertical-v1/],
  ["another site", (value) => { value.meta.site_key = "caddo"; }, /meta.site_key must be puerto-rico/],
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
