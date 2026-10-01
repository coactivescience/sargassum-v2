import { validateFullLegacyRelease } from "./release-schema.js";
import { isSiteId, SARGASSUM_APPLICATION_KEY, validateSargassumDay, validateSargassumRelease } from "./sargassum-schema.js";

export class ReleaseError extends Error {
  constructor(code, { status, requestId, message } = {}) {
    super(message || code);
    this.name = "ReleaseError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function endpointFor(apiBaseUrl, tenantId) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()
    || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new ReleaseError("invalid_configuration");
  }
  try {
    const api = new URL(apiBaseUrl.trim());
    const encodedTenantId = encodeURIComponent(tenantId.trim());
    return new URL(`/api/tenants/${encodedTenantId}/salvinia/releases/current/manifest`, api).toString();
  } catch {
    throw new ReleaseError("invalid_configuration");
  }
}

function assetUrl(apiBaseUrl, value, expectedPathPrefix) {
  const resolved = new URL(value, apiBaseUrl);
  if (resolved.origin !== new URL(apiBaseUrl).origin) {
    throw new ReleaseError("invalid_release", { message: "Release asset URL must use the configured API origin" });
  }
  if (!resolved.pathname.startsWith(expectedPathPrefix) || resolved.pathname.length === expectedPathPrefix.length) {
    throw new ReleaseError("invalid_release", { message: "Release asset URL must belong to the selected tenant and release" });
  }
  return resolved.toString();
}

function resolveAssetReferences(value, assets, apiBaseUrl, expectedPathPrefix) {
  if (Array.isArray(value)) return value.map((item) => resolveAssetReferences(item, assets, apiBaseUrl, expectedPathPrefix));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "file" && typeof item === "string") {
      const registeredUrl = assets[item];
      if (typeof registeredUrl !== "string") {
        throw new ReleaseError("invalid_release", { message: `Release references an unregistered asset: ${item}` });
      }
      output[key] = assetUrl(apiBaseUrl, registeredUrl, expectedPathPrefix);
    } else {
      output[key] = resolveAssetReferences(item, assets, apiBaseUrl, expectedPathPrefix);
    }
  }
  return output;
}

export function classifyRelease(release) {
  const validation = validateFullLegacyRelease(release);
  return { kind: validation.ok ? "full" : "limited", release, validation };
}

async function responseError(response) {
  let body;
  try { body = await response.json(); } catch { /* API response had no JSON body. */ }
  // The data service answers { error: { code, request_id } }; older routes used a bare string.
  const code = typeof body?.error === "string" ? body.error : body?.error?.code;
  return new ReleaseError(typeof code === "string" && code ? code : "release_request_failed", {
    status: response.status,
    requestId: response.headers.get("x-request-id") || body?.error?.request_id || body?.request_id || undefined,
  });
}

export async function loadCurrentRelease(apiBaseUrl, tenantId, fetcher = fetch) {
  const response = await fetcher(endpointFor(apiBaseUrl, tenantId), {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw await responseError(response);

  let manifest;
  try { manifest = await response.json(); } catch {
    throw new ReleaseError("invalid_release", { message: "Release manifest is not valid JSON" });
  }
  if (!manifest?.payload || !manifest?.assets || typeof manifest.assets !== "object"
    || typeof manifest?.release?.id !== "string" || !manifest.release.id.trim()) {
    throw new ReleaseError("invalid_release", { message: "Release manifest is incomplete" });
  }
  const expectedPathPrefix = `/api/tenants/${encodeURIComponent(tenantId.trim())}/salvinia/releases/${encodeURIComponent(manifest.release.id.trim())}/assets/`;
  return { ...classifyRelease(resolveAssetReferences(manifest.payload, manifest.assets, apiBaseUrl, expectedPathPrefix)), releaseId: manifest.release.id.trim() };
}

function sargassumUrl(apiBaseUrl, tenantId, path) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()
    || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new ReleaseError("invalid_configuration");
  }
  try {
    return new URL(`/api/tenants/${encodeURIComponent(tenantId.trim())}/sargassum${path}`, new URL(apiBaseUrl.trim())).toString();
  } catch {
    throw new ReleaseError("invalid_configuration");
  }
}

