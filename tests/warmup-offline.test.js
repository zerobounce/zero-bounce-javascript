/**
 * Offline suite for the Warmup API client. Replaces global fetch; no network
 * and no real key.
 */
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

    // A zb_managed account takes no engagement rule: say so rather than drop it.
    fake.records.length = 0;
    expect(() =>
      c.addSendingAccount({
        fromAddress: "sender@example.com",
        onboardingModel: "zb_managed",
        engagementRuleId: 2,
      })
    ).toThrow("ZeroBounce: engagement_rule_id is for self_managed.");
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

    for (const call of bad) {
      expect(call).toThrow();
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

  it("does not follow a redirect", async () => {
    installFake({ status: 302, body: "" });
    const c = new ZeroBounceWarmup(KEY);

    const error = await rejects(c.getSeeds());
    expect(error.statusCode).toBe(302);
    expect(error.message).toContain("redirect");
  });
});
