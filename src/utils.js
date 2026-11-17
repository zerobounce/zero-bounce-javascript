import {
  joinFileJobMessage,
  isGreylistMessage,
  RESPONSE_FIELDS,
  responseFieldMismatch,
  UNEXPECTED_FIELD_TYPE_MESSAGE,
} from "./response-fields.js";

// Constants
export const API_BULK_BASE_URL = "https://bulkapi.zerobounce.net/v2";
export const API_BULK_ROOT_URL = "https://bulkapi.zerobounce.net";
export const HTTP_TIMEOUT_MS = 120000;
export const HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

/**
 * An error from the API, carrying the HTTP status so callers can tell a 403
 * (Cloudflare) from a 400/404 (API) or a 429 (Warmup rate limit).
 */
export class ZBApiError extends Error {
  constructor(message, statusCode = 0) {
    super(message);
    this.name = "ZBApiError";
    this.statusCode = statusCode;
  }
}

export function apiError(message, statusCode = 0) {
  return new ZBApiError(message, statusCode);
}

/** Whether the authority, as written, contains `@` (catches `https://@host`). */
function hasUserinfoMarker(url) {
  const cleaned = url.replace(/[\t\n\r]/g, "");
  const afterScheme = cleaned.trim().split(":").slice(1).join(":") || "";
  const authority = afterScheme.replace(/^[/\\]+/, "").split(/[/\\?#]/)[0] || "";
  return authority.includes("@");
}

/** Loopback http is allowed only for offline tests. */
function isLoopbackHttp(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") return false;
    const host = parsed.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  } catch {
    return false;
  }
}

function refuseBadTransportUrl(url, name, refuseQueryAndFragment) {
  if (typeof url !== "string") {
    throw new Error(`ZeroBounce: ${name} must be an https:// URL`);
  }
  if (refuseQueryAndFragment && (url.includes("?") || url.includes("#"))) {
    throw new Error(`ZeroBounce: ${name} must not contain a query string or a fragment ("?" or "#").`);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`ZeroBounce: ${name} must be an https:// URL`);
  }
  if (parsed.username || parsed.password || hasUserinfoMarker(url)) {
    throw new Error(`ZeroBounce: ${name} must not contain a username or password.`);
  }
  if (parsed.protocol === "https:" || isLoopbackHttp(url)) {
    return url;
  }
  throw new Error(`ZeroBounce: ${name} must be an https:// URL`);
}

/**
 * Every request carries a key: refuse to send one anywhere but https.
 * Covers each overridable base URL, not just the main one. Userinfo, query
 * and fragment are refused with fixed messages that never quote the URL.
 */
export function requireHttpsUrl(url, name = "apiBaseURL") {
  return refuseBadTransportUrl(url, name, name !== "request URL");
}

/**
 * Drops trailing slashes, so a base URL given as ".../v2/" does not produce
 * ".../v2//validate". Done without a regular expression: `/\/+$/` backtracks
 * quadratically on a string of many slashes, which CodeQL flags as a
 * polynomial ReDoS when the value comes from a caller.
 */
export function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) end -= 1;
  return value.slice(0, end);
}

/** An https base URL with its trailing slashes removed. */
export function normalizeBaseUrl(url, name) {
  return trimTrailingSlashes(requireHttpsUrl(url, name));
}

/**
 * A yes/no option, parsed strictly: true / false, the strings "true" /
 * "false" in any case, or 1 / 0. Anything else is rejected rather than
 * guessed at, so the string "false" is never sent as true.
 */
export function strictBoolean(value, name) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === 0) return value === 1;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "false") return text === "true";
  }
  throw new Error(`ZeroBounce: ${name} parameter is invalid. Must be true or false.`);
}

/** Invisible characters that are not the ordinary ASCII space (U+0020). */
function isInvisibleChar(code) {
  return (
    (code >= 0x00ad && code <= 0x00ad) ||
    (code >= 0x034f && code <= 0x034f) ||
    (code >= 0x0600 && code <= 0x0605) ||
    code === 0x0890 ||
    code === 0x0891 ||
    code === 0x061c ||
    code === 0x06dd ||
    code === 0x070f ||
    code === 0x08e2 ||
    code === 0x115f ||
    code === 0x1160 ||
    code === 0x17b4 ||
    code === 0x17b5 ||
    (code >= 0x180b && code <= 0x180f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2065) ||
    (code >= 0x2066 && code <= 0x206f) ||
    code === 0x2800 ||
    code === 0x3164 ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    code === 0xfeff ||
    code === 0xffa0 ||
    (code >= 0xfff0 && code <= 0xfff8) ||
    (code >= 0xfff9 && code <= 0xfffb) ||
    code === 0x110bd ||
    code === 0x110cd ||
    (code >= 0x13430 && code <= 0x1343f) ||
    (code >= 0x1bca0 && code <= 0x1bca3) ||
    (code >= 0x1d173 && code <= 0x1d17a) ||
    (code >= 0xe0000 && code <= 0xe0fff)
  );
}

function isCombiningMark(code) {
  const ch = String.fromCodePoint(code);
  return /\p{M}/u.test(ch);
}

/**
 * Reject a key with surrounding whitespace, control characters, Unicode
 * whitespace other than U+0020 in the middle, invisible format characters,
 * or a mark-only key. An ordinary space in the middle stays allowed.
 */
