/**
 * @jest-environment node
 *
 * Offline checks that the SDK behaves like the other ZeroBounce SDKs: dead-key
 * bodies, getfile JSON errors, base URL normalisation, strict booleans, the
 * redirect guard and keeping the key out of inspect / JSON output. Replaces
 * global fetch; no network and no real key.
 */
import fs from "fs";
import path from "path";
import util from "util";
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { ZeroBounceWarmup } from "../src/warmup.js";

const KEY = "parity-secret-key-123";

let calls;
let previousFetch;

function respond(body, { status = 200, contentType = "application/json", headers = {} } = {}) {
  calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get(name) {
          const lower = String(name).toLowerCase();
          if (lower === "content-type") return contentType;
          return headers[lower] ?? null;
        },
      },
      text: async () => body,
    };
  };
}

function client(base, options) {
  const sdk = new ZeroBounceSDK();
  sdk.init(KEY, base, options);
  return sdk;
}

async function outcome(promise) {
  try {
    return { resolved: await promise };
  } catch (error) {
    return { rejected: error.message, status: error.statusCode };
  }
}

function sent(call = calls[0]) {
  const url = new URL(call.url);
  const fields = Object.fromEntries(url.searchParams.entries());
  const body = call.init.body;
  if (body && typeof body.entries === "function") {
    for (const [key, value] of body.entries()) {
      fields[key] = typeof value === "string" ? value : "<file>";
    }
  } else if (typeof body === "string" && body.trim().startsWith("{")) {
    Object.assign(fields, JSON.parse(body));
  }
  return fields;
}

beforeEach(() => {
  previousFetch = global.fetch;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = previousFetch;
  jest.restoreAllMocks();
});

describe("a 2xx body with an error and no success field", () => {
  it("rejects whatever the error text says, with the status", async () => {
    const sdk = client();
    const cases = [
      ['{"error":"Something went wrong"}', () => sdk.validateEmail("a@example.com"), "Something went wrong"],
      ['{"error_message":"Not allowed"}', () => sdk.getApiUsage("2026-10-01", "2026-10-02"), "Not allowed"],
      ['{"Error":"Unexpected failure"}', () => sdk.listFilters(), "Unexpected failure"],
      ['{"error":"invalid email"}', () => sdk.scoreEmail("not-an-email"), "invalid email"],
      ['{"error":"Error: temporary outage"}', () => sdk.getEmailActivity("a@example.com"), "temporary outage"],
    ];
    for (const [body, call, message] of cases) {
      respond(body);
      expect([body, await outcome(call())]).toEqual([body, { rejected: message, status: 200 }]);
    }
  });

  it("still resolves the greylist Message, credits of -1 and bodies with success", async () => {
    const sdk = client();
    respond('{"Message":"Greylist validation still in progress. Please try again later."}');
    await expect(sdk.validateEmail("a@example.com")).resolves.toMatchObject({
      Message: "Greylist validation still in progress. Please try again later.",
    });
    respond('{"Credits":"-1"}');
    await expect(sdk.getCredits()).resolves.toEqual({ Credits: "-1" });
    respond('{"success":true,"message":"File Accepted","file_id":"f1","error":""}');
    await expect(sdk.getFileStatus("f1")).resolves.toMatchObject({ success: true });
    respond('{"address":"a@example.com","status":"valid","error":""}');
    await expect(sdk.validateEmail("a@example.com")).resolves.toMatchObject({ status: "valid" });
  });
});

