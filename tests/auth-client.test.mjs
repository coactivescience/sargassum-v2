import assert from "node:assert/strict";
import test from "node:test";

import * as auth from "../public/auth-client.js";

const { signInWithPassword, verifyTotp } = auth;

test("signs in through the configured unified API and preserves its session cookie", async () => {
  const calls = [];

  const result = await signInWithPassword("https://api.example.test/base", {
    email: "analyst@example.test",
    password: "not-a-real-password",
  }, async (url, init) => {
    calls.push({ url, init });
    return Response.json({ user: { id: "user-1" } });
  });

  assert.deepEqual(calls, [{
    url: "https://api.example.test/api/auth/sign-in/email",
    init: {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: "analyst@example.test", password: "not-a-real-password" }),
    },
  }]);
  assert.deepEqual(result, { requiresTwoFactor: false });
});

test("reports the backend two-factor challenge after a password sign-in", async () => {
  const result = await signInWithPassword("https://api.example.test", {
    email: "analyst@example.test",
    password: "not-a-real-password",
  }, async () => Response.json({ twoFactorRedirect: true }));

  assert.deepEqual(result, { requiresTwoFactor: true });
});

test("verifies a six-digit TOTP code through the unified API", async () => {
  const calls = [];
  await verifyTotp("https://api.example.test", "123456", async (url, init) => {
    calls.push({ url, init });
    return Response.json({ user: { id: "user-1" } });
  });

  assert.deepEqual(calls, [{
    url: "https://api.example.test/api/auth/two-factor/verify-totp",
    init: {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ code: "123456" }),
    },
  }]);
});

test("signs out through the configured unified API", async () => {
  assert.equal(typeof auth.signOut, "function");
  if (typeof auth.signOut !== "function") return;
  const calls = [];

  await auth.signOut("https://api.example.test/base", async (url, init) => {
    calls.push({ url, init });
    return Response.json({ success: true });
  });

  assert.deepEqual(calls, [{
    url: "https://api.example.test/api/auth/sign-out",
    init: {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
    },
  }]);
});
