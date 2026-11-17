/**
 * @jest-environment node
 *
 * Behaviour fixes from depth-first audit 1 — each case failed on base 64659f1.
 */
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import {
  isSuccessFailure,
  isSuccessFlag,
  looksLikeHtml,
  looksLikeHtmlDownload,
  successFlagOfBody,
  uploadFilePart,
} from "../src/utils.js";
import { ZeroBounceWarmup } from "../src/warmup.js";

const FILE_ID = "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff";
const KEY = "behaviour-fix-key";

function client() {
  const sdk = new ZeroBounceSDK();
  sdk.init(KEY);
  return sdk;
}

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { get: () => "application/json" },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("looksLikeHtml skips leading whitespace", () => {
  it("detects HTML after padding before the 2000-character sniff window", () => {
    const padded = `${" ".repeat(1999)}<html><body>x</body></html>`;
    expect(looksLikeHtml(padded)).toBe(true);
  });

  it("does not treat CSV that begins with spaces as HTML", () => {
    const csv = "   email\ntest@example.com\n";
    expect(looksLikeHtml(csv)).toBe(false);
  });
});

describe("message-only and empty JSON on typed calls", () => {
  it("rejects {} and message-only bodies on sendFile with status 200", async () => {
    const sdk = client();
    const file = new Blob(["Email Address\n"], { type: "text/csv" });
    for (const body of ["{}", '{"message":"only"}', "{ }", "{\n}"]) {
      global.fetch = async () => jsonResponse(body);
      await expect(sdk.sendFile({ file, email_address_column: 1 })).rejects.toMatchObject({
        name: "ZBApiError",
        statusCode: 200,
      });
    }
  });

  it("rejects a finder message beside null documented fields", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"message":"Invalid domain","domain":null}');
    await expect(sdk.findEmailByDomain({ domain: "example.com" })).rejects.toMatchObject({
      name: "ZBApiError",
      statusCode: 200,
    });
  });

  it("keeps a finder body with only a null domain and no message", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"domain":null}');
    await expect(sdk.findEmailByDomain({ domain: "example.com" })).resolves.toEqual({ domain: null });
  });
});

describe("file status known-field rule", () => {
  it("rejects bodies with no known file-status field on getFileStatus", async () => {
    const sdk = client();
    const bodies = [
      '{"foo":1}',
      '{"":""}',
      '{"message":"m","file_id":null}',
      '{"message":"only"}',
    ];
    for (const body of bodies) {
      global.fetch = async () => jsonResponse(body);
      await expect(sdk.getFileStatus(FILE_ID)).rejects.toMatchObject({
        name: "ZBApiError",
        statusCode: 200,
      });
    }
  });

  it("accepts file_status or a real success flag", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"file_status":"Processing"}');
    await expect(sdk.getFileStatus(FILE_ID)).resolves.toEqual({ file_status: "Processing" });

    global.fetch = async () => jsonResponse('{"success":true}');
    await expect(sdk.getFileStatus(FILE_ID)).resolves.toEqual({ success: true });

    global.fetch = async () => jsonResponse('{"success":"1"}');
    await expect(sdk.getFileStatus(FILE_ID)).resolves.toEqual({ success: true });
  });

  it('rejects success string "0" on file status', async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"success":"0"}');
    await expect(sdk.getFileStatus(FILE_ID)).rejects.toMatchObject({
      name: "ZBApiError",
      statusCode: 200,
    });
  });

  it("accepts numeric success 1 and 1.0 as a true flag after field typing", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"success":1}');
    await expect(sdk.getFileStatus(FILE_ID)).resolves.toEqual({ success: true });

    global.fetch = async () => jsonResponse('{"file_status":"Processing","success":1.0}');
    await expect(sdk.getFileStatus(FILE_ID)).resolves.toEqual({
      file_status: "Processing",
      success: true,
    });
  });

  it("rejects numeric success 0 as a failure flag", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"success":0}');
    await expect(sdk.getFileStatus(FILE_ID)).rejects.toMatchObject({
      name: "ZBApiError",
      statusCode: 200,
    });
  });

  it('does not treat success 0.4 as a flag when it is the only field', async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"success":0.4}');
    await expect(sdk.getFileStatus(FILE_ID)).rejects.toMatchObject({
      name: "ZBApiError",
      statusCode: 200,
    });
  });
});

