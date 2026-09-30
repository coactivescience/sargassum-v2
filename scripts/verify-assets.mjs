import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "public/index.html",
  "public/app.css",
  "public/core.js",
  "public/console.js",
  "public/views.js",
  "public/app.js",
  "public/intelligence-data.js",
  "public/intelligence.js",
  "public/auth-client.js",
  "public/tenant-client.js",
  "public/release-client.js",
  "public/sargassum-schema.js",
  "public/sargassum-app.js",
  "public/landing-client.js",
  "public/bootstrap.js",
  "public/vendor/leaflet.js",
  "public/vendor/leaflet.css",
];

const workerGenerated = new Set(["runtime-config.js"]);

const html = await readFile("public/index.html", "utf8");
const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((src) => !workerGenerated.has(src));

await Promise.all([
  ...required.map((file) => access(file)),
  ...scripts.map((src) => access(join("public", src))),
]);