export function checkApiKey(apiKey, name = "api key") {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error(`ZeroBounce: ${name} parameter is missing.`);
  }
  const invalid =
    apiKey !== apiKey.trim() ||
    [...apiKey].some((char) => {
      const code = char.codePointAt(0);
      if (code <= 0x1f || code === 0x7f) return true;
      if (char !== " " && /\s/u.test(char)) return true;
      if (isInvisibleChar(code)) return true;
      return false;
    });
  if (invalid) {
    throw new Error(
      `ZeroBounce: ${name} has surrounding whitespace or control characters.`
    );
  }
  if ([...apiKey].every((char) => isCombiningMark(char.codePointAt(0)))) {
    throw new Error(
      `ZeroBounce: ${name} has surrounding whitespace or control characters.`
    );
  }
  return apiKey;
}

/** A caller value as one URL path segment: percent-encoded, never "." or "..". */
export function pathSegment(value, name) {
  const text = value == null ? "" : String(value).trim();
  if (!text) throw new Error(`ZeroBounce: ${name} parameter is missing.`);
  if (text === "." || text === "..") {
    throw new Error(`ZeroBounce: ${name} parameter is invalid.`);
  }
  return encodeURIComponent(text);
}

/** The body of JSON.stringify(text): the form a JSON request body quotes it in. */
const jsonEscaped = (text) => JSON.stringify(text).slice(1, -1);
/**
 * The same with "/" written as "\/", as PHP's json_encode and others write it.
 * jsonEscaped has already escaped every backslash, so turning each "/" into
 * "\/" here is a complete JSON escape, not a partial one.
 */
const jsonEscapedSlash = (text) => jsonEscaped(text).split("/").join("\\/");
/** URL-encoded with spaces as %20. */
const urlEncoded = (text) => encodeURIComponent(text);
/** Form-encoded as URLSearchParams writes it: spaces as "+", "'" as %27. */
const formEncoded = (text) => new URLSearchParams({ s: text }).toString().slice(2);

/** The quoting steps a secret can go through before a body echoes it, up to depth 2. */
const QUOTINGS = [jsonEscaped, jsonEscapedSlash];
/** How the quoted copy can then be encoded: as is, URL-encoded, form-encoded. */
const ENCODINGS = [(text) => text, urlEncoded, formEncoded];

/**
 * Every form a secret can take in a message, composed from the encoders above:
 * the raw secret and each one- or two-step JSON quoting of it (with or without
 * "/" as "\/"; a body or proxy quoting a JSON request body, and a JSON copy of
 * that quote), each as is, URL-encoded and form-encoded (a server that echoes
 * a URL-encoded request body). Plus escape() of the raw secret. Longest first,
 * so no form leaves part of a longer one behind.
 */
function secretForms(secret) {
  const raw = String(secret);
  const quoted = [raw];
  for (const once of QUOTINGS) {
    const first = once(raw);
    quoted.push(first);
    for (const twice of QUOTINGS) quoted.push(twice(first));
  }
  const forms = [escape(raw)];
  for (const text of quoted) {
    for (const encode of ENCODINGS) forms.push(encode(text));
  }
  return [...new Set(forms.filter(Boolean))].sort((a, b) => b.length - a.length);
}

/** What a message says instead when a decoded view of it still holds a secret. */
export const CREDENTIAL_OMITTED_MESSAGE =
  "ZeroBounce: the response text was omitted because it contained a credential.";

/** The UTF-8 sequence length a lead byte announces, or 0 for a byte no sequence starts with. */
function utf8SequenceLength(byte) {
  if (byte < 0x80) return 1;
  if (byte >= 0xc2 && byte <= 0xdf) return 2;
  if (byte >= 0xe0 && byte <= 0xef) return 3;
  if (byte >= 0xf0 && byte <= 0xf4) return 4;
  return 0;
}

/**
 * A run of %XX that is not valid UTF-8 as a whole, decoded one UTF-8 sequence
 * at a time: each valid sequence becomes its character and each byte that
 * starts none stays as its %XX. A stray %FF in front of a percent-encoded
 * secret therefore still leaves the secret readable in this view, whatever
 * its characters (a Latin-1 reading of the run would turn "ä" into "Ã¤").
 */
function percentRunDecoded(run) {
  const bytes = run.match(/%[0-9A-Fa-f]{2}/g);
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const length = utf8SequenceLength(parseInt(bytes[i].slice(1), 16));
    if (length) {
      try {
        out += decodeURIComponent(bytes.slice(i, i + length).join(""));
        i += length;
        continue;
      } catch {
        // Not a complete, valid sequence: keep this byte as it is.
      }
    }
    out += bytes[i];
    i += 1;
  }
  return out;
}

/** %XX sequences decoded as UTF-8; a byte that is not part of valid UTF-8 stays as its %XX. */
function percentDecoded(text) {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return percentRunDecoded(run);
    }
  });
}

const JSON_UNESCAPES = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "'": "'" };

function hexDigit(char) {
  const d = parseInt(char, 16);
  return Number.isNaN(d) ? -1 : d;
}

function codePointText(code) {
  if (code < 0 || code > 0x10ffff) return "\uFFFD";
  return String.fromCodePoint(code);
}

