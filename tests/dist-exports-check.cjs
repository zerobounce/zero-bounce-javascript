/**
 * Shared check for the built package's exports, used by
 * dist-exports-require.cjs and dist-exports-import.mjs. Offline: global fetch
 * is replaced with a fake and no real key is used.
 */
"use strict";

const assert = require("assert");

function reply(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (String(name).toLowerCase() === "content-type" ? "application/json" : null) },
    text: async () => body,
  };
}

async function check(exported, label) {
  const { default: defaultExport, ZeroBounceSDK, ZeroBounceWarmup, ZBApiError } = exported;
  for (const [name, value] of Object.entries({ default: defaultExport, ZeroBounceSDK, ZeroBounceWarmup, ZBApiError })) {
    assert.strictEqual(typeof value, "function", `${label}: ${name} is exported`);
  }
  assert.strictEqual(defaultExport, ZeroBounceSDK, `${label}: the default export is ZeroBounceSDK`);
  assert.strictEqual(ZeroBounceSDK.Warmup, ZeroBounceWarmup, `${label}: ZeroBounceSDK.Warmup is ZeroBounceWarmup`);

  const calls = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ host: u.host, path: u.pathname, headers: init.headers || {} });
    if (u.pathname.endsWith("/validate")) return reply(400, '{"error":"Invalid email"}');
    if (u.host === "warmup-api.zerobounce.net") return reply(200, '[{"from_address":"sender@example.com"}]');
    return reply(200, '{"Credits":"7"}');
  };
  try {
    const zb = new ZeroBounceSDK();
    zb.init("offline-test-key");
    assert.strictEqual((await zb.getCredits()).Credits, "7");

    let error;
    try {
      await zb.validateEmail("bad@example.com");
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof ZBApiError, `${label}: an API failure is an instance of the exported ZBApiError`);
    assert.strictEqual(error.statusCode, 400);
    assert.strictEqual(error.message, "Invalid email");

    const own = new ZBApiError("made here", 418);
    assert.ok(own instanceof Error);
    assert.strictEqual(own.name, "ZBApiError");
    assert.strictEqual(own.statusCode, 418);

    const warmup = new ZeroBounceWarmup("offline-warmup-key");
    const accounts = await warmup.listSendingAccounts();
    assert.deepStrictEqual(accounts, [{ from_address: "sender@example.com" }]);
    const warmupCall = calls[calls.length - 1];
    assert.strictEqual(warmupCall.host, "warmup-api.zerobounce.net");
    assert.strictEqual(warmupCall.path, "/api/v1/warmup/sending-accounts");
    assert.strictEqual(warmupCall.headers["API-Key"], "offline-warmup-key");
  } finally {
    globalThis.fetch = previous;
  }
  console.log(`${label}: ok`);
}

module.exports = { check };