describe("success flag parsing", () => {
  it("treats only documented literals as flags", () => {
    for (const value of [0.4, 5, "maybe", [], {}, ""]) {
      expect(isSuccessFlag(value)).toBe(false);
    }
    for (const value of [true, false, 0, 1, 1.0, "true", "FALSE", " 1 ", "0"]) {
      expect(isSuccessFlag(value)).toBe(true);
    }
    expect(isSuccessFailure("0")).toBe(true);
    expect(isSuccessFailure("1")).toBe(false);
  });
});

describe("transport failures", () => {
  it("throws ZBApiError with statusCode 0 on connection refusal", async () => {
    const sdk = client();
    global.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(sdk.getCredits()).rejects.toMatchObject({
      name: "ZBApiError",
      statusCode: 0,
    });
  });
});

describe("browser getFile download name", () => {
  const csv = "email\na@b.c\n";

  beforeEach(() => {
    global.document = {
      body: { appendChild: jest.fn(), removeChild: jest.fn() },
      createElement: jest.fn(() => ({ href: "", download: "", click: jest.fn() })),
    };
    global.window = {
      URL: { createObjectURL: () => "blob:mock", revokeObjectURL: jest.fn() },
      navigator: {},
    };
    global.Blob = class Blob {};
    global.fetch = async () => ({
      status: 200,
      headers: { get: () => "text/csv" },
      text: async () => csv,
    });
  });

  it("includes the file id in the saved CSV name", async () => {
    const sdk = client();
    const name = await sdk.getFile(FILE_ID);
    expect(name).toBe(`result-${FILE_ID}.csv`);
  });

  it("includes the file id in the scoring CSV name", async () => {
    const sdk = client();
    const name = await sdk.getScoringFile(FILE_ID);
    expect(name).toBe(`result-${FILE_ID}-scoring.csv`);
  });
});
describe("success flag read from the raw text (audit js1 P)", () => {
  it("classifies a top-level success like the Pascal helper", () => {
    const cases = [
      ['{"success":true}', "true"],
      ['{"success":false}', "false"],
      ['{"success":0}', "false"],
      ['{"success":1}', "true"],
      ['{"success":1.0}', "true"],
      ['{"success":" FALSE "}', "false"],
      ['{"success":"True"}', "true"],
      ['{"success":"0"}', "false"],
      ['{"success":"1"}', "true"],
      ['{"success":null}', "notflag"],
      ['{"success":2}', "notflag"],
      ['{"success":0.4}', "notflag"],
      ['{"success":"maybe"}', "notflag"],
      ['{"success":"yes"}', "notflag"],
      ['{"success":{}}', "notflag"],
      ['{"x":1}', "absent"],
      ['{"meta":{"success":false},"a":"\\"success\\":false"}', "absent"],
      ['{"success":true,"success":false}', "false"],
      ['{"success":false,"success":true}', "false"],
      ['{"success":null,"success":true}', "true"],
      ['[{"success":false}]', "absent"],
    ];
    for (const [body, expected] of cases) expect([body, successFlagOfBody(body)]).toEqual([body, expected]);
  });

  it("a success that is no flag does not hide the message or the dead key", async () => {
    const sdk = client();
    const file = new Blob(["Email Address\n"], { type: "text/csv" });
    for (const success of ["null", "2", '"maybe"', "0.4", '"yes"', "{}"]) {
      global.fetch = async () => jsonResponse(`{"success":${success},"message":"Upload refused"}`);
      await expect(sdk.sendFile({ file, email_address_column: 1 })).rejects.toMatchObject({
        message: "Upload refused",
        statusCode: 200,
      });
      global.fetch = async () => jsonResponse(`{"success":${success},"error":"Something broke"}`);
      await expect(sdk.getApiUsage("2024-01-01", "2024-01-02")).rejects.toMatchObject({
        message: "Something broke",
        statusCode: 200,
      });
    }
    global.fetch = async () => jsonResponse('{"success":null}');
    await expect(sdk.getApiUsage("2024-01-01", "2024-01-02")).rejects.toMatchObject({ statusCode: 200 });
  });

  it("any false among duplicate success keys is a failure", async () => {
    const sdk = client();
    global.fetch = async () =>
      jsonResponse('{"success":false,"success":true,"file_id":"x","file_name":"f","message":"m"}');
    await expect(
      sdk.sendFile({ file: new Blob(["a\n"], { type: "text/csv" }), email_address_column: 1 })
    ).rejects.toMatchObject({ statusCode: 200 });
  });
});

