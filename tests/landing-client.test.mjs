import assert from "node:assert/strict";
import test from "node:test";

import { signInAction } from "../public/landing-client.js";

test("opens the application-owned sign-in experience without an external destination", () => {
  assert.deepEqual(signInAction("authentication_required"), {
    label: "Sign in to your workspace",
  });
});

test("keeps a recovery action available when the current session has no tenant access", () => {
  assert.deepEqual(
    signInAction("no_tenant_access"),
    {
      label: "Sign in or switch account",
    },
  );
});
