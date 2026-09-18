export class AuthError extends Error {
  constructor(code, { status, message } = {}) {
    super(message || code);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

function endpointFor(apiBaseUrl, path) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) throw new AuthError("invalid_configuration");
  try {
    return new URL(path, apiBaseUrl).toString();
  } catch {
    throw new AuthError("invalid_configuration");
  }
}

function required(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new AuthError(`missing_${field}`);
  return value.trim();
}

async function request(apiBaseUrl, path, body, fetcher) {
  const response = await fetcher(endpointFor(apiBaseUrl, path), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await response.json(); } catch { /* The server did not return JSON. */ }
  if (!response.ok) {
    throw new AuthError(data?.code || data?.error?.code || data?.error || "authentication_failed", {
      status: response.status,
      message: data?.message || data?.error?.message,
    });
  }
  return data || {};
}

export async function signInWithPassword(apiBaseUrl, credentials, fetcher = fetch) {
  const email = required(credentials?.email, "email");
  const password = required(credentials?.password, "password");
  const data = await request(apiBaseUrl, "/api/auth/sign-in/email", { email, password }, fetcher);
  return { requiresTwoFactor: data.twoFactorRedirect === true };
}

export async function verifyTotp(apiBaseUrl, code, fetcher = fetch) {
  return request(apiBaseUrl, "/api/auth/two-factor/verify-totp", { code: required(code, "code") }, fetcher);
}

export async function signOut(apiBaseUrl, fetcher = fetch) {
  await request(apiBaseUrl, "/api/auth/sign-out", {}, fetcher);
}