describe("getfile and its variants", () => {
  const variants = [
    ["getFile", (sdk) => sdk.getFile("f1")],
    ["getScoringFile", (sdk) => sdk.getScoringFile("f1")],
    ["getEmailFinderFile", (sdk) => sdk.getEmailFinderFile("f1")],
    ["getDomainSearchFile", (sdk) => sdk.getDomainSearchFile("f1")],
  ];

  it("reject a JSON error body with its message and status instead of resolving it", async () => {
    for (const [name, call] of variants) {
      respond('{"success":false,"message":"File not found"}');
      expect([name, await outcome(call(client()))]).toEqual([
        name,
        { rejected: "File not found", status: 200 },
      ]);
      respond('{"error":"File not ready"}', { contentType: "text/plain" });
      expect([name, await outcome(call(client()))]).toEqual([
        name,
        { rejected: "File not ready", status: 200 },
      ]);
    }
  });

  it("reject a 4xx or 5xx answer even when its body reads as a CSV file", async () => {
    for (const [name, call] of variants) {
      respond("email\nperson@example.com\n", { status: 500, contentType: "text/csv" });
      const result = await outcome(call(client()));
      expect([name, result.status, "rejected" in result]).toEqual([name, 500, true]);
    }
  });

  it("reject any body served as application/json rather than return it as CSV text", async () => {
    for (const [name, call] of variants) {
      respond('{"foo":"bar"}');
      const result = await outcome(call(client()));
      expect([name, result.status, typeof result.rejected]).toEqual([name, 200, "string"]);
    }
  });

  it("still return a CSV file as text", async () => {
    const csv = '"Email Address","ZB Status"\n"a@example.com","valid"\n';
    for (const [name, call] of variants) {
      respond(csv, { contentType: "text/csv" });
      expect([name, await call(client())]).toEqual([name, csv]);
    }
  });
});

describe("base URLs", () => {
  it("strip trailing slashes from every base URL", async () => {
    const sdk = client("https://api.zerobounce.net/v2//", {
      listEvaluatorBaseURL: "https://bulkapi.zerobounce.net/v2/listevaluator/",
      inboxPlacementBaseURL: "https://bulkapi.zerobounce.net/api/ipt/",
      emailFinderBaseURL: "https://bulkapi.zerobounce.net/email-finder/",
      domainSearchBaseURL: "https://bulkapi.zerobounce.net/domain-search/",
    });
    const requests = [
      [() => sdk.validateEmail("a@example.com"), "https://api.zerobounce.net/v2/validate"],
      [() => sdk.getListEvaluatorResult("f1"), "https://bulkapi.zerobounce.net/v2/listevaluator/f1/"],
      [() => sdk.getInboxPlacementProviders(), "https://bulkapi.zerobounce.net/api/ipt/providers"],
      [() => sdk.getEmailFinderFileStatus("f1"), "https://bulkapi.zerobounce.net/email-finder/filestatus"],
      [() => sdk.getDomainSearchFileStatus("f1"), "https://bulkapi.zerobounce.net/domain-search/filestatus"],
    ];
    for (const [call, expected] of requests) {
      respond('{"success":true,"address":"a@example.com","status":"valid"}');
      await call();
      const url = new URL(calls[0].url);
      expect(`${url.origin}${url.pathname}`).toBe(expected);
    }
  });

  it("strip trailing slashes from the Warmup client's base URL", async () => {
    const warmup = new ZeroBounceWarmup(KEY, "https://warmup-api.zerobounce.net//");
    respond('{"success":true}');
    await warmup.listSendingAccounts();
    const url = new URL(calls[0].url);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://warmup-api.zerobounce.net/api/v1/warmup/sending-accounts"
    );
  });

  it("cover every base URL the public API accepts", () => {
    // Every base-URL parameter or option declared in the shipped types must
    // be in one of the two tests above; a new one fails here until it is.
    const covered = [
      "apiBaseURL",
      "listEvaluatorBaseURL",
      "inboxPlacementBaseURL",
      "emailFinderBaseURL",
      "domainSearchBaseURL",
      "baseURL", // ZeroBounceWarmup constructor
    ].sort();
    const types = fs.readFileSync(path.join(__dirname, "..", "zeroBounceSDK.d.ts"), "utf8");
    const declared = [...types.matchAll(/\b(\w*(?:base|Base)(?:URL|Url|_url))\??\s*:/g)]
      .map((m) => m[1])
      .sort();
    expect(declared).toEqual(covered);
  });
});

