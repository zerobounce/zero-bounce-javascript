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

/** Replace every form a secret could take in a message with ***. */
export function redactSecrets(text, secrets = []) {
  let value = String(text);
  for (const secret of secrets) {
    if (!secret) continue;
    for (const form of [secret, encodeURIComponent(secret), escape(secret)]) {
      if (form) value = value.split(form).join("***");
    }
  }
  return value.replace(/([?&](?:api_key|API-Key)=)[^&\s"']+/gi, "$1***");
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

function shouldReturnGetFileAsJsonError(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  if (getFileJsonIndicatesFailure(parsed)) return true;
  return Object.prototype.hasOwnProperty.call(parsed, "success");
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

function looksLikeHtml(body) {
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
  for (const key of ["error", "message", "error_message", "detail"]) {
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
  if (typeof parsed.error === "string" && isAccountLevelText(parsed.error)) {
    return stripErrorPrefix(parsed.error.trim());
  }
  return null;
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

export function warnOnRegionalBulkHost(url, apiBaseURL, state) {
  if (!state || state.warned) return;
  const base = String(apiBaseURL || "").toLowerCase();
  if (!REGIONAL_API_HOSTS.some((host) => base.includes(host))) return;
  if (!String(url).toLowerCase().includes("bulkapi.zerobounce.net")) return;
  state.warned = true;
  const warn = typeof console !== "undefined" && console.warn ? console.warn : null;
  if (warn) {
    warn(
      "ZeroBounce: a regional base URL is set, but this request goes to " +
        "bulkapi.zerobounce.net. ZeroBounce documents no regional bulk host."
    );
  }
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

  const trimmed = finalResult.trim();
  const looksJson =
    ct.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (looksJson) {
    try {
      const parsed = JSON.parse(finalResult);
      if (shouldReturnGetFileAsJsonError(parsed)) {
        return parsed;
      }
    } catch {
      throw apiError("ZeroBounce returned a response that is not valid JSON.", status);
    }
  }

  if (!isBrowserEnvironment()) {
    return finalResult;
  }

  const blob = new Blob([finalResult], { type: "text/csv" });
  return saveFile(blob, `result${scoring ? "-scoring" : ""}.csv`);
}

function bulkApiBase(bulkBase) {
  return bulkBase === "root" ? API_BULK_ROOT_URL : API_BULK_BASE_URL;
}

function buildRequestUrl({ batch, bulkBase, apiBaseURL, baseURL, path, params }) {
  // An explicit baseURL wins: the list evaluator, the Inbox Placement Tester and
  // the finder/domain-search families each have their own, overridable host.
  const base = baseURL != null ? baseURL : batch ? bulkApiBase(bulkBase) : apiBaseURL;
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
  returnText = false,
  scoring = false,
  apiBaseURL,
  baseURL = null,
  bearerToken = null,
  extraHeaders = null,
  secrets = [],
  regionalWarningState = null,
}) {
  const url = buildRequestUrl({ batch, bulkBase, apiBaseURL, baseURL, path, params });
  requireHttpsUrl(url, "request URL");
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
    finalResult = await readBodyText(response);
  } catch (error) {
    throw transportError(error, secrets);
  }

  if (returnText) {
    return processGetFileResponseBody(finalResult, response, scoring);
  }

  const status = responseStatus(response);
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
    parsed = JSON.parse(finalResult);
  } catch {
    throw apiError(redactSecrets(messageFromBody(finalResult, status), secrets), status);
  }
  const account = accountLevelMessage(parsed);
  if (account) throw apiError(account, status);
  // {"success": false, ...} on an HTTP 200 is still a failure.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const failed = parsed.success === false || parsed.success === "False" || parsed.success === "false";
    if (failed) {
      throw apiError(messageFromBody(finalResult, status), status);
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
