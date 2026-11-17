// Offline guard: no test may reach a non-loopback host. Tests stub fetch (or the
// SDK's own request helpers); anything that would really send fails loudly here.
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function hostOf(target) {
  try {
    const url = typeof target === "string" || target instanceof URL ? new URL(String(target)) : new URL(target.url || target.href);
    return url.hostname;
  } catch {
    return String(target);
  }
}

function refuse(host, how) {
  throw new Error(`Network guard: ${how} to "${host}" refused; tests must run offline (stub fetch/XHR).`);
}

function guardHost(host, how) {
  if (!LOOPBACK.has(String(host).toLowerCase())) refuse(host, how);
}

// fetch (Node's own, or whatwg-fetch installed later by a test, which uses XMLHttpRequest).
if (typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch;
  globalThis.fetch = function guardedFetch(input, init) {
    try {
      guardHost(hostOf(input), "fetch");
    } catch (error) {
      return Promise.reject(error);
    }
    return realFetch.call(this, input, init);
  };
}

// XMLHttpRequest (jsdom): checked when the request is opened.
if (typeof XMLHttpRequest !== "undefined") {
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function guardedOpen(method, url, ...rest) {
    const base = typeof location !== "undefined" ? location.href : undefined;
    let host;
    try {
      host = new URL(String(url), base).hostname;
    } catch {
      host = String(url);
    }
    guardHost(host, "XMLHttpRequest");
    return realOpen.call(this, method, url, ...rest);
  };
}

// Node http / https.
for (const name of ["http", "https"]) {
  const mod = require(name);
  for (const fn of ["request", "get"]) {
    const real = mod[fn];
    mod[fn] = function guarded(...args) {
      const first = args[0];
      let host;
      if (typeof first === "string" || first instanceof URL) host = hostOf(first);
      else host = (first && (first.hostname || first.host)) || "localhost";
      guardHost(String(host).replace(/:\d+$/, ""), `${name}.${fn}`);
      return real.apply(this, args);
    };
  }
}

if (typeof window !== "undefined" && window.URL) {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {};
  }
}

// jsdom has no TextDecoder; browsers and Node (>= 18) do, and the SDK reads
// JSON bodies with it (keeping a byte order mark, so it is rejected).
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = require("util").TextDecoder;
}
