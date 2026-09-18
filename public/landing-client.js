export function signInAction(state) {
  if (!["authentication_required", "authorization_denied", "no_tenant_access"].includes(state)) return null;
  return {
    label: state === "authentication_required" ? "Sign in to your workspace" : "Sign in or switch account",
  };
}
