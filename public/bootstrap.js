import { loadSargassumRelease } from "./release-client.js";
import { startSargassumWorkspace } from "./sargassum-app.js";
import {
  loadAccessibleTenants,
  loadBrowserSession,
  selectTenant as selectAccessibleTenant,
  writeTenantSelection,
} from "./tenant-client.js";
import { signInWithPassword, signOut, verifyTotp } from "./auth-client.js";
import { signInAction } from "./landing-client.js";

function stateFor(error) {
  if (error?.status === 401) return "authentication_required";
  if (error?.status === 403) return "authorization_denied";
  if (error?.status === 404) return "release_not_found";
  if (error?.code === "invalid_release") return "release_invalid";
  return "release_unavailable";
}

function selectionOptions({ getSearch, storage }) {
  return { search: getSearch(), storage };
}

function stale(isCurrent) {
  return !isCurrent();
}

function noTenantAccess(showError, renderTenantOptions) {
  renderTenantOptions([], null);
  showError({ code: "no_tenant_access", requestId: undefined });
  return { status: "error", code: "no_tenant_access" };
}

function identityFor(session) {
  const name = session?.user?.name;
  const role = session?.user?.role;
  if (typeof name !== "string" || !name.trim() || typeof role !== "string" || !role.trim()) return null;
  return { name: name.trim(), role: role.trim() };
}

export async function start(config, dependencies = {}) {
  const {
    loadTenants = loadAccessibleTenants,
    loadSession = loadBrowserSession,
    loadRelease = loadSargassumRelease,
    selectTenant = selectAccessibleTenant,
    persistSelection = () => {},
    renderTenantOptions = () => {},
    renderUserIdentity = null,
    showEmptyRelease = () => {},
    startApp = () => {},
    showError = () => {},
    getSearch = () => (typeof location === "undefined" ? "" : location.search),
    storage = typeof sessionStorage === "undefined" ? undefined : sessionStorage,
    isCurrent = () => true,
  } = dependencies;
  const apiBaseUrl = config?.apiBaseUrl;

  const fail = (error) => {
    const code = stateFor(error);
    showError({ code, requestId: error?.requestId });
    return { status: "error", code };
  };

  let tenants;
  try {
    tenants = await loadTenants(apiBaseUrl);
  } catch (error) {
    return fail(error);
  }
  if (stale(isCurrent)) return { status: "stale" };
  if (!Array.isArray(tenants) || tenants.length === 0) {
    let session;
    try {
      session = await loadSession(apiBaseUrl);
    } catch (error) {
      return fail(error);
    }
    if (stale(isCurrent)) return { status: "stale" };
    if (!session) return fail({ status: 401 });
    return noTenantAccess(showError, renderTenantOptions);
  }

  const identity = typeof renderUserIdentity === "function"
    ? loadSession(apiBaseUrl).then(identityFor).catch(() => null)
    : null;

  const select = (available) => selectTenant(available, selectionOptions({ getSearch, storage }));
  let selected = select(tenants);
  if (!selected?.tenant) return noTenantAccess(showError, renderTenantOptions);

  const loadSelectedRelease = async (candidate, available, refreshed = false) => {
    const { tenant, source } = candidate;
    renderTenantOptions(available, tenant.id);
    if (source !== "url") persistSelection(tenant.id, { replace: true });

    try {
      const classification = await loadRelease(apiBaseUrl, tenant.id, { search: getSearch() });
      if (stale(isCurrent)) return { status: "stale" };
      startApp(classification.release, tenant, {
        kind: classification.kind,
        ...(classification.releaseId ? { releaseId: classification.releaseId } : {}),
        ...(classification.sourceRevision ? { sourceRevision: classification.sourceRevision } : {}),
        ...(classification.site ? { site: classification.site, sites: classification.sites } : {}),
        validation: classification.validation,
      });
      const userIdentity = await identity;
      if (stale(isCurrent)) return { status: "stale" };
      if (userIdentity) renderUserIdentity(userIdentity);
      return { status: "ready", tenantId: tenant.id };
    } catch (error) {
      if (stale(isCurrent)) return { status: "stale" };
      if (error?.status === 404) {
        showEmptyRelease(tenant, { code: error?.code === "no_sargassum_sites" ? "no_sargassum_sites" : "release_not_found", site: error?.site });
        const userIdentity = await identity;
        if (stale(isCurrent)) return { status: "stale" };
        if (userIdentity) renderUserIdentity(userIdentity);
        return { status: "empty", tenantId: tenant.id };
      }
      if (error?.status !== 403 || refreshed) return fail(error);

      let refreshedTenants;
      try {
        refreshedTenants = await loadTenants(apiBaseUrl);
      } catch (refreshError) {
        return fail(refreshError);
      }
      if (stale(isCurrent)) return { status: "stale" };

      const alternatives = Array.isArray(refreshedTenants)
        ? refreshedTenants.filter((item) => item.id !== tenant.id)
        : [];
      if (alternatives.length === 0) return noTenantAccess(showError, renderTenantOptions);

      selected = select(alternatives);
      if (!selected?.tenant) return noTenantAccess(showError, renderTenantOptions);
      return loadSelectedRelease(selected, refreshedTenants, true);
    }
  };

  return loadSelectedRelease(selected, tenants);
}

