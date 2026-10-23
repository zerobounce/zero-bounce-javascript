/**
 * Offline API suite. Replaces global fetch; no network and no real API key.
 */
import { ZeroBounceSDK } from "../src/zero-bounce.js";

const HTML_PAGE = (() => {
  const head =
    '<!DOCTYPE html><html lang="en-US"><head><title>Access denied | zerobounce.net | Zero Bounce</title></head><body>';
  return `${head}${"<p>blocked</p>".repeat(20000)}</body></html>`;
})();

const CF_JSON = JSON.stringify({
  type: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1020/",
  title: "Error 1020: Access denied",
  status: 403,
  detail: "The request was blocked by a Cloudflare firewall rule configured by the site owner.",
  error_code: 1020,
  cloudflare_error: true,
  what_you_should_do: "Do not retry. This block is intentional.",
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenJson(value) {
  const fields = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return fields;
  for (const [key, item] of Object.entries(value)) {
    if (item == null) fields[key] = "null";
    else if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      fields[key] = String(item);
    } else {
      fields[key] = JSON.stringify(item);
    }
  }
  return fields;
}

async function readBody(body) {
  if (body == null) return { fields: {}, json: null };
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const json = JSON.parse(trimmed);
      return { fields: flattenJson(json), json };
    }
    const params = new URLSearchParams(body);
    return { fields: Object.fromEntries(params.entries()), json: null };
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return { fields: Object.fromEntries(body.entries()), json: null };
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const fields = {};
    for (const [key, value] of body.entries()) {
      fields[key] = typeof value === "string" ? value : "<file>";
    }
    return { fields, json: null };
  }
  return { fields: {}, json: null };
}

function httpResponse(status, body, contentType) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type" ? contentType : null;
      },
    },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function successBody(request) {
  const key = JSON.stringify(request.apiKey);
  const path = request.path;
  const ends = (suffix) => path.endsWith(suffix);
  if (path.includes("getfile")) {
    return {
      status: 200,
      contentType: "text/csv",
      body: `email\n${request.apiKey}@example.com\n`,
    };
  }
  if (path.includes("validatebatch")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"email_batch":[{"address":${key},"status":"valid"}],"errors":[],"echo_api_key":${key}}`,
    };
  }
  if (ends("/validate")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"address":"person@example.com","status":"valid","echo_api_key":${key}}`,
    };
  }
  if (ends("/scoring")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"email":"person@example.com","score":10,"echo_api_key":${key}}`,
    };
  }
  if (path.includes("getcredits")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"Credits":"7","echo_api_key":${key}}`,
    };
  }
  if (path.includes("getapiusage")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"total":1,"echo_api_key":${key}}`,
    };
  }
  if (ends("/activity")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"found":true,"active_in_days":"3","echo_api_key":${key}}`,
    };
  }
  if (path.includes("guessformat")) {
    return {
      status: 200,
      contentType: "application/json",
      body: `{"email":"ada@example.com","domain":"example.com","echo_api_key":${key},"other_domain_formats":[]}`,
    };
  }
  return {
    status: 200,
    contentType: "application/json",
    body: `{"success":true,"message":"ok","file_id":${key},"echo_api_key":${key}}`,
  };
}

function answer(request) {
  const key = request.apiKey;
  if (key.startsWith("html-403-") || key.startsWith("html-200-")) {
    return httpResponse(key.startsWith("html-403-") ? 403 : 200, HTML_PAGE, "text/html; charset=UTF-8");
  }
  if (key.startsWith("empty-")) {
    return httpResponse(200, "", "application/json");
  }
  if (key.startsWith("malformed-")) {
    return httpResponse(200, `<<<not-json>>>${"x".repeat(5000)}`, "application/json");
  }
  if (key.startsWith("cf-json-")) {
    return httpResponse(403, CF_JSON, "application/json");
  }
  if (key.startsWith("double-error-")) {
    return httpResponse(400, "Error: Error: api_key is invalid", "text/plain");
  }
  if (key.startsWith("ipt-detail-")) {
    // The Inbox Placement Tester (Django REST framework) reports errors as "detail".
    return httpResponse(
      404,
      JSON.stringify({ detail: "Inbox placement test not found." }),
      "application/json"
    );
  }
  if (key.startsWith("invalid-key-")) {
    return httpResponse(200, JSON.stringify({ error: "Invalid API Key" }), "application/json");
  }
  if (key.startsWith("no-credits-")) {
    return httpResponse(
      200,
      JSON.stringify({ error: "Your account ran out of credits" }),
      "application/json"
    );
  }
  if (pathIsBatch(request) && key.startsWith("batch-account-")) {
    return httpResponse(
      200,
      JSON.stringify({
        email_batch: [],
        errors: [{ email_address: "all", error: "Invalid API Key or your account ran out of credits" }],
      }),
      "application/json"
    );
  }
  if (pathIsBatch(request) && key.startsWith("batch-partial-")) {
    return httpResponse(
      200,
      JSON.stringify({
        email_batch: [{ address: "good@example.com", status: "valid" }],
        errors: [{ email_address: "bad@", error: "Invalid email address" }],
      }),
      "application/json"
    );
  }
  if (key.startsWith("score-item-")) {
    return httpResponse(200, JSON.stringify({ error: "invalid email" }), "application/json");
  }
  const success = successBody(request);
  return httpResponse(success.status, success.body, success.contentType);
}