describe("booleans", () => {
  it("send the string \"false\" as false on every boolean option", async () => {
    const sdk = client();
    const file = new Blob(["a@example.com\n"]);
    const checks = [
      [
        () => sdk.validateEmail("a@example.com", { activityData: "false", verifyPlus: "false", domainInfo: "false" }),
        { activity_data: "false", verify_plus: "false", domain_info: "false" },
      ],
      [
        () => sdk.validateEmail("a@example.com", { greylistProcessing: "true", callbackUrl: "https://example.com/cb" }),
        { greylist_processing: "true", callback_url: "https://example.com/cb" },
      ],
      [
        () => sdk.sendFile({ file, email_address_column: 1, has_header_row: "false", remove_duplicate: "false", allowPhase2: "false" }),
        { has_header_row: "false", remove_duplicate: "false", allow_phase_2: "false" },
      ],
      [
        () => sdk.sendFileStream(file, "a.csv", { email_address_column: 1, has_header_row: "false", remove_duplicate: 0 }),
        { has_header_row: "false", remove_duplicate: "false" },
      ],
      [
        () => sdk.sendScoringFile({ file, email_address_column: 1, has_header_row: "false", remove_duplicate: "false" }),
        { has_header_row: "false", remove_duplicate: "false" },
      ],
      [
        () => sdk.sendScoringFileStream(file, "a.csv", { email_address_column: 1, has_header_row: "FALSE" }),
        { has_header_row: "false" },
      ],
      [
        () => sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 2, has_header_row: "false" }),
        { has_header_row: "false" },
      ],
      [
        () => sdk.sendEmailFinderFileStream(file, "a.csv", { domain_column: 1, full_name_column: 2, has_header_row: "false" }),
        { has_header_row: "false" },
      ],
      [() => sdk.sendDomainSearchFile({ file, domain_column: 1, has_header_row: "false" }), { has_header_row: "false" }],
      [
        () => sdk.sendDomainSearchFileStream(file, "a.csv", { domain_column: 1, has_header_row: "false" }),
        { has_header_row: "false" },
      ],
    ];
    for (const [call, expected] of checks) {
      respond('{"success":true,"file_id":"f1","address":"a@example.com","status":"valid"}');
      await call();
      expect(sent()).toMatchObject(expected);
    }
    respond("a,b\n", { contentType: "text/csv" });
    await sdk.getFile("f1", { activityData: "false" });
    expect(sent().activity_data).toBe("false");
  });

  it("keep the documented defaults when an option is null or left out", async () => {
    const sdk = client();
    const file = new Blob(["a@example.com\n"]);
    respond('{"success":true,"file_id":"f1"}');
    await sdk.sendFile({ file, email_address_column: 1, has_header_row: null });
    expect(sent()).toMatchObject({ has_header_row: "false" });
    expect(sent().allow_phase_2).toBeUndefined();
    // remove_duplicate is always sent on every sendfile variant, "false" when
    // left out or null: the released 4.0.x default (standard.md exception).
    for (const call of [
      () => sdk.sendFile({ file, email_address_column: 1 }),
      () => sdk.sendFile({ file, email_address_column: 1, remove_duplicate: null }),
      () => sdk.sendFileStream(file, "a.csv", { email_address_column: 1 }),
      () => sdk.sendScoringFile({ file, email_address_column: 1 }),
      () => sdk.sendScoringFileStream(file, "a.csv", { email_address_column: 1 }),
    ]) {
      respond('{"success":true,"file_id":"f1"}');
      await call();
      expect(sent().remove_duplicate).toBe("false");
    }
    for (const call of [
      () => sdk.sendFile({ file, email_address_column: 1, remove_duplicate: true }),
      () => sdk.sendFileStream(file, "a.csv", { email_address_column: 1, remove_duplicate: "true" }),
      () => sdk.sendScoringFile({ file, email_address_column: 1, remove_duplicate: 1 }),
      () => sdk.sendScoringFileStream(file, "a.csv", { email_address_column: 1, remove_duplicate: true }),
    ]) {
      respond('{"success":true,"file_id":"f1"}');
      await call();
      expect(sent().remove_duplicate).toBe("true");
    }
    respond('{"address":"a@example.com","status":"valid"}');
    await sdk.validateEmail("a@example.com", { activityData: null });
    expect(sent().activity_data).toBeUndefined();
  });

  it("reject a value that is not a boolean, before any request", async () => {
    const sdk = client();
    const file = new Blob(["a@example.com\n"]);
    const bad = [
      () => sdk.validateEmail("a@example.com", { activityData: "yes" }),
      () => sdk.validateEmail("a@example.com", { verifyPlus: "no" }),
      () => sdk.sendFile({ file, email_address_column: 1, has_header_row: "maybe" }),
      () => sdk.sendScoringFile({ file, email_address_column: 1, remove_duplicate: 2 }),
      () => sdk.sendDomainSearchFile({ file, domain_column: 1, has_header_row: "off" }),
      () => sdk.getFile("f1", { activityData: "nope" }),
    ];
    for (const call of bad) {
      respond('{"success":true}');
      await expect(call()).rejects.toThrow("Must be true or false.");
      expect(calls).toHaveLength(0);
    }
  });

  it("parse validateBatch's activityData and verifyPlus strictly and send them as JSON booleans", async () => {
    const sdk = client();
    const batch = [{ email_address: "a@example.com" }];
    for (const [given, expected] of [["false", false], ["TRUE", true], [0, false], [1, true], [false, false], [true, true]]) {
      respond('{"email_batch":[],"errors":[]}');
      await sdk.validateBatch(batch, { activityData: given, verifyPlus: given });
      expect(JSON.parse(calls[0].init.body)).toMatchObject({ activity_data: expected, verify_plus: expected });
    }
    respond('{"email_batch":[],"errors":[]}');
    await sdk.validateBatch(batch, { activityData: null });
    expect(JSON.parse(calls[0].init.body)).not.toHaveProperty("activity_data");
    for (const bad of ["no", "yes", "0", 2]) {
      for (const option of ["activityData", "verifyPlus"]) {
        respond('{"email_batch":[],"errors":[]}');
        await expect(sdk.validateBatch(batch, { [option]: bad })).rejects.toThrow(
          `${option} parameter is invalid. Must be true or false.`
        );
        expect(calls).toHaveLength(0);
      }
    }
  });

  it("send Warmup ignoreConflict \"false\" as false and reject a non-boolean", async () => {
    const warmup = new ZeroBounceWarmup(KEY);
    respond('{"ok":true}');
    await warmup.addSendingAccount({
      fromAddress: "me@example.com",
      onboardingModel: "self_managed",
      engagementRuleId: 0,
      ignoreConflict: "false",
    });
    expect(JSON.parse(calls[0].init.body).ignore_conflict).toBe(false);
    respond('{"ok":true}');
    await expect(
      warmup.addSendingAccount({
        fromAddress: "me@example.com",
        onboardingModel: "self_managed",
        engagementRuleId: 0,
        ignoreConflict: "sure",
      })
    ).rejects.toThrow("Must be true or false.");
    expect(calls).toHaveLength(0);
  });
});