/** JSON and other backslash escapes, including `\u{27}`, `\047`, `\U{27}` and `\x27`. */
function jsonUnescaped(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "\\" || i + 1 >= text.length) {
      out += text[i];
      i += 1;
      continue;
    }
    const next = text[i + 1];
    if (next in JSON_UNESCAPES) {
      out += JSON_UNESCAPES[next];
      i += 2;
      continue;
    }
    if ((next === "u" || next === "U") && text[i + 2] === "{") {
      let j = i + 3;
      let digits = "";
      while (j < text.length && digits.length < 8 && hexDigit(text[j]) >= 0) {
        digits += text[j];
        j += 1;
      }
      if (digits && text[j] === "}") {
        out += codePointText(parseInt(digits, 16));
        i = j + 1;
        continue;
      }
    }
    if (next === "u" || next === "U") {
      const isCap = next === "U";
      let hex = text.slice(i + 2, i + 2 + (isCap ? 8 : 4));
      if (isCap && hex.length === 8 && /^[0-9A-Fa-f]{8}$/.test(hex)) {
        const code = parseInt(hex, 16);
        if (code <= 0x10ffff) {
          out += codePointText(code);
          i += 10;
          continue;
        }
        hex = text.slice(i + 2, i + 6);
      }
      if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
        let code = parseInt(hex, 16);
        if (code >= 0xd800 && code <= 0xdbff && text[i + 6] === "\\" && text[i + 7] === "u") {
          const low = text.slice(i + 8, i + 12);
          if (/^[0-9A-Fa-f]{4}$/.test(low)) {
            const lowCode = parseInt(low, 16);
            if (lowCode >= 0xdc00 && lowCode <= 0xdfff) {
              code = 0x10000 + ((code - 0xd800) << 10) + (lowCode - 0xdc00);
              out += codePointText(code);
              i += 12;
              continue;
            }
          }
        }
        out += codePointText(code);
        i += 6;
        continue;
      }
    }
    if (next === "x") {
      if (text[i + 2] === "{") {
        let j = i + 3;
        let digits = "";
        while (j < text.length && digits.length < 6 && hexDigit(text[j]) >= 0) {
          digits += text[j];
          j += 1;
        }
        if (digits && text[j] === "}") {
          out += codePointText(parseInt(digits, 16));
          i = j + 1;
          continue;
        }
      }
      if (hexDigit(text[i + 2]) >= 0 && hexDigit(text[i + 3]) >= 0) {
        out += String.fromCharCode(hexDigit(text[i + 2]) * 16 + hexDigit(text[i + 3]));
        i += 4;
        continue;
      }
    }
    if (next >= "0" && next <= "7") {
      let value = next.charCodeAt(0) - 48;
      let len = 2;
      if (next <= "3" && text[i + 2] >= "0" && text[i + 2] <= "7") {
        value = value * 8 + (text[i + 2].charCodeAt(0) - 48);
        len = 3;
        if (text[i + 3] >= "0" && text[i + 3] <= "7") {
          value = value * 8 + (text[i + 3].charCodeAt(0) - 48);
          len = 4;
        }
      } else if (text[i + 2] >= "0" && text[i + 2] <= "7") {
        value = value * 8 + (text[i + 2].charCodeAt(0) - 48);
        len = 3;
      }
      out += String.fromCharCode(value);
      i += len;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function htmlEntity(name) {
  switch (name.toLowerCase()) {
    case "amp":
      return "&";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "quot":
      return '"';
    case "apos":
      return "'";
    case "nbsp":
      return "\u00a0";
    default:
      return null;
  }
}

/** Named and numeric HTML entities (`&#39`, `&APOS;`, …). `%u0027` is not decoded. */
function htmlUnescaped(text) {
  if (!text.includes("&")) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "&") {
      out += text[i];
      i += 1;
      continue;
    }
    if (text[i + 1] === "#") {
      let radix = 10;
      let at = i + 2;
      if (text[at] === "x" || text[at] === "X") {
        radix = 16;
        at += 1;
      }
      let digits = "";
      while (at < text.length && (radix === 10 ? text[at] >= "0" && text[at] <= "9" : hexDigit(text[at]) >= 0)) {
        digits += text[at];
        at += 1;
      }
      if (digits) {
        let end = at;
        if (text[at] === ";") end = at + 1;
        out += codePointText(parseInt(digits, radix));
        i = end;
        continue;
      }
    }
  const nameMatch = text.slice(i + 1).match(/^[A-Za-z][A-Za-z0-9]*/);
    if (nameMatch) {
      const name = nameMatch[0];
      const decoded = htmlEntity(name);
      if (decoded != null) {
        const semi = text[i + 1 + name.length] === ";";
        out += decoded;
        i += 1 + name.length + (semi ? 1 : 0);
        continue;
      }
    }
    out += "&";
    i += 1;
  }
  return out;
}

