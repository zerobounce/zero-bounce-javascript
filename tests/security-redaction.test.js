/**
 * Security: base URL rules, invisible API keys, and quote or entity redaction.
 * Offline only; stubs fetch where a call is needed.
 */
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { ZeroBounceWarmup } from "../src/warmup.js";
import {
  CREDENTIAL_OMITTED_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
  holdsSecret,
  redactSecrets,
  requireHttpsUrl,
  checkApiKey,
} from "../src/utils.js";

const KEY = "k'3y-AbC";

describe("requireHttpsUrl", () => {
  it("refuses userinfo before send without quoting the URL", () => {
    expect(() => requireHttpsUrl("https://api.zerobounce.net@evil.example/v2")).toThrow(
      "ZeroBounce: apiBaseURL must not contain a username or password."
    );
    expect(() => requireHttpsUrl("https://@host/v2", "baseURL")).toThrow(/username or password/);
    expect(() => requireHttpsUrl("https://api.zerobounce.net/v2")).not.toThrow();
  });

  it("refuses query and fragment without quoting the URL", () => {
    for (const url of ["https://host/v2?", "https://host/v2#x", "https://host/v2?"]) {
      expect(() => requireHttpsUrl(url)).toThrow(/query string or a fragment/);
    }
  });
});

describe("requireHttpsUrl, the raw string", () => {
  const refusedBase = [
    ["a tab", "https://api.zerobounce.net/v2\t"],
    ["a tab inside the host", "https://api.zero\tbounce.net/v2"],
    ["a line feed", "https://api.zerobounce.net/v2\n"],
    ["a carriage return", "https://api.zerobounce.net\r/v2"],
    ["a leading space", " https://api.zerobounce.net/v2"],
    ["a trailing space", "https://api.zerobounce.net/v2 "],
    ["a no-break space", "https://api.zerobounce.net/v2\u00a0"],
    ["a zero-width space in the host", "https://api.zerobounce\u200b.net/v2"],
    ["a soft hyphen", "https://api.zerobounce.net/v\u00ad2"],
    ["a bidi override", "https://api.zerobounce.net/\u202ev2"],
    ["a variation selector", "https://api.zerobounce.net/v2\ufe0f"],
    ["U+2800", "https://api.zerobounce.net/v2\u2800"],
    ["a C1 control", "https://api.zerobounce.net/v2\u0085"],
    ["a backslash", "https://evil.example\\v2"],
    ["backslashes after the scheme", "https:\\\\evil.example\\v2"],
    ["a lone high surrogate", "https://api.zerobounce.net/v2\ud800"],
    ["a lone low surrogate", "https://api.zerobounce.net/\udc00v2"],
    ["a Cyrillic host letter", "https://api.zerob\u043eunce.net/v2"],
    ["a fullwidth dot", "https://api.zerobounce\uff0enet/v2"],
    ["a percent-encoded dot in the host", "https://api%2ezerobounce.net/v2"],
    ["a percent-encoded letter in the host", "https://api.zerobounce%2Enet/v2"],
    ["an encoded slash in the path", "https://api.zerobounce.net/v2%2f..%2fx"],
    ["a dot segment", "https://api.zerobounce.net/v2/../x"],
    ["no host", "https:///v2"],
    ["no scheme separator", "https:api.zerobounce.net"],
    ["an empty string", ""],
    ["a number", 5],
    ["null", null],
    ["plain http to a real host", "http://api.zerobounce.net/v2"],
    ["plain http to a look-alike of loopback", "http://127.0.0.1.evil.example/v2"],
    ["ftp", "ftp://api.zerobounce.net/v2"],
  ];

  it.each(refusedBase)("refuses %s without quoting the URL", (_name, url) => {
    let error = null;
    try {
      requireHttpsUrl(url, "apiBaseURL");
    } catch (caught) {
      error = caught;
    }
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/^ZeroBounce: apiBaseURL must be an https:\/\/ URL/);
    if (typeof url === "string" && url.length > 12) expect(error.message).not.toContain("zerobounce.net/v2");
  });

  it("refuses a Cyrillic or fullwidth host also in the request URL, and a tab or space in it", () => {
    for (const url of ["https://api.zerob\u043eunce.net/v2/x?api_key=k", "https://api.zerobounce.net/v2/x?a=b c", "https://api.zerobounce.net/\tv2"]) {
      expect(() => requireHttpsUrl(url, "request URL")).toThrow(/request URL must be an https/);
    }
  });

  it("accepts the clean forms: https, loopback http, a port, an IPv6 loopback, a trailing slash", () => {
    for (const url of [
      "https://api.zerobounce.net/v2",
      "HTTPS://API.ZEROBOUNCE.NET/v2/",
      "https://api-us.zerobounce.net/v2",
      "https://host.example:8443/v2",
      "http://127.0.0.1:8080/v2",
      "http://localhost:3000",
      "http://[::1]:9000/v2",
      "https://bulkapi.zerobounce.net",
    ]) {
      expect(() => requireHttpsUrl(url, "apiBaseURL")).not.toThrow();
    }
  });

  it("refuses the same bad URLs through init and the Warmup constructor", () => {
    for (const url of ["https://api.zerobounce.net/v2\t", " https://api.zerobounce.net/v2", "https://api.zerob\u043eunce.net/v2"]) {
      expect(() => new ZeroBounceSDK().init("k", url)).toThrow(/apiBaseURL must be an https/);
      expect(() => new ZeroBounceWarmup("k", url)).toThrow(/baseURL must be an https/);
    }
  });
});

