/**
 * Security: base URL rules, invisible API keys, and quote or entity redaction.
 * Offline only; stubs fetch where a call is needed.
 */
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { ZeroBounceWarmup } from "../src/warmup.js";
import {
  CREDENTIAL_OMITTED_MESSAGE,
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

describe("checkApiKey", () => {
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