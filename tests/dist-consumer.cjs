/**
 * Consumer check for the packed SDK, run on the oldest Node in package.json
 * `engines` and on the current one. Offline: global fetch is replaced with a
 * fake, and no real key is used.
 *
 * CI copies this file into a directory where the packed tarball has been
 * installed with `npm install <tarball>`, so the package resolves by name
 * through its `main`/`exports`, exactly as for a consumer:
 *   node dist-consumer.cjs
 */
"use strict";

const assert = require("assert");

const calls = [];

function reply(body, status, contentType) {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

// Feeds the SDK's fetch arguments through the platform's own Request, so the
// running Node validates the signal, redirect mode and FormData/Blob body.
async function fakeFetch(url, init = {}) {
  const request = new Request(url, init);
  const bodyText = init.body != null ? await request.text() : null;
  const u = new URL(url);
  calls.push({ path: u.pathname, bodyText, signal: !!init.signal, redirect: init.redirect });
  const p = u.pathname;
  if (p.endsWith("/getcredits")) return reply('{"Credits":"4242"}', 200, "application/json");
  if (p.endsWith("/validatebatch")) {
    return reply('{"email_batch":[{"address":"a@example.com","status":"valid"}],"errors":[]}', 200, "application/json");
  }
  if (p.endsWith("/validate")) {
    if (u.searchParams.get("email") === "bad@example.com") {
      return reply('{"error":"Invalid email"}', 400, "application/json");
    }
    return reply(JSON.stringify({ address: u.searchParams.get("email"), status: "valid" }), 200, "application/json");
  }
  if (p.endsWith("/sendfile")) return reply('{"success":true,"message":"File Accepted","file_id":"f-123"}', 200, "application/json");
  if (p.endsWith("/getfile")) return reply('"Email Address"\n"valid@example.com"\n', 200, "text/csv");
  return reply('[{"from_address":"sender@example.com"}]', 200, "application/json");
}

async function exercise(ZeroBounceSDK, label) {
  calls.length = 0;
  assert.strictEqual(typeof ZeroBounceSDK, "function", `${label}: default export is the constructor`);
  assert.strictEqual(ZeroBounceSDK.ZBValidateStatus.VALID, "valid");
  assert.strictEqual(typeof ZeroBounceSDK.Warmup, "function");

  const zb = new ZeroBounceSDK();
  zb.init("offline-test-key");

  assert.strictEqual((await zb.getCredits()).Credits, "4242");
  assert.strictEqual((await zb.validateEmail("valid@example.com")).status, "valid");

  let error;
  try {
    await zb.validateEmail("bad@example.com");
  } catch (e) {
    error = e;
  }
  assert.ok(error && error.name === "ZBApiError" && error.statusCode === 400, `${label}: HTTP 400 rejects with ZBApiError`);

  const batch = await zb.validateBatch([{ email_address: "a@example.com" }], { timeout: 30 });
  assert.strictEqual(batch.email_batch[0].status, "valid");
  assert.ok(calls.find((c) => c.path.endsWith("/validatebatch")).bodyText.includes('"timeout":"30"'));

  const csv = new Blob(["email\nvalid@example.com\n"], { type: "text/csv" });
  const sent = await zb.sendFileStream(csv, "emails.csv", { email_address_column: 1 });
  assert.strictEqual(sent.file_id, "f-123");
  const upload = calls.find((c) => c.path.endsWith("/sendfile")).bodyText;
  assert.ok(/filename="emails\.csv"/.test(upload) && upload.includes("valid@example.com"), `${label}: multipart upload encoded`);

  assert.ok(String(await zb.getFile("aaaaaaaa-1111-2222-3333-444444444444")).includes("valid@example.com"));

  const warmup = new ZeroBounceSDK.Warmup("offline-warmup-key");
  assert.ok(await warmup.listSendingAccounts());

  assert.ok(calls.every((c) => c.signal), `${label}: every request carries a timeout signal`);
  assert.ok(calls.every((c) => c.redirect === "error"), `${label}: every request refuses redirects`);
  console.log(`${label}: ok (${calls.length} requests)`);
}

(async () => {
  console.log(`Node ${process.version}`);
  for (const name of ["fetch", "FormData", "Blob", "Request", "Response"]) {
    assert.strictEqual(typeof globalThis[name], "function", `global ${name} is missing`);
  }
  globalThis.fetch = fakeFetch;

  const required = require("@zerobounce/zero-bounce-sdk");
  await exercise(required, "require()");

  const imported = (await import("@zerobounce/zero-bounce-sdk")).default;
  assert.strictEqual(imported, required, "import and require resolve to the same build");
  await exercise(imported, "import");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