function pathIsBatch(request) {
  return request.path.includes("validatebatch");
}

function installFakeFetch() {
  const records = [];
  const previous = global.fetch;
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const body = await readBody(init.body);
    const query = Object.fromEntries(parsed.searchParams.entries());
    const recorded = {
      method: String(init.method || "GET").toUpperCase(),
      host: parsed.host,
      path: parsed.pathname,
      url: String(url),
      query,
      body: body.fields,
      json: body.json,
      fields: { ...query, ...body.fields },
      apiKey: body.fields.api_key || query.api_key || "",
      redirect: init.redirect,
    };
    records.push(recorded);
    await delay(Math.floor(Math.random() * 21));
    return answer(recorded);
  };
  return {
    records,
    restore() {
      global.fetch = previous;
    },
    only() {
      expect(records).toHaveLength(1);
      return records[0];
    },
  };
}

function expectShort(message) {
  expect(typeof message).toBe("string");
  expect(message.length).toBeLessThan(500);
  expect(message).not.toMatch(/<html|<!DOCTYPE|<p>blocked/i);
  expect(message).not.toMatch(/Error:\s*Error:/);
  expect(message).not.toMatch(/\[Error\]:/);
  expect(message.startsWith("Error:")).toBe(false);
  expect(message).not.toMatch(/SyntaxError|Unexpected token|json\.exception/i);
  expect(message).not.toContain("<<<not-json>>>");
}

async function expectRejected(promise) {
  let thrown = null;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expectShort(thrown.message);
  return thrown;
}

function client(key, base = ZeroBounceSDK.ApiURL.DEFAULT_API_URL) {
  const sdk = new ZeroBounceSDK();
  sdk.init(key, base);
  return sdk;
}