describe("redirects", () => {
  it("reject a 3xx answer with its status instead of reading it as a result", async () => {
    respond('{"Credits":"100"}', { status: 302, headers: { location: "https://elsewhere.example/" } });
    await expect(outcome(client().getCredits())).resolves.toEqual({
      rejected: "ZeroBounce returned a redirect, which this client does not follow.",
      status: 302,
    });
    respond("a,b\n", { status: 301, contentType: "text/csv" });
    await expect(outcome(client().getFile("f1"))).resolves.toMatchObject({ status: 301 });
    respond('{"ok":true}', { status: 307 });
    await expect(outcome(new ZeroBounceWarmup(KEY).listSendingAccounts())).resolves.toEqual({
      rejected: "ZeroBounce returned a redirect, which this client does not follow.",
      status: 307,
    });
  });
});

describe("guessFormat (deprecated)", () => {
  it("rejects a dead key's bare Message, as the finder and domain search do", async () => {
    respond('{"Message":"Invalid API key or your account ran out of credits"}');
    await expect(outcome(client().guessFormat({ domain: "example.com" }))).resolves.toEqual({
      rejected: "Invalid API key or your account ran out of credits",
      status: 200,
    });
  });
});

describe("the API key", () => {
  it("is not shown by util.inspect or JSON.stringify of either client", async () => {
    const sdk = client();
    const warmup = new ZeroBounceWarmup(KEY);
    for (const value of [sdk, warmup]) {
      expect(util.inspect(value, { depth: 5 })).not.toContain(KEY);
      expect(JSON.stringify(value)).not.toContain(KEY);
      expect(String(value)).not.toContain(KEY);
    }
    // ...and is still sent.
    respond('{"Credits":"5"}');
    await sdk.getCredits();
    expect(sent().api_key).toBe(KEY);
    respond("[]");
    await warmup.listSendingAccounts();
    expect(calls[0].init.headers["API-Key"]).toBe(KEY);
  });
});

