// Constants
export const API_BASE_URL = "https://api.zerobounce.net/v2";
export const API_BULK_BASE_URL = "https://bulkapi.zerobounce.net/v2";
export const HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

export async function createRequest({
  requestType,
  body = null,
  params = null,
  path,
  batch = false,
  returnText = false,
  scoring = false,
}) {
  const url = `${
    batch ? API_BULK_BASE_URL : API_BASE_URL
  }${path}?${new URLSearchParams(params)}`;

  try {
    const response = await fetch(url, {
      method: requestType,
      headers: HEADERS,
      body,
    });
    if (returnText) {
      const finalResult = await response.text();
      if (!finalResult.includes('"success":"False"')) {
        const blob = new Blob([finalResult], { type: "application/json" });
        return saveFile(blob, `result${scoring ? "-scoring" : ""}.csv`);
      } else {
        return JSON.parse(finalResult);
      }
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
