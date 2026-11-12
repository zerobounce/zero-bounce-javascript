/**
 * Offline API suite. Replaces global fetch; no network and no real API key.
 */
import { inspect } from "util";
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
  // LIVE (2026-11-11): what an invalid or drained key gets back, each with an
  // HTTP 200 and no "success" field.
  if (key.startsWith("dead-key-")) {
    const path = request.path;
    let body = '{"error":"Invalid API key or your account ran out of credits"}';
    if (path.includes("guessformat")) body = '{"Message":"Invalid API key or your account ran out of credits"}';
    else if (path.includes("filters")) body = '{  "Error": "Invalid API key or your account ran out of credits"}';
    else if (path.includes("getapiusage")) body = '{"error":"Invalid API key"}';
    else if (path.includes("getcredits")) body = '{"Credits":"-1"}';
    return httpResponse(200, body, "application/json");
  }
  // The documented answer to a repeated greylist_processing validate: a result
  // whose only field is Message, not an error.
  if (key.startsWith("greylist-pending-") && request.path.endsWith("/validate")) {
    return httpResponse(
      200,
      '{"Message":"Greylist validation still in progress. Please try again later."}',
      "application/json"
    );
  }
  if (key.startsWith("filter-message-") && request.path.includes("filters")) {
    return httpResponse(200, '{"Message":"Filter has been added."}', "application/json");
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
    const headers = init.headers || {};
    const authorization = String(headers.Authorization || headers.authorization || "");
    // The Inbox Placement Tester authenticates with a Bearer header rather than
    // an api_key parameter, so the key can arrive either way.
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const recorded = {
      method: String(init.method || "GET").toUpperCase(),
      host: parsed.host,
      path: parsed.pathname,
      url: String(url),
      query,
      headers,
      authorization,
      bearer,
      body: body.fields,
      json: body.json,
      fields: { ...query, ...body.fields },
      apiKey: body.fields.api_key || query.api_key || bearer || "",
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

/** The public methods of a client class, from its prototype, sorted. */
function publicMethods(cls) {
  return Object.getOwnPropertyNames(cls.prototype)
    .filter((name) => name !== "constructor" && name !== "init" && !name.startsWith("_"))
    .filter((name) => typeof cls.prototype[name] === "function")
    .sort();
}

/**
 * Turns every https base URL a client holds (strings, and strings one level
 * down in objects) into http, and returns the number it changed.
 */
function downgradeBaseUrls(target) {
  let changed = 0;
  const downgrade = (value) => {
    if (typeof value === "string" && value.startsWith("https://")) {
      changed += 1;
      return `http://${value.slice("https://".length)}`;
    }
    return value;
  };
  for (const name of Object.getOwnPropertyNames(target)) {
    const value = target[name];
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) value[key] = downgrade(value[key]);
    } else {
      target[name] = downgrade(value);
    }
  }
  return changed;
}

