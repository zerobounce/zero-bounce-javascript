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

/**
 * The detail of the failure for a URL that is not a clean https base URL. The
 * message never quotes the URL, which may carry a credential.
 */
const REFUSED_URL_DETAIL =
  ' (plain http:// only to 127.0.0.1, localhost or [::1]) with a host, without user information, a query string or a fragment ("@", "?" or "#"), a backslash, whitespace, control or invisible characters, a lone surrogate, a non-ASCII character or a "%" in the host, or an encoded slash or a dot segment in the path';

/** A character no URL may carry: control, whitespace, invisible, bidi, format, surrogate, backslash. */
function isForbiddenUrlCharacter(char) {
  if (char === "\\") return true;
  const code = char.codePointAt(0);
  if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  if (code >= 0xd800 && code <= 0xdfff) return true; // a lone surrogate (a pair is one code point)
  if (code === 0xfffd) return true;
  if (isInvisibleChar(code)) return true;
  return /[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}\p{Co}\p{Cn}]/u.test(char);
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** The raw authority's host (lower case), or null when it is not a plain ASCII host with an optional numeric port. */
function rawHost(authority) {
  let host = authority;
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    if (close < 0) return null;
    const port = host.slice(close + 1);
    host = host.slice(0, close + 1);
    if (!/^\[[0-9A-Fa-f:.]+\]$/.test(host)) return null;
    if (port && !/^:[0-9]+$/.test(port)) return null;
    return host.toLowerCase();
  }
  const colon = host.lastIndexOf(":");
  if (colon >= 0) {
    if (!/^[0-9]*$/.test(host.slice(colon + 1))) return null;
    host = host.slice(0, colon);
  }
  if (!host || host.includes(":") || host.includes("%") || !/^[\x21-\x7e]+$/.test(host)) return null;
  return host.toLowerCase();
}

/**
 * Checks the raw string before `new URL()` sees it: the parser strips tabs and
 * newlines, trims, turns backslashes into slashes and folds fullwidth or
 * percent-encoded hosts, so a URL it accepts can send the key somewhere other
 * than the text says.
 */