describe("HTML whole-tag rule (audit js1 P)", () => {
  it("never treats a body that starts with { or [ as HTML, nor <htmlfoo> or <bodyguard>", () => {
    for (const body of [
      '{"firstname":"<body>"}',
      ' \n[{"a":"<html>"}]',
      '{"error":"bad <html> input"}',
      "<htmlfoo>",
      "<bodyguard>",
      "<header>x</header>",
    ]) {
      expect([body, looksLikeHtml(body)]).toEqual([body, false]);
    }
    for (const body of ["<HTML>", "<html lang=en>", "<body/>", "<!DOCTYPE html>", "  \ufeff<head\n>"]) {
      expect([body, looksLikeHtml(body)]).toEqual([body, true]);
    }
  });

  it("looks at the next character at the edge of the probe window", () => {
    expect(looksLikeHtml(`${"x".repeat(1995)}<body>`)).toBe(true);
    expect(looksLikeHtml(`${"x".repeat(1995)}<body>`.slice(0, 2000))).toBe(true);
    expect(looksLikeHtml(`${"x".repeat(1995)}<body` + "guard")).toBe(false);
  });

  it("a download is HTML by body only when it starts with <", () => {
    expect(looksLikeHtmlDownload("a,b\n1,<body>\n")).toBe(false);
    expect(looksLikeHtmlDownload('email,note\nx@y.z,"see <body> tag"\n')).toBe(false);
    expect(looksLikeHtmlDownload("  <html><body>x</body></html>")).toBe(true);
  });

  it("2xx answers and error bodies keep their JSON when a value holds a tag", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"error":"bad <html> input"}', 400);
    await expect(sdk.getCredits()).rejects.toMatchObject({ message: "bad <html> input", statusCode: 400 });
    global.fetch = async () => ({
      status: 200,
      headers: { get: () => "text/csv" },
      text: async () => 'email,note\nx@y.z,"see <body> tag"\n',
    });
    await expect(sdk.getFile(FILE_ID)).resolves.toEqual(expect.any(String));
  });

  it("Warmup: a JSON error with a tag in a string keeps its message; a CSV cell is not a page", async () => {
    const warmup = new ZeroBounceWarmup("warmup-test-key");
    global.fetch = async () => jsonResponse('{"detail":"bad <html> input"}', 400);
    await expect(warmup.listSendingAccounts()).rejects.toMatchObject({ message: "bad <html> input" });
    global.fetch = async () => ({
      status: 200,
      headers: { get: () => "text/csv" },
      text: async () => 'a,b\n1,"<body>"\n',
    });
    await expect(warmup._csv("/x")).resolves.toContain("<body>");
  });
});

