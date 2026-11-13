import { responseFieldMismatch, UNEXPECTED_FIELD_TYPE_MESSAGE } from "./response-fields.js";

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
 * Every request carries a key: refuse to send one anywhere but https.
 * Covers each overridable base URL, not just the main one.
 */
export function requireHttpsUrl(url, name = "apiBaseURL") {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
    throw new Error(`ZeroBounce: ${name} must be an https:// URL`);
  }
  return url;
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

/**
 * Reject a key with surrounding whitespace or control characters — for example
 * one read from a file with its trailing newline. `fetch` would otherwise
 * reject it as a header value and quote it, unredacted, in its own error.
 */
export function checkApiKey(apiKey, name = "api key") {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error(`ZeroBounce: ${name} parameter is missing.`);
  }
  if (apiKey !== apiKey.trim() || /[\u0000-\u001f\u007f]/.test(apiKey)) {
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

const JSON_UNESCAPES = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

/** Each JSON string escape (\" \\ \/ \b \f \n \r \t \uXXXX) decoded, in one left-to-right pass. */
function jsonUnescaped(text) {
  return text.replace(/\\(?:u([0-9A-Fa-f]{4})|(["\\/bfnrt]))/g, (_, hex, simple) =>
    hex ? String.fromCharCode(parseInt(hex, 16)) : JSON_UNESCAPES[simple]
  );
}

/**
 * The decoders a body's encodings are undone with: URL (%XX), form ("+" as a
 * space, then %XX, so a form-encoded layer takes one step) and JSON.
 */
const DECODERS = [percentDecoded, (text) => percentDecoded(text.split("+").join(" ")), jsonUnescaped];
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
  if (Object.prototype.hasOwnProperty.call(o, "success") && o.success != null) {
    if (o.success === false || o.success === "False" || o.success === "false") {
      return true;
    }
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

export function looksLikeHtml(body) {
  const head = String(body).slice(0, 2000).toLowerCase();
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<body")
  );
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

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

const MESSAGE_KEYS = new Set(["error", "message", "error_message", "Message", "Error", "detail"]);

/**
 * Whether a body is nothing but a message: an object with no "success" field
 * whose keys are all message keys, at least one a non-empty string. Only for
 * the email finder and domain search, whose result is never a bare message.
 * LIVE: guessformat answers an invalid or drained key with an HTTP 200 and
 * {"Message": "Invalid API key or your account ran out of credits"}. Not for
 * validate: a repeated greylist_processing request answers
 * {"Message": "Greylist validation still in progress..."}, which is a result.
 */
function messageOnlyBody(parsed) {
  const object = objectWithoutSuccess(parsed);
  if (!object) return false;
  const keys = Object.keys(object);
  return keys.length > 0 && keys.every((key) => MESSAGE_KEYS.has(key)) && keys.some((key) => nonEmptyString(object[key]));
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
  return new Error(redactSecrets(`${name}: ${message}`, secrets));
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

function processGetFileResponseBody(finalResult, response, scoring) {
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

  const blob = new Blob([finalResult], { type: "text/csv" });
  return saveFile(blob, `result${scoring ? "-scoring" : ""}.csv`);
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
  messageOnlyIsFailure = false,
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
      return processGetFileResponseBody(finalResult, response, scoring);
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
  if (messageOnlyIsFailure && messageOnlyBody(parsed)) {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  // {"success": false, ...} on an HTTP 200 is still a failure.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const failed = parsed.success === false || parsed.success === "False" || parsed.success === "false";
    if (failed) {
      throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
    }
  }
  if (!hasShape(parsed, shape)) throw apiError(UNEXPECTED_SHAPE_MESSAGE, status);
  // A field of the declared result type that arrives with another JSON type
  // (standard.md: field types are part of the shape).
  if (fields != null) {
    const field = responseFieldMismatch(parsed, fields);
    if (field !== null) {
      throw apiError(field ? `${UNEXPECTED_FIELD_TYPE_MESSAGE} (${field}).` : `${UNEXPECTED_FIELD_TYPE_MESSAGE}.`, status);
    }
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

export function parameterIsMissing(parameter, aditionalInfo = "") {
  const extra = aditionalInfo ? ` ${aditionalInfo}` : "";
  throw new Error(`ZeroBounce: ${parameter} parameter is missing.${extra}`);
}

export function parameterIsInvalid(parameter, aditionalInfo = "") {
  const extra = aditionalInfo ? ` ${aditionalInfo}` : "";
  throw new Error(`ZeroBounce: ${parameter} parameter is invalid.${extra}`);
}
