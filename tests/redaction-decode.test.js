/**
 * Each decode step of the redaction check (standard.md §3: redaction is
 * closed under encoding), one test per step, so removing or weakening any
 * one of them fails here: %XX (upper- and lower-case hex, and runs that are
 * not valid UTF-8), "+" as a space, JSON escapes, \uXXXX (surrogate pairs
 * included), NUL / %00 not ending the check, and four layers (the SDK's own
 * request encoding plus three echo layers).
 *
 * Every echo below is a spelling the SDK's list of known forms does not
 * produce, so only the decode check can catch it. Offline: no network.
 */
import { CREDENTIAL_OMITTED_MESSAGE, holdsSecret, redactSecrets } from "../src/utils.js";
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { ZeroBounceWarmup } from "../src/warmup.js";

const KEY = "k3y-AbC123-secret";
const NON_ASCII = "pässwörd-Sécret1";
const EMOJI = "key-\u{1F600}-z";

/** Every UTF-8 byte as %XX, letters included (encodeURIComponent leaves those alone). */
const percentAll = (text, lower = false) =>
  [...Buffer.from(text, "utf8")]
    .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
    .map((pct) => (lower ? pct : pct.toUpperCase()))
    .join("");
/** Every UTF-16 unit as \uXXXX. */
const unicodeAll = (text) =>
  [...text].flatMap((char) => (char.length === 2 ? [char[0], char[1]] : [char]))
    .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .join("");

function expectOmitted(echo, secret) {
  const text = `Bad Request: [${echo}]`;
  expect({ echo, held: holdsSecret(text, [secret]) }).toEqual({ echo, held: true });
  expect(redactSecrets(text, [secret])).toBe(CREDENTIAL_OMITTED_MESSAGE);
}

