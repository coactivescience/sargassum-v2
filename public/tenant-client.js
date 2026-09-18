export class TenantError extends Error {
  constructor(code, { status, requestId, message } = {}) {
    super(message || code);
    this.name = "TenantError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function validTenant(tenant) {
  return tenant
    && typeof tenant.id === "string" && tenant.id.trim()
    && typeof tenant.slug === "string" && tenant.slug.trim()
    && typeof tenant.display_name === "string" && tenant.display_name.trim();
}

function endpointFor(apiBaseUrl, path) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) {
    throw new TenantError("invalid_configuration");
  }
  try {
    return new URL(path, apiBaseUrl).toString();
  } catch {
    throw new TenantError("invalid_configuration");
  }
}

async function responseError(response) {
  let body;
  try { body = await response.json(); } catch { /* API response had no JSON body. */ }
  return new TenantError(body?.error || "tenant_request_failed", {
    status: response.status,
    requestId: response.headers.get("x-request-id") || body?.request_id || undefined,
  });
}

export async function loadAccessibleTenants(apiBaseUrl, fetcher = fetch) {
  const response = await fetcher(endpointFor(apiBaseUrl, "/api/tenants/accessible"), {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw await responseError(response);

  let body;
  try { body = await response.json(); } catch {
    throw new TenantError("invalid_tenant_response", { message: "Tenant discovery response is not valid JSON" });
  }
  if (!Array.isArray(body?.data?.tenants) || !body.data.tenants.every(validTenant)) {
    throw new TenantError("invalid_tenant_response", { message: "Tenant discovery response is incomplete" });
  }
  return body.data.tenants;
}

export async function loadBrowserSession(apiBaseUrl, fetcher = fetch) {
  const response = await fetcher(endpointFor(apiBaseUrl, "/api/auth/get-session"), {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw await responseError(response);

  let body;
  try { body = await response.json(); } catch {
    throw new TenantError("invalid_session_response", { message: "Session response is not valid JSON" });
  }
  return body && typeof body === "object" ? body : null;
}

function storedTenantId(storage) {
  try {
    return storage?.getItem("tenant") || null;
  } catch {
    return null;
  }
}

export function selectTenant(tenants, { search = "", storage } = {}) {
  if (!Array.isArray(tenants) || tenants.length === 0) return null;

  const findAccessible = (id) => tenants.find((tenant) => tenant?.id === id) || null;
  const urlTenant = findAccessible(new URLSearchParams(search).get("tenant"));
  if (urlTenant) return { tenant: urlTenant, source: "url" };

  const storageTenant = findAccessible(storedTenantId(storage));
  if (storageTenant) return { tenant: storageTenant, source: "storage" };

  return { tenant: tenants[0], source: "default" };
}

export function writeTenantSelection(tenantId, { history, location, storage, replace = false } = {}) {
  if (typeof tenantId !== "string" || !tenantId.trim()) return;

  const params = new URLSearchParams(location?.search || "");
  params.set("tenant", tenantId);
  const path = `${location?.pathname || ""}?${params.toString()}${location?.hash || ""}`;
  const method = replace ? "replaceState" : "pushState";
  history?.[method]?.(null, "", path);
  try {
    storage?.setItem("tenant", tenantId);
  } catch {
    // Storage is optional convenience state, never authorization.
  }
}