/** `\xHH` byte escapes outside JSON's decoder. */
function hexByteEscapesDecoded(text) {
  if (!text.includes("\\x") && !text.includes("\\X")) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (
      text[i] === "\\" &&
      (text[i + 1] === "x" || text[i + 1] === "X") &&
      hexDigit(text[i + 2]) >= 0 &&
      hexDigit(text[i + 3]) >= 0
    ) {
      out += String.fromCharCode(hexDigit(text[i + 2]) * 16 + hexDigit(text[i + 3]));
      i += 4;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

/** Backslash-quote and HTML entities not covered by `jsonUnescaped`. */
function quoteDecoded(text) {
  return htmlUnescaped(hexByteEscapesDecoded(text.replace(/\\'/g, "'")));
}

/** Full case fold of one scalar via default Unicode mappings (no locale). */
function foldedScalars(scalar) {
  let current = [scalar];
  for (let round = 0; round < 3; round += 1) {
    const next = [];
    for (const item of current) {
      for (const upper of item.toUpperCase()) {
        for (const lower of upper.toLowerCase()) {
          next.push(lower);
        }
      }
    }
    if (next.join("") === current.join("")) break;
    current = next;
  }
  return current;
}

function foldedCharacter(character) {
  const scalars = [...character];
  const plain = scalars.every((s) => {
    const value = s.codePointAt(0);
    return value >= 0x4e00 && value <= 0x9fff;
  });
  let out = plain ? scalars : [...character.normalize("NFD")];
  let folded = [];
  for (const scalar of out) {
    folded.push(...foldedScalars(scalar));
  }
  if (!plain) {
    folded = [...folded.join("").normalize("NFD")];
  }
  const droppable = folded.map(
    (scalar, index) => scalar.codePointAt(0) === 0x307 && index > 0 && folded[index - 1] === "i"
  );
  return { folded, droppable };
}

/** Folded text with byte offsets into the original string for masking. */
function buildFoldedText(text) {
  if (/^[\x00-\x7F]*$/.test(text)) {
    const scalars = [...text].map((c) => c.toLowerCase());
    const starts = scalars.map((_, index) => index);
    const ends = starts.map((start) => start + 1);
    return { scalars, starts, ends, droppable: scalars.map(() => false) };
  }
  const scalars = [];
  const starts = [];
  const ends = [];
  const droppable = [];
  let offset = 0;
  for (const character of text) {
    const width = [...character].length;
    const { folded, droppable: drops } = foldedCharacter(character);
    for (let index = 0; index < folded.length; index += 1) {
      scalars.push(folded[index]);
      starts.push(offset);
      ends.push(offset + width);
      droppable.push(drops[index]);
    }
    offset += width;
  }
  return { scalars, starts, ends, droppable };
}

function foldedSpelling(text) {
  const view = buildFoldedText(text);
  return view.scalars.filter((_, index) => !view.droppable[index]).join("");
}

function markScalar(scalar) {
  return /\p{M}/u.test(scalar);
}

function secretOccurrences(needle, haystack) {
  const text = haystack.scalars;
  if (!needle.length || text.length < needle.length) return [];
  let baseIndex = needle.length - 1;
  while (baseIndex >= 0 && markScalar(needle[baseIndex])) baseIndex -= 1;
  const found = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== needle[0]) continue;
    let matches = true;
    let position = start + 1;
    let offset = 1;
    while (offset <= baseIndex) {
      while (position < text.length && haystack.droppable[position] && text[position] !== needle[offset]) {
        position += 1;
      }
      if (position >= text.length || text[position] !== needle[offset]) {
        matches = false;
        break;
      }
      position += 1;
      offset += 1;
    }
    let last = position - 1;
    if (matches && baseIndex < needle.length - 1) {
      const span = haystack.starts[last];
      let next = last + 1;
      for (let mi = baseIndex + 1; mi < needle.length; mi += 1) {
        const mark = needle[mi];
        let seen = false;
        while (next < text.length && haystack.starts[next] === span) {
          const hit = !haystack.droppable[next] && text[next] === mark;
          next += 1;
          if (hit) {
            seen = true;
            last = next - 1;
            break;
          }
        }
        if (!seen) {
          matches = false;
          break;
        }
      }
    }
    if (matches) found.push([haystack.starts[start], haystack.ends[last]]);
  }
  return found;
}

/** NFD, full Unicode case fold, then drop U+0307 after `i` (lesson 111). */
function simpleFoldSpelling(text) {
  let folded = [];
  for (const scalar of [...String(text).normalize("NFD")]) {
    folded.push(...foldedScalars(scalar));
  }
  folded = [...folded.join("").normalize("NFD")];
  return folded
    .filter((scalar, index) => !(scalar.codePointAt(0) === 0x307 && index > 0 && folded[index - 1] === "i"))
    .join("");
}

function revealsInFoldedText(text, secrets) {
  const hay = simpleFoldSpelling(text);
  return secrets.filter(Boolean).some((secret) => {
    const needle = simpleFoldSpelling(String(secret));
    return needle.length > 0 && hay.includes(needle);
  });
}

function maskFolded(text, secrets) {
  const forms = [];
  for (const secret of secrets) {
    if (!secret) continue;
    forms.push(String(secret), ...secretForms(String(secret)));
  }
  const needles = [...new Set(forms.map((form) => foldedSpelling(form)).filter(Boolean))].map((spelling) => [...spelling]);
  if (!needles.length || !text) return text;
  const view = buildFoldedText(text);
  const ranges = [];
  for (const needle of needles) {
    for (const [start, end] of secretOccurrences(needle, view)) {
      const span = text.slice(start, end);
      if (span.includes("%") || span.includes("\\") || span.includes("&")) continue;
      ranges.push([start, end]);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] < last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  let out = "";
  let index = 0;
  let next = 0;
  for (const character of text) {
    const width = character.length;
    if (next < merged.length && index === merged[next][0]) out += "***";
    if (next < merged.length && index >= merged[next][0] && index < merged[next][1]) {
      index += width;
      if (index === merged[next][1]) next += 1;
      continue;
    }
    out += character;
    index += width;
  }
  return out;
}

/**
 * The decoders a body's encodings are undone with: URL (%XX), form ("+" as a
 * space, then %XX, so a form-encoded layer takes one step), JSON, quotes and HTML.
 */
const DECODERS = [
  percentDecoded,
  (text) => percentDecoded(text.split("+").join(" ")),
  jsonUnescaped,
  quoteDecoded,
];
/** The SDK's own request encoding plus three echo layers (standard.md §3). */
const DECODE_LAYERS = 4;

/** The text and every view of it reached by up to four decodings, in any order. */
function decodedViews(text) {
  const views = new Set([text]);
  let layer = [text];
  for (let depth = 0; depth < DECODE_LAYERS; depth += 1) {
    const next = [];
    for (const view of layer) {
      for (const decode of DECODERS) {
        const decoded = decode(view);
        if (!views.has(decoded)) {
          views.add(decoded);
          next.push(decoded);
        }
      }
    }
    layer = next;
  }
  return views;
}

/** Whether any decoded view of the text still contains one of the secrets. */
export function holdsSecret(text, secrets = []) {
  const present = secrets.filter(Boolean).map(String);
  if (!present.length) return false;
  for (const view of decodedViews(String(text))) {
    if (present.some((secret) => view.includes(secret))) return true;
    if (revealsInFoldedText(view, present)) return true;
  }
  return false;
}

/**
 * Replace every form a secret could take in a message with ***. Then decode
 * what is left (URL, "+", JSON, up to four layers in any order): a spelling
 * the list above misses still decodes to the secret, and the whole text is
 * dropped for a fixed message rather than returned.
 */
export function redactSecrets(text, secrets = []) {
  let value = String(text);
  for (const secret of secrets) {
    if (!secret) continue;
    for (const form of secretForms(secret)) {
      value = value.split(form).join("***");
    }
  }
  value = maskFolded(value, secrets);
  value = value.replace(/([?&](?:api_key|API-Key)=)[^&\s"']+/gi, "$1***");
  return holdsSecret(value, secrets) ? CREDENTIAL_OMITTED_MESSAGE : value;
}

/** Deeper JSON than any ZeroBounce answer; a body nested past it is refused unparsed. */
export const MAX_JSON_DEPTH = 512;

/** Whether the JSON text nests arrays or objects deeper than the limit (strings skipped). */
function jsonNestedTooDeep(text, limit = MAX_JSON_DEPTH) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "[" || char === "{") {
      depth += 1;
      if (depth > limit) return true;
    } else if (char === "]" || char === "}") {
      depth -= 1;
    }
  }
  return false;
}

/**
 * JSON.parse with a nesting limit: a body nested past MAX_JSON_DEPTH rejects
 * with a ZBApiError (no status here; the caller adds it) instead of being
 * returned, where printing or walking it would overflow the caller's stack.
 */
export function parseJsonBody(text) {
  if (jsonNestedTooDeep(String(text))) {
    throw new ZBApiError("ZeroBounce returned a response nested too deeply to read.", null);
  }
  return JSON.parse(text);
}

export const UNEXPECTED_SHAPE_MESSAGE =
  "ZeroBounce returned JSON of an unexpected shape for this call.";

/**
 * Whether a parsed body has the shape the call declares: "object" (a JSON
 * object, not an array), "array", "objectOrArray", or "json" (any JSON, for
 * the calls typed `unknown`). A number, string, boolean or null is never an
 * API answer where an object or array is declared.
 */
export function hasShape(parsed, shape) {
  const isArray = Array.isArray(parsed);
  const isObject = parsed !== null && typeof parsed === "object" && !isArray;
  if (shape === "json") return true;
  if (shape === "array") return isArray;
  if (shape === "objectOrArray") return isArray || isObject;
  return isObject;
}

function fetchTimeoutSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(HTTP_TIMEOUT_MS);
  }
  return undefined;
}

function nonEmptyStringField(o, key) {
  const v = o[key];
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) {
    return v.some((item) => typeof item === "string" && item.trim() !== "");
  }
  return false;
}

