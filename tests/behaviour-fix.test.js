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
} from "../src/utils.js";

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