describe("init", () => {
  /** Everything init can set, including the non-enumerable key. */
  function state(sdk) {
    return { _api_key: sdk._api_key, ...sdk };
  }

  it("leaves an initialised client exactly as it was when it throws", async () => {
    const sdk = client();
    const before = state(sdk);
    const bad = [
      ["key-B", ZeroBounceSDK.ApiURL.EU_API_URL, { domainSearchBaseURL: "http://evil.example" }],
      ["key-B", ZeroBounceSDK.ApiURL.EU_API_URL, { listEvaluatorBaseURL: "http://evil.example" }],
      ["key-B", ZeroBounceSDK.ApiURL.EU_API_URL, { inboxPlacementBaseURL: "http://evil.example" }],
      ["key-B", ZeroBounceSDK.ApiURL.EU_API_URL, { emailFinderBaseURL: "http://evil.example" }],
      ["key-B", "http://api-eu.zerobounce.net/v2"],
      ["key-B\n", ZeroBounceSDK.ApiURL.EU_API_URL],
      ["", ZeroBounceSDK.ApiURL.EU_API_URL],
    ];
    for (const args of bad) {
      expect(() => sdk.init(...args)).toThrow(/ZeroBounce:/);
      expect([args, state(sdk)]).toEqual([args, before]);
    }
    respond('{"Credits":"5"}');
    await sdk.getCredits();
    expect(new URL(calls[0].url).host).toBe("api.zerobounce.net");
    expect(sent().api_key).toBe(KEY);
  });

  it("leaves a fresh client uninitialised, with no key stored, when it throws", async () => {
    const fresh = new ZeroBounceSDK();
    const before = state(fresh);
    expect(() => fresh.init("key-C", "http://evil.example/v2")).toThrow(/https/);
    expect(state(fresh)).toEqual(before);
    expect(fresh._api_key).toBeNull();
    respond('{"Credits":"5"}');
    await expect(fresh.getCredits()).rejects.toThrow(/Call init/);
    expect(calls).toEqual([]);
  });

  it("rejects a key with surrounding whitespace or control characters, before storing it", () => {
    for (const key of ["key\n", " key", "key\t", "ke\u0000y", "ke\u001fy", "ke\u007fy"]) {
      const sdk = new ZeroBounceSDK();
      expect([key, (() => { try { sdk.init(key); return null; } catch (error) { return error.message; } })()]).toEqual([
        key,
        "ZeroBounce: Api key has surrounding whitespace or control characters.",
      ]);
      expect(sdk._initialized).toBe(false);
      expect(sdk._api_key).toBeNull();
    }
  });
});

/**
 * Every boolean input either client declares in zeroBounceSDK.d.ts, as
 * "Interface.property" (or "method.property" for an inline options object),
 * read from the declarations so that a boolean added later cannot escape the
 * sweep below. Response fields (…Response, …Result, …Payload) are outputs.
 */