/**
 * Whether a parsed JSON object from getfile should be treated as an API error payload
 * (aligned with other ZeroBounce SDKs).
 */
export function getFileJsonIndicatesFailure(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  if (Object.prototype.hasOwnProperty.call(o, "success")) {
    const flag = o.success;
    if (isSuccessFlag(flag) && isSuccessFailure(flag)) return true;
  }
  return (
    nonEmptyStringField(o, "message") ||
    nonEmptyStringField(o, "error") ||
    nonEmptyStringField(o, "error_message")
  );
}

function isBrowserEnvironment() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

function responseStatus(response) {
  return response && typeof response.status === "number" ? response.status : 200;
}

function responseContentType(response) {
  if (!response || !response.headers || typeof response.headers.get !== "function") return "";
  return String(response.headers.get("content-type") || "").toLowerCase();
}

/** A JSON media type: application/json, or any "+json" type such as application/problem+json. */
export function isJsonContentType(contentType) {
  const media = String(contentType || "").split(";")[0].trim().toLowerCase();
  return media === "application/json" || media.endsWith("+json");
}

/** A body that is a JSON object or array (or tries to be one): never a CSV file. */
export function looksLikeJson(body) {
  const trimmed = String(body).trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

const FILE_STATUS_KNOWN_FIELDS = new Set([
  "file_status",
  "file_id",
  "file_name",
  "upload_date",
  "file_phase_2_status",
  "complete_percentage",
  "error_reason",
  "return_url",
]);

/** Spaces, tabs, CR, LF, VT, FF, a UTF-8 BOM and NBSP before HTML sniffing. */
function skipLeadingHtmlWhitespace(body) {
  const text = String(body);
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0b || code === 0x0c) {
      i += 1;
      continue;
    }
    if (code === 0xa0) {
      i += 1;
      continue;
    }
    break;
  }
  return text.slice(i, i + 2000);
}

export function looksLikeHtml(body) {
  const head = skipLeadingHtmlWhitespace(body).toLowerCase();
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<body")
  );
}

/** Whether `success` is a documented boolean flag (not coerced with parseInt). */
export function isSuccessFlag(value) {
  if (typeof value === "boolean") return true;
  if (value === 0 || value === 1) return true;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "false" || text === "0" || text === "1") return true;
  }
  return false;
}

/** The false values of a real `success` flag. */
export function isSuccessFailure(value) {
  if (value === false || value === 0) return true;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "false" || text === "0") return true;
  }
  return false;
}

