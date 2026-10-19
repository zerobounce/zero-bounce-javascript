// Constants
export const API_BULK_BASE_URL = "https://bulkapi.zerobounce.net/v2";
export const API_BULK_ROOT_URL = "https://bulkapi.zerobounce.net";
export const HTTP_TIMEOUT_MS = 120000;
export const HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

export function requireHttpsUrl(url) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
    throw new Error("apiBaseURL must be an https:// URL");
  }
  return url;
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
  if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
  if (Array.isArray(parsed.message)) {
    const parts = parsed.message.filter((item) => typeof item === "string" && item.trim());
    if (parts.length) return parts.join("; ");
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

function transportError(error) {
  const name = error && error.name ? error.name : "Error";
  const message = error && error.message ? error.message : String(error);
  const redacted = `${name}: ${message}`.replace(/([?&]api_key=)[^&\s"']+/gi, "$1***");
  return new Error(redacted);
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
    throw new Error(messageFromBody(finalResult, status));
  }
  if (!String(finalResult).trim()) {
    throw new Error(`Empty response from ZeroBounce (HTTP ${status})`);
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
      throw new Error("ZeroBounce returned a response that is not valid JSON.");
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

function buildRequestUrl({ batch, bulkBase, apiBaseURL, path, params }) {
  const base = batch ? bulkApiBase(bulkBase) : apiBaseURL;
  const query =
    params != null && Object.keys(params).length > 0
      ? `?${new URLSearchParams(params)}`
      : "";
  return `${base}${path}${query}`;
}

export async function createRequest({
  requestType,
  body = null,
  params = null,
  path,
  batch = false,
  bulkBase = "v2",
  returnText = false,
  scoring = false,
  apiBaseURL
}) {
  const url = buildRequestUrl({ batch, bulkBase, apiBaseURL, path, params });

  let response;
  try {
    response = await fetch(url, {
      method: requestType,
      headers: HEADERS,
      body,
      signal: fetchTimeoutSignal(),
      redirect: "error",
    });
  } catch (error) {
    // Some fetch polyfills embed the request URL, including api_key, in errors.
    throw transportError(error);
  }

  let finalResult;
  try {
    finalResult = await readBodyText(response);
  } catch (error) {
    throw transportError(error);
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
    throw new Error(messageFromBody(finalResult, status));
  }

  let parsed;
  try {
    parsed = JSON.parse(finalResult);
  } catch {
    throw new Error(messageFromBody(finalResult, status));
  }
  const account = accountLevelMessage(parsed);
  if (account) throw new Error(account);
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