function declaredBooleanInputs() {
  const lines = fs.readFileSync(path.join(__dirname, "..", "zeroBounceSDK.d.ts"), "utf8").split("\n");
  const inputs = [];
  const unclassified = [];
  let context = null;
  for (const line of lines) {
    const declared = line.match(/^export (?:interface|class|type) (\w+)/);
    if (declared) context = declared[1];
    const inline = line.match(/^\s+(\w+)\(\w+\??: \{\s*$/);
    if (inline) context = inline[1];
    if (/^\s*(\/\/|\*|\/\*\*)/.test(line) || !/\bboolean\b/.test(line)) continue;
    const property = line.match(/^\s+(\w+)\??: [^;]*\bboolean\b[^;]*;\s*$/);
    if (!property) {
      unclassified.push(`unparsed: ${line.trim()}`);
    } else if (/(Response|Result|Payload)$/.test(context)) {
      continue;
    } else if (/Options$/.test(context) || /^Warmup/.test(context) || /^[a-z]/.test(context)) {
      inputs.push(`${context}.${property[1]}`);
    } else {
      unclassified.push(`${context}.${property[1]}`);
    }
  }
  expect(unclassified).toEqual([]);
  return [...new Set(inputs)].sort();
}

describe("every boolean parameter", () => {
  const file = () => new Blob(["a@example.com\n"]);
  const job = { file_name: "emails/list.csv", return_url: "https://example.com/done", has_header_row: true };
  const sdkCall = (run, reply = '{"success":true,"file_id":"f1"}', contentType) => ({
    run: (value) => {
      respond(reply, contentType ? { contentType } : undefined);
      return run(client(), value);
    },
  });
  const warmupCall = (run) => ({
    run: (value) => {
      respond('{"ok":true}');
      return run(new ZeroBounceWarmup(KEY), value);
    },
    json: true,
  });
  const managed = (extra) => ({ fromAddress: "me@example.com", onboardingModel: "zb_managed", ...extra });
  const update = { fromAddress: "me@example.com", engagementRuleId: 1, statusId: 4 };

  // How each declared boolean is exercised, and its name on the wire.
  // `realBooleanOnly`: only true / false are accepted, as in the other SDKs.
  const sweep = {
    "ValidateEmailOptions.activityData": { ...sdkCall((s, v) => s.validateEmail("a@example.com", { activityData: v }), '{"address":"a@example.com","status":"valid"}'), wire: "activity_data" },
    "ValidateEmailOptions.verifyPlus": { ...sdkCall((s, v) => s.validateEmail("a@example.com", { verifyPlus: v }), '{"address":"a@example.com","status":"valid"}'), wire: "verify_plus" },
    "ValidateEmailOptions.domainInfo": { ...sdkCall((s, v) => s.validateEmail("a@example.com", { domainInfo: v }), '{"address":"a@example.com","status":"valid"}'), wire: "domain_info" },
    "ValidateEmailOptions.greylistProcessing": { ...sdkCall((s, v) => s.validateEmail("a@example.com", { greylistProcessing: v }), '{"address":"a@example.com","status":"valid"}'), wire: "greylist_processing" },
    "ValidateBatchOptions.activityData": { ...sdkCall((s, v) => s.validateBatch([{ email_address: "a@example.com" }], { activityData: v }), '{"email_batch":[],"errors":[]}'), wire: "activity_data", json: true },
    "ValidateBatchOptions.verifyPlus": { ...sdkCall((s, v) => s.validateBatch([{ email_address: "a@example.com" }], { verifyPlus: v }), '{"email_batch":[],"errors":[]}'), wire: "verify_plus", json: true },
    "GetFileOptions.activityData": { ...sdkCall((s, v) => s.getFile("f1", { activityData: v }), "a,b\n", "text/csv"), wire: "activity_data" },
    "SendFileOptions.has_header_row": { ...sdkCall((s, v) => s.sendFile({ file: file(), email_address_column: 1, has_header_row: v })), wire: "has_header_row" },
    "SendFileOptions.remove_duplicate": { ...sdkCall((s, v) => s.sendFile({ file: file(), email_address_column: 1, remove_duplicate: v })), wire: "remove_duplicate" },
    "SendFileOptions.allowPhase2": { ...sdkCall((s, v) => s.sendFile({ file: file(), email_address_column: 1, allowPhase2: v })), wire: "allow_phase_2" },
    "SendFileStreamOptions.has_header_row": { ...sdkCall((s, v) => s.sendFileStream(file(), "a.csv", { email_address_column: 1, has_header_row: v })), wire: "has_header_row" },
    "SendFileStreamOptions.remove_duplicate": { ...sdkCall((s, v) => s.sendFileStream(file(), "a.csv", { email_address_column: 1, remove_duplicate: v })), wire: "remove_duplicate" },
    "SendFileStreamOptions.allowPhase2": { ...sdkCall((s, v) => s.sendFileStream(file(), "a.csv", { email_address_column: 1, allowPhase2: v })), wire: "allow_phase_2" },
    "SendScoringFileOptions.has_header_row": { ...sdkCall((s, v) => s.sendScoringFile({ file: file(), email_address_column: 1, has_header_row: v })), wire: "has_header_row" },
    "SendScoringFileOptions.remove_duplicate": { ...sdkCall((s, v) => s.sendScoringFile({ file: file(), email_address_column: 1, remove_duplicate: v })), wire: "remove_duplicate" },
    "SendScoringFileStreamOptions.has_header_row": { ...sdkCall((s, v) => s.sendScoringFileStream(file(), "a.csv", { email_address_column: 1, has_header_row: v })), wire: "has_header_row" },
    "SendScoringFileStreamOptions.remove_duplicate": { ...sdkCall((s, v) => s.sendScoringFileStream(file(), "a.csv", { email_address_column: 1, remove_duplicate: v })), wire: "remove_duplicate" },
    "SendEmailFinderFileOptions.has_header_row": { ...sdkCall((s, v) => s.sendEmailFinderFile({ file: file(), domain_column: 1, first_name_column: 2, has_header_row: v })), wire: "has_header_row" },
    "SendEmailFinderFileStreamOptions.has_header_row": { ...sdkCall((s, v) => s.sendEmailFinderFileStream(file(), "a.csv", { domain_column: 1, full_name_column: 2, has_header_row: v })), wire: "has_header_row" },
    "SendDomainSearchFileOptions.has_header_row": { ...sdkCall((s, v) => s.sendDomainSearchFile({ file: file(), domain_column: 1, has_header_row: v })), wire: "has_header_row" },
    "SendDomainSearchFileStreamOptions.has_header_row": { ...sdkCall((s, v) => s.sendDomainSearchFileStream(file(), "a.csv", { domain_column: 1, has_header_row: v })), wire: "has_header_row" },
    "BulkRootFileJobOptions.has_header_row": { ...sdkCall((s, v) => s.validateS3file({ ...job, has_header_row: v }), '{"success":true}'), wire: "has_header_row" },
    "BulkRootFileJobOptions.remove_duplicates": { ...sdkCall((s, v) => s.validateS3file({ ...job, remove_duplicates: v }), '{"success":true}'), wire: "remove_duplicates" },
    "addSendingAccount.ignoreConflict": { ...warmupCall((w, v) => w.addSendingAccount({ fromAddress: "me@example.com", onboardingModel: "self_managed", engagementRuleId: 0, ignoreConflict: v })), wire: "ignore_conflict" },
    "WarmupManagedSending.weekdays_only": { ...warmupCall((w, v) => w.addSendingAccount(managed({ managedSending: { weekdays_only: v } }))), wire: (body) => body.managed_sending.weekdays_only },
    "updateSendingAccount.autoEnable": { ...warmupCall((w, v) => w.updateSendingAccount({ ...update, autoEnable: v })), wire: "auto_enable", realBooleanOnly: true },
  };

  it("covers every boolean the type declarations accept, on both clients", () => {
    expect(Object.keys(sweep).sort()).toEqual(declaredBooleanInputs());
  });

  for (const [name, entry] of Object.entries(sweep)) {
    it(`${name}: is sent as a boolean, and anything else is rejected before a request`, async () => {
      const read = () => {
        const fields = sent();
        return typeof entry.wire === "function" ? entry.wire(fields) : fields[entry.wire];
      };
      const asWire = (value) => (entry.json ? value : String(value));

      const accepted = [[true, true], [false, false]];
      if (!entry.realBooleanOnly) accepted.push(["false", false], ["TRUE", true], [0, false], [1, true]);
      for (const [given, expected] of accepted) {
        await entry.run(given);
        expect([name, given, read()]).toEqual([name, given, asWire(expected)]);
      }

      const rejected = ["maybe", "no", 2, {}];
      if (entry.realBooleanOnly) rejected.push("false", "true", 0, 1);
      for (const given of rejected) {
        const result = await outcome(entry.run(given));
        expect([name, given, result.rejected]).toEqual([name, given, expect.stringMatching(/Must be true or false\.$/)]);
        expect([name, given, calls]).toEqual([name, given, []]);
      }
    });
  }
});
