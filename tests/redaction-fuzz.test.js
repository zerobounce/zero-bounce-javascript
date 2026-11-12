/**
 * Redaction is closed under encoding (standard.md §3, checks S4/S7): a secret
 * echoed through any sequence of up to three encodings (URL with %20, URL with
 * "+", JSON, JSON with "/" as "\/") never reaches a caller in any decoded view
 * of the error: message, other fields, cause chain or inspect() output.
 *
 * Every sequence of length 1 to 3 is tried (4 + 16 + 64), for a fixed awkward
 * secret and for secrets shuffled by a seeded generator. Offline: replaces
 * global fetch; no network and no real key.
 */
import { inspect } from "util";
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { ZeroBounceWarmup } from "../src/warmup.js";
import { AWKWARD_SECRET_CHARS } from "./secret-forms.js";

const ENCODINGS = {
  "URL %20": (text) => encodeURIComponent(text),
  "URL +": (text) => new URLSearchParams({ s: text }).toString().slice(2),
  JSON: (text) => JSON.stringify(text).slice(1, -1),
  "JSON \\/": (text) => JSON.stringify(text).slice(1, -1).split("/").join("\\/"),
};

/** Every sequence of 1 to 3 encodings, as [label, encode]. */
function encodingSequences() {
  let layer = [[[], (text) => text]];
  const all = [];
  for (let depth = 0; depth < 3; depth += 1) {
    const next = [];
    for (const [names, encode] of layer) {
      for (const [name, step] of Object.entries(ENCODINGS)) {
        next.push([[...names, name], (text) => step(encode(text))]);
      }
    }
    all.push(...next);
    layer = next;
  }
  return all.map(([names, encode]) => [names.join(" > "), encode]);
}