function messageFor(code) {
  return {
    authentication_required: "Sign in to view the Sargassum release.",
    authorization_denied: "Your account does not have access to the Sargassum release.",
    no_tenant_access: "No Sargassum workspace is available for this session.",
    release_not_found: "There is no published Sargassum release for this tenant yet.",
    release_invalid: "The published Sargassum release is invalid and cannot be displayed. Please contact your administrator.",
    release_unavailable: "The Sargassum release could not be loaded. Please try again.",
  }[code];
}

export function showBrowserError({ code, requestId }, documentRef = document, windowRef = window) {
  windowRef.demoApp?.dispose?.();
  const landing = documentRef.querySelector("#public-landing");
  const element = documentRef.querySelector("#landing-release-status");
  const signIn = documentRef.querySelector("#landing-sign-in");
  const auth = documentRef.querySelector("#landing-auth");
  const appShell = documentRef.querySelector(".app-shell");
  if (landing) landing.hidden = false;
  if (landing) landing.classList.remove("landing-auth-active");
  if (appShell) appShell.hidden = true;
  if (auth) auth.hidden = true;
  if (signIn) {
    const action = signInAction(code);
    signIn.hidden = !action;
    if (action) {
      const arrow = documentRef.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      signIn.replaceChildren(action.label, arrow);
    }
  }
  element.hidden = false;
  element.textContent = `${messageFor(code)}${requestId ? ` Reference: ${requestId}.` : ""}`;
}

export function showBrowserEmptyRelease(_tenant, documentRef = document, windowRef = window, reason = {}) {
  windowRef.demoApp?.dispose?.();
  const landing = documentRef.querySelector("#public-landing");
  const element = documentRef.querySelector("#landing-release-status");
  const signIn = documentRef.querySelector("#landing-sign-in");
  const auth = documentRef.querySelector("#landing-auth");
  const appShell = documentRef.querySelector(".app-shell");
  if (landing) landing.hidden = false;
  if (landing) landing.classList.remove("landing-auth-active");
  if (appShell) appShell.hidden = true;
  if (auth) auth.hidden = true;
  if (signIn) signIn.hidden = true;
  if (element) {
    element.hidden = false;
    element.textContent = reason.code === "no_sargassum_sites"
      ? "No Sargassum sites are enabled for this workspace yet. Ask your administrator to enable a site."
      : `Your workspace access is active. The first Sargassum release${reason.site?.label ? ` for ${reason.site.label}` : ""} is still being prepared.`;
  }
}

function authenticationMessage(error) {
  if (error?.code === "missing_email") return "Enter your email address to continue.";
  if (error?.code === "missing_password") return "Enter your password to continue.";
  if (error?.code === "missing_code") return "Enter the authenticator code to continue.";
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD") return "That email or password is not recognized.";
  return "We could not sign you in. Please check your details and try again.";
}

function setupBrowserAuthentication(config, reload) {
  const trigger = document.querySelector("#landing-sign-in");
  const panel = document.querySelector("#landing-auth");
  const landing = document.querySelector("#public-landing");
  const signInForm = document.querySelector("#landing-sign-in-form");
  const twoFactorForm = document.querySelector("#landing-two-factor-form");
  const error = document.querySelector("#landing-auth-error");
  const status = document.querySelector("#landing-release-status");
  if (!trigger || !panel || !signInForm || !twoFactorForm || !error || !status) return;

  const showError = (cause) => {
    error.textContent = authenticationMessage(cause);
    error.hidden = false;
  };
  const clearError = () => {
    error.textContent = "";
    error.hidden = true;
  };
  const setBusy = (form, busy) => {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = busy;
  };
  const showSignIn = () => {
    landing?.classList.add("landing-auth-active");
    panel.hidden = false;
    trigger.hidden = true;
    twoFactorForm.hidden = true;
    signInForm.hidden = false;
    clearError();
    signInForm.elements.email.focus();
  };

  trigger.addEventListener("click", showSignIn);
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    setBusy(signInForm, true);
    try {
      const result = await signInWithPassword(config?.apiBaseUrl, Object.fromEntries(new FormData(signInForm)));
      if (result.requiresTwoFactor) {
        signInForm.hidden = true;
        twoFactorForm.hidden = false;
        status.textContent = "Enter your authenticator code to continue.";
        twoFactorForm.elements.code.focus();
      } else {
        await reload();
      }
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(signInForm, false);
    }
  });
  twoFactorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    setBusy(twoFactorForm, true);
    try {
      await verifyTotp(config?.apiBaseUrl, String(new FormData(twoFactorForm).get("code") || ""));
      await reload();
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(twoFactorForm, false);
    }
  });
}