describe("redaction decode steps", () => {
  it("decodes %XX with upper- and lower-case hex", () => {
    for (const secret of [KEY, NON_ASCII, EMOJI]) {
      expectOmitted(percentAll(secret), secret);
      expectOmitted(percentAll(secret, true), secret);
    }
  });

  it("decodes a %XX run that is not valid UTF-8 as a whole, one sequence at a time", () => {
    // A stray byte that starts no UTF-8 sequence, a lead byte cut short, a
    // lone continuation byte and a Latin-1 "ä": each makes the whole run
    // invalid for decodeURIComponent, and the secret after it must still be read.
    for (const junk of ["%FF", "%ff", "%C3", "%80", "%E4", "%F0%9F", "%ED%A0%80"]) {
      for (const secret of [KEY, NON_ASCII, EMOJI]) {
        expectOmitted(`${junk}${percentAll(secret)}`, secret);
        expectOmitted(`${percentAll(secret)}${junk}`, secret);
      }
    }
  });

  it("decodes every UTF-8 sequence length (2, 3 and 4 bytes) in a run that is not valid UTF-8 as a whole", () => {
    // Secrets made only of 2-, 3- or 4-byte characters: no ASCII between them
    // splits the run, so the one-sequence-at-a-time decoder alone must read
    // each length (dropping a length from utf8SequenceLength leaks it).
    for (const secret of ["éééééééé", "€€€€€€€€", "\u{1F600}\u{1F600}\u{1F600}\u{1F600}"]) {
      for (const lower of [false, true]) {
        for (const junk of ["%FF", "%ff", "%80"]) {
          for (const echo of [`${junk}${percentAll(secret, lower)}`, `${percentAll(secret, lower)}${junk}`]) {
            // Upper-case hex is encodeURIComponent's own form, replaced with
            // *** before the check; lower-case hex reaches the check alone.
            const text = `Bad Request: [${echo}]`;
            const redacted = redactSecrets(text, [secret]);
            expect({ echo, held: holdsSecret(text, [secret]), leaked: holdsSecret(redacted, [secret]) }).toEqual({
              echo,
              held: true,
              leaked: false,
            });
            if (lower) expect(redacted).toBe(CREDENTIAL_OMITTED_MESSAGE);
          }
        }
      }
    }
  });

  it("keeps the bytes of an invalid run it cannot decode, so text without a secret is unchanged", () => {
    const text = "Bad Request: [%FF%41%C3 %e4]";
    expect(redactSecrets(text, [KEY])).toBe(text);
    // The run is also read as Latin-1 (below), so "ÿ" shows; a secret that is not in it does not.
    expect(holdsSecret(text, ["ÿ"])).toBe(true);
    expect(holdsSecret(text, ["zzz"])).toBe(false);
  });

  it("decodes every \\u and \\U spelling of a key, as a body might echo it", () => {
    const key = "zb-key-\u00e9-\u{1F600}";
    const hex4 = (c) => c.toString(16).padStart(4, "0");
    const spellings = {
      "\\uXXXX": [...key].map((ch) => { const c = ch.codePointAt(0); return c > 0xffff ? Array.from({ length: ch.length }, (_, i) => "\\u" + hex4(ch.charCodeAt(i))).join("") : "\\u" + hex4(c); }).join(""),
      "\\UXXXX": [...key].map((ch) => { const c = ch.codePointAt(0); return c > 0xffff ? Array.from({ length: ch.length }, (_, i) => "\\U" + hex4(ch.charCodeAt(i))).join("") : "\\U" + hex4(c); }).join(""),
      "\\UXXXXXXXX": [...key].map((ch) => "\\U" + ch.codePointAt(0).toString(16).padStart(8, "0")).join(""),
      "\\U{...}": [...key].map((ch) => "\\U{" + ch.codePointAt(0).toString(16) + "}").join(""),
      "\\u{...}": [...key].map((ch) => "\\u{" + ch.codePointAt(0).toString(16) + "}").join(""),
    };
    for (const [name, echo] of Object.entries(spellings)) {
      expect([name, holdsSecret(`bad ${echo} end`, [key])]).toEqual([name, true]);
      expect([name, redactSecrets(`bad ${echo} end`, [key])]).toEqual([name, CREDENTIAL_OMITTED_MESSAGE]);
    }
    // A lower-case \\u pair written with \\U for one half, and a \\UXXXX run, as in the finding.
    const ascii = "zbkey";
    const echoed = [...ascii].map((ch) => "\\U" + ch.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    expect(redactSecrets(`Invalid key ${echoed}`, [ascii])).toBe(CREDENTIAL_OMITTED_MESSAGE);
    expect(holdsSecret("\\U12345678 \\UZZZZ", [ascii])).toBe(false);
  });

  it("reads a run of byte escapes or %XX as UTF-8, and as Latin-1 too", () => {
    const key = "k\u00e9y-\u00e4-\u20ac";
    const bytes = [...Buffer.from(key, "utf8")];
    const xs = bytes.map((b) => "\\x" + b.toString(16).padStart(2, "0")).join("");
    const octal = bytes.map((b) => "\\" + b.toString(8).padStart(3, "0")).join("");
    const percent = bytes.map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
    for (const [name, echo] of [["hex", xs], ["octal", octal], ["percent", percent]]) {
      expect([name, holdsSecret(`bad ${echo} end`, [key])]).toEqual([name, true]);
    }
    // A Latin-1 key echoed by byte: %E9, \xe9, \351.
    const latin = "caf\u00e9-key";
    for (const echo of ["caf%E9-key", "caf\\xe9-key", "caf\\351-key"]) {
      expect([echo, holdsSecret(`bad ${echo} end`, [latin])]).toEqual([echo, true]);
    }
    expect(holdsSecret("caf%E8-key \\xe8 \\350", [latin])).toBe(false);
  });

  it("decodes '+' as a space (form encoding)", () => {
    const secret = "smtp pass word";
    expectOmitted(percentAll(secret).split("%20").join("+"), secret);
  });

  it("decodes JSON escapes and \\uXXXX, surrogate pairs included", () => {
    expectOmitted(unicodeAll(KEY), KEY);
    expectOmitted(unicodeAll(NON_ASCII), NON_ASCII);
    expectOmitted(unicodeAll(EMOJI), EMOJI);
    expectOmitted(`\\u0045\\ud83d\\ude00`, `E\u{1F600}`);
    const quoted = 'a"b\\c/d';
    expectOmitted(`\\u0061\\"\\u0062\\\\\\u0063\\/\\u0064`, quoted);
  });

  it("does not stop at a NUL or %00 in the body", () => {
    expectOmitted(`\u0000${percentAll(KEY)}`, KEY);
    expectOmitted(`%00${percentAll(KEY)}`, KEY);
    expectOmitted(`\\u0000${unicodeAll(KEY)}`, KEY);
  });

  it("decodes four layers: the SDK's request encoding plus three echo layers", () => {
    const secret = "s%e c+r/e\"t";
    let echo = secret;
    for (let i = 0; i < 4; i += 1) echo = encodeURIComponent(echo);
    expectOmitted(echo, secret);
    const json = (text) => JSON.stringify(text).slice(1, -1);
    expectOmitted(encodeURIComponent(json(encodeURIComponent(json(secret)))), secret);
  });

  it("checks a body with no '%' or '\\' too: no shortcut skips the decode check", () => {
    // Only "\\u" escapes, no "%"; only "%", no "\\"; the raw key is replaced, the rest stays.
    expectOmitted(`id ${unicodeAll(KEY)}`, KEY);
    expectOmitted(`id ${percentAll(KEY)}`, KEY);
    expect(redactSecrets(`plain ${KEY} text`, [KEY])).toBe("plain *** text");
  });

  it("omits an invalid-UTF-8 echo of the key from a validateEmail error", async () => {
    const previous = global.fetch;
    try {
      const sdk = new ZeroBounceSDK();
      sdk.init(KEY);
      global.fetch = async () => ({
        status: 400,
        ok: false,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({ error: `Invalid API key: %FF${percentAll(KEY)}` }),
      });
      await expect(sdk.validateEmail("a@example.com")).rejects.toMatchObject({
        statusCode: 400,
        message: CREDENTIAL_OMITTED_MESSAGE,
      });
    } finally {
      global.fetch = previous;
    }
  });

  it("omits a non-ASCII SMTP password echoed after an invalid byte from a testSmtpConfiguration error", async () => {
    const previous = global.fetch;
    try {
      const warmup = new ZeroBounceWarmup("warmup-key");
      for (const echo of [percentAll(NON_ASCII), `%FF${percentAll(NON_ASCII)}`, `%FF ${percentAll(NON_ASCII)}`]) {
        global.fetch = async () => ({
          status: 400,
          ok: false,
          headers: { get: () => "text/plain" },
          text: async () => `login failed ${echo}`,
        });
        const error = await warmup
          .testSmtpConfiguration({ fromAddress: "a@example.com", username: "user", password: NON_ASCII, server: "smtp.example.com", port: 587 })
          .then(() => null, (thrown) => thrown);
        expect({ echo, message: error && error.message }).toEqual({ echo, message: CREDENTIAL_OMITTED_MESSAGE });
      }
    } finally {
      global.fetch = previous;
    }
  });
});