function refuseBadTransportUrl(url, name, isBase) {
  const shortRefusal = () => new Error(`ZeroBounce: ${name} must be an https:// URL`);
  const refused = () => new Error(`ZeroBounce: ${name} must be an https:// URL${REFUSED_URL_DETAIL}`);
  if (typeof url !== "string") throw shortRefusal();
  const lowered = url.toLowerCase();
  const isHttps = lowered.startsWith("https://");
  const isHttp = lowered.startsWith("http://");
  if (!isHttps && !isHttp) throw shortRefusal();
  const rest = url.slice(isHttps ? 8 : 7);
  const authorityEnd = rest.search(/[/?#\\]/);
  const authority = authorityEnd < 0 ? rest : rest.slice(0, authorityEnd);
  if (authority.includes("@")) {
    throw new Error(`ZeroBounce: ${name} must not contain a username or password.`);
  }
  if (isBase && (url.includes("?") || url.includes("#"))) {
    throw new Error(`ZeroBounce: ${name} must not contain a query string or a fragment ("?" or "#").`);
  }
  for (const char of url) {
    if (isForbiddenUrlCharacter(char)) throw refused();
  }
  const host = rawHost(authority);
  if (host == null) throw refused();
  if (isHttp && !LOOPBACK_HOSTS.has(host)) throw shortRefusal();
  if (isBase) {
    for (const segment of rest.slice(authority.length).split("/")) {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Keep the raw segment.
      }
      const lower = segment.toLowerCase();
      if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) throw refused();
      if (lower.includes("%2f") || lower.includes("%5c") || lower.includes("%00")) throw refused();
    }
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw shortRefusal();
  }
  if (parsed.username || parsed.password) {
    throw new Error(`ZeroBounce: ${name} must not contain a username or password.`);
  }
  const parsedHost = parsed.hostname.toLowerCase();
  if (parsedHost !== host && `[${parsedHost}]` !== host && parsedHost !== host.replace(/^\[|\]$/g, "")) {
    throw refused();
  }
  return url;
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
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
      if (code >= 0xd800 && code <= 0xdfff) return true; // a lone surrogate would be sent as U+FFFD
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

/** Every %XX as the Latin-1 character of its byte: the reading of a body that echoed a Latin-1 key ("%E9" for "é"). */
function percentLatin1(text) {
  return text.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Runs of characters U+0080 to U+00FF read as bytes: each valid UTF-8 sequence
 * becomes its character. `\xC3\xA9` and `\303\251` are the two bytes of "é",
 * which jsonUnescaped alone leaves as "Ã©"; a byte that starts no valid
 * sequence stays as it is, so this is a second view next to that one.
 */
function latin1RunsAsUtf8(text) {
  return text.replace(/[\u0080-\u00ff]+/g, (run) => {
    let out = "";
    let i = 0;
    while (i < run.length) {
      const length = utf8SequenceLength(run.charCodeAt(i));
      if (length > 1 && i + length <= run.length) {
        let escaped = "";
        for (let k = 0; k < length; k += 1) escaped += `%${run.charCodeAt(i + k).toString(16).padStart(2, "0")}`;
        try {
          out += decodeURIComponent(escaped);
          i += length;
          continue;
        } catch {
          // Not a valid sequence: keep this byte as it is.
        }
      }
      out += run[i];
      i += 1;
    }
    return out;
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
    if (next === "U" && /^[0-9A-Fa-f]{8}$/.test(text.slice(i + 2, i + 10)) && parseInt(text.slice(i + 2, i + 10), 16) <= 0x10ffff) {
      out += codePointText(parseInt(text.slice(i + 2, i + 10), 16));
      i += 10;
      continue;
    }
    if (next === "u" || next === "U") {
      const hex = text.slice(i + 2, i + 6);
      if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
        let code = parseInt(hex, 16);
        if (code >= 0xd800 && code <= 0xdbff && text[i + 6] === "\\" && (text[i + 7] === "u" || text[i + 7] === "U")) {
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
  percentLatin1,
  (text) => percentLatin1(text.split("+").join(" ")),
  jsonUnescaped,
  (text) => latin1RunsAsUtf8(jsonUnescaped(text)),
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
 * The most text redaction works on. Masking decodes and folds the text
 * (seconds per megabyte of non-ASCII text), and no message the SDK builds is
 * near this long, so longer text is replaced, whole, by a fixed message.
 */
export const MAX_REDACTED_LENGTH = 65536;
export const TEXT_TOO_LONG_MESSAGE = "ZeroBounce: the text was omitted because it is too long to show.";

/** The UTF-8 length of the text, counting a lone surrogate as 3 (U+FFFD). */
function utf8Length(text) {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) total += 1;
    else if (code < 0x800) total += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      total += 4;
      i += 1;
    } else total += 3;
  }
  return total;
}

/**
 * Replace every form a secret could take in a message with ***. Then decode
 * what is left (URL, "+", JSON, up to four layers in any order): a spelling
 * the list above misses still decodes to the secret, and the whole text is
 * dropped for a fixed message rather than returned.
 */
export function redactSecrets(text, secrets = []) {
  let value = String(text);
  if (value.length > MAX_REDACTED_LENGTH / 3 && utf8Length(value) > MAX_REDACTED_LENGTH) {
    return TEXT_TOO_LONG_MESSAGE;
  }
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

export function responseStatus(response) {
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
function skipLeadingHtmlWhitespace(body, whole = false) {
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
  return whole ? text.slice(i) : text.slice(i, i + 2000);
}

const HTML_PROBE_CHARS = 2000;
const HTML_TAGS = ["<!doctype html", "<html", "<head", "<body"];

/** A tag found whole: the next character is whitespace, `>` or `/`. */
function hasWholeTag(text, tag, following) {
  let from = 0;
  for (;;) {
    const at = text.indexOf(tag, from);
    if (at < 0) return false;
    const end = at + tag.length;
    const next = end < text.length ? text[end] : following;
    if (next === undefined) return true;
    if (next === ">" || next === "/" || next === " " || next === "\t" || next === "\n" || next === "\r" || next === "\u000b" || next === "\f") {
      return true;
    }
    from = at + 1;
  }
}

/**
 * Whether a body is an HTML page. A body that starts with `{` or `[` after its
 * padding is never HTML (it is JSON, whatever a string in it says). Any other
 * body is HTML when a whole `<!doctype html`, `<html`, `<head` or `<body` tag
 * (followed by whitespace, `>` or `/`, so `<header>` and `<htmlfoo>` do not
 * match) is in its first 2000 characters, in any case.
 */
export function looksLikeHtml(body) {
  const text = String(body);
  const start = text.length - skipLeadingHtmlWhitespace(text, true).length;
  const first = text[start];
  if (first === "{" || first === "[") return false;
  const window = text.slice(start, start + HTML_PROBE_CHARS + 1).toLowerCase();
  const head = window.slice(0, HTML_PROBE_CHARS);
  const following = window.length > HTML_PROBE_CHARS ? window[HTML_PROBE_CHARS] : undefined;
  return HTML_TAGS.some((tag) => hasWholeTag(head, tag, following));
}

/**
 * Whether a file download is an HTML page. Unlike an API answer, a CSV can
 * hold `<body>` in a cell, so by body alone a download is HTML only when it
 * starts with `<` after its padding (a CSV never does); an HTML content type
 * is checked by the caller.
 */
export function looksLikeHtmlDownload(body) {
  const text = String(body);
  const start = text.length - skipLeadingHtmlWhitespace(text, true).length;
  return text[start] === "<";
}

export const HTML_DOWNLOAD_MESSAGE = "ZeroBounce returned an HTML page (text/html) instead of a file.";
export const HTML_PAGE_DOWNLOAD_MESSAGE = "ZeroBounce returned an HTML page instead of a file.";

/**
 * The fixed text for a download that is not a file because it looks like HTML
 * (it starts with `<`, or is served as text/html), or null when the body
 * should speak for itself: an HTML page (its title is shown), a JSON body (its
 * message) or, on an error status, a plain-text message. The content type is
 * named only when it really is text/html.
 */
export function htmlDownloadMessage(body, contentType, status) {
  const text = String(body);
  if (!text.trim() || looksLikeHtml(text) || looksLikeJson(text)) return null;
  const start = text.length - skipLeadingHtmlWhitespace(text, true).length;
  if (status >= 400 && text[start] !== "<") return null;
  return String(contentType).includes("text/html") ? HTML_DOWNLOAD_MESSAGE : HTML_PAGE_DOWNLOAD_MESSAGE;
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
 * What a body's own top-level "success" field says, read from the raw text
 * (JSON.parse keeps only the last of duplicate keys, so a first `false` would
 * be lost): "absent", "notflag", "true" or "false". A flag is a JSON boolean,
 * the number 0 or 1, or the text true/false/0/1 (any case, trimmed). Anything
 * else (null, 2, 0.4, "maybe", an object) is no flag: "notflag", read as if
 * the field were absent. Any real false among duplicates is "false". Only the
 * object's own keys count, never a nested "success" or one inside a string.
 */
export function successFlagOfBody(body) {
  const text = String(body);
  let i = 0;
  const n = text.length;
  const isWs = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";
  while (i < n && (isWs(text[i]) || text.charCodeAt(i) === 0xfeff)) i += 1;
  if (text[i] !== "{") return "absent";
  let result = "absent";
  let depth = 0;
  const stringEnd = (from) => {
    let j = from + 1;
    while (j < n) {
      if (text[j] === "\\") j += 2;
      else if (text[j] === '"') return j;
      else j += 1;
    }
    return n;
  };
  const classify = (token, isString) => {
    const t = token.trim().toLowerCase();
    if (t === "true" || (isString && t === "1")) return "true";
    if (t === "false" || (isString && t === "0")) return "false";
    // A JSON number is a flag by its value (0e5, -0 and 1.0 are, 0.4 and 2 are not).
    if (!isString && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?$/.test(t)) {
      const number = Number(t);
      if (Number.isFinite(number) && number === 1) return "true";
      if (Number.isFinite(number) && number === 0) return "false";
    }
    return "notflag";
  };
  while (i < n) {
    const c = text[i];
    if (c === "{" || c === "[") depth += 1;
    else if (c === "}" || c === "]") depth -= 1;
    else if (c === '"') {
      const close = stringEnd(i);
      let after = close + 1;
      while (after < n && isWs(text[after])) after += 1;
      if (depth === 1 && text[after] === ":") {
        let key;
        try {
          key = JSON.parse(text.slice(i, close + 1));
        } catch {
          key = "";
        }
        if (key === "success") {
          after += 1;
          while (after < n && isWs(text[after])) after += 1;
          let one;
          if (text[after] === '"') {
            const end = stringEnd(after);
            let token;
            try {
              token = JSON.parse(text.slice(after, end + 1));
            } catch {
              token = "\u0000";
            }
            one = classify(token, true);
          } else {
            let end = after;
            while (end < n && !isWs(text[end]) && text[end] !== "," && text[end] !== "}" && text[end] !== "]") end += 1;
            const token = text.slice(after, end);
            one = /^[{\[]/.test(token) ? "notflag" : classify(token, false);
          }
          if (one === "false") return "false";
          if (one === "true" || result === "absent") result = one;
        }
      }
      i = close;
    }
    i += 1;
  }
  return result;
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

const HTML_TITLE_WINDOW = 65536;
const HTML_TITLE_MAX = 1000;

/** Index of `needle` (lower-case ASCII) in `text` from `from`, comparing only A-Z case-insensitively. */
function indexOfAsciiCaseless(text, needle, from) {
  const first = needle.length;
  for (let at = text.indexOf("<", from); at >= 0; at = text.indexOf("<", at + 1)) {
    if (at + first > text.length) return -1;
    let same = true;
    for (let k = 1; k < first; k += 1) {
      let code = text.charCodeAt(at + k);
      if (code >= 65 && code <= 90) code += 32;
      if (code !== needle.charCodeAt(k)) {
        same = false;
        break;
      }
    }
    if (same) return at;
  }
  return -1;
}

/**
 * The text of the page's <title>, or "" when there is none or it is longer than
 * 1000 characters. A linear scan of the first 64 KiB (no backtracking pattern).
 * Tags are found on the original text, comparing ASCII letters without case,
 * and the title is cut from the original: no lower-cased copy is ever shown.
 */
function htmlTitle(body) {
  const text = String(body).slice(0, HTML_TITLE_WINDOW);
  let from = 0;
  for (;;) {
    const open = indexOfAsciiCaseless(text, "<title", from);
    if (open < 0) return "";
    const next = text[open + 6];
    if (next === ">" || next === "/" || next === " " || next === "\t" || next === "\n" || next === "\r" || next === "\f" || next === "\u000b") {
      const tagEnd = text.indexOf(">", open);
      if (tagEnd < 0) return "";
      const close = indexOfAsciiCaseless(text, "</title", tagEnd);
      if (close < 0) return "";
      if (close - tagEnd - 1 > HTML_TITLE_MAX) return "";
      const title = text.slice(tagEnd + 1, close).replace(/\s+/g, " ").trim();
      return title.length > HTML_TITLE_MAX ? "" : title;
    }
    from = open + 1;
  }
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
      if (strings.length) return strings.join("\n");
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

function accountLevelMessage(parsed, successState = "absent") {
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
  const noSuccess = successState === "absent" || successState === "notflag";
  for (const key of ["error", "error_message", "Error"]) {
    const value = parsed[key];
    if (typeof value !== "string" || !value.trim()) continue;
    if (noSuccess || (key !== "error_message" && isAccountLevelText(value))) {
      return stripErrorPrefix(value.trim()) || value.trim();
    }
  }
  return null;
}

/**
 * The object without a "success" that is no flag (read as absent), or null for
 * a real flag or a non-object.
 */
function objectWithoutSuccess(parsed, successState) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (!Object.prototype.hasOwnProperty.call(parsed, "success")) return parsed;
  if (successState !== "notflag") return null;
  const { success: _ignored, ...rest } = parsed;
  return rest;
}

/**
 * validate's one message-only exemption: the greylist answer, a body whose only
 * key is "Message" (capital M) holding a text. Any other message-only body is an error.
 */
function isGreylistAnswer(object) {
  const keys = Object.keys(object);
  return keys.length === 1 && keys[0] === "Message" && typeof object.Message === "string" && object.Message.trim() !== "";
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
function messageOnlyBody(parsed, fieldTypes = null, successState = "absent") {
  const object = objectWithoutSuccess(parsed, successState);
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
      const account = accountLevelMessage(parsed, successFlagOfBody(trimmed));
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

const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag).get;

/**
 * The upload file as FormData takes it: a Blob/File, or a Buffer/Uint8Array
 * wrapped into a Blob under the given name. Anything else (a path string, a
 * stream, a plain object) is refused before any request is sent, because
 * FormData would turn it into a text field such as "[object Object]".
 */
export function uploadFilePart(file, fileName = null, argument = "file") {
  const isBlob = typeof Blob !== "undefined" && file instanceof Blob;
  // Not instanceof: a Buffer made in another realm (jsdom, a vm) is still bytes.
  // The real typed-array tag (a getter no plain object can fake), so a Buffer from another realm counts.
  const isBytes = ArrayBuffer.isView(file) && TYPED_ARRAY_TAG.call(file) === "Uint8Array";
  if (!isBlob && !isBytes) {
    throw apiError(
      `ZeroBounce: ${argument} must be a Blob, a File, a Buffer or a Uint8Array ` +
        "(a file path, a stream or any other value is not accepted).",
      0
    );
  }
  let name = fileName;
  if (name == null && isBlob && typeof file.name === "string") name = file.name;
  if (name == null && isBytes) name = "file.csv";
  const part = isBytes ? new Blob([file]) : file;
  return name == null ? [part] : [part, String(name)];
}

const LINE_BREAK_OR_NUL = /[\r\n\0]/;

/**
 * Refuses CR, LF and NUL in every text field and file name of a multipart
 * body, before the request is sent (lesson 121). The text is never quoted.
 */
function refuseControlsInForm(body) {
  if (!body || typeof body !== "object" || typeof body.entries !== "function") return;
  if (typeof FormData === "undefined" || !(body instanceof FormData)) return;
  for (const [key, value] of body.entries()) {
    if (typeof value === "string") {
      if (LINE_BREAK_OR_NUL.test(value)) {
        throw apiError(`ZeroBounce: the form field "${String(key).slice(0, 40)}" must not contain a line break or a NUL character.`, 0);
      }
    } else if (value && typeof value.name === "string" && LINE_BREAK_OR_NUL.test(value.name)) {
      throw apiError("ZeroBounce: the file name must not contain a line break or a NUL character.", 0);
    }
  }
}

/**
 * A network failure, with every form of the secret removed.
 *
 * The redacted copy is returned on its own: the original is never attached as
 * `cause`, because its message and request URL can carry the key.
 */
export function transportError(error, secrets = []) {
  const name = error && error.name ? error.name : "Error";
  const message = error && error.message ? error.message : String(error);
  // Node's fetch reports every network failure as "TypeError: fetch failed" and
  // keeps the reason (ECONNREFUSED, ENOTFOUND, a TLS error) in `cause`.
  // Only the error's own text is redacted: the fixed words around it are the SDK's.
  let text = redactSecrets(`${name}: ${message}`, secrets);
  const cause = error && typeof error === "object" ? error.cause : null;
  if (cause && typeof cause === "object") {
    const code = typeof cause.code === "string" ? cause.code : "";
    const detail = typeof cause.message === "string" ? cause.message : "";
    const reason = [code, detail && detail !== code ? detail : ""].filter(Boolean).join(": ");
    // Redact the whole reason (never a pre-cut piece of it: a cut inside a secret
    // would leave its start); a redacted text over 300 characters is not cut
    // (a long secret repeated would leave its start at the cut) but omitted.
    if (reason) {
      const redacted = redactSecrets(reason, secrets);
      if (redacted.length <= 300) {
        text += ` (${redacted})`;
      } else {
        // The short error code (ECONNRESET) is still worth showing.
        const shownCode = code && code.length <= 40 ? `${redactSecrets(code, secrets)}: ` : "";
        text += ` (${shownCode}${TRANSPORT_DETAILS_OMITTED})`;
      }
    }
  }
  return apiError(text, 0);
}

const TRANSPORT_DETAILS_OMITTED = "details omitted: too long";

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
  const htmlish = looksLikeHtmlDownload(finalResult) || ct.includes("text/html");
  if (htmlish || status >= 400) {
    // A page without a whole html/head/body tag, or CSV rows under text/html, get the fixed
    // text; an HTML page, a JSON body or a plain error message speak for themselves.
    const fixed = htmlish ? htmlDownloadMessage(finalResult, ct, status) : null;
    throw apiError(fixed || messageFromBody(finalResult, status), status);
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

/** Refuses a 3xx (or a browser's opaque redirect, status 0): this client never follows one. */
export function refuseRedirect(response) {
  const status = responseStatus(response);
  if (response && response.type === "opaqueredirect") {
    throw apiError("ZeroBounce returned a redirect, which this client does not follow.", 0);
  }
  if (status >= 300 && status < 400) {
    throw apiError("ZeroBounce returned a redirect, which this client does not follow.", status);
  }
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
  messageFirst = false,
  requireFileStatusKnownField = false,
  emptyIsSuccess = false,
  shape = "object",
  fields = null,
}) {
  const url = buildRequestUrl({ batch, bulkBase, bulkURLs, apiBaseURL, baseURL, path, params });
  requireHttpsUrl(url, "request URL");
  refuseControlsInForm(body);
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
      redirect: "manual",
    });
  } catch (error) {
    // Some fetch polyfills embed the request URL, including the key, in errors.
    throw transportError(error, secrets);
  }

  // redirect: "manual" hands back the 3xx itself (a browser's opaque redirect
  // has status 0), so the caller sees the status instead of "fetch failed".
  refuseRedirect(response);

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
  const successState = successFlagOfBody(finalResult);
  const account = accountLevelMessage(parsed, successState);
  if (account) throw apiError(redactSecrets(account, secrets), status);
  const greylistExempt =
    fields != null &&
    [].concat(fields).includes("EmailValidationResult") &&
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    isGreylistAnswer(parsed);
  // {"success": false, ...} on an HTTP 200 is still a failure, whichever of
  // duplicate "success" keys says so. A "success" that is no flag is read as absent.
  if (successState === "false") {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  if (!hasShape(parsed, shape)) throw apiError(UNEXPECTED_SHAPE_MESSAGE, status);
  // A field of the declared result type that arrives with another JSON type
  // (standard.md: field types are part of the shape).
  const hasMessageKey = parsed !== null && typeof parsed === "object" && Object.keys(parsed).some((key) => MESSAGE_KEYS.has(key));
  const messageOnlyNow = () =>
    fields != null && !greylistExempt && messageOnlyBody(parsed, fields, successState);
  // A message beside a "success" that is no flag is that message, not a wrong type.
  if (successState === "notflag" && hasMessageKey && !messageOnlyExempt && messageOnlyNow()) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  // getCredits (messageFirst): a message-only body is the API's text, not a missing field.
  if (messageFirst && hasMessageKey && messageOnlyNow()) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
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
  if (!messageOnlyExempt && messageOnlyNow()) {
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
    return filename;
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
