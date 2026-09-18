import { validateFullLegacyRelease } from "./release-schema.js";

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
  return new ReleaseError(body?.error || "release_request_failed", {
    status: response.status,
    requestId: response.headers.get("x-request-id") || body?.request_id || undefined,
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