describe("HTML title (audit js1 P)", () => {
  it("drops a title over 1000 characters and scans a hostile page in linear time", async () => {
    const sdk = client();
    global.fetch = async () => ({
      status: 502,
      headers: { get: () => "text/html" },
      text: async () => `<html><title>${"a".repeat(1001)}</title></html>`,
    });
    await expect(sdk.getCredits()).rejects.toMatchObject({
      message: "ZeroBounce returned an HTML error page instead of an API response.",
    });
    global.fetch = async () => ({
      status: 502,
      headers: { get: () => "text/html" },
      text: async () => `<html><title>Bad Gateway</title></html>`,
    });
    await expect(sdk.getCredits()).rejects.toMatchObject({
      message: 'ZeroBounce returned an HTML error page ("Bad Gateway") instead of an API response.',
    });
    const hostile = `<html>${"<title ".repeat(20000)}`;
    global.fetch = async () => ({ status: 502, headers: { get: () => "text/html" }, text: async () => hostile });
    const started = Date.now();
    await expect(sdk.getCredits()).rejects.toMatchObject({ statusCode: 502 });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("message lists and getCredits message (audit js1 P)", () => {
  it("joins a list of messages with a newline", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"message":["a","b"]}', 400);
    await expect(sdk.getCredits()).rejects.toMatchObject({ message: "a\nb" });
    const warmup = new ZeroBounceWarmup("warmup-test-key");
    global.fetch = async () => jsonResponse('{"detail":["a","b"]}', 400);
    await expect(warmup.listSendingAccounts()).rejects.toMatchObject({ message: "a\nb" });
  });

  it("getCredits {\"message\":\"x\"} is an error with that text", async () => {
    const sdk = client();
    global.fetch = async () => jsonResponse('{"message":"x"}');
    await expect(sdk.getCredits()).rejects.toMatchObject({ message: "x", statusCode: 200 });
  });
});

// ---- audit 2, fixer U: transport, downloads, errors ----

function textResponse(body, { status = 200, contentType = "text/csv", type } = {}) {
  return {
    status,
    type,
    headers: { get: (name) => (String(name).toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

describe("transport cause text is redacted, and omitted when it is long", () => {
  const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  it("never leaves a prefix of the key, whatever offset it straddles", async () => {
    for (let offset = 280; offset <= 310; offset += 1) {
      global.fetch = async () => {
        const error = new TypeError("fetch failed");
        error.cause = Object.assign(new Error(`${"x".repeat(offset)}${KEY} tail`), { code: "ECONNRESET" });
        throw error;
      };
      const error = await rejection(client().getCredits());
      expect(error.message).toContain("ECONNRESET");
      expect([offset, error.message.includes(KEY.slice(0, 5))]).toEqual([offset, false]);
    }
  });

  it("shows no cut tail: a redacted cause over 300 characters is omitted", async () => {
    for (const pad of [298, 299, 300, 301]) {
      global.fetch = async () => {
        const error = new TypeError("fetch failed");
        error.cause = new Error(`${"x".repeat(pad)}${"\u{1F600}".repeat(10)}`);
        throw error;
      };
      const error = await rejection(client().getCredits());
      expect([pad, LONE_SURROGATE.test(error.message)]).toEqual([pad, false]);
      expect(error.message).toContain("(details omitted: too long)");
    }
  });

  it("leaves no start of a long secret that is repeated many times", () => {
    const { transportError } = require("../src/utils.js");
    const secret = "P" + "abcdefghijklmnopqrstuvwxyz".repeat(9).slice(0, 221);
    const error = new TypeError("fetch failed");
    error.cause = { code: "ECONNRESET", message: `${secret.repeat(91)}${secret}` }; // 20,424 characters: past a pre-cut at 20,000
    const message = transportError(error, [secret]).message;
    expect(message).not.toContain(secret.slice(0, 4));
    expect(message).toMatch(/^TypeError: fetch failed \(ECONNRESET: \*+\)$/);
    error.cause = { code: "ECONNRESET", message: secret.repeat(130) };
    expect(transportError(error, [secret]).message).toBe("TypeError: fetch failed (ECONNRESET: details omitted: too long)");
    // Without the omission the cut text carried the start of the secret.
    const half = new TypeError("fetch failed");
    half.cause = { code: "E", message: `${"y".repeat(299)}${secret.slice(0, 15)}` };
    expect(transportError(half, [secret]).message).not.toContain(secret.slice(0, 8));
  });

  it("does not mask the SDK's own words with a one-letter secret", () => {
    const { transportError } = require("../src/utils.js");
    const error = new TypeError("fetch failed");
    error.cause = { code: "E", message: "x".repeat(400) };
    expect(transportError(error, ["o"]).message).toContain("(E: details omitted: too long)");
    const status = transportError(new TypeError("the response has no HTTP status"), []).message;
    expect(status).toBe("TypeError: the response has no HTTP status");
  });
});

describe("redirects (main client)", () => {
  it("reports a browser's opaque redirect with status 0", async () => {
    global.fetch = async () => textResponse("", { status: 0, type: "opaqueredirect" });
    const error = await rejection(client().getCredits());
    expect(error).toMatchObject({ statusCode: 0 });
    expect(error.message).toMatch(/redirect/);
  });

  it("treats a bare 300 as a redirect, and 299 and 400 as no redirect", async () => {
    global.fetch = async () => textResponse("", { status: 300 });
    const error = await rejection(client().getCredits());
    expect(error).toMatchObject({ statusCode: 300 });
    expect(error.message).toMatch(/redirect/);
    global.fetch = async () => textResponse("", { status: 400, contentType: "application/json" });
    expect((await rejection(client().getCredits())).message).not.toMatch(/redirect/);
  });
});

describe("Warmup transport matches the main client", () => {
  const warmup = () => new ZeroBounceWarmup("warmup-fix-key");

  it("sends redirect: manual and reports a 3xx and an opaque redirect", async () => {
    let init;
    global.fetch = async (url, options) => {
      init = options;
      return textResponse("", { status: 302 });
    };
    const error = await rejection(warmup().getSeeds());
    expect(init.redirect).toBe("manual");
    expect(error).toMatchObject({ statusCode: 302 });
    global.fetch = async () => textResponse("", { status: 0, type: "opaqueredirect" });
    const opaque = await rejection(warmup().getSeeds());
    expect(opaque).toMatchObject({ statusCode: 0 });
    expect(opaque.message).toMatch(/redirect/);
    global.fetch = async () => textResponse("", { status: 300 });
    expect(await rejection(warmup().getSeeds())).toMatchObject({ statusCode: 300 });
  });

  it("keeps the cause text of a transport failure, redacted", async () => {
    global.fetch = async () => {
      const error = new TypeError("fetch failed");
      error.cause = Object.assign(new Error("connect ECONNREFUSED warmup-fix-key"), { code: "ECONNREFUSED" });
      throw error;
    };
    const error = await rejection(warmup().getSeeds());
    expect(error.message).toContain("ECONNREFUSED");
    expect(error.message).not.toContain("warmup-fix-key");
  });

  it("rejects a status-0 response instead of resolving null", async () => {
    global.fetch = async () => textResponse("", { status: 0, type: "error" });
    const error = await rejection(warmup().listSendingAccounts());
    expect(error).toMatchObject({ name: "ZBApiError", statusCode: 0 });
  });
});

describe("file argument is real bytes", () => {
  const args = { email_address_column: 1 };
  it("refuses a plain object that only claims the Uint8Array tag", async () => {
    let sent = 0;
    global.fetch = async () => {
      sent += 1;
      return jsonResponse({ success: true, message: "ok", file_id: "f", file_name: "n" });
    };
    const fake = { [Symbol.toStringTag]: "Uint8Array", length: 1 };
    await expect(client().sendFile({ file: fake, ...args })).rejects.toThrow(/must be a Blob/);
    expect(sent).toBe(0);
  });

  it("accepts a Uint8Array made in another realm", async () => {
    const foreign = require("vm").runInNewContext("new Uint8Array([97, 10])");
    expect(foreign instanceof Uint8Array).toBe(false);
    const [part, name] = uploadFilePart(foreign, "x.csv");
    expect(part).toBeDefined();
    expect(name).toBe("x.csv");
  });
});

describe("downloads that are HTML pages", () => {
  const HTML_TEXT = "ZeroBounce returned an HTML page (text/html) instead of a file.";
  const PAGE_TEXT = "ZeroBounce returned an HTML page instead of a file.";
  it("refuses a body that starts with < after padding, whatever its tags", async () => {
    for (const body of ["<title>Access denied</title>", "  \n<p>Access denied</p>", "﻿<div>x</div>"]) {
      global.fetch = async () => textResponse(body);
      const error = await rejection(client().getFile(FILE_ID));
      expect([body, error.message]).toEqual([body, PAGE_TEXT]);
    }
    expect(looksLikeHtmlDownload("<p>x</p>")).toBe(true);
    expect(looksLikeHtmlDownload("a,b\n<body>,1\n")).toBe(false);
  });

  it("gives the fixed text, not the rows, for text/html content", async () => {
    global.fetch = async () => textResponse("email,status\nsecret@example.com,valid\n", { contentType: "text/html" });
    const error = await rejection(client().getFile(FILE_ID));
    expect(error.message).toBe(HTML_TEXT);
    global.fetch = async () => textResponse("email,status\nsecret@example.com,valid\n", { contentType: "text/html; charset=utf-8" });
    const seeds = await rejection(new ZeroBounceWarmup("warmup-fix-key").downloadSeeds());
    expect(seeds.message).toBe(HTML_TEXT);
    global.fetch = async () => textResponse("<title>Denied</title>");
    expect((await rejection(new ZeroBounceWarmup("warmup-fix-key").downloadSeeds())).message).toBe(PAGE_TEXT);
  });

  it("names text/html only when the content type is text/html", async () => {
    global.fetch = async () => textResponse("<p>x</p>", { contentType: "text/csv" });
    expect((await rejection(client().getFile(FILE_ID))).message).toBe(PAGE_TEXT);
    global.fetch = async () => textResponse("<p>x</p>", { contentType: "text/html" });
    expect((await rejection(client().getFile(FILE_ID))).message).toBe(HTML_TEXT);
  });

  it("keeps the API message of a JSON or plain-text error served as text/html", async () => {
    const json = '{"success":false,"message":"File not found"}';
    for (const status of [200, 400]) {
      global.fetch = async () => textResponse(json, { status, contentType: "text/html" });
      const error = await rejection(client().getFile(FILE_ID));
      expect([status, error.message, error.statusCode]).toEqual([status, "File not found", status]);
      global.fetch = async () => textResponse(json, { status, contentType: "text/html" });
      const warm = await rejection(new ZeroBounceWarmup("warmup-fix-key").downloadSeeds());
      expect([status, warm.message]).toEqual([status, "File not found"]);
    }
    global.fetch = async () => textResponse("Internal error: quota exceeded", { status: 500, contentType: "text/html" });
    expect((await rejection(client().getFile(FILE_ID))).message).toBe("Internal error: quota exceeded");
    // CSV rows under text/html on a 200 are still no file.
    global.fetch = async () => textResponse("email,status\na@example.com,valid\n", { contentType: "text/html" });
    expect((await rejection(client().getFile(FILE_ID))).message).toBe(HTML_TEXT);
  });

  it("still returns a CSV", async () => {
    global.fetch = async () => textResponse("email,status\na@example.com,valid\n");
    await expect(client().getFile(FILE_ID)).resolves.toMatch(/\.csv$|^email,status/);
  });
});

describe("successFlagOfBody reads JSON numbers by value", () => {
  it("classifies flags and non-flags", () => {
    const flag = (token) => successFlagOfBody(`{"success":${token}}`);
    for (const token of ["0e5", "-0", "0.0", "0E0", "-0.0e-3"]) expect([token, flag(token)]).toEqual([token, "false"]);
    for (const token of ["1.0", "1e0", "1E+0", "1.0000000000000000001", "10e-1"]) expect([token, flag(token)]).toEqual([token, "true"]);
    for (const token of ["0.4", "2", "1e400", "-1", "01", "0x1", "1.5"]) expect([token, flag(token)]).toEqual([token, "notflag"]);
  });
});

describe("HTML titles are cut from the original text", () => {
  it("finds tags in any case and never shows lower-cased text", async () => {
    const page = "<HTML><HEAD>İİİ<TITLE>İstanbul Access Denied</TITLE></HEAD></HTML>";
    global.fetch = async () => textResponse(page, { status: 403, contentType: "text/html" });
    const error = await rejection(client().getCredits());
    expect(error.message).toContain('("İstanbul Access Denied")');
    expect(error.message).not.toContain("istanbul");
  });
});

describe("transport URL guards, each on its own", () => {
  const { requireHttpsUrl } = require("../src/utils.js");
  const detail = /a non-ASCII character or a "%" in the host/;
  it("refuses a host the parser rewrites to another address", () => {
    for (const url of ["https://127.1/v2", "https://2130706433/v2", "https://0x7f.0.0.1/v2", "https://0177.0.0.1/v2"]) {
      expect(() => requireHttpsUrl(url)).toThrow(detail);
    }
  });
  it("refuses a % in the host with the long message, not as a parse failure", () => {
    expect(() => requireHttpsUrl("https://exa%zzmple.com/v2")).toThrow(detail);
  });
});

describe("validateEmail treats message-only bodies as errors, except the greylist answer", () => {
  const bodies = [
    { message: "bad" },
    { success: null, message: "bad" },
    { success: "maybe", message: "bad" },
    { success: 0.4, message: "bad" },
    { success: {}, message: "bad" },
    { success: "", message: "bad" },
    { success: [], message: "bad" },
    { message: "bad", address: null, status: null },
  ];
  for (const method of ["GET", "POST"]) {
    it(`rejects with ZBApiError 200 and the message (${method})`, async () => {
      for (const body of bodies) {
        global.fetch = async () => jsonResponse(body);
        const error = await rejection(client().validateEmail("a@example.com", { method }));
        expect([JSON.stringify(body), error.name, error.statusCode, error.message]).toEqual([
          JSON.stringify(body),
          "ZBApiError",
          200,
          "bad",
        ]);
      }
    });
    it(`still returns the greylist answer, and results with null or extra fields (${method})`, async () => {
      global.fetch = async () => jsonResponse({ Message: "Greylist validation still in progress..." });
      const grey = await client().validateEmail("a@example.com", { method });
      expect(grey.message).toBe("Greylist validation still in progress...");
      global.fetch = async () => jsonResponse({ address: "a@example.com", status: "valid", sub_status: null });
      await expect(client().validateEmail("a@example.com", { method })).resolves.toMatchObject({ status: "valid" });
      global.fetch = async () => jsonResponse({ Message: "note", address: "a@example.com", status: "valid" });
      await expect(client().validateEmail("a@example.com", { method })).resolves.toMatchObject({ status: "valid" });
    });
  }
});