/** Whether any https URL is left on the client after downgradeBaseUrls. */
function holdsHttpsUrl(target) {
  return JSON.stringify(Object.getOwnPropertyNames(target).map((name) => target[name])).includes("https://");
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
      ["sendEmailFinderFile", () => sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 2 }), "POST", "bulkapi.zerobounce.net", "/email-finder/sendfile"],
      ["sendEmailFinderFileStream", () => sdk.sendEmailFinderFileStream(file, "emails.csv", { domain_column: 1, full_name_column: 2 }), "POST", "bulkapi.zerobounce.net", "/email-finder/sendfile"],
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
      ["validateS3file", () => sdk.validateS3file({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/validateS3file"],
      ["scoreS3file", () => sdk.scoreS3file({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/scoreS3file"],
      ["exportS3file", () => sdk.exportS3file({ file_id: id, export_bucket: "bucket" }), "POST", "bulkapi.zerobounce.net", "/exportS3file"],
      ["emailFinderS3file", () => sdk.emailFinderS3file({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/emailFinderS3file"],
      ["domainSearchS3file", () => sdk.domainSearchS3file({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/domainSearchS3file"],
      ["validateSFTPfile", () => sdk.validateSFTPfile({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/validateSFTPfile"],
      ["scoreSFTPfile", () => sdk.scoreSFTPfile({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/scoreSFTPfile"],
      ["emailFinderSFTPfile", () => sdk.emailFinderSFTPfile({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/emailFinderSFTPfile"],
      ["domainSearchSFTPfile", () => sdk.domainSearchSFTPfile({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" }), "POST", "bulkapi.zerobounce.net", "/domainSearchSFTPfile"],
      ["exportSFTPfile", () => sdk.exportSFTPfile({ file_id: "fid" }), "POST", "bulkapi.zerobounce.net", "/exportSFTPfile"],
      ["getInboxPlacementProviders", () => sdk.getInboxPlacementProviders(), "GET", "bulkapi.zerobounce.net", "/api/ipt/providers"],
      ["getInboxPlacementTestTypes", () => sdk.getInboxPlacementTestTypes(), "GET", "bulkapi.zerobounce.net", "/api/ipt/test-types"],
      ["createInboxPlacementTest", () => sdk.createInboxPlacementTest({ name: "t" }), "POST", "bulkapi.zerobounce.net", "/api/ipt/test"],
      ["getInboxPlacementTest", () => sdk.getInboxPlacementTest(id), "GET", "bulkapi.zerobounce.net", "/api/ipt/test/file-1"],
      ["listInboxPlacementTests", () => sdk.listInboxPlacementTests(), "GET", "bulkapi.zerobounce.net", "/api/ipt/tests"],
      ["deleteInboxPlacementTest", () => sdk.deleteInboxPlacementTest(id), "DELETE", "bulkapi.zerobounce.net", "/api/ipt/test/file-1"],
      ["getInboxPlacementWebhook", () => sdk.getInboxPlacementWebhook(), "GET", "bulkapi.zerobounce.net", "/api/ipt/webhook"],
      ["setInboxPlacementWebhook", () => sdk.setInboxPlacementWebhook("https://example.com/hook"), "PUT", "bulkapi.zerobounce.net", "/api/ipt/webhook"],
      ["sendEvaluatedFile", () => sdk.sendEvaluatedFile("eval-file-1"), "POST", "bulkapi.zerobounce.net", "/v2/send-evaluated-file/"],
      ["addFilter", () => sdk.addFilter({ rule: "allow", target: "domain", value: "spam.com" }), "POST", "api.zerobounce.net", "/v2/filters/add"],
      ["listFilters", () => sdk.listFilters(), "GET", "api.zerobounce.net", "/v2/filters/list"],
      ["deleteFilter", () => sdk.deleteFilter({ rule: "allow", target: "domain", value: "spam.com" }), "POST", "api.zerobounce.net", "/v2/filters/delete"],
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

  it("covers every public method in callAll, so the sweeps that use it miss none", () => {
    const names = callAll(client("parity-key")).map(([name]) => name).sort();
    const methods = Object.getOwnPropertyNames(ZeroBounceSDK.prototype)
      .filter((name) => name !== "constructor" && name !== "init" && !name.startsWith("_"))
      .sort();
    expect(names).toEqual(methods);
  });

  it("keeps every form of the key out of a transport or API error, on every public method", async () => {
    // A key whose URL-encoded, escape()d and JSON-escaped forms all differ
    // from the raw one and from each other.
    const key = 'transport"secret/+%1';
    const json = JSON.stringify(key).slice(1, -1);
    const forms = [key, encodeURIComponent(key), escape(key), json, json.replace(/\//g, "\\/")];
    expect(new Set(forms).size).toBe(forms.length);
    const sdk = client(key);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    // [status, content type, body]: API and proxy answers that quote the key.
    const echoes = {
      "success false": (detail) => [200, "application/json", JSON.stringify({ success: false, message: `rejected ${detail}` })],
      "error field": (detail) => [200, "application/json", JSON.stringify({ error: `rejected ${detail}` })],
      "dead key": (detail) => [200, "application/json", JSON.stringify({ error: `Invalid API key ${detail}` })],
      "not JSON on 2xx": (detail) => [200, "application/json", `rejected ${detail}`],
      "message only": (detail) => [200, "application/json", JSON.stringify({ Message: `rejected ${detail}` })],
      "HTTP 400": (detail) => [400, "application/json", JSON.stringify({ message: `rejected ${detail}` })],
      "HTTP 400 error": (detail) => [400, "application/json", JSON.stringify({ error: `rejected ${detail}` })],
      "HTTP 400 text": (detail) => [400, "text/plain", `Bad Request: GET /v2/x?api_key=${key} ${detail}`],
    };
    // A message-only body is a result everywhere but email finder and domain
    // search (validate's greylist answer), so only those must reject on it.
    const mustReject = (failure, name) => failure !== "message only" || /^(findEmail|guessFormat)/.test(name);
    const finderNames = callAll(sdk).map(([name]) => name).filter((name) => mustReject("message only", name));
    expect(finderNames.length).toBeGreaterThanOrEqual(5);
    for (const failure of ["fetch", "body", ...Object.keys(echoes)]) {
      for (const [name, run] of callAll(sdk)) {
        // Some fetch implementations and polyfills quote the request URL, or
        // more, in their own errors.
        global.fetch = async (url) => {
          const detail = `${forms.join(" ")} ${url}`;
          if (failure === "fetch") throw new TypeError(`fetch failed: ${detail}`);
          if (echoes[failure]) {
            const [status, contentType, body] = echoes[failure](detail);
            return { status, headers: { get: () => contentType }, text: async () => body };
          }
          return {
            status: 200,
            headers: { get: () => "application/json" },
            text: async () => {
              throw new TypeError(`body failed: ${detail}`);
            },
          };
        };
        let message = null;
        try {
          await run();
        } catch (error) {
          // Every field, the stack and any cause, not only the message.
          message = `${error.message}\n${error.stack}\n${inspect(error, { showHidden: true, depth: 5 })}`;
        }
        const leaked = message !== null && forms.some((form) => message.includes(form));
        expect({ name, failure, rejected: message !== null || !mustReject(failure, name), leaked }).toEqual({
          name,
          failure,
          rejected: true,
          leaked: false,
        });
      }
    }
  });

  it("resolves an empty 2xx to deleteInboxPlacementTest as null, and rejects every other empty answer with its status", async () => {
    const sdk = client("parity-key");
    const answerWith = (status, body = "") => {
      global.fetch = async () => ({
        status,
        headers: { get: () => (body ? "application/json" : null) },
        text: async () => body,
      });
    };
    const settle = async (run) => {
      try {
        return { resolved: await run() };
      } catch (error) {
        return { status: error.statusCode, message: error.message };
      }
    };
    const iptCalls = callAll(sdk).filter(([, , , , path]) => path.startsWith("/api/ipt/"));
    expect(iptCalls.map(([name]) => name)).toContain("deleteInboxPlacementTest");
    for (const [name, run] of iptCalls) {
      for (const [status, body] of [[204, ""], [200, ""], [200, "  \n"]]) {
        answerWith(status, body);
        const expected =
          name === "deleteInboxPlacementTest"
            ? { resolved: null }
            : { status, message: `Empty response from ZeroBounce (HTTP ${status})` };
        expect({ name, status, outcome: await settle(run) }).toEqual({ name, status, outcome: expected });
      }
    }
    // An empty error answer is still an error with its status, on DELETE too.
    for (const status of [404, 500]) {
      answerWith(status);
      expect(await settle(() => sdk.deleteInboxPlacementTest("t-1"))).toEqual({
        status,
        message: `Empty response from ZeroBounce (HTTP ${status})`,
      });
    }
    // A JSON answer to DELETE is still returned as it is.
    answerWith(200, '{"id":"t-1","status":"deleted"}');
    expect(await settle(() => sdk.deleteInboxPlacementTest("t-1"))).toEqual({
      resolved: { id: "t-1", status: "deleted" },
    });
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

  it("rejects a dead key on every call with the API's own message", async () => {
    const sdk = client("dead-key-user");
    const drained = "Invalid API key or your account ran out of credits";
    const calls = [
      ["validateEmail", () => sdk.validateEmail("a@example.com"), drained],
      ["validateEmail POST", () => sdk.validateEmail("a@example.com", { method: "POST" }), drained],
      ["getEmailActivity", () => sdk.getEmailActivity("a@example.com"), drained],
      ["getApiUsage", () => sdk.getApiUsage("2026-10-01", "2026-10-02"), "Invalid API key"],
      ["findEmailByDomain", () => sdk.findEmailByDomain({ domain: "example.com", first_name: "john" }), drained],
      ["findEmailByCompanyName", () => sdk.findEmailByCompanyName({ company_name: "Example", first_name: "john" }), drained],
      ["findEmailFormatByDomain", () => sdk.findEmailFormatByDomain({ domain: "example.com" }), drained],
      ["findEmailFormatByCompanyName", () => sdk.findEmailFormatByCompanyName({ company_name: "Example" }), drained],
      ["addFilter", () => sdk.addFilter({ rule: "allow", target: "email", value: "x@example.com" }), drained],
      ["deleteFilter", () => sdk.deleteFilter({ rule: "allow", target: "email", value: "x@example.com" }), drained],
      ["listFilters", () => sdk.listFilters(), drained],
      ["listFilters POST", () => sdk.listFilters({ method: "POST" }), drained],
    ];
    for (const [name, call, message] of calls) {
      let result;
      let error;
      try {
        result = await call();
      } catch (caught) {
        error = caught;
      }
      expect([name, result]).toEqual([name, undefined]);
      expect([name, error && error.message]).toEqual([name, message]);
      expect([name, error && error.statusCode]).toEqual([name, 200]);
    }
    // -1 is the documented credit balance of an invalid key, not an error.
    await expect(sdk.getCredits()).resolves.toEqual({ Credits: "-1" });

  });

  it("keeps a bare Message as a result where the API means one", async () => {
    // The API's "Message" is also on `message`, the field the types declare.
    await expect(client("greylist-pending-1").validateEmail("a@example.com")).resolves.toEqual({
      Message: "Greylist validation still in progress. Please try again later.",
      message: "Greylist validation still in progress. Please try again later.",
    });
    await expect(
      client("filter-message-1").addFilter({ rule: "allow", target: "email", value: "x@example.com" })
    ).resolves.toEqual({ Message: "Filter has been added." });
  });

  it("rejects a scoring body that is only an error, as the other SDKs do", async () => {
    const sdk = client("score-item-1");
    await expect(sdk.scoreEmail("not-an-email")).rejects.toMatchObject({
      message: "invalid email",
      statusCode: 200,
    });
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
    // Left to the API's own default unless the caller sets it.
    expect(request.fields.remove_duplicate).toBeUndefined();

    fake.records.length = 0;
    await sdk.sendScoringFile({ file, email_address_column: 1, has_header_row: false, remove_duplicate: false });
    request = fake.only();
    expect(request.fields.allow_phase_2).toBeUndefined();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.remove_duplicate).toBe("false");
    expect(request.fields.first_name_column).toBeUndefined();

    fake.records.length = 0;
    await sdk.sendEmailFinderFile({
      file,
      domain_column: 2,
      has_header_row: false,
      full_name_column: 3,
      middle_name_column: 0,
    });
    request = fake.only();
    expect(request.fields.has_header_row).toBe("false");
    expect(request.fields.domain_column).toBe("2");
    expect(request.fields.full_name_column).toBe("3");
    expect(request.fields.first_name_column).toBeUndefined();
    expect(request.fields.middle_name_column).toBeUndefined();

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
    await sdk.sendEmailFinderFile({ file, domain_column: 0, first_name_column: 1 });
    expect(fake.only().fields.domain_column).toBe("0");

    fake.records.length = 0;
    await sdk.sendListEvaluatorFile({ file, email_address_column: 0 });
    expect(fake.only().fields.email_address_column).toBe("0");
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
    await sdk.addFilter({ rule: "allow", target: "email", value: "a@example.com" });
    expect(fake.only().body).toEqual({
      api_key: "parity-key",
      rule: "allow",
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
    await expectRejected(sdk.findEmailFormatByDomain({ domain: "" }));
    await expectRejected(sdk.addFilter({ rule: "", target: "domain", value: "spam.com" }));
    await expectRejected(sdk.getFile(""));
    await expectRejected(sdk.exportS3file({}));
    await expectRejected(sdk.exportS3file({ file_id: "fid", export_bucket: "  " }));
    await expectRejected(sdk.emailFinderS3file({ has_header_row: true }));
    await expectRejected(sdk.validateS3file({ file_name: "f.csv", has_header_row: true }));
    await expectRejected(sdk.scoreS3file({ file_name: "f.csv", has_header_row: true }));
    await expectRejected(
      sdk.sendEmailFinderFile({ file, domain_column: 1 })
    );
    await expectRejected(
      sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 0 })
    );
    await expectRejected(
      sdk.sendEmailFinderFileStream(file, "emails.csv", { domain_column: 1 })
    );
    await expectRejected(sdk.scoreSFTPfile({ file_name: "  ", has_header_row: true }));
    await expectRejected(sdk.domainSearchSFTPfile({ file_name: "f.csv" }));
    // LIVE: return_url is required even though the docs mark it optional.
    await expectRejected(
      sdk.emailFinderSFTPfile({ file_name: "f.csv", has_header_row: true })
    );
    await expectRejected(
      sdk.validateSFTPfile({ has_header_row: true, return_url: "https://example.com/done" })
    );
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
    // The Inbox Placement Tester documents Authorization: Bearer, not a query key.
    expect(request.authorization).toBe("Bearer parity-key");
    expect(request.query.api_key).toBeUndefined();

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
    // The key travels in the Bearer header, so an unfiltered list sends no query.
    expect(Object.keys(fake.only().query)).toEqual([]);

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
    await sdk.emailFinderS3file({
      file_name: "inbox.csv",
      has_header_row: false,
      return_url: "https://example.com/done",
    });
    let request = fake.only();
    expect(request.path).toBe("/emailFinderS3file");
    expect(request.body.file_name).toBe("inbox.csv");
    expect(request.body.has_header_row).toBe("false");
    expect(request.body.return_url).toBe("https://example.com/done");
    // remove_duplicates is the only one of the four that stays optional.
    expect(request.body.remove_duplicates).toBeUndefined();

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

    // LIVE: validateSFTPfile needs file_name too, although the docs mark it
    // optional ("file_name: This field is required").
    fake.records.length = 0;
    await sdk.validateSFTPfile({ file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" });
    request = fake.only();
    expect(request.path).toBe("/validateSFTPfile");
    expect(request.body.file_name).toBe("f.csv");

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

  it("rejects a getFile JSON error object and still downloads CSV", async () => {
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
    await expect(sdk.getFile("file-1")).rejects.toMatchObject({ message: "File not ready", statusCode: 200 });
    fake.restore();
    fake = installFakeFetch();
    const csvSdk = client("parity-key");
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(csvSdk.getFile("file-1")).resolves.toBe("result.csv");
  });

  it("rejects a JSON, HTML or empty download on every getfile method, with status 200", async () => {
    const sdk = client("parity-key");
    const downloads = callAll(sdk).filter(([, , , , path]) => path.includes("getfile"));
    expect(downloads.map(([name]) => name).sort()).toEqual([
      "getDomainSearchFile",
      "getEmailFinderFile",
      "getFile",
      "getScoringFile",
    ]);
    // Each answer is caught by one check only, so dropping any one check fails here.
    const answers = {
      "JSON array under text/csv": ["text/csv", '["File not found"]'],
      "JSON object under no content type": [null, '{"detail":"Not found"}'],
      "problem+json content type": ["application/problem+json", "email\na@example.com\n"],
      "JSON content type with charset": ["application/json; charset=utf-8", "email\na@example.com\n"],
      "text/html content type, body not a page": ["text/html; charset=UTF-8", "<h1>403 Forbidden</h1>"],
      "HTML page under text/csv": ["text/csv", "<!DOCTYPE html><html><body>Blocked</body></html>"],
      "empty body": ["text/csv", ""],
    };
    for (const [answer, [contentType, body]] of Object.entries(answers)) {
      for (const [name, run] of downloads) {
        global.fetch = async () => httpResponse(200, body, contentType);
        let outcome;
        try {
          outcome = { resolved: await run() };
        } catch (error) {
          outcome = { status: error.statusCode, name: error.name };
        }
        expect({ answer, name, outcome }).toEqual({ answer, name, outcome: { status: 200, name: "ZBApiError" } });
      }
    }
  });

  it("rejects a 2xx JSON call served as text/html even when the body is valid JSON", async () => {
    const sdk = client("parity-key");
    global.fetch = async () => httpResponse(200, '{"Credits":"5"}', "text/html");
    const error = await expectRejected(sdk.getCredits());
    expect([error.name, error.statusCode]).toEqual(["ZBApiError", 200]);
  });

  it('rejects success "false", "False" and false on a 2xx, each with status 200', async () => {
    const sdk = client("parity-key");
    for (const success of [false, "false", "False"]) {
      global.fetch = async () =>
        httpResponse(200, JSON.stringify({ success, message: "File not found" }), "application/json");
      let outcome;
      try {
        outcome = { resolved: await sdk.getFileStatus("file-1") };
      } catch (error) {
        outcome = { status: error.statusCode, message: error.message };
      }
      expect({ success, outcome }).toEqual({ success, outcome: { status: 200, message: "File not found" } });
    }
  });

  it("sends validateBatch as JSON with the JSON content type", async () => {
    const sdk = client("parity-key");
    const batch = [{ email_address: "a@example.com", ip_address: "1.1.1.1" }];
    const result = await sdk.validateBatch(batch, { timeout: 30, verifyPlus: true });

    const request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.zerobounce.net/v2/validatebatch");
    // The key travels in the JSON body, not the query string.
    expect(request.query).toEqual({});
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(request.json).toEqual({
      api_key: "parity-key",
      email_batch: batch,
      // LIVE: timeout is a JSON string; the flags stay JSON booleans.
      timeout: "30",
      verify_plus: true,
    });
    expect(result.email_batch[0].status).toBe("valid");
  });

  it("finds an email without first_name and still sends it when given", async () => {
    const sdk = client("parity-key");
    await sdk.findEmailByDomain({ domain: "example.com" });
    let request = fake.only();
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      "https://api.zerobounce.net/v2/guessformat?api_key=parity-key&domain=example.com"
    );
    expect(request.query.first_name).toBeUndefined();

    fake.records.length = 0;
    await sdk.findEmailByCompanyName({ company_name: "Ada Inc" });
    request = fake.only();
    expect(request.url).toBe(
      "https://api.zerobounce.net/v2/guessformat?api_key=parity-key&company_name=Ada+Inc"
    );
    expect(request.query.first_name).toBeUndefined();

    fake.records.length = 0;
    const result = await sdk.findEmailByDomain({
      domain: "example.com",
      first_name: "Ada",
      last_name: "Lovelace",
    });
    request = fake.only();
    expect(request.query).toEqual({
      api_key: "parity-key",
      first_name: "Ada",
      last_name: "Lovelace",
      domain: "example.com",
    });
    expect(result.email).toBe("ada@example.com");

    // The domain is still required, and the domain-search family is untouched.
    await expectRejected(sdk.findEmailByDomain({ first_name: "Ada" }));
    await expectRejected(sdk.findEmailByCompanyName({ first_name: "Ada" }));
  });

  it("requires a first_name_column or full_name_column for the bulk email finder", async () => {
    const sdk = client("parity-key");
    const missing = await expectRejected(sdk.sendEmailFinderFile({ file, domain_column: 1 }));
    expect(missing.message).toBe(
      "ZeroBounce: first_name_column parameter is missing. Send first_name_column or full_name_column."
    );
    // 0 and false mean "leave this column out", so neither counts as given.
    await expectRejected(
      sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 0 })
    );
    await expectRejected(
      sdk.sendEmailFinderFile({ file, domain_column: 1, full_name_column: false })
    );
    await expectRejected(
      sdk.sendEmailFinderFileStream(file, "emails.csv", { domain_column: 1 })
    );
    expect(fake.records).toHaveLength(0);

    await sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 2 });
    let request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://bulkapi.zerobounce.net/email-finder/sendfile");
    expect(request.fields.first_name_column).toBe("2");
    expect(request.fields.api_key).toBe("parity-key");

    fake.records.length = 0;
    await sdk.sendEmailFinderFileStream(file, "emails.csv", {
      domain_column: 1,
      full_name_column: 3,
    });
    request = fake.only();
    expect(request.url).toBe("https://bulkapi.zerobounce.net/email-finder/sendfile");
    expect(request.fields.full_name_column).toBe("3");
    expect(request.fields.first_name_column).toBeUndefined();
  });

  it("honours the emailFinderBaseURL and domainSearchBaseURL overrides", async () => {
    const sdk = new ZeroBounceSDK();
    sdk.init("parity-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
      emailFinderBaseURL: "https://finder.example.com/email-finder",
      domainSearchBaseURL: "https://search.example.com/domain-search",
    });

    const calls = [
      [() => sdk.sendEmailFinderFile({ file, domain_column: 1, first_name_column: 2 }), "POST", "https://finder.example.com/email-finder/sendfile"],
      [() => sdk.sendEmailFinderFileStream(file, "emails.csv", { domain_column: 1, first_name_column: 2 }), "POST", "https://finder.example.com/email-finder/sendfile"],
      [() => sdk.getEmailFinderFileStatus("file-1"), "GET", "https://finder.example.com/email-finder/filestatus?api_key=parity-key&file_id=file-1"],
      [() => sdk.getEmailFinderFile("file-1"), "GET", "https://finder.example.com/email-finder/getfile?api_key=parity-key&file_id=file-1"],
      [() => sdk.deleteEmailFinderFile("file-1"), "GET", "https://finder.example.com/email-finder/deletefile?api_key=parity-key&file_id=file-1"],
      [() => sdk.sendDomainSearchFile({ file, domain_column: 1 }), "POST", "https://search.example.com/domain-search/sendfile"],
      [() => sdk.sendDomainSearchFileStream(file, "emails.csv", { domain_column: 1 }), "POST", "https://search.example.com/domain-search/sendfile"],
      [() => sdk.getDomainSearchFileStatus("file-1"), "GET", "https://search.example.com/domain-search/filestatus?api_key=parity-key&file_id=file-1"],
      [() => sdk.getDomainSearchFile("file-1"), "GET", "https://search.example.com/domain-search/getfile?api_key=parity-key&file_id=file-1"],
      [() => sdk.deleteDomainSearchFile("file-1"), "GET", "https://search.example.com/domain-search/deletefile?api_key=parity-key&file_id=file-1"],
    ];
    for (const [run, method, url] of calls) {
      fake.records.length = 0;
      await run();
      expect({ method: fake.only().method, url: fake.only().url }).toEqual({ method, url });
      expect(fake.only().apiKey).toBe("parity-key");
    }

    // An override is still checked, and a default client keeps the bulk host.
    const bare = new ZeroBounceSDK();
    expect(() =>
      bare.init("parity-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
        emailFinderBaseURL: "http://finder.example.com",
      })
    ).toThrow(/emailFinderBaseURL must be an https/);
    expect(() =>
      bare.init("parity-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
        domainSearchBaseURL: "http://search.example.com",
      })
    ).toThrow(/domainSearchBaseURL must be an https/);

    fake.records.length = 0;
    await client("parity-key").getEmailFinderFileStatus("file-1");
    expect(fake.only().url).toBe(
      "https://bulkapi.zerobounce.net/email-finder/filestatus?api_key=parity-key&file_id=file-1"
    );
  });

  it("sends exactly the documented fields for the S3 and SFTP file jobs", async () => {
    const sdk = client("parity-key");
    const jobs = [
      ["validateS3file", (options) => sdk.validateS3file(options), "/validateS3file"],
      ["scoreS3file", (options) => sdk.scoreS3file(options), "/scoreS3file"],
      ["emailFinderS3file", (options) => sdk.emailFinderS3file(options), "/emailFinderS3file"],
      ["domainSearchS3file", (options) => sdk.domainSearchS3file(options), "/domainSearchS3file"],
      ["validateSFTPfile", (options) => sdk.validateSFTPfile(options), "/validateSFTPfile"],
      ["scoreSFTPfile", (options) => sdk.scoreSFTPfile(options), "/scoreSFTPfile"],
      ["emailFinderSFTPfile", (options) => sdk.emailFinderSFTPfile(options), "/emailFinderSFTPfile"],
      ["domainSearchSFTPfile", (options) => sdk.domainSearchSFTPfile(options), "/domainSearchSFTPfile"],
    ];

    for (const [name, run, path] of jobs) {
      fake.records.length = 0;
      const result = await run({
        file_name: "emails/list.csv",
        has_header_row: true,
        remove_duplicates: false,
        return_url: "https://example.com/done",
        // Undocumented extras a caller may still pass: none may go out.
        email_address_column: 1,
        first_name_column: 2,
        last_name_column: 3,
        gender_column: 4,
        ip_address_column: 5,
        remove_duplicate: true,
        allowPhase2: true,
      });
      const request = fake.only();
      expect({ name, method: request.method, url: request.url }).toEqual({
        name,
        method: "POST",
        url: `https://bulkapi.zerobounce.net${path}`,
      });
      expect(request.query).toEqual({});
      expect(request.body).toEqual({
        api_key: "parity-key",
        file_name: "emails/list.csv",
        has_header_row: "true",
        remove_duplicates: "false",
        return_url: "https://example.com/done",
      });
      expect(result.success).toBe(true);
    }

    // LIVE: file_name, has_header_row and return_url are all required.
    fake.records.length = 0;
    for (const [, run] of jobs) {
      await expectRejected(run({ has_header_row: true, return_url: "https://example.com/done" }));
      await expectRejected(run({ file_name: "f.csv", return_url: "https://example.com/done" }));
      const noUrl = await expectRejected(run({ file_name: "f.csv", has_header_row: true }));
      expect(noUrl.message).toBe(
        "ZeroBounce: return_url parameter is missing. The API rejects a job without it."
      );
    }
    expect(fake.records).toHaveLength(0);
  });

  it("sends the string \"false\" as false on the S3 and SFTP jobs and rejects non-booleans", async () => {
    // 3.0.0's validateS3file sent has_header_row as given, so "false" meant
    // false. Coerced with truthiness it would go out as "true".
    const sdk = client("parity-key");
    const job = (extra) => ({
      file_name: "emails/list.csv",
      return_url: "https://example.com/done",
      ...extra,
    });
    const cases = [
      [{ has_header_row: "false", remove_duplicates: "false" }, "false", "false"],
      [{ has_header_row: "FALSE", remove_duplicates: " False " }, "false", "false"],
      [{ has_header_row: "true", remove_duplicates: "TRUE" }, "true", "true"],
      [{ has_header_row: false, remove_duplicates: true }, "false", "true"],
      [{ has_header_row: 0, remove_duplicates: 1 }, "false", "true"],
    ];
    for (const run of [(o) => sdk.validateS3file(o), (o) => sdk.scoreS3file(o), (o) => sdk.validateSFTPfile(o)]) {
      for (const [extra, header, duplicates] of cases) {
        fake.records.length = 0;
        await run(job(extra));
        const request = fake.only();
        expect([extra, request.body.has_header_row, request.body.remove_duplicates]).toEqual([
          extra,
          header,
          duplicates,
        ]);
      }
    }

    fake.records.length = 0;
    for (const bad of ["no", "", "yes", 2, {}, []]) {
      const header = await expectRejected(sdk.validateS3file(job({ has_header_row: bad })));
      expect(header.message).toBe("ZeroBounce: has_header_row parameter is invalid. Must be true or false.");
      const duplicates = await expectRejected(
        sdk.scoreS3file(job({ has_header_row: true, remove_duplicates: bad }))
      );
      expect(duplicates.message).toBe(
        "ZeroBounce: remove_duplicates parameter is invalid. Must be true or false."
      );
    }
    expect(fake.records).toHaveLength(0);
  });

  it("takes sendEvaluatedFile's file id as a string or as { file_id }", async () => {
    const sdk = client("parity-key");
    await sdk.sendEvaluatedFile("eval-file-1");
    expect(fake.only().body).toEqual({ api_key: "parity-key", file_id: "eval-file-1" });
    fake.records.length = 0;
    await sdk.sendEvaluatedFile({ file_id: "eval-file-2" });
    expect(fake.only().body).toEqual({ api_key: "parity-key", file_id: "eval-file-2" });
    fake.records.length = 0;
    // What the 3.1.0 type declared, { file }, carries no id and is rejected.
    await expectRejected(sdk.sendEvaluatedFile({ file: new Blob(["x"]) }));
    expect(fake.records).toHaveLength(0);
  });

  it("makes export_bucket optional on exportS3file, as export_path is on exportSFTPfile", async () => {
    const sdk = client("parity-key");
    await sdk.exportS3file({ file_id: "job-1" });
    let request = fake.only();
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://bulkapi.zerobounce.net/exportS3file");
    expect(request.body).toEqual({ api_key: "parity-key", file_id: "job-1" });

    fake.records.length = 0;
    const result = await sdk.exportS3file({ file_id: "job-1", export_bucket: "my-bucket" });
    request = fake.only();
    expect(request.body).toEqual({
      api_key: "parity-key",
      file_id: "job-1",
      export_bucket: "my-bucket",
    });
    expect(result.success).toBe(true);

    fake.records.length = 0;
    await expectRejected(sdk.exportS3file({}));
    await expectRejected(sdk.exportS3file({ file_id: "job-1", export_bucket: "   " }));
    expect(fake.records).toHaveLength(0);
  });

  it("reports the API's own error body for a rejected S3 job", async () => {
    const sdk = client("parity-key");
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        headers: { get: () => "application/json" },
        text: () =>
          Promise.resolve(
            JSON.stringify({ error_message: "Provided return URL is not permitted: None" })
          ),
      })
    );
    const error = await expectRejected(
      sdk.validateS3file({
        file_name: "emails/list.csv",
        has_header_row: true,
        return_url: "https://example.com/done",
      })
    );
    expect(error.message).toBe("Provided return URL is not permitted: None");
    expect(error.statusCode).toBe(400);
  });

  it("refuses a non-https URL on every request path, not only in init", async () => {
    // init() refuses an http base URL; this is the per-request check behind
    // it, reached by turning every base URL the client holds into http.
    const sdk = client("parity-key");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(downgradeBaseUrls(sdk)).toBeGreaterThan(0);
    expect(holdsHttpsUrl(sdk)).toBe(false);
    const sent = [];
    global.fetch = async (url) => {
      sent.push(String(url));
      throw new TypeError("fetch must not be reached");
    };
    const refused = [];
    for (const [name, run] of callAll(sdk)) {
      let message = null;
      try {
        await run();
      } catch (error) {
        message = error.message;
      }
      expect({ name, message }).toEqual({ name, message: "ZeroBounce: request URL must be an https:// URL" });
      refused.push(name);
    }
    expect(sent).toEqual([]);
    // Complete by construction: every public method was exercised.
    expect(refused.sort()).toEqual(publicMethods(ZeroBounceSDK));
  });

  it("gives every request on every public method the 120 s timeout signal", async () => {
    const sdk = client("parity-key");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const marker = new AbortController().signal;
    const timeouts = [];
    const spy = jest.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      timeouts.push(ms);
      return marker;
    });
    const signals = [];
    const answerWith = global.fetch;
    global.fetch = async (url, init = {}) => {
      signals.push(init.signal);
      return answerWith(url, init);
    };
    const covered = [];
    try {
      for (const [name, run] of callAll(sdk)) {
        signals.length = 0;
        timeouts.length = 0;
        await run();
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
    expect(covered.sort()).toEqual(publicMethods(ZeroBounceSDK));
  });

  it("masks the API key in each of its forms, URL-encoded JSON-escaped included, needing every one", async () => {
    // A space, a quote, "/", "+", "%", "&", "=", "<", ">", "'" and "\\": every
    // form below differs from every other.
    const key = `api SeCrEt"/+%&=<>'\\z`;
    const json = JSON.stringify(key).slice(1, -1);
    const form = (text) => new URLSearchParams({ s: text }).toString().slice(2);
    const bases = {
      raw: key,
      json,
      "json, / as \\/": json.replace(/\//g, "\\/"),
      "json twice": JSON.stringify(json).slice(1, -1),
    };
    const forms = { "escape()": escape(key) };
    for (const [name, base] of Object.entries(bases)) {
      forms[name] = base;
      forms[`${name}, URL-encoded (%20)`] = encodeURIComponent(base);
      forms[`${name}, form-encoded (+)`] = form(base);
    }
    expect(new Set(Object.values(forms)).size).toBe(Object.keys(forms).length);
    const sdk = client(key);
    const messageFor = async (echo) => {
      global.fetch = async () => httpResponse(400, `Bad Request: [${echo}]`, "text/plain");
      try {
        await sdk.validateEmail("a@example.com");
      } catch (error) {
        return error.message;
      }
      return "resolved";
    };
    // Each form, echoed on its own, must come back exactly as "***" would: a
    // form left out leaks, or leaves the tail of a longer form behind.
    const expected = await messageFor("***");
    expect(expected).toContain("[***]");
    const got = {};
    for (const [name, echo] of Object.entries(forms)) got[name] = await messageFor(echo);
    expect(got).toEqual(Object.fromEntries(Object.keys(forms).map((name) => [name, expected])));
  });

  it("redacts the api_key query value in a transport error even in a form no literal replacement covers", async () => {
    // URLSearchParams writes a space as "+" and "+" as "%2B": none of the raw,
    // encodeURIComponent or escape forms. Only the api_key=... pattern
    // catches it.
    const key = "secret key+1";
    const queryForm = new URLSearchParams({ api_key: key }).toString().slice("api_key=".length);
    expect([key, encodeURIComponent(key), escape(key)]).not.toContain(queryForm);
    const sdk = client(key);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = async (url) => {
      throw new TypeError(`fetch failed for ${url}`);
    };
    let quoted = 0;
    for (const [name, run] of callAll(sdk)) {
      let message = "";
      try {
        await run();
      } catch (error) {
        message = `${error.message}\n${error.stack}`;
      }
      if (message.includes("api_key=***")) quoted += 1;
      expect({ name, leaked: message.includes(queryForm) }).toEqual({ name, leaked: false });
    }
    expect(quoted).toBeGreaterThan(0);
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