/** Decoders written independently of the SDK's: whole-string where the platform allows. */
const TEST_DECODERS = [
  (text) => {
    try {
      return decodeURIComponent(text);
    } catch {
      return unescape(text);
    }
  },
  (text) => {
    const spaced = text.replace(/\+/g, " ");
    try {
      return decodeURIComponent(spaced);
    } catch {
      return unescape(spaced);
    }
  },
  (text) => {
    try {
      return JSON.parse(`"${text}"`);
    } catch {
      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\(["\\/])/g, "$1");
    }
  },
];

function views(text, depth = 3) {
  const seen = new Set([text]);
  let layer = [text];
  for (let i = 0; i < depth; i += 1) {
    layer = layer.flatMap((view) => TEST_DECODERS.map((decode) => decode(view))).filter((view) => {
      if (seen.has(view)) return false;
      seen.add(view);
      return true;
    });
  }
  return [...seen];
}

/** Every string a caller can read off an error: own fields, message, cause chain, inspect(). */
function errorTexts(error) {
  const texts = [];
  for (let current = error, hops = 0; current != null && hops < 10; current = current.cause, hops += 1) {
    texts.push(String(current), String(current.message), inspect(current, { depth: 5 }));
    for (const name of Object.getOwnPropertyNames(current)) {
      const value = current[name];
      texts.push(typeof value === "string" ? value : String(JSON.stringify(value)));
    }
  }
  return texts;
}

/** A seeded generator (mulberry32), so a failure reproduces. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function secrets() {
  const random = seeded(20261112);
  const list = [`sk SeCrEt"/+%&=<>'\\z`];
  for (let i = 0; i < 2; i += 1) {
    const chars = [...AWKWARD_SECRET_CHARS, ..."Ab3xQ9"];
    for (let j = chars.length - 1; j > 0; j -= 1) {
      const k = Math.floor(random() * (j + 1));
      [chars[j], chars[k]] = [chars[k], chars[j]];
    }
    list.push(`k${chars.join("")}z`);
  }
  for (const secret of list) for (const char of AWKWARD_SECRET_CHARS) expect(secret).toContain(char);
  return list;
}

function httpResponse(status, body, contentType) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (String(name).toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

/** The body shapes an echo arrives in. */
const SHAPES = {
  "400 text": (echo) => httpResponse(400, `Bad Request: [${echo}]`, "text/plain"),
  "500 JSON error": (echo) => httpResponse(500, JSON.stringify({ error: `failed for ${echo}` }), "application/json"),
  "200 JSON error": (echo) => httpResponse(200, JSON.stringify({ error: `Invalid API key ${echo}` }), "application/json"),
  "200 success false": (echo) =>
    httpResponse(200, JSON.stringify({ success: false, message: `rejected ${echo}` }), "application/json"),
};

/**
 * The Warmup client returns a 2xx JSON body as its result (it has no
 * success/error convention), so only its non-2xx shapes are errors.
 */
const WARMUP_SHAPES = Object.fromEntries(Object.entries(SHAPES).filter(([shape]) => !shape.startsWith("200")));

async function leaksFor(secret, run, shapes = SHAPES) {
  const leaks = [];
  for (const [sequence, encode] of encodingSequences()) {
    const echo = encode(secret);
    for (const [shape, respond] of Object.entries(shapes)) {
      global.fetch = async () => respond(echo);
      let error = null;
      try {
        await run();
      } catch (thrown) {
        error = thrown;
      }
      if (!error) {
        leaks.push(`${shape} / ${sequence}: resolved`);
        continue;
      }
      if (errorTexts(error).some((text) => views(text).some((view) => view.includes(secret)))) {
        leaks.push(`${shape} / ${sequence}: ${error.message}`);
      }
    }
  }
  return leaks;
}

describe("redaction closed under encoding", () => {
  const previous = global.fetch;
  afterEach(() => {
    global.fetch = previous;
  });

  it("tries every sequence of up to three encodings, each spelling the secret differently", () => {
    const sequences = encodingSequences();
    expect(sequences.length).toBe(4 + 16 + 64);
    const secret = secrets()[0];
    // Many sequences collide (JSON leaves a URL-encoded text as it is), but
    // most spell the secret their own way.
    expect(new Set(sequences.map(([, encode]) => encode(secret))).size).toBeGreaterThanOrEqual(40);
    // The test's own decoders recover the secret from every sequence.
    for (const [sequence, encode] of sequences) {
      expect({ sequence, found: views(encode(secret)).includes(secret) }).toEqual({ sequence, found: true });
    }
  });

  it("keeps the API key out of every validation error", async () => {
    for (const secret of secrets()) {
      const sdk = new ZeroBounceSDK();
      sdk.init(secret);
      expect(await leaksFor(secret, () => sdk.validateEmail("a@example.com"))).toEqual([]);
    }
  });

  it("keeps the Warmup key out of every Warmup error", async () => {
    for (const secret of secrets()) {
      const warmup = new ZeroBounceWarmup(secret);
      expect(await leaksFor(secret, () => warmup.listSendingAccounts(), WARMUP_SHAPES)).toEqual([]);
    }
  });

  it("keeps the SMTP password and username out of every testSmtpConfiguration error", async () => {
    const warmup = new ZeroBounceWarmup("warmup-key");
    for (const secret of secrets()) {
      const call = (password, username) => () =>
        warmup.testSmtpConfiguration({ fromAddress: "a@example.com", username, password, server: "smtp.example.com", port: 587 });
      expect(await leaksFor(secret, call(secret, "user@example.com"), WARMUP_SHAPES)).toEqual([]);
      expect(await leaksFor(secret, call("smtp-password", secret), WARMUP_SHAPES)).toEqual([]);
    }
  });

  it("keeps the key out of a transport error that quotes it in any encoding", async () => {
    const secret = secrets()[0];
    const sdk = new ZeroBounceSDK();
    sdk.init(secret);
    const leaks = [];
    for (const [sequence, encode] of encodingSequences()) {
      global.fetch = async () => {
        throw new TypeError(`fetch failed: ${encode(secret)}`);
      };
      try {
        await sdk.getCredits();
        leaks.push(`${sequence}: resolved`);
      } catch (error) {
        if (errorTexts(error).some((text) => views(text).some((view) => view.includes(secret)))) {
          leaks.push(`${sequence}: ${error.message}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("also decodes encoders outside the four above: \\uXXXX escapes and URL encoding that keeps \"+\"", async () => {
    // PHP's json_encode (JSON_HEX_*) and Python's ensure_ascii write \u003C
    // and friends; escape() and some URL encoders leave "+" as it is, so "+"
    // must not be read as a space there.
    const unicodeEscaped = (text) =>
      [...text].map((char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
    const plusKept = (text) => encodeURIComponent(text).split("%2B").join("+");
    const sequences = {
      "\\u escapes": unicodeEscaped,
      "\\u escapes > URL %20": (text) => encodeURIComponent(unicodeEscaped(text)),
      "URL keeping + > URL keeping +": (text) => plusKept(plusKept(text)),
      "escape() > escape()": (text) => escape(escape(text)),
      "escape() > JSON > escape()": (text) => escape(JSON.stringify(escape(text)).slice(1, -1)),
    };
    for (const secret of secrets()) {
      const sdk = new ZeroBounceSDK();
      sdk.init(secret);
      const leaks = [];
      for (const [sequence, encode] of Object.entries(sequences)) {
        expect(views(encode(secret))).toContain(secret);
        global.fetch = async () => httpResponse(400, `Bad Request: [${encode(secret)}]`, "text/plain");
        try {
          await sdk.validateEmail("a@example.com");
          leaks.push(`${sequence}: resolved`);
        } catch (error) {
          if (errorTexts(error).some((text) => views(text).some((view) => view.includes(secret)))) {
            leaks.push(`${sequence}: ${error.message}`);
          }
        }
      }
      expect(leaks).toEqual([]);
    }
  });

  it("keeps an error that only ever carried *** readable", async () => {
    const sdk = new ZeroBounceSDK();
    sdk.init(secrets()[0]);
    global.fetch = async () => httpResponse(400, "Bad Request: [api key not allowed]", "text/plain");
    await expect(sdk.validateEmail("a@example.com")).rejects.toThrow("Bad Request: [api key not allowed]");
  });
});