/**
 * JSON numbers 0 and 1 are real flags but file-status types declare `success`
 * as boolean or string; normalize only documented numeric flags for field check.
 */
function normalizeSuccessFlag(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  if (!Object.prototype.hasOwnProperty.call(parsed, "success")) return parsed;
  const flag = parsed.success;
  if (flag === true || !isSuccessFlag(flag) || isSuccessFailure(flag)) return parsed;
  return { ...parsed, success: true };
}

function declaredResponseFieldNames(fieldTypes) {
  const keys = new Set();
  for (const name of [].concat(fieldTypes ?? [])) {
    const spec = RESPONSE_FIELDS[name];
    if (!spec) continue;
    for (const key of Object.keys(spec)) keys.add(key);
  }
  return keys;
}

function hasKnownFileStatusField(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  if (Object.prototype.hasOwnProperty.call(parsed, "success")) {
    const flag = parsed.success;
    if (isSuccessFlag(flag) && !isSuccessFailure(flag)) return true;
  }
  for (const key of FILE_STATUS_KNOWN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
    const value = parsed[key];
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return true;
  }
  return false;
}

function htmlTitle(body) {
  const match = String(body).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return match[1].replace(/\s+/g, " ").trim();
}

function stripErrorPrefix(message) {
  let value = String(message).trim();
  for (;;) {
    if (value.startsWith("Error:")) {
      value = value.slice("Error:".length).trim();
      continue;
    }
    if (value.startsWith("[Error]:")) {
      value = value.slice("[Error]:".length).trim();
      continue;
    }
    return value;
  }
}

function isAccountLevelText(value) {
  return /invalid api key|api_key is invalid|ran out of credits|out of credits/i.test(value);
}

function readableJsonMessage(parsed) {
  // A top-level JSON list of strings, e.g. the Inbox Placement Tester's
  // ["In-progress tests cannot be deleted."].
  if (Array.isArray(parsed)) {
    const first = parsed.find((item) => typeof item === "string" && item.trim());
    return first ? first.trim() : null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  // "detail" is how the Inbox Placement Tester (Django REST framework) and the
  // Warmup API report errors.
  for (const key of ["error", "message", "error_message", "Message", "Error", "detail"]) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) {
      const strings = value.filter((item) => typeof item === "string" && item.trim());
      if (strings.length) return strings.join("; ");
      // A validation error list: [{loc: ["body", "field"], msg: "..."}].
      const first = value[0];
      if (first && typeof first === "object" && first.msg) {
        const loc = Array.isArray(first.loc) ? first.loc.slice(1).join(".") : "";
        return loc ? `${loc}: ${first.msg}` : String(first.msg);
      }
    }
  }
  return null;
}

function accountLevelMessage(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (Array.isArray(parsed.errors)) {
    for (const item of parsed.errors) {
      if (item && String(item.email_address || "").toLowerCase() === "all") {
        const text = typeof item.error === "string" ? item.error.trim() : "";
        return stripErrorPrefix(text || "Invalid API Key or your account ran out of credits");
      }
    }
  }
  // LIVE: an invalid or drained key answers validate, activity and
  // getapiusage with {"error": "..."} and the filters with {"Error": "..."},
  // all on an HTTP 200 with no "success" field. Without a "success" field any
  // non-empty error string is a failure, whatever it says, as in the other
  // SDKs. With one, only the key / credits wording is.
  const noSuccess = !Object.prototype.hasOwnProperty.call(parsed, "success");
  for (const key of ["error", "error_message", "Error"]) {
    const value = parsed[key];
    if (typeof value !== "string" || !value.trim()) continue;
    if (noSuccess || (key !== "error_message" && isAccountLevelText(value))) {
      return stripErrorPrefix(value.trim()) || value.trim();
    }
  }
  return null;
}

function objectWithoutSuccess(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return Object.prototype.hasOwnProperty.call(parsed, "success") ? null : parsed;
}

const MESSAGE_KEYS = new Set(["error", "message", "error_message", "Message", "Error", "detail"]);

/**
 * A message beside documented fields that are all null — the same failure as a
 * message-only body on typed calls (standard.md §3).
 */
function messageBesideNullDocumentedFields(object, fieldTypes) {
  const declared = declaredResponseFieldNames(fieldTypes);
  if (!declared.size) return false;
  const keys = Object.keys(object);
  if (!keys.some((key) => MESSAGE_KEYS.has(key))) return false;
  return keys.every((key) => MESSAGE_KEYS.has(key) || (declared.has(key) && object[key] == null));
}

/**
 * Whether a body is nothing but a message: an empty object, an object with no
 * "success" field whose keys are all message keys, or a message key beside
 * documented fields that are all null. The keys decide, whatever the values.
 * Not for validate's greylist answer or the other message-only exemptions.
 */
function messageOnlyBody(parsed, fieldTypes = null) {
  const object = objectWithoutSuccess(parsed);
  if (!object) return false;
  const keys = Object.keys(object);
  if (keys.length === 0) return true;
  if (keys.every((key) => MESSAGE_KEYS.has(key))) return true;
  return messageBesideNullDocumentedFields(object, fieldTypes);
}

function cloudflareTitle(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.title !== "string") {
    return null;
  }
  const accessDenied = parsed.title.includes("Access denied") || parsed.title.includes("1020");
  if (accessDenied && parsed.cloudflare_error === true) return parsed.title;
  return null;
}