async function getJson(url, fetcher) {
  const response = await fetcher(url, { credentials: "include", headers: { accept: "application/json" } });
  if (!response.ok) throw await responseError(response);
  try { return await response.json(); } catch {
    throw new ReleaseError("invalid_release", { message: "Sargassum response is not valid JSON" });
  }
}

/** List the tenant's sites that are enabled for Sargassum (labels and IDs come from the data service). */
export async function loadSargassumSites(apiBaseUrl, tenantId, fetcher = fetch) {
  const body = await getJson(sargassumUrl(apiBaseUrl, tenantId, "/sites"), fetcher);
  if (!Array.isArray(body?.sites) || body.sites.some((site) => !isSiteId(site?.id) || typeof site?.label !== "string" || !site.label.trim())) {
    throw new ReleaseError("invalid_release", { message: "Sargassum site list is invalid" });
  }
  return body.sites;
}

/**
 * Choose the site to show: `?site=<uuid>` when it is listed, otherwise the
 * first site with a current release, otherwise the first site.
 */
export function selectSargassumSite(sites, search = "") {
  if (!Array.isArray(sites) || sites.length === 0) return null;
  const requested = new URLSearchParams(search).get("site");
  const fromUrl = sites.find((site) => site.id === requested);
  if (fromUrl) return { site: fromUrl, source: "url" };
  const withRelease = sites.find((site) => site.current_release);
  return { site: withRelease ?? sites[0], source: "default" };
}

/**
 * Load the active release of the selected Sargassum site. The third argument is
 * a fetcher or { fetcher, search }.
 */
export async function loadSargassumRelease(apiBaseUrl, tenantId, options = {}) {
  const { fetcher = fetch, search = "" } = typeof options === "function" ? { fetcher: options } : options;
  const sites = await loadSargassumSites(apiBaseUrl, tenantId, fetcher);
  const selected = selectSargassumSite(sites, search);
  if (!selected) throw new ReleaseError("no_sargassum_sites", { status: 404, message: "No Sargassum sites are enabled for this workspace" });
  const site = selected.site;

  let manifest;
  try {
    manifest = await getJson(sargassumUrl(apiBaseUrl, tenantId, `/sites/${encodeURIComponent(site.id)}/releases/current/manifest`), fetcher);
  } catch (error) {
    if (error instanceof ReleaseError) Object.assign(error, { site, sites });
    throw error;
  }
  const releaseId = typeof manifest?.release?.id === "string" ? manifest.release.id.trim() : "";
  if (!manifest?.payload || !manifest?.assets || typeof manifest.assets !== "object" || !releaseId) {
    throw new ReleaseError("invalid_release", { message: "Release manifest is incomplete" });
  }
  if (manifest.release.site_id !== site.id || manifest.release.application_key !== SARGASSUM_APPLICATION_KEY) {
    throw new ReleaseError("invalid_release", { message: "Release manifest belongs to another site or application" });
  }
  const expectedPathPrefix = `/api/tenants/${encodeURIComponent(tenantId.trim())}/sargassum/sites/${encodeURIComponent(site.id)}/releases/${encodeURIComponent(releaseId)}/assets/`;
  const payload = resolveAssetReferences(manifest.payload, manifest.assets, apiBaseUrl, expectedPathPrefix);
  const validation = validateSargassumRelease(payload, { siteId: site.id });
  if (!validation.ok) {
    const error = new ReleaseError("invalid_release", { message: validation.errors[0] });
    error.validation = validation;
    throw error;
  }
  return {
    kind: "sargassum",
    release: payload,
    releaseId,
    sourceRevision: typeof manifest.release.source_revision === "string" ? manifest.release.source_revision : payload.meta.source_revision,
    validation,
    site,
    sites,
  };
}

/** Fetch one day asset (already resolved and prefix-checked) and validate it against its timeline row. */
export async function loadSargassumDay(row, fetcher = fetch) {
  const response = await fetcher(row.file, { credentials: "include", headers: { accept: "application/json" } });
  if (!response.ok) throw await responseError(response);
  let record;
  try { record = await response.json(); } catch {
    throw new ReleaseError("invalid_release", { message: `Day ${row.date} is not valid JSON` });
  }
  const validation = validateSargassumDay(record, row);
  if (!validation.ok) throw new ReleaseError("invalid_release", { message: validation.errors[0] });
  return record;
}