export function browserTenantSwitcher(documentRef = document) {
  const label = documentRef.querySelector("#tenant-switcher-label");
  const control = documentRef.querySelector("#tenant-switcher");
  const list = documentRef.querySelector("#site-list");
  const count = documentRef.querySelector("#site-count");

  const render = (tenants, selectedId, onSelect = () => {}) => {
    control.replaceChildren(...tenants.map((tenant) => {
      const option = documentRef.createElement("option");
      option.value = tenant.id;
      option.textContent = tenant.display_name;
      option.selected = tenant.id === selectedId;
      return option;
    }));
    list?.replaceChildren(...tenants.map((tenant) => {
      const button = documentRef.createElement("button");
      const name = documentRef.createElement("strong");
      const detail = documentRef.createElement("small");
      button.type = "button";
      button.className = `site-button${tenant.id === selectedId ? " active" : ""}`;
      button.dataset.tenant = tenant.id;
      if (tenant.id === selectedId) button.setAttribute("aria-current", "page");
      name.textContent = tenant.display_name;
      detail.textContent = "Sargassum monitoring";
      button.append(name, detail);
      button.addEventListener("click", () => onSelect(tenant.id));
      return button;
    }));
    if (count) count.textContent = `${tenants.length} authorized location${tenants.length === 1 ? "" : "s"}`;
    label.hidden = false;
    control.hidden = false;
    control.disabled = true;
  };

  return { control, render };
}

export function browserUserIdentity(documentRef = document) {
  const identities = [
    {
      badge: documentRef.querySelector("#user-identity"),
      name: documentRef.querySelector("#user-name"),
      role: documentRef.querySelector("#user-role"),
    },
    {
      badge: documentRef.querySelector("#landing-user-identity"),
      name: documentRef.querySelector("#landing-user-name"),
      role: documentRef.querySelector("#landing-user-role"),
    },
  ];

  return (identity) => {
    identities.forEach(({ badge, name, role }) => {
      if (!badge || !name || !role) return;
      name.textContent = identity.name;
      role.textContent = identity.role;
      badge.hidden = false;
    });
  };
}

export function setupBrowserLogout(config, reload, dependencies = {}) {
  const {
    documentRef = document,
    windowRef = window,
    storage = windowRef.sessionStorage,
    signOutAction = signOut,
  } = dependencies;
  const button = documentRef.querySelector("#logout");
  if (!button) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await signOutAction(config?.apiBaseUrl);
      storage?.removeItem("tenant");
      windowRef.demoApp?.dispose?.();
      await reload();
    } finally {
      button.disabled = false;
    }
  });
}

function startBrowserApp(config) {
  const { control, render } = browserTenantSwitcher();
  const renderUserIdentity = browserUserIdentity();
  let requestVersion = 0;

  const persist = (tenantId, { replace }) => writeTenantSelection(tenantId, {
    history: window.history,
    location: window.location,
    storage: window.sessionStorage,
    replace,
  });
  const reload = async () => {
    const version = ++requestVersion;
    control.disabled = true;
    const result = await start(config, {
      persistSelection: persist,
      renderTenantOptions: (tenants, selectedId) => render(tenants, selectedId, selectTenantId),
      renderUserIdentity,
      showEmptyRelease: (tenant, reason) => showBrowserEmptyRelease(tenant, document, window, reason),
      startApp: (release, tenant, classification) => {
        startSargassumWorkspace({ release, ...classification }, tenant, config);
        persist(tenant.id, { replace: true });
      },
      showError: showBrowserError,
      getSearch: () => window.location.search,
      storage: window.sessionStorage,
      isCurrent: () => version === requestVersion,
    });
    if (version === requestVersion && result.status !== "stale") {
      control.disabled = result.code === "no_tenant_access";
    }
  };

  const selectTenantId = (tenantId) => {
    persist(tenantId, { replace: false });
    void reload();
  };

  control.addEventListener("change", () => {
    selectTenantId(control.value);
  });
  window.addEventListener("popstate", () => { void reload(); });
  setupBrowserAuthentication(config, reload);
  setupBrowserLogout(config, reload);
  void reload();
}

if (typeof document !== "undefined") startBrowserApp(window.RUNTIME_CONFIG);
