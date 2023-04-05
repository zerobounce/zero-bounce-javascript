// Constants
export const API_BASE_URL = "https://api.zerobounce.net/v2";
export const API_BULK_BASE_URL = "https://bulkapi.zerobounce.net/v2";
export const HEADERS = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

// Endpoints
export function getCreditsEndpoint(apikey) {
  return `${API_BASE_URL}/getcredits?api_key=${apikey}`;
}

export function validateEndpoint(email, ip_address = null, apiKey) {
  return `${API_BASE_URL}/validate?api_key=${apiKey}&email=${email}${
    ip_address ? "&ip_address=" + ip_address : ""
  }`;
}

export function apiUsageEndpoint(startDate, endDate, apiKey) {
  return `${API_BASE_URL}/getapiusage?api_key=${apiKey}&start_date=${startDate}&end_date=${endDate}`;
}
