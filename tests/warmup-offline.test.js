/**
 * Offline suite for the Warmup API client. Replaces global fetch; no network
 * and no real key.
 */
import { inspect } from "util";
import { ZeroBounceWarmup } from "../src/warmup.js";

const KEY = "warmup-test-key";

function httpResponse(status, body, contentType = "application/json") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name) =>
        String(name).toLowerCase() === "content-type" ? contentType : null,
    },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function installFake({ status = 200, body = '{"ok":true}', contentType = "application/json" } = {}) {
  const records = [];
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    records.push({
      method: String(init.method || "GET").toUpperCase(),
      host: parsed.host,
      path: parsed.pathname,
      url: String(url),
      query: Object.fromEntries(parsed.searchParams.entries()),
      headers: init.headers || {},
      json: init.body ? JSON.parse(init.body) : null,
      redirect: init.redirect,
    });
    return httpResponse(status, body, contentType);
  };
  return {
    records,
    only() {
      expect(records.length).toBe(1);
      return records[0];
    },
  };
}

async function rejects(promise) {
  let thrown = null;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  return thrown;
}

/** Every public method of the Warmup client, called with valid arguments. */
function allWarmupCalls(c) {
  const from = "sender@example.com";
  return [
    ["listSendingAccounts", () => c.listSendingAccounts()],
    ["getSendingAccount", () => c.getSendingAccount(from)],
    ["addSendingAccount", () => c.addSendingAccount({ fromAddress: from, onboardingModel: "self_managed", engagementRuleId: 0 })],
    ["updateSendingAccount", () => c.updateSendingAccount({ fromAddress: from, engagementRuleId: 1, statusId: 4, autoEnable: false })],
    ["deleteSendingAccount", () => c.deleteSendingAccount(from)],
    ["changeFromAddress", () => c.changeFromAddress(from, "new@example.com")],
    ["listFromAddresses", () => c.listFromAddresses()],
    ["getEngagementRules", () => c.getEngagementRules()],
    ["setEngagementRule", () => c.setEngagementRule(from, 2)],
    ["getCustomEngagement", () => c.getCustomEngagement(from)],
    ["createCustomEngagement", () => c.createCustomEngagement({ cFrom: from, replyPct: 10, importantPct: 10, clickPct: 5 })],
    ["updateCustomEngagement", () => c.updateCustomEngagement({ cFrom: from, replyPct: 10, importantPct: 10, clickPct: 5 })],
    ["deleteCustomEngagement", () => c.deleteCustomEngagement(from, 1)],
    ["getSeeds", () => c.getSeeds()],
    ["downloadSeeds", () => c.downloadSeeds()],
    ["getSeedCount", () => c.getSeedCount()],
    ["getProgressToday", () => c.getProgressToday()],
    ["getSentToday", () => c.getSentToday()],
    ["getEmailsPerDay", () => c.getEmailsPerDay()],
    ["getStatistics", () => c.getStatistics(from)],
    ["getStatisticsPerDay", () => c.getStatisticsPerDay({ fromAddress: from, startDate: "2026-01-01", endDate: "2026-01-31" })],
    ["getStatisticsDetailed", () => c.getStatisticsDetailed(from)],
    ["downloadStatistics", () => c.downloadStatistics(from)],
    ["getFromAddressStatistics", () => c.getFromAddressStatistics(from)],
    ["checkDomainDmarc", () => c.checkDomainDmarc(from)],
    ["testSmtpConfiguration", () => c.testSmtpConfiguration({ fromAddress: from, username: "u", password: "p", server: "smtp.example.com", port: 587 })],
  ];
}

/** The public methods of the Warmup client, from its prototype, sorted. */
function publicWarmupMethods() {
  return Object.getOwnPropertyNames(ZeroBounceWarmup.prototype)
    .filter((name) => name !== "constructor" && !name.startsWith("_"))
    .filter((name) => typeof ZeroBounceWarmup.prototype[name] === "function")
    .sort();
}

