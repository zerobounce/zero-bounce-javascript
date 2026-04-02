// Constants
export const API_BULK_BASE_URL = "https://bulkapi.zerobounce.net/v2";
export const HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

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

function processGetFileResponseBody(finalResult, response, scoring) {
  const ct = (response.headers.get("content-type") || "").toLowerCase();
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
      /* treat as file body */
    }
  }

  if (!response.ok) {
    try {
      return JSON.parse(finalResult);
    } catch {
      throw new Error(finalResult || `HTTP ${response.status}`);
    }
  }

  const blob = new Blob([finalResult], { type: "text/csv" });
  return saveFile(blob, `result${scoring ? "-scoring" : ""}.csv`);
}

export async function createRequest({
  requestType,
  body = null,
  params = null,
  path,
  batch = false,
  returnText = false,
  scoring = false,
  apiBaseURL
}) {
  const url = `${
    batch ? API_BULK_BASE_URL : apiBaseURL
  }${path}?${new URLSearchParams(params)}`;

  try {
    const response = await fetch(url, {
      method: requestType,
      headers: HEADERS,
      body,
    });
    if (returnText) {
      const finalResult = await response.text();
      return processGetFileResponseBody(finalResult, response, scoring);
    }
    if (response.status === 403) {  
      throw new Error('[Error]: api_key is invalid');
    } else {
      const finalResult = await response.json();
      return finalResult;
    }
  } catch (error) {
    throw new Error(error);
  }
}

function saveFile(blob, filename) {
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
  console.error("ZeroBounce: Call init function first with a valid api key.");
}

export function parameterIsMissing(parameter, aditionalInfo = "") {
  console.error(
    `ZeroBounce: ${parameter} parameter is missing. ${aditionalInfo}`
  );
}

export function parameterIsInvalid(parameter, aditionalInfo = "") {
  console.error(
    `ZeroBounce: ${parameter} parameter is invalid. ${aditionalInfo}`
  );
}