describe("offline API", () => {
  let fake;
  const file = new File(["email\n"], "emails.csv", { type: "text/csv" });

  beforeEach(() => {
    fake = installFakeFetch();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    fake.restore();
  });

  function callAll(sdk) {
    const id = "file-1";
    return [
      ["getCredits", () => sdk.getCredits(), "GET", "api.zerobounce.net", "/v2/getcredits"],
      ["validateEmail", () => sdk.validateEmail("a@example.com"), "GET", "api.zerobounce.net", "/v2/validate"],
      ["getApiUsage", () => sdk.getApiUsage("2020-01-01", "2020-01-31"), "GET", "api.zerobounce.net", "/v2/getapiusage"],
      ["validateBatch", () => sdk.validateBatch([{ email_address: "a@example.com" }]), "POST", "api.zerobounce.net", "/v2/validatebatch"],
      ["getEmailActivity", () => sdk.getEmailActivity("a@example.com"), "GET", "api.zerobounce.net", "/v2/activity"],
      ["scoreEmail", () => sdk.scoreEmail("a@example.com"), "GET", "api.zerobounce.net", "/v2/scoring"],
      ["sendFile", () => sdk.sendFile({ file, email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/sendfile"],
      ["sendFileStream", () => sdk.sendFileStream(file, "emails.csv", { email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/sendfile"],
      ["sendScoringFile", () => sdk.sendScoringFile({ file, email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/scoring/sendfile"],
      ["sendScoringFileStream", () => sdk.sendScoringFileStream(file, "emails.csv", { email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/scoring/sendfile"],
      ["getFileStatus", () => sdk.getFileStatus(id), "GET", "bulkapi.zerobounce.net", "/v2/filestatus"],
      ["getScoringFileStatus", () => sdk.getScoringFileStatus(id), "GET", "bulkapi.zerobounce.net", "/v2/scoring/filestatus"],
      ["getFile", () => sdk.getFile(id), "GET", "bulkapi.zerobounce.net", "/v2/getfile"],
      ["getScoringFile", () => sdk.getScoringFile(id), "GET", "bulkapi.zerobounce.net", "/v2/scoring/getfile"],
      ["deleteFile", () => sdk.deleteFile(id), "GET", "bulkapi.zerobounce.net", "/v2/deletefile"],
      ["deleteScoringFile", () => sdk.deleteScoringFile(id), "GET", "bulkapi.zerobounce.net", "/v2/scoring/deletefile"],
      ["sendEmailFinderFile", () => sdk.sendEmailFinderFile({ file, domain_column: 1 }), "POST", "bulkapi.zerobounce.net", "/email-finder/sendfile"],
      ["sendEmailFinderFileStream", () => sdk.sendEmailFinderFileStream(file, "emails.csv", { domain_column: 1 }), "POST", "bulkapi.zerobounce.net", "/email-finder/sendfile"],
      ["getEmailFinderFileStatus", () => sdk.getEmailFinderFileStatus(id), "GET", "bulkapi.zerobounce.net", "/email-finder/filestatus"],
      ["getEmailFinderFile", () => sdk.getEmailFinderFile(id), "GET", "bulkapi.zerobounce.net", "/email-finder/getfile"],
      ["deleteEmailFinderFile", () => sdk.deleteEmailFinderFile(id), "GET", "bulkapi.zerobounce.net", "/email-finder/deletefile"],
      ["sendDomainSearchFile", () => sdk.sendDomainSearchFile({ file, domain_column: 1 }), "POST", "bulkapi.zerobounce.net", "/domain-search/sendfile"],
      ["sendDomainSearchFileStream", () => sdk.sendDomainSearchFileStream(file, "emails.csv", { domain_column: 1 }), "POST", "bulkapi.zerobounce.net", "/domain-search/sendfile"],
      ["getDomainSearchFileStatus", () => sdk.getDomainSearchFileStatus(id), "GET", "bulkapi.zerobounce.net", "/domain-search/filestatus"],
      ["getDomainSearchFile", () => sdk.getDomainSearchFile(id), "GET", "bulkapi.zerobounce.net", "/domain-search/getfile"],
      ["deleteDomainSearchFile", () => sdk.deleteDomainSearchFile(id), "GET", "bulkapi.zerobounce.net", "/domain-search/deletefile"],
      ["sendListEvaluatorFile", () => sdk.sendListEvaluatorFile({ file, email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/listevaluator/"],
      ["sendListEvaluatorFileStream", () => sdk.sendListEvaluatorFileStream(file, "emails.csv", { email_address_column: 1 }), "POST", "bulkapi.zerobounce.net", "/v2/listevaluator/"],
      ["getListEvaluatorResult", () => sdk.getListEvaluatorResult(id), "GET", "bulkapi.zerobounce.net", "/v2/listevaluator/file-1/"],
      ["listS3files", () => sdk.listS3files(), "GET", "bulkapi.zerobounce.net", "/listS3files"],
      ["validateS3file", () => sdk.validateS3file({ file_name: "f.csv" }), "POST", "bulkapi.zerobounce.net", "/validateS3file"],
      ["scoreS3file", () => sdk.scoreS3file({ file_name: "f.csv" }), "POST", "bulkapi.zerobounce.net", "/scoreS3file"],
      ["exportS3file", () => sdk.exportS3file({ file_id: id, export_bucket: "bucket" }), "POST", "bulkapi.zerobounce.net", "/exportS3file"],
      ["emailFinderS3file", () => sdk.emailFinderS3file({ file_name: "f.csv", has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/emailFinderS3file"],
      ["domainSearchS3file", () => sdk.domainSearchS3file({ file_name: "f.csv", has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/domainSearchS3file"],
      ["validateSFTPfile", () => sdk.validateSFTPfile({ has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/validateSFTPfile"],
      ["scoreSFTPfile", () => sdk.scoreSFTPfile({ file_name: "f.csv", has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/scoreSFTPfile"],
      ["emailFinderSFTPfile", () => sdk.emailFinderSFTPfile({ file_name: "f.csv", has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/emailFinderSFTPfile"],
      ["domainSearchSFTPfile", () => sdk.domainSearchSFTPfile({ file_name: "f.csv", has_header_row: true }), "POST", "bulkapi.zerobounce.net", "/domainSearchSFTPfile"],
      ["exportSFTPfile", () => sdk.exportSFTPfile({ file_id: "fid" }), "POST", "bulkapi.zerobounce.net", "/exportSFTPfile"],
      ["getInboxPlacementProviders", () => sdk.getInboxPlacementProviders(), "GET", "bulkapi.zerobounce.net", "/api/ipt/providers"],
      ["getInboxPlacementTestTypes", () => sdk.getInboxPlacementTestTypes(), "GET", "bulkapi.zerobounce.net", "/api/ipt/test-types"],
      ["createInboxPlacementTest", () => sdk.createInboxPlacementTest({ name: "t" }), "POST", "bulkapi.zerobounce.net", "/api/ipt/test"],
      ["getInboxPlacementTest", () => sdk.getInboxPlacementTest(id), "GET", "bulkapi.zerobounce.net", "/api/ipt/test/file-1"],
      ["listInboxPlacementTests", () => sdk.listInboxPlacementTests(), "GET", "bulkapi.zerobounce.net", "/api/ipt/tests"],
      ["deleteInboxPlacementTest", () => sdk.deleteInboxPlacementTest(id), "DELETE", "bulkapi.zerobounce.net", "/api/ipt/test/file-1"],
      ["getInboxPlacementWebhook", () => sdk.getInboxPlacementWebhook(), "GET", "bulkapi.zerobounce.net", "/api/ipt/webhook"],
      ["setInboxPlacementWebhook", () => sdk.setInboxPlacementWebhook("https://example.com/hook"), "PUT", "bulkapi.zerobounce.net", "/api/ipt/webhook"],
      ["sendEvaluatedFile", () => sdk.sendEvaluatedFile({ file }), "POST", "bulkapi.zerobounce.net", "/v2/send-evaluated-file/"],
      ["addFilter", () => sdk.addFilter({ rule: "exclude", target: "domain", value: "spam.com" }), "POST", "api.zerobounce.net", "/v2/filters/add"],
      ["listFilters", () => sdk.listFilters(), "GET", "api.zerobounce.net", "/v2/filters/list"],
      ["deleteFilter", () => sdk.deleteFilter({ rule: "exclude", target: "domain", value: "spam.com" }), "POST", "api.zerobounce.net", "/v2/filters/delete"],
      ["findEmailByDomain", () => sdk.findEmailByDomain({ domain: "example.com", first_name: "Ada" }), "GET", "api.zerobounce.net", "/v2/guessformat"],
      ["findEmailByCompanyName", () => sdk.findEmailByCompanyName({ company_name: "Ada Inc", first_name: "Ada" }), "GET", "api.zerobounce.net", "/v2/guessformat"],
      ["findEmailFormatByDomain", () => sdk.findEmailFormatByDomain({ domain: "example.com" }), "GET", "api.zerobounce.net", "/v2/guessformat"],
      ["findEmailFormatByCompanyName", () => sdk.findEmailFormatByCompanyName({ company_name: "Ada Inc" }), "GET", "api.zerobounce.net", "/v2/guessformat"],
      ["guessFormat", () => sdk.guessFormat({ domain: "example.com" }), "GET", "api.zerobounce.net", "/v2/guessformat"],
    ];
  }

  it("calls the right host, path, and method for every public method", async () => {
    const sdk = client("parity-key");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    for (const [name, run, method, host, path] of callAll(sdk)) {
      fake.records.length = 0;
      await run();
      expect({ name, method: fake.records[0].method, host: fake.records[0].host, path: fake.records[0].path }).toEqual({
        name,
        method,
        host,
        path,
      });
      expect(fake.records[0].apiKey).toBe("parity-key");
    }
  });

  it("uses the regional host selected in init", async () => {
    const usa = client("parity-key", ZeroBounceSDK.ApiURL.USA_API_URL);
    await usa.getCredits();
    expect(fake.only().host).toBe("api-us.zerobounce.net");
    fake.records.length = 0;
    const eu = client("parity-key", ZeroBounceSDK.ApiURL.EU_API_URL);
    await eu.getCredits();
    expect(fake.only().host).toBe("api-eu.zerobounce.net");
  });

  it("does not follow redirects", async () => {
    const sdk = client("parity-key");
    await sdk.getCredits();
    expect(fake.only().redirect).toBe("error");
  });

  it("percent-encodes query values", async () => {
    const sdk = client("key with space");
    await sdk.validateEmail("a&b=c@example.com");
    const request = fake.only();
    expect(request.url).not.toContain("a&b=c@example.com");
    expect(request.url).not.toContain("key with space");
    expect(request.fields.email).toBe("a&b=c@example.com");
    expect(request.fields.api_key).toBe("key with space");
  });

  it("omits unset validate options and sends false and enums as the API expects", async () => {
    const sdk = client("parity-key");
    await sdk.validateEmail("a@example.com");
    let request = fake.only();
    expect(request.fields.timeout).toBeUndefined();
    expect(request.fields.activity_data).toBeUndefined();
    expect(request.fields.verify_plus).toBeUndefined();
    expect(request.fields.ip_address).toBeUndefined();

    fake.records.length = 0;
    await sdk.validateEmail("a@example.com", {
      ip_address: "127.0.0.1",
      timeout: 30,
      activityData: false,
      verifyPlus: true,
    });
    request = fake.only();
    expect(request.fields.ip_address).toBe("127.0.0.1");
    expect(request.fields.timeout).toBe("30");
    expect(request.fields.activity_data).toBe("false");
    expect(request.fields.verify_plus).toBe("true");

    fake.records.length = 0;
    await sdk.validateEmail("a@example.com", { method: "POST", verifyPlus: false });
    request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.query.api_key).toBeUndefined();
    expect(request.body.api_key).toBe("parity-key");
    expect(request.body.verify_plus).toBe("false");
    expect(request.body.activity_data).toBeUndefined();
  });

  it("posts validateBatch to the JSON API and keeps partial errors on the result", async () => {
    const sdk = client("batch-partial-key");
    const batch = [{ email_address: "good@example.com", ip_address: "127.0.0.1" }];
    const result = await sdk.validateBatch(batch, { activityData: false, verifyPlus: true });
    const request = fake.only();
    expect(request.host).toBe("api.zerobounce.net");
    expect(request.path).toBe("/v2/validatebatch");
    expect(request.json.activity_data).toBe(false);
    expect(request.json.verify_plus).toBe(true);
    expect(request.json.timeout).toBeUndefined();
    expect(request.json.email_batch).toEqual(batch);
    expect(result.email_batch).toEqual([{ address: "good@example.com", status: "valid" }]);
    expect(result.errors).toEqual([{ email_address: "bad@", error: "Invalid email address" }]);
  });

  it("rejects a validateBatch account-level error", async () => {
    const sdk = client("batch-account-key");
    const error = await expectRejected(
      sdk.validateBatch([{ email_address: "a@example.com" }])
    );
    expect(error.message).toBe("Invalid API Key or your account ran out of credits");
  });

  it("rejects account-level invalid key and no-credits responses", async () => {
    const invalid = await expectRejected(client("invalid-key-1").getCredits());
    expect(invalid.message).toBe("Invalid API Key");
    fake.records.length = 0;
    const credits = await expectRejected(client("no-credits-1").getCredits());
    expect(credits.message).toBe("Your account ran out of credits");
  });

  it("leaves a per-email scoring error on the resolved result", async () => {
    const sdk = client("score-item-1");
    await expect(sdk.scoreEmail("not-an-email")).resolves.toEqual({ error: "invalid email" });
  });

  it("sends scoreEmail and listFilters as form posts when method is POST", async () => {
    const sdk = client("parity-key");
    await sdk.scoreEmail("a@example.com", { method: "POST" });
    let request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/v2/scoring");
    expect(request.query.api_key).toBeUndefined();
    expect(request.body).toEqual({ api_key: "parity-key", email: "a@example.com" });

    fake.records.length = 0;
    await sdk.listFilters({ method: "POST" });
    request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/v2/filters/list");
    expect(request.body.api_key).toBe("parity-key");
    expect(request.query.api_key).toBeUndefined();
  });

  it("sends bulk booleans as true or false, including an explicit false header row", async () => {
    const sdk = client("parity-key");
    await sdk.sendFile({
      file,
      email_address_column: 1,
      has_header_row: false,
      remove_duplicate: true,
      allowPhase2: false,
    });
    let request = fake.only();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.remove_duplicate).toBe("true");
    expect(request.fields.allow_phase_2).toBe("false");

    fake.records.length = 0;
    await sdk.sendFile({ file, email_address_column: 1 });
    request = fake.only();
    expect(request.fields.allow_phase_2).toBeUndefined();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.remove_duplicate).toBe("false");

    fake.records.length = 0;
    await sdk.sendScoringFile({ file, email_address_column: 1, has_header_row: false, remove_duplicate: false });
    request = fake.only();
    expect(request.fields.allow_phase_2).toBeUndefined();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.remove_duplicate).toBe("false");
    expect(request.fields.first_name_column).toBeUndefined();

    fake.records.length = 0;
    await sdk.sendEmailFinderFile({ file, domain_column: 2, has_header_row: false, first_name_column: 0 });
    request = fake.only();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.domain_column).toBe("2");
    expect(request.fields.first_name_column).toBeUndefined();

    fake.records.length = 0;
    await sdk.sendDomainSearchFile({ file, domain_column: 1, has_header_row: false });
    expect(fake.only().fields.has_header_row).toBe("false");
  });

  it("sends column index 0 for required columns and leaves optional 0 columns out", async () => {
    const sdk = client("parity-key");
    await sdk.sendFile({
      file,
      email_address_column: 0,
      first_name_column: 0,
      last_name_column: 3,
    });
    let request = fake.only();
    expect(request.fields.email_address_column).toBe("0");
    expect(request.fields.first_name_column).toBeUndefined();
    expect(request.fields.last_name_column).toBe("3");

    fake.records.length = 0;
    await sdk.sendEmailFinderFile({ file, domain_column: 0 });
    expect(fake.only().fields.domain_column).toBe("0");

    fake.records.length = 0;
    await sdk.sendListEvaluatorFile({ file, email_address_column: 0 });
    expect(fake.only().fields.email_address_column).toBe("0");
    fake.records.length = 0;
    await sdk.validateS3file({
      file_name: "f.csv",
      email_address_column: 0,
      first_name_column: 0,
      has_header_row: false,
      remove_duplicate: false,
    });
    request = fake.only();
    expect(request.fields.email_address_column).toBe("0");
    expect(request.fields.first_name_column).toBeUndefined();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.remove_duplicate).toBe("false");
    expect(request.fields.allow_phase_2).toBeUndefined();

  });

  it("sends getFile download_type and activity_data only when set, and not for scoring", async () => {
    const sdk = client("parity-key");
    await sdk.getFile("file-1", {
      downloadType: ZeroBounceSDK.ZBDownloadType.PHASE_1,
      activityData: false,
    });
    let request = fake.only();
    expect(request.fields.download_type).toBe("phase_1");
    expect(request.fields.activity_data).toBe("false");

    fake.records.length = 0;
    await sdk.getFile("file-1");
    request = fake.only();
    expect(request.fields.download_type).toBeUndefined();
    expect(request.fields.activity_data).toBeUndefined();

    fake.records.length = 0;
    await sdk.getScoringFile("file-1", {
      downloadType: ZeroBounceSDK.ZBDownloadType.COMBINED,
      activityData: true,
    });
    request = fake.only();
    expect(request.fields.download_type).toBe("combined");
    expect(request.fields.activity_data).toBeUndefined();
  });

  it("omits unset email-finder names and does not send the string null", async () => {
    const sdk = client("parity-key");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await sdk.findEmailByDomain({ domain: "example.com", first_name: "Ada" });
    let request = fake.only();
    expect(request.fields.domain).toBe("example.com");
    expect(request.fields.first_name).toBe("Ada");
    expect(request.fields.middle_name).toBeUndefined();
    expect(request.fields.last_name).toBeUndefined();
    expect(request.fields.company_name).toBeUndefined();
    expect(request.url).not.toContain("middle_name");
    expect(request.url).not.toContain("=null");

    fake.records.length = 0;
    await sdk.findEmailByCompanyName({ company_name: "Ada Inc", first_name: "Ada", last_name: "Lovelace" });
    request = fake.only();
    expect(request.fields.company_name).toBe("Ada Inc");
    expect(request.fields.last_name).toBe("Lovelace");
    expect(request.fields.domain).toBeUndefined();
    expect(request.fields.middle_name).toBeUndefined();

    fake.records.length = 0;
    await sdk.guessFormat({ domain: "example.com" });
    request = fake.only();
    expect(request.fields.domain).toBe("example.com");
    expect(request.fields.first_name).toBeUndefined();
    expect(request.fields.middle_name).toBeUndefined();
    expect(request.fields.last_name).toBeUndefined();
  });

  it("omits unset listS3files and filter fields", async () => {
    const sdk = client("parity-key");
    await sdk.listS3files();
    expect(fake.only().fields.bucket).toBeUndefined();
    expect(fake.records[0].fields.search).toBeUndefined();
    fake.records.length = 0;
    await sdk.listS3files({ bucket: "inbox", search: "a.csv" });
    expect(fake.only().fields.bucket).toBe("inbox");
    expect(fake.records[0].fields.search).toBe("a.csv");
    fake.records.length = 0;
    await sdk.addFilter({ rule: "include", target: "email", value: "a@example.com" });
    expect(fake.only().body).toEqual({
      api_key: "parity-key",
      rule: "include",
      target: "email",
      value: "a@example.com",
    });
  });

  it("rejects missing and invalid arguments before any request", async () => {
    const bare = new ZeroBounceSDK();
    await expectRejected(bare.getCredits());
    expect(fake.records).toHaveLength(0);

    expect(() => bare.init("")).toThrow(/api key/i);
    expect(() => bare.init("   ")).toThrow(/api key/i);
    expect(() => bare.init("key", "http://evil.example/v2")).toThrow(/https/i);
    expect(fake.records).toHaveLength(0);

    const sdk = client("parity-key");
    await expectRejected(sdk.validateEmail(""));
    await expectRejected(sdk.validateEmail("a@example.com", { timeout: 0 }));
    await expectRejected(sdk.validateEmail("a@example.com", { timeout: 2 }));
    await expectRejected(sdk.validateEmail("a@example.com", { timeout: 61 }));
    await expectRejected(sdk.validateBatch(null));
    await expectRejected(sdk.validateBatch([{ email_address: "a@example.com" }], { timeout: 0 }));
    await expectRejected(sdk.validateBatch([{ email_address: "a@example.com" }], { timeout: 9 }));
    await expectRejected(sdk.getApiUsage("", "2020-01-31"));
    await expectRejected(sdk.scoreEmail(""));
    await expectRejected(sdk.sendFile({ email_address_column: 1 }));
    await expectRejected(sdk.sendFile({ file }));
    await expectRejected(sdk.findEmailByDomain({ first_name: "Ada" }));
    await expectRejected(sdk.findEmailByDomain({ domain: "example.com" }));
    await expectRejected(sdk.addFilter({ rule: "", target: "domain", value: "spam.com" }));
    await expectRejected(sdk.getFile(""));
    await expectRejected(sdk.exportS3file({ file_id: "id" }));
    await expectRejected(sdk.emailFinderS3file({ has_header_row: true }));
    await expectRejected(sdk.scoreSFTPfile({ file_name: "  ", has_header_row: true }));
    await expectRejected(sdk.domainSearchSFTPfile({ file_name: "f.csv" }));
    await expectRejected(sdk.exportSFTPfile({}));
    await expectRejected(sdk.exportSFTPfile({ file_id: "fid", export_path: "  " }));
    await expectRejected(sdk.validateEmail("a@example.com", { callbackUrl: "https://example.com/cb" }));
    await expectRejected(
      sdk.validateEmail("a@example.com", { greylistProcessing: true, callbackUrl: "   " })
    );
    await expectRejected(sdk.createInboxPlacementTest({ name: "" }));
    await expectRejected(sdk.createInboxPlacementTest({ name: "x".repeat(65) }));
    await expectRejected(sdk.createInboxPlacementTest({ name: "t", testType: 4 }));
    await expectRejected(sdk.createInboxPlacementTest({ name: "t", testType: 1 }));
    await expectRejected(
      sdk.createInboxPlacementTest({ name: "t", providers: [{ maxSeeds: 2 }] })
    );
    await expectRejected(
      sdk.createInboxPlacementTest({ name: "t", providers: [{ id: 1, maxSeeds: 0 }] })
    );
    await expectRejected(sdk.listInboxPlacementTests({ status: "queued" }));
    await expectRejected(sdk.listInboxPlacementTests({ page: 0 }));
    await expectRejected(sdk.listInboxPlacementTests({ pageSize: 101 }));
    await expectRejected(sdk.getInboxPlacementTest(""));
    await expectRejected(sdk.deleteInboxPlacementTest(""));
    await expectRejected(sdk.setInboxPlacementWebhook(""));
    expect(fake.records).toHaveLength(0);
  });

  it("omits the new validate options until set and sends booleans as true or false", async () => {
    const sdk = client("parity-key");
    await sdk.validateEmail("a@example.com");
    let request = fake.only();
    expect(request.query.domain_info).toBeUndefined();
    expect(request.query.greylist_processing).toBeUndefined();
    expect(request.query.callback_url).toBeUndefined();

    fake.records.length = 0;
    await sdk.validateEmail("a@example.com", {
      domainInfo: true,
      greylistProcessing: false,
    });
    request = fake.only();
    expect(request.query.domain_info).toBe("true");
    expect(request.query.greylist_processing).toBe("false");

    fake.records.length = 0;
    await sdk.validateEmail("a@example.com", {
      greylistProcessing: true,
      callbackUrl: "https://example.com/cb",
      method: "POST",
    });
    request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.body.greylist_processing).toBe("true");
    expect(request.body.callback_url).toBe("https://example.com/cb");
  });

  it("sends inbox placement bodies as camelCase JSON and leaves unset fields out", async () => {
    const sdk = client("parity-key");
    await sdk.createInboxPlacementTest({ name: "basic" });
    let request = fake.only();
    expect(request.json).toEqual({ name: "basic" });
    expect(request.query.api_key).toBe("parity-key");

    fake.records.length = 0;
    await sdk.createInboxPlacementTest({
      name: "full",
      testType: 1,
      senderEmail: "from@example.com",
      providerIds: [1, 2],
      seedIds: [3],
      providers: [{ id: 4, maxSeeds: 2 }],
      webhookUrl: "https://example.com/hook",
    });
    expect(fake.only().json).toEqual({
      name: "full",
      testType: 1,
      senderEmail: "from@example.com",
      providerIds: [1, 2],
      seedIds: [3],
      providers: [{ id: 4, maxSeeds: 2 }],
      webhookUrl: "https://example.com/hook",
    });

    fake.records.length = 0;
    await sdk.setInboxPlacementWebhook("https://example.com/hook");
    request = fake.only();
    expect(request.method).toBe("PUT");
    expect(request.json).toEqual({ webhookUrl: "https://example.com/hook" });
  });

  it("sends only the inbox placement list filters that are set", async () => {
    const sdk = client("parity-key");
    await sdk.listInboxPlacementTests();
    expect(Object.keys(fake.only().query)).toEqual(["api_key"]);

    fake.records.length = 0;
    await sdk.listInboxPlacementTests({
      status: "finished",
      createdAfter: "2026-01-01",
      createdBefore: "2026-02-01",
      page: 2,
      pageSize: 50,
    });
    const query = fake.only().query;
    expect(query.status).toBe("finished");
    expect(query.createdAfter).toBe("2026-01-01");
    expect(query.createdBefore).toBe("2026-02-01");
    expect(query.page).toBe("2");
    expect(query.page_size).toBe("50");
  });

  it("uses the list evaluator base URL and encodes the file id", async () => {
    const sdk = client("parity-key");
    await sdk.getListEvaluatorResult("a b/c");
    const request = fake.only();
    expect(request.host).toBe("bulkapi.zerobounce.net");
    expect(request.path).toBe("/v2/listevaluator/a%20b%2Fc/");

    fake.records.length = 0;
    const overridden = new ZeroBounceSDK();
    overridden.init("parity-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
      listEvaluatorBaseURL: "https://example.com/custom/listevaluator",
    });
    await overridden.getListEvaluatorResult("file-1");
    expect(fake.only().url).toBe(
      "https://example.com/custom/listevaluator/file-1/?api_key=parity-key"
    );
  });

  it("turns a detail error body into a short message", async () => {
    const error = await expectRejected(client("ipt-detail-key").getInboxPlacementProviders());
    expect(error.message).toContain("Inbox placement test not found");
  });

  it("sends the documented S3 and SFTP job fields and omits unset ones", async () => {
    const sdk = client("parity-key");
    await sdk.emailFinderS3file({ file_name: "inbox.csv", has_header_row: false });
    let request = fake.only();
    expect(request.path).toBe("/emailFinderS3file");
    expect(request.body.file_name).toBe("inbox.csv");
    expect(request.body.has_header_row).toBe("false");
    expect(request.body.remove_duplicates).toBeUndefined();
    expect(request.body.return_url).toBeUndefined();

    fake.records.length = 0;
    await sdk.domainSearchS3file({
      file_name: "inbox.csv",
      has_header_row: true,
      remove_duplicates: false,
      return_url: "https://example.com/done",
    });
    request = fake.only();
    expect(request.body.has_header_row).toBe("true");
    expect(request.body.remove_duplicates).toBe("false");
    expect(request.body.return_url).toBe("https://example.com/done");

    // validateSFTPfile is the one job whose file_name the docs mark optional.
    fake.records.length = 0;
    await sdk.validateSFTPfile({ has_header_row: true });
    request = fake.only();
    expect(request.path).toBe("/validateSFTPfile");
    expect(request.body.file_name).toBeUndefined();

    fake.records.length = 0;
    await sdk.exportSFTPfile({ file_id: "fid" });
    request = fake.only();
    expect(request.path).toBe("/exportSFTPfile");
    expect(request.body.file_id).toBe("fid");
    expect(request.body.export_path).toBeUndefined();

    fake.records.length = 0;
    await sdk.exportSFTPfile({ file_id: "fid", export_path: "/out" });
    expect(fake.only().body.export_path).toBe("/out");
  });

  it("turns a 403 HTML access-denied page into a short error", async () => {
    const error = await expectRejected(client("html-403-key").getCredits());
    expect(error.message).toContain("Access denied");
    expect(HTML_PAGE.length).toBeGreaterThan(100000);
  });

  it("turns a 403 HTML getFile page into a short error instead of the page", async () => {
    const error = await expectRejected(client("html-403-file").getFile("file-1"));
    expect(error.message).toContain("Access denied");
  });

  it("rejects HTML with status 200 for JSON and file downloads", async () => {
    const credits = await expectRejected(client("html-200-credits").getCredits());
    expect(credits.message).toContain("Access denied");
    const fileError = await expectRejected(client("html-200-file").getFile("file-1"));
    expect(fileError.message).toContain("Access denied");
    const finder = await expectRejected(client("html-200-finder").getEmailFinderFile("file-1"));
    expect(finder.message).toContain("Access denied");
    const domain = await expectRejected(client("html-200-domain").getDomainSearchFile("file-1"));
    expect(domain.message).toContain("Access denied");
  });

  it("rejects empty and malformed bodies without the parser text", async () => {
    const empty = await expectRejected(client("empty-key").getCredits());
    expect(empty.message).toMatch(/Empty response/);
    const malformed = await expectRejected(client("malformed-key").validateEmail("a@example.com"));
    expect(malformed.message).toMatch(/not valid JSON/);
    const fileEmpty = await expectRejected(client("empty-file").getFile("file-1"));
    expect(fileEmpty.message).toMatch(/Empty response/);
  });

  it("strips a repeated Error prefix", async () => {
    const error = await expectRejected(client("double-error-key").getCredits());
    expect(error.message).toBe("api_key is invalid");
  });

  it("uses the Cloudflare JSON title for a 403 access-denied payload", async () => {
    const error = await expectRejected(client("cf-json-key").getCredits());
    expect(error.message).toBe("Error 1020: Access denied");
  });

  it("returns a getFile JSON error object and still downloads CSV", async () => {
    const previous = global.fetch;
    const sdk = client("parity-key");
    global.fetch = previous;
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: () => Promise.resolve(JSON.stringify({ success: false, message: "File not ready" })),
      })
    );
    await expect(sdk.getFile("file-1")).resolves.toEqual({ success: false, message: "File not ready" });
    fake.restore();
    fake = installFakeFetch();
    const csvSdk = client("parity-key");
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(csvSdk.getFile("file-1")).resolves.toBe("result.csv");
  });

  it("keeps API keys isolated across concurrent clients", async () => {
    const clients = Array.from({ length: 12 }, (_, index) => {
      const key = `client-${String(index).padStart(4, "0")}-secret`;
      return { key, sdk: client(key) };
    });
    const results = await Promise.all(
      clients.map(({ sdk }) => sdk.validateEmail(`person-${sdk._api_key}@example.com`))
    );
    expect(fake.records).toHaveLength(clients.length);
    results.forEach((result, index) => {
      expect(result.echo_api_key).toBe(clients[index].key);
      const blob = JSON.stringify(result);
      for (const other of clients) {
        if (other.key !== clients[index].key) expect(blob).not.toContain(other.key);
      }
    });
    for (const request of fake.records) {
      expect(request.apiKey).toBe(request.fields.api_key);
      expect(request.fields.email).toBe(`person-${request.apiKey}@example.com`);
      for (const other of clients) {
        if (other.key !== request.apiKey) {
          expect(request.url).not.toContain(other.key);
          expect(JSON.stringify(request.fields)).not.toContain(other.key);
        }
      }
    }
  });
});