function messageFromBody(body, statusCode) {
  const trimmed = String(body).trim();
  if (!trimmed) return `Empty response from ZeroBounce (HTTP ${statusCode})`;
  if (looksLikeHtml(body)) {
    const title = htmlTitle(body);
    if (!title) return "ZeroBounce returned an HTML error page instead of an API response.";
    return `ZeroBounce returned an HTML error page ("${title}") instead of an API response.`;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const title = cloudflareTitle(parsed);
      if (title) return title;
      const account = accountLevelMessage(parsed);
      if (account) return account;
      const readable = readableJsonMessage(parsed);
      if (readable) return stripErrorPrefix(readable);
      return "ZeroBounce returned an unexpected response.";
    } catch {
      return "ZeroBounce returned a response that is not valid JSON.";
    }
  }
  if (trimmed.length > 1000) return "ZeroBounce returned a response that is not valid JSON.";
  const message = stripErrorPrefix(trimmed);
  return message || `Empty response from ZeroBounce (HTTP ${statusCode})`;
}

/**
 * A network failure, with every form of the secret removed.
 *
 * The redacted copy is returned on its own: the original is never attached as
 * `cause`, because its message and request URL can carry the key.
 */
function transportError(error, secrets = []) {
  const name = error && error.name ? error.name : "Error";
  const message = error && error.message ? error.message : String(error);
  return apiError(redactSecrets(`${name}: ${message}`, secrets), 0);
}

/**
 * ZeroBounce documents no regional bulk host, so an EU or US base URL still
 * sends bulk traffic to bulkapi.zerobounce.net. Warn once per client.
 */
const REGIONAL_API_HOSTS = ["api-eu.zerobounce.net", "api-us.zerobounce.net"];
const BULK_HOST = "bulkapi.zerobounce.net";

/**
 * The host of a URL, lowercased, or "" when it will not parse.
 *
 * Matching the host as a substring of the whole URL would also accept
 * `https://evil.example/bulkapi.zerobounce.net` and
 * `https://bulkapi.zerobounce.net.evil.example`, so the host is compared on
 * its own.
 */
