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