describe("Warmup API client", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the key in the API-Key header, never in the URL", async () => {
    const fake = installFake();
    const client = new ZeroBounceWarmup(KEY);

    await client.listSendingAccounts();

    const request = fake.only();
    expect(request.host).toBe("warmup-api.zerobounce.net");
    expect(request.path).toBe("/api/v1/warmup/sending-accounts");
    expect(request.headers["API-Key"]).toBe(KEY);
    expect(request.url).not.toContain(KEY);
    expect(request.query.api_key).toBeUndefined();
    // A redirect must never be followed: it could carry the key elsewhere.
    expect(request.redirect).toBe("error");
  });

  it("covers every documented endpoint with the right method and path", async () => {
    const fake = installFake();
    const c = new ZeroBounceWarmup(KEY);
    const from = "sender@example.com";

    const calls = [
      [() => c.listSendingAccounts(), "GET", "/sending-accounts"],
      [() => c.getSendingAccount(from), "GET", "/sending-account"],
      [() => c.addSendingAccount({ fromAddress: from, onboardingModel: "self_managed", engagementRuleId: 0 }), "POST", "/sending-accounts"],
      [() => c.updateSendingAccount({ fromAddress: from, engagementRuleId: 1, statusId: 4, autoEnable: false }), "PUT", "/sending-accounts"],
      [() => c.deleteSendingAccount(from), "DELETE", "/sending-accounts"],
      [() => c.changeFromAddress(from, "new@example.com"), "PUT", "/smtp-credentials"],
      [() => c.listFromAddresses(), "GET", "/from-addresses"],
      [() => c.getEngagementRules(), "GET", "/engagement-rules"],
      [() => c.setEngagementRule(from, 2), "PUT", "/engagement-rule"],
      [() => c.getCustomEngagement(from), "GET", `/custom-engagement/${encodeURIComponent(from)}`],
      [() => c.createCustomEngagement({ cFrom: from, replyPct: 10, importantPct: 10, clickPct: 5 }), "POST", "/custom-engagement"],
      [() => c.updateCustomEngagement({ cFrom: from, replyPct: 10, importantPct: 10, clickPct: 5 }), "PUT", "/custom-engagement"],
      [() => c.deleteCustomEngagement(from, 1), "DELETE", "/custom-engagement"],
      [() => c.getSeeds(), "GET", "/seeds"],
      [() => c.getSeedCount(), "GET", "/seed-count"],
      [() => c.getProgressToday(), "GET", "/progress-today"],
      [() => c.getSentToday(), "GET", "/sent-today"],
      [() => c.getEmailsPerDay(), "GET", "/emails-per-day"],
      [() => c.getStatistics(from), "GET", "/statistics"],
      [() => c.getStatisticsPerDay({ fromAddress: from, startDate: "2026-01-01", endDate: "2026-01-31" }), "GET", "/statistics-per-day"],
      [() => c.getStatisticsDetailed(from), "GET", "/statistics-detailed"],
      [() => c.getFromAddressStatistics(from), "GET", "/from-address-statistics"],
      [() => c.checkDomainDmarc(from), "GET", "/check-domain-dmarc"],
      [() => c.testSmtpConfiguration({ fromAddress: from, username: "u", password: "p", server: "smtp.example.com", port: 587 }), "POST", "/test-smtp-configuration"],
    ];

    for (const [call, method, path] of calls) {
      fake.records.length = 0;
      await call();
      const request = fake.only();
      expect(request.method).toBe(method);
      expect(request.path).toBe(`/api/v1/warmup${path}`);
      expect(request.headers["API-Key"]).toBe(KEY);
    }
  });

  it("returns CSV text for the two downloads", async () => {
    const fake = installFake({ body: "seed,provider\na@example.com,gmail\n", contentType: "text/csv" });
    const c = new ZeroBounceWarmup(KEY);

    expect(await c.downloadSeeds()).toContain("seed,provider");
    expect(fake.only().path).toBe("/api/v1/warmup/seeds/download");

    fake.records.length = 0;
    expect(await c.downloadStatistics("sender@example.com")).toContain("seed,provider");
    const request = fake.only();
    expect(request.path).toBe("/api/v1/warmup/statistics/download");
    expect(request.query.c_from).toBe("sender@example.com");
  });

  it("returns null for the documented empty successes", async () => {
    installFake({ status: 204, body: "" });
    const c = new ZeroBounceWarmup(KEY);
    expect(await c.deleteSendingAccount("sender@example.com")).toBeNull();
    expect(await c.setEngagementRule("sender@example.com", 1)).toBeNull();

    installFake({ status: 200, body: "" });
    expect(await c.changeFromAddress("a@example.com", "b@example.com")).toBeNull();
  });

  it("omits optional query parameters until they are set", async () => {
    const fake = installFake();
    const c = new ZeroBounceWarmup(KEY);

    await c.listFromAddresses();
    expect(Object.keys(fake.only().query)).toEqual([]);

    fake.records.length = 0;
    await c.listFromAddresses({ searchFrom: "sender@example.com", offset: 0, limit: 50 });
    // offset and limit travel as strings.
    expect(fake.only().query).toEqual({
      search_from: "sender@example.com",
      offset: "0",
      limit: "50",
    });

    fake.records.length = 0;
    await c.checkDomainDmarc("sender@example.com");
    expect(fake.only().query.dkim_selector).toBeUndefined();

    fake.records.length = 0;
    await c.checkDomainDmarc("sender@example.com", "selector1");
    expect(fake.only().query.dkim_selector).toBe("selector1");
  });

  it("builds the documented sending-account bodies", async () => {
    const fake = installFake();
    const c = new ZeroBounceWarmup(KEY);

    await c.addSendingAccount({
      fromAddress: "sender@example.com",
      onboardingModel: "self_managed",
      engagementRuleId: 3,
      ignoreConflict: true,
    });
    expect(fake.only().json).toEqual({
      from_address: "sender@example.com",
      onboarding_model: "self_managed",
      engagement_rule_id: 3,
      ignore_conflict: true,
    });

    fake.records.length = 0;
    await c.addSendingAccount({
      fromAddress: "sender@example.com",
      onboardingModel: "zb_managed",
      emailContent: { types_of_emails: ["newsletter"] },
      managedSending: { timezone_offset: 2, warmup_start_date: "2026-02-01" },
    });
    expect(fake.only().json).toEqual({
      from_address: "sender@example.com",
      onboarding_model: "zb_managed",
      email_content: { types_of_emails: ["newsletter"] },
      managed_sending: { timezone_offset: 2, warmup_start_date: "2026-02-01" },
    });

    // A zb_managed account takes no engagement rule: say so rather than drop
    // it. Like every argument check, it rejects the promise: a caller's
    // .catch() sees it, and nothing is thrown before a promise exists.
    fake.records.length = 0;
    let pending;
    expect(() => {
      pending = c.addSendingAccount({
        fromAddress: "sender@example.com",
        onboardingModel: "zb_managed",
        engagementRuleId: 2,
      });
    }).not.toThrow();
    expect(typeof (pending && pending.then)).toBe("function");
    await expect(pending).rejects.toThrow("ZeroBounce: engagement_rule_id is for self_managed.");
    const caught = await c
      .addSendingAccount({ fromAddress: "sender@example.com", onboardingModel: "zb_managed", engagementRuleId: 0 })
      .catch((error) => error.message);
    expect(caught).toBe("ZeroBounce: engagement_rule_id is for self_managed.");
    expect(fake.records).toHaveLength(0);

    fake.records.length = 0;
    await c.updateSendingAccount({
      fromAddress: "sender@example.com",
      engagementRuleId: 1,
      statusId: 5,
      autoEnable: true,
    });
    // team_id is required by the schema and replaced with the key's own team.
    expect(fake.only().json).toEqual({
      team_id: 1,
      from_address: "sender@example.com",
      engagement_rule_id: 1,
      status_id: 5,
      auto_enable: true,
    });
  });

  it("checks arguments before sending anything", async () => {
    const fake = installFake();
    const c = new ZeroBounceWarmup(KEY);

    const bad = [
      () => c.addSendingAccount({ fromAddress: "a@example.com", onboardingModel: "nope" }),
      () => c.addSendingAccount({ fromAddress: "a@example.com", onboardingModel: "self_managed" }),
      () => c.addSendingAccount({ fromAddress: "a@example.com", onboardingModel: "self_managed", engagementRuleId: 9 }),
      // zb_managed has no engagement_rule_id: it is rejected, not dropped.
      () => c.addSendingAccount({ fromAddress: "a@example.com", onboardingModel: "zb_managed", engagementRuleId: 1 }),
      () => c.updateSendingAccount({ fromAddress: "a@example.com", engagementRuleId: 1, statusId: 1 }),
      () => c.setEngagementRule("a@example.com", 7),
      () => c.createCustomEngagement({ cFrom: "a@example.com", replyPct: 1, importantPct: 10, clickPct: 5 }),
      // click_pct may be at most important_pct x 1.75.
      () => c.createCustomEngagement({ cFrom: "a@example.com", replyPct: 10, importantPct: 10, clickPct: 60 }),
      () => c.deleteCustomEngagement("a@example.com", 0),
      () => c.listFromAddresses({ searchFrom: "bad space" }),
      () => c.getStatisticsPerDay({ fromAddress: "a@example.com", startDate: "2026-02-01", endDate: "2026-01-01" }),
      () => c.getStatisticsPerDay({ fromAddress: "a@example.com", startDate: "01/02/2026", endDate: "2026-01-01" }),
      // LIVE: check-domain-dmarc needs an email address, not a bare domain.
      () => c.checkDomainDmarc("example.com"),
      () => c.testSmtpConfiguration({ fromAddress: "a@example.com", username: "u", password: "p", server: "s", port: 0 }),
      () => c.getCustomEngagement(".."),
    ];

    // Every check rejects the returned promise, as on ZeroBounceSDK; none
    // throws synchronously.
    for (const call of bad) {
      let pending;
      expect(() => {
        pending = call();
      }).not.toThrow();
      expect(typeof (pending && pending.then)).toBe("function");
      await rejects(pending);
    }
    expect(fake.records.length).toBe(0);
  });

  it("rejects a bad key or a non-https base URL before sending", () => {
    expect(() => new ZeroBounceWarmup("")).toThrow();
    // A key read from a file with its newline would be quoted, unredacted, by fetch.
    expect(() => new ZeroBounceWarmup("key-with-newline\n")).toThrow(/whitespace or control/);
    expect(() => new ZeroBounceWarmup(KEY, "http://warmup-api.zerobounce.net")).toThrow(/https/);
  });

  it("reports the HTTP status and a short message on failure", async () => {
    installFake({ status: 429, body: JSON.stringify({ detail: "Too many requests" }) });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.updateCustomEngagement({ cFrom: "a@example.com", replyPct: 10, importantPct: 10, clickPct: 5 }));
    expect(error.statusCode).toBe(429);
    expect(error.message).toBe("Too many requests");
  });

  it("reads a validation error list as field: message", async () => {
    installFake({
      status: 422,
      body: JSON.stringify({ detail: [{ loc: ["body", "from_address"], msg: "field required" }] }),
    });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.getSeeds());
    expect(error.message).toBe("from_address: field required");
    expect(error.statusCode).toBe(422);
  });

  it("keeps an HTML page and a huge body out of the message", async () => {
    installFake({
      status: 403,
      body: `<!DOCTYPE html><html><head><title>Access denied</title></head><body>${"x".repeat(50000)}</body></html>`,
      contentType: "text/html",
    });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.getSeeds());
    expect(error.message.length).toBeLessThan(200);
    expect(error.message).not.toContain("<html");
  });

  it("sends testSmtpConfiguration as exactly the documented JSON body", async () => {
    const fake = installFake({ body: '{"success":true}' });
    const c = new ZeroBounceWarmup(KEY);
    await c.testSmtpConfiguration({
      fromAddress: "a@example.com",
      username: "smtp-user",
      password: "smtp-pass",
      server: "smtp.example.com",
      port: 587,
    });
    const request = fake.only();
    expect([request.method, request.path]).toEqual(["POST", "/api/v1/warmup/test-smtp-configuration"]);
    expect(request.json).toEqual({
      from_address: "a@example.com",
      username: "smtp-user",
      password: "smtp-pass",
      server: "smtp.example.com",
      port: 587,
    });
  });

  it("masks every form of the SMTP credentials, JSON-escaped included, in errors", async () => {
    const password = 'smtp"pass/+%1';
    const username = 'smtp"user/+%2';
    const forms = (secret) => {
      const json = JSON.stringify(secret).slice(1, -1);
      return [secret, encodeURIComponent(secret), escape(secret), json, json.replace(/\//g, "\\/")];
    };
    const all = [...forms(password), ...forms(username)];
    // A server that quotes the JSON request body it received, and each form.
    global.fetch = async (url, init) =>
      httpResponse(500, `SMTP login failed: ${init.body} ${all.join(" ")}`, "text/plain");
    const c = new ZeroBounceWarmup(KEY);
    const error = await rejects(
      c.testSmtpConfiguration({ fromAddress: "a@example.com", username, password, server: "smtp.example.com", port: 587 })
    );
    const text = `${error.message}\n${error.stack}\n${inspect(error, { showHidden: true, depth: 5 })}`;
    expect(all.filter((form) => text.includes(form))).toEqual([]);
    expect(error.statusCode).toBe(500);
  });

  it("masks the SMTP password in each of its forms, URL-encoded JSON-escaped included, needing every one", async () => {
    // A space, a quote, "/", "+", "%", "&", "=", "<", ">", "'" and "\\": every
    // form below differs from every other.
    const password = `pw SeCrEt"/+%&=<>'\\z`;
    const json = JSON.stringify(password).slice(1, -1);
    const form = (text) => new URLSearchParams({ s: text }).toString().slice(2);
    const bases = {
      raw: password,
      json,
      "json, / as \\/": json.replace(/\//g, "\\/"),
      "json twice": JSON.stringify(json).slice(1, -1),
    };
    const forms = { "escape()": escape(password) };
    for (const [name, base] of Object.entries(bases)) {
      forms[name] = base;
      forms[`${name}, URL-encoded (%20)`] = encodeURIComponent(base);
      forms[`${name}, form-encoded (+)`] = form(base);
    }
    expect(new Set(Object.values(forms)).size).toBe(Object.keys(forms).length);
    const c = new ZeroBounceWarmup(KEY);
    const messageFor = async (echo) => {
      global.fetch = async () => httpResponse(500, `SMTP login failed: [${echo}]`, "text/plain");
      const error = await rejects(
        c.testSmtpConfiguration({ fromAddress: "a@example.com", username: "u", password, server: "s", port: 587 })
      );
      return error.message;
    };
    // Each form, echoed on its own, must come back exactly as "***" would: a
    // form left out leaks, or leaves the tail of a longer form behind.
    const expected = await messageFor("***");
    expect(expected).toContain("[***]");
    const got = {};
    for (const [name, echo] of Object.entries(forms)) got[name] = await messageFor(echo);
    expect(got).toEqual(Object.fromEntries(Object.keys(forms).map((name) => [name, expected])));
  });

  it("masks the SMTP password when a server echoes the request body URL-encoded or quoted as JSON", async () => {
    const password = `pw SeCrEt"/+%&=<>'\\z`;
    const echoes = {
      raw: (body) => body,
      "URL-encoded": (body) => encodeURIComponent(body),
      "form-encoded": (body) => new URLSearchParams({ body }).toString(),
      "quoted as JSON": (body) => JSON.stringify(body),
      "quoted as JSON, URL-encoded": (body) => encodeURIComponent(JSON.stringify(body)),
    };
    const c = new ZeroBounceWarmup(KEY);
    const leaked = {};
    for (const [name, echo] of Object.entries(echoes)) {
      global.fetch = async (url, init) => httpResponse(500, `Error ${echo(init.body)}`, "text/plain");
      const error = await rejects(
        c.testSmtpConfiguration({ fromAddress: "a@example.com", username: "u", password, server: "s", port: 587 })
      );
      leaked[name] = /SeCrEt/.test(`${error.message}\n${error.stack}`);
    }
    expect(leaked).toEqual(Object.fromEntries(Object.keys(echoes).map((name) => [name, false])));
  });

  it("masks the key and the SMTP credentials in errors", async () => {
    const password = "super-secret-password";
    const username = "smtp-user";
    installFake({
      status: 500,
      body: JSON.stringify({
        detail: `SMTP login failed for ${username} with ${password} and key ${KEY}`,
      }),
    });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(
      c.testSmtpConfiguration({
        fromAddress: "a@example.com",
        username,
        password,
        server: "smtp.example.com",
        port: 587,
      })
    );
    // LIVE: a failed SMTP login comes back as HTTP 500, an API bug.
    expect(error.statusCode).toBe(500);
    expect(error.message).not.toContain(password);
    expect(error.message).not.toContain(username);
    expect(error.message).not.toContain(KEY);
    expect(error.message).toContain("***");
  });

  it("keeps the key out of a network failure and its cause chain", async () => {
    global.fetch = async () => {
      throw new Error(`connect ECONNREFUSED https://warmup-api.zerobounce.net?API-Key=${KEY}`);
    };
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.getSeeds());
    expect(error.message).not.toContain(KEY);
    // The original, unredacted error must not survive as the cause.
    expect(error.cause).toBeUndefined();
  });

  it("lists every public method in allWarmupCalls, so the sweeps that use it miss none", () => {
    expect(allWarmupCalls(new ZeroBounceWarmup(KEY)).map(([name]) => name).sort()).toEqual(publicWarmupMethods());
  });

  it("refuses a non-https URL on every request path, not only in the constructor", async () => {
    const c = new ZeroBounceWarmup(KEY);
    // The constructor refuses an http base URL; this is the per-request check
    // behind it, reached by turning every URL the client holds into http.
    let changed = 0;
    for (const name of Object.getOwnPropertyNames(c)) {
      if (typeof c[name] === "string" && c[name].startsWith("https://")) {
        c[name] = `http://${c[name].slice("https://".length)}`;
        changed += 1;
      }
    }
    expect(changed).toBeGreaterThan(0);
    const fake = installFake();
    const refused = [];
    for (const [name, call] of allWarmupCalls(c)) {
      const error = await rejects(call());
      expect([name, error.message]).toEqual([name, "ZeroBounce: request URL must be an https:// URL"]);
      refused.push(name);
    }
    expect(fake.records).toEqual([]);
    expect(refused.sort()).toEqual(publicWarmupMethods());
  });

  it("gives every request on every public method the 120 s timeout signal", async () => {
    const marker = new AbortController().signal;
    const timeouts = [];
    const spy = jest.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      timeouts.push(ms);
      return marker;
    });
    const signals = [];
    global.fetch = async (url, init = {}) => {
      signals.push(init.signal);
      return httpResponse(200, "seed\na@example.com\n", "text/csv");
    };
    const covered = [];
    try {
      for (const [name, call] of allWarmupCalls(new ZeroBounceWarmup(KEY))) {
        signals.length = 0;
        timeouts.length = 0;
        // Only the request matters here; a CSV body is not every method's answer.
        await call().catch(() => {});
        expect({ name, marked: signals.map((signal) => signal === marker), timeouts }).toEqual({
          name,
          marked: [true],
          timeouts: [120000],
        });
        covered.push(name);
      }
    } finally {
      spy.mockRestore();
    }
    expect(covered.sort()).toEqual(publicWarmupMethods());
  });

  it("rejects a download answered with JSON instead of returning it as CSV text", async () => {
    const c = new ZeroBounceWarmup(KEY);
    for (const [name, call] of [
      ["downloadSeeds", () => c.downloadSeeds()],
      ["downloadStatistics", () => c.downloadStatistics("sender@example.com")],
    ]) {
      installFake({ body: JSON.stringify({ detail: "No statistics yet" }), contentType: "application/json; charset=utf-8" });
      const error = await rejects(call());
      expect([name, error.message, error.statusCode]).toEqual([name, "No statistics yet", 200]);
    }
  });

  it("rejects a JSON or empty download whatever its content type, with status 200", async () => {
    const c = new ZeroBounceWarmup(KEY);
    // Each answer is caught by one check only, so dropping any one check fails here.
    const answers = {
      "JSON object under text/csv": ["text/csv", '{"detail":"Not found"}'],
      "JSON array under text/csv": ["text/csv", '["No statistics yet"]'],
      "JSON object, no content type": [null, '{"error":"Not found"}'],
      "problem+json content type": ["application/problem+json", "seed\na@example.com\n"],
      "JSON content type": ["application/json", "seed\na@example.com\n"],
      "empty body": ["text/csv", ""],
      "blank body": ["text/csv", " \n"],
    };
    for (const [answer, [contentType, body]] of Object.entries(answers)) {
      for (const [name, call] of [
        ["downloadSeeds", () => c.downloadSeeds()],
        ["downloadStatistics", () => c.downloadStatistics("sender@example.com")],
      ]) {
        installFake({ body, contentType });
        let outcome;
        try {
          outcome = { resolved: await call() };
        } catch (error) {
          outcome = { status: error.statusCode, name: error.name };
        }
        expect({ answer, name, outcome }).toEqual({ answer, name, outcome: { status: 200, name: "ZBApiError" } });
      }
    }
  });

  it("rejects a download answered with an HTML page instead of returning it as CSV text", async () => {
    const c = new ZeroBounceWarmup(KEY);
    const page = `<!DOCTYPE html><html><head><title>Just a moment ${KEY}</title></head><body>${"x".repeat(5000)}</body></html>`;
    for (const [name, call] of [
      ["downloadSeeds", () => c.downloadSeeds()],
      ["downloadStatistics", () => c.downloadStatistics("sender@example.com")],
    ]) {
      // A proxy or challenge page, served as HTML or mislabelled as CSV.
      for (const contentType of ["text/html; charset=UTF-8", "text/csv"]) {
        installFake({ body: page, contentType });
        const error = await rejects(call());
        expect([name, contentType, error.message, error.statusCode]).toEqual([
          name,
          contentType,
          "ZeroBounce returned an HTML error page instead of an API response.",
          200,
        ]);
      }
    }
  });

  it("keeps every form of the key out of every error, on every public method", async () => {
    // A key whose URL-encoded, escape()d and JSON-escaped forms all differ
    // from the raw one and from each other.
    const key = 'warmup"secret/+%1';
    const json = JSON.stringify(key).slice(1, -1);
    const forms = [key, encodeURIComponent(key), escape(key), json, json.replace(/\//g, "\\/")];
    expect(new Set(forms).size).toBe(forms.length);
    const detail = `${forms.join(" ")} https://warmup-api.zerobounce.net/api/v1/warmup?API-Key=${encodeURIComponent(key)}`;
    // [status, content type, body], or a body read that fails.
    const echoes = {
      "2xx error JSON": [200, "application/json", JSON.stringify({ error: `Invalid API key ${detail}` })],
      "2xx success false": [200, "application/json", JSON.stringify({ success: false, message: `rejected ${detail}` })],
      "2xx not JSON": [200, "text/plain", `rejected ${detail}`],
      "2xx HTML": [200, "text/html", `<html><head><title>${detail}</title></head></html>`],
      "4xx JSON": [400, "application/json", JSON.stringify({ error: `rejected ${detail}` })],
      "4xx text": [400, "text/plain", `Bad Request: ${detail}`],
      "body read": null,
    };
    // Which answers each kind of method must reject; on the others a JSON
    // method or a download may resolve with the body as its result.
    const downloads = publicWarmupMethods().filter((name) => name.startsWith("download"));
    expect(downloads).toEqual(["downloadSeeds", "downloadStatistics"]);
    const mustReject = (echo, name) =>
      echo.startsWith("4xx") ||
      echo === "body read" ||
      echo === "2xx HTML" ||
      (downloads.includes(name) ? echo.startsWith("2xx error") || echo.startsWith("2xx success") : echo === "2xx not JSON");
    const covered = new Set();
    for (const [echo, answer] of Object.entries(echoes)) {
      for (const [name, call] of allWarmupCalls(new ZeroBounceWarmup(key))) {
        global.fetch = async () => {
          if (!answer) {
            return {
              status: 200,
              headers: { get: () => "application/json" },
              text: async () => {
                throw new TypeError(`terminated: ${detail}`);
              },
            };
          }
          return httpResponse(answer[0], answer[2], answer[1]);
        };
        let text = null;
        try {
          await call();
        } catch (error) {
          text = `${error.message}\n${error.stack}\n${inspect(error, { showHidden: true, depth: 5 })}`;
        }
        const leaked = text !== null && forms.some((form) => text.includes(form));
        expect({ name, echo, rejected: text !== null || !mustReject(echo, name), leaked }).toEqual({
          name,
          echo,
          rejected: true,
          leaked: false,
        });
        covered.add(name);
      }
    }
    expect([...covered].sort()).toEqual(publicWarmupMethods());
  });

  it("rejects a JSON answer served as text/html on every JSON method, though the body parses", async () => {
    const c = new ZeroBounceWarmup(KEY);
    const calls = allWarmupCalls(c).filter(([name]) => !name.startsWith("download"));
    expect(calls.length).toBe(publicWarmupMethods().length - 2);
    const outcome = {};
    for (const [name, call] of calls) {
      // The same body under a JSON content type is a result, so only the
      // content type tells the two apart.
      installFake({ body: '{"a":1}', contentType: "application/json" });
      const json = await call();
      installFake({ body: '{"a":1}', contentType: "text/html; charset=UTF-8" });
      let html;
      try {
        html = await call();
      } catch (error) {
        html = [error.name, error.statusCode];
      }
      outcome[name] = [json, html];
    }
    expect(outcome).toEqual(Object.fromEntries(calls.map(([name]) => [name, [{ a: 1 }, ["ZBApiError", 200]]])));
  });

  it("rejects a download served as text/html even when the body does not look like a page", async () => {
    const c = new ZeroBounceWarmup(KEY);
    for (const [name, call] of [
      ["downloadSeeds", () => c.downloadSeeds()],
      ["downloadStatistics", () => c.downloadStatistics("sender@example.com")],
    ]) {
      // A bare fragment: no doctype, <html>, <head> or <body>, so only the
      // content type tells it apart from CSV text.
      installFake({ body: "<h1>403 Forbidden</h1>", contentType: "text/html; charset=UTF-8" });
      const error = await rejects(call());
      expect([name, error.name, error.statusCode]).toEqual([name, "ZBApiError", 200]);
    }
  });

  it("sends every documented zb_managed field, and accepts a fractional timezone_offset", async () => {
    const fake = installFake();
    const c = new ZeroBounceWarmup(KEY);
    const emailContent = {
      company_name: "Example Inc",
      company_website: "https://example.com",
      company_description: "We send newsletters.",
      types_of_emails: ["transactional", "newsletter", "marketing"],
      example_email: "Hello from Example Inc.",
    };
    const managedSending = {
      weekdays_only: true,
      timezone: "Asia/Kolkata",
      timezone_offset: 5.5,
      warmup_start_date: "2026-12-01",
    };

    await c.addSendingAccount({ fromAddress: "sender@example.com", onboardingModel: "zb_managed", emailContent, managedSending });
    expect(fake.only().json).toEqual({
      from_address: "sender@example.com",
      onboarding_model: "zb_managed",
      email_content: emailContent,
      managed_sending: managedSending,
    });

    // -11 to 14, fractional offsets included.
    for (const offset of [5.5, 3.0, -11, 14, -9.5, 0]) {
      fake.records.length = 0;
      await c.addSendingAccount({ fromAddress: "sender@example.com", onboardingModel: "zb_managed", managedSending: { timezone_offset: offset } });
      expect(fake.only().json.managed_sending).toEqual({ timezone_offset: offset });
    }
    fake.records.length = 0;
    for (const offset of [-11.5, 14.5, Number.NaN, Infinity, "5.5", true]) {
      const error = await rejects(
        c.addSendingAccount({ fromAddress: "sender@example.com", onboardingModel: "zb_managed", managedSending: { timezone_offset: offset } })
      );
      expect([offset, error.message]).toEqual([offset, "ZeroBounce: timezone_offset parameter is invalid. Must be -11 to 14."]);
    }
    expect(fake.records).toHaveLength(0);
  });

  it("does not follow a redirect", async () => {
    installFake({ status: 302, body: "" });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.getSeeds());
    expect(error.statusCode).toBe(302);
    expect(error.message).toContain("redirect");
  });
});