function hostOf(value) {
  try {
    return new URL(String(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function warnOnRegionalBulkHost(url, apiBaseURL, state) {
  if (!state || state.warned) return;
  if (!REGIONAL_API_HOSTS.includes(hostOf(apiBaseURL))) return;
  if (hostOf(url) !== BULK_HOST) return;
  state.warned = true;
  const warn = typeof console !== "undefined" && console.warn ? console.warn : null;
  if (warn) {
    warn(
      "ZeroBounce: a regional base URL is set, but this request goes to " +
        "bulkapi.zerobounce.net. ZeroBounce documents no regional bulk host."
    );
  }
}

/**
 * A JSON body exactly as sent. Response.text() drops a leading UTF-8 byte
 * order mark, and a BOM is not JSON (RFC 8259, strict JSON corpus), so the
 * bytes are decoded with the mark kept, where the platform allows.
 */
export async function readJsonBodyText(response) {
  if (response && typeof response.arrayBuffer === "function" && typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());
  }
  return readBodyText(response);
}

async function readBodyText(response) {
  if (response && typeof response.text === "function") return await response.text();
  if (response && typeof response.json === "function") {
    const data = await response.json();
    return typeof data === "string" ? data : JSON.stringify(data);
  }
  return "";
}

function processGetFileResponseBody(finalResult, response, scoring, fileId = "download") {
  const status = responseStatus(response);
  const ct = responseContentType(response);
  if (looksLikeHtml(finalResult) || ct.includes("text/html") || status >= 400) {
    throw apiError(messageFromBody(finalResult, status), status);
  }
  if (!String(finalResult).trim()) {
    throw apiError(`Empty response from ZeroBounce (HTTP ${status})`, status);
  }

  // A file download is never JSON: a body served with a JSON content type
  // (application/json, application/problem+json), or a JSON object or array
  // under any content type, rejects with the status rather than resolving as
  // CSV text.
  if (isJsonContentType(ct) || looksLikeJson(finalResult)) {
    throw apiError(messageFromBody(finalResult, status), status);
  }

  if (!isBrowserEnvironment()) {
    return finalResult;
  }

  const id = String(fileId);
  const blob = new Blob([finalResult], { type: "text/csv" });
  return saveFile(blob, `result-${id}${scoring ? "-scoring" : ""}.csv`);
}

function bulkApiBase(bulkBase, bulkURLs) {
  const urls = bulkURLs || { v2: API_BULK_BASE_URL, root: API_BULK_ROOT_URL };
  return bulkBase === "root" ? urls.root : urls.v2;
}

/**
 * The key as this request carries it: an api_key query or form field, an
 * api_key JSON field, or the Inbox Placement Tester's Bearer token. Every
 * error createRequest raises is redacted against these, so no call site can
 * forget to pass its key.
 */
function requestSecrets({ params, body, jsonBody, bearerToken }) {
  const found = [bearerToken];
  if (params && typeof params === "object") found.push(params.api_key);
  if (jsonBody && typeof jsonBody === "object") found.push(jsonBody.api_key);
  if (body && typeof body === "object" && typeof body.get === "function") {
    try {
      found.push(body.get("api_key"));
    } catch {
      // Not a FormData or URLSearchParams after all.
    }
  }
  return found.filter((value) => typeof value === "string" && value);
}

function buildRequestUrl({ batch, bulkBase, bulkURLs, apiBaseURL, baseURL, path, params }) {
  // An explicit baseURL wins: the list evaluator, the Inbox Placement Tester and
  // the finder/domain-search families each have their own, overridable host.
  const base = baseURL != null ? baseURL : batch ? bulkApiBase(bulkBase, bulkURLs) : apiBaseURL;
  const query =
    params != null && Object.keys(params).length > 0
      ? `?${new URLSearchParams(params)}`
      : "";
  return `${base}${path}${query}`;
}

export async function createRequest({
  requestType,
  body = null,
  jsonBody = null,
  params = null,
  path,
  batch = false,
  bulkBase = "v2",
  bulkURLs = null,
  returnText = false,
  scoring = false,
  apiBaseURL,
  baseURL = null,
  bearerToken = null,
  extraHeaders = null,
  secrets = [],
  regionalWarningState = null,
  messageOnlyExempt = false,
  requireFileStatusKnownField = false,
  emptyIsSuccess = false,
  shape = "object",
  fields = null,
}) {
  const url = buildRequestUrl({ batch, bulkBase, bulkURLs, apiBaseURL, baseURL, path, params });
  requireHttpsUrl(url, "request URL");
  secrets = [...secrets, ...requestSecrets({ params, body, jsonBody, bearerToken })];
  warnOnRegionalBulkHost(url, apiBaseURL, regionalWarningState);

  const headers = { ...HEADERS };
  // The Inbox Placement Tester takes JSON; everything else sends query, form,
  // or multipart bodies, which must not carry a JSON content type.
  if (jsonBody != null) headers["Content-Type"] = "application/json";
  // The Inbox Placement Tester documents Authorization: Bearer, not a query key.
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  let response;
  try {
    response = await fetch(url, {
      method: requestType,
      headers,
      body: jsonBody != null ? JSON.stringify(jsonBody) : body,
      signal: fetchTimeoutSignal(),
      redirect: "error",
    });
  } catch (error) {
    // Some fetch polyfills embed the request URL, including the key, in errors.
    throw transportError(error, secrets);
  }

  const redirectStatus = responseStatus(response);
  if (redirectStatus >= 300 && redirectStatus < 400) {
    throw apiError(
      "ZeroBounce returned a redirect, which this client does not follow.",
      redirectStatus
    );
  }

  let finalResult;
  try {
    finalResult = returnText ? await readBodyText(response) : await readJsonBodyText(response);
  } catch (error) {
    throw transportError(error, secrets);
  }

  if (returnText) {
    try {
      const fileId = params && params.file_id != null ? params.file_id : "download";
      return processGetFileResponseBody(finalResult, response, scoring, fileId);
    } catch (error) {
      if (error instanceof ZBApiError) throw apiError(redactSecrets(error.message, secrets), error.statusCode);
      throw error;
    }
  }

  const status = responseStatus(response);
  // Only for calls documented to answer 204 No Content (Inbox Placement DELETE):
  // an empty object, so the declared result type holds (as C/C++ "{}", iOS [:]).
  // Empty means no bytes at all: a whitespace-only body is not JSON (E7).
  if (emptyIsSuccess && status >= 200 && status < 300 && String(finalResult) === "") {
    return {};
  }
  const contentType = responseContentType(response);
  if (
    looksLikeHtml(finalResult) ||
    contentType.includes("text/html") ||
    status >= 400 ||
    !String(finalResult).trim()
  ) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }

  let parsed;
  try {
    parsed = parseJsonBody(finalResult);
  } catch (error) {
    if (error instanceof ZBApiError) throw apiError(error.message, status);
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  const account = accountLevelMessage(parsed);
  if (account) throw apiError(redactSecrets(account, secrets), status);
  const greylistExempt =
    fields != null &&
    [].concat(fields).includes("EmailValidationResult") &&
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    isGreylistMessage(parsed);
  // {"success": false, ...} on an HTTP 200 is still a failure.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (Object.prototype.hasOwnProperty.call(parsed, "success")) {
      const flag = parsed.success;
      if (isSuccessFlag(flag) && isSuccessFailure(flag)) {
        throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
      }
    }
  }
  if (!hasShape(parsed, shape)) throw apiError(UNEXPECTED_SHAPE_MESSAGE, status);
  // A field of the declared result type that arrives with another JSON type
  // (standard.md: field types are part of the shape).
  if (fields != null) {
    parsed = normalizeSuccessFlag(parsed);
    parsed = joinFileJobMessage(parsed, fields);
    const field = responseFieldMismatch(parsed, fields);
    if (field !== null) {
      throw apiError(field ? `${UNEXPECTED_FIELD_TYPE_MESSAGE} (${field}).` : `${UNEXPECTED_FIELD_TYPE_MESSAGE}.`, status);
    }
  }
  // A wrong type is reported first. A body whose fields fit, but that is only a
  // message or a file status with no known field, is still not a result.
  if (fields != null && !messageOnlyExempt && !greylistExempt && messageOnlyBody(parsed, fields)) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  if (
    requireFileStatusKnownField &&
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    !hasKnownFileStatusField(parsed)
  ) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  return parsed;
}

function saveFile(blob, filename) {
  if (!isBrowserEnvironment()) {
    throw new Error("saveFile is only available in browser environments");
  }
  if (window.navigator.msSaveOrOpenBlob) {
    // IE support
    window.navigator.msSaveOrOpenBlob(blob, filename);
  } else {
    const a = document.createElement("a");
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 0);
    return filename;
  }
}

export function notInitialized() {
  throw new Error("ZeroBounce: Call init function first with a valid api key.");
}

export function parameterIsMissing(parameter, additionalInfo = "") {
  const extra = additionalInfo ? ` ${additionalInfo}` : "";
  throw new Error(`ZeroBounce: ${parameter} parameter is missing.${extra}`);
}

export function parameterIsInvalid(parameter, additionalInfo = "") {
  const extra = additionalInfo ? ` ${additionalInfo}` : "";
  throw new Error(`ZeroBounce: ${parameter} parameter is invalid.${extra}`);
}