describe("checkApiKey", () => {
  it("refuses C1 controls (NEL included), lone surrogates and U+2800, mid-key too", () => {
    for (const ch of ["\u0080", "\u0085", "\u009f", "\ud800", "\udfff", "\u2800", "\ud83d"]) {
      expect(() => checkApiKey(`ab${ch}cd`)).toThrow(/whitespace or control/);
    }
    expect(() => checkApiKey("ab\u00a1cd\u{1F600}")).not.toThrow();
    expect(() => checkApiKey("ab\ud83d\ude00cd")).not.toThrow();
  });

  it("refuses invisible characters and allows a mid-key ordinary space", () => {
    const chars = [
      "\u00a0",
      "\u202e",
      "\u200b",
      "\u180b",
      "\u2066",
      "\u0600",
      "\u0890",
      "\u00ad",
      "\ufff9",
      "\u{1d173}",
    ];
    for (const ch of chars) {
      expect(() => checkApiKey(`ab${ch}cd`)).toThrow(/whitespace or control/);
    }
    expect(() => checkApiKey("ab cd")).not.toThrow();
    expect(() => checkApiKey("   ")).toThrow(/missing/);
  });
});

describe("redactSecrets cost cap", () => {
  it("replaces text over 64 KiB by a fixed message, and keeps text at the cap", () => {
    const key = "zb-cap-key";
    expect(redactSecrets(`x ${key} `.padEnd(65537, "y"), [key])).toBe(TEXT_TOO_LONG_MESSAGE);
    // Multi-byte text is counted in bytes: 30000 three-byte characters is 90000 bytes.
    expect(redactSecrets("\u20ac".repeat(30000), [key])).toBe(TEXT_TOO_LONG_MESSAGE);
    expect(redactSecrets(`x ${key} `.padEnd(65536, "y"), [key])).toBe(`x *** `.padEnd(65536 - key.length + 3, "y"));
    expect(TEXT_TOO_LONG_MESSAGE).not.toContain(key);
  });
});

describe("redactSecrets quote and fold", () => {
  const apostropheKey = "my'key";

  it.each([
    ["\\u{27}", "bad my\\u{27}key end"],
    ["\\047", "bad my\\047key end"],
    ["\\x27", "bad my\\x27key end"],
    ["\\U{27}", "bad my\\U{27}key end"],
    ["\\'", "bad my\\'key end"],
    ["&apos;", "bad my&apos;key end"],
    ["&#39", "bad my&#39;key end"],
  ])("decodes %s spellings of a quote in the key", (_label, text) => {
    expect(holdsSecret(text, [apostropheKey])).toBe(true);
    expect(redactSecrets(text, [apostropheKey])).toBe(CREDENTIAL_OMITTED_MESSAGE);
  });

  it("does not decode %u0027 as a quote", () => {
    const text = "bad %u0027key end";
    expect(holdsSecret(text, [apostropheKey])).toBe(false);
  });

  it("redacts ß echoed as SS and Greek U+1F80+U+0301 against U+1F84 both ways", () => {
    const eszett = "stra\u00dfe-key";
    expect(redactSecrets(`bad STRASSE-KEY!`, [eszett])).toBe("bad ***!");
    const dec = "k\u1f80\u0301-key9";
    const nfc = "k\u1f84-key9";
    expect(redactSecrets(`bad ${nfc} here`, [dec])).toBe(CREDENTIAL_OMITTED_MESSAGE);
    expect(redactSecrets(`bad ${dec} here`, [nfc])).toBe(CREDENTIAL_OMITTED_MESSAGE);
    expect(holdsSecret(`bad ${nfc} here`, [dec])).toBe(true);
  });

  it("redacts an HTML title that carries the key through an entity", () => {
    const body = `<html><head><title>Invalid key my&#39;key</title></head><body></body></html>`;
    expect(redactSecrets(body, [apostropheKey])).toBe(CREDENTIAL_OMITTED_MESSAGE);
  });

  it("redacts the Warmup SMTP password spelled with \\u{27}", async () => {
    const password = "smtp'pass";
    const previous = global.fetch;
    try {
      const warmup = new ZeroBounceWarmup("warmup-key");
      global.fetch = async () => ({
        status: 400,
        ok: false,
        headers: { get: () => "text/plain" },
        text: async () => `login failed smtp\\u{27}pass`,
      });
      const error = await warmup
        .testSmtpConfiguration({
          fromAddress: "a@example.com",
          username: "user",
          password,
          server: "smtp.example.com",
          port: 587,
        })
        .then(() => null, (thrown) => thrown);
      expect(error.message).toBe(CREDENTIAL_OMITTED_MESSAGE);
    } finally {
      global.fetch = previous;
    }
  });
});

describe("init refuses bad base URLs", () => {
  it("does not send getCredits to evil.example when userinfo is in the base URL", async () => {
    const sdk = new ZeroBounceSDK();
    const calls = [];
    const previous = global.fetch;
    global.fetch = async (url) => {
      calls.push(String(url));
      return { status: 200, ok: true, headers: { get: () => "application/json" }, text: async () => '{"Credits":"1"}' };
    };
    try {
      expect(() => sdk.init("valid-key", "https://api.zerobounce.net@evil.example/v2")).toThrow(/username or password/);
      await expect(sdk.getCredits()).rejects.toThrow(/init/);
      expect(calls).toEqual([]);
    } finally {
      global.fetch = previous;
    }
  });
});