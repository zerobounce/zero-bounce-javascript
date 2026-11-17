// Offline guard: no test may reach a non-loopback host. Tests stub fetch (or the
// SDK's own request helpers); anything that would really send fails loudly here.
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function hostOfString(text) {
  try {
    return new URL(text).hostname;
  } catch {
    return text;
  }
}

// Every host a fetch target can mean. fetch() reads String(input) for anything
// that is not a Request, a Request has .url, and a URL-like has .href: a guard
// that read only one of them can be fooled by an object whose toString() says
// another host than its .url.
function hostsOf(target) {
  if (typeof target === "string") return [hostOfString(target)];
  if (target instanceof URL) return [target.hostname];
  const hosts = [];
  if (target && typeof target === "object") {
    if (target.url != null) hosts.push(hostOfString(String(target.url)));
    if (target.href != null) hosts.push(hostOfString(String(target.href)));
    const text = String(target);
    if (!text.startsWith("[object ")) hosts.push(hostOfString(text));
    if (hosts.length) return hosts;
  }
  return [String(target)];
}

function refuse(host, how) {
  throw new Error(`Network guard: ${how} to "${host}" refused; tests must run offline (stub fetch/XHR).`);
}

function guardHost(host, how) {
  if (!LOOPBACK.has(String(host).toLowerCase())) refuse(host, how);
}

// fetch: Node's own (guarded), or a stub/polyfill a test assigns later (left
// alone unless it is native code). It is an accessor on globalThis so that it
// is covered whether fetch exists at setup time or is defined afterwards
// (jsdom has none; a test or a polyfill may install one).
function guardFetch(real) {
  return function guardedFetch(input, init) {
    try {
      for (const host of hostsOf(input)) guardHost(host, "fetch");
    } catch (error) {
      return Promise.reject(error);
    }
    return real.call(this, input, init);
  };
}

{
  const original = globalThis.fetch;
  const isNative = (fn) => typeof fn === "function" && /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn));
  const worthGuarding = (fn) => typeof fn === "function" && fn.name !== "guardedFetch" && (fn === original || isNative(fn));
  const asData = (value) =>
    Object.defineProperty(globalThis, "fetch", { value, writable: true, configurable: true, enumerable: true });
  let wrapper = worthGuarding(original) ? guardFetch(original) : original;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    enumerable: true,
    get() {
      return wrapper;
    },
    // The first assignment turns it into an ordinary data property, which is
    // what jest.spyOn and the tests' own stubs expect; a real fetch assigned
    // is guarded, a stub is left alone.
    set(value) {
      asData(worthGuarding(value) ? guardFetch(value) : value);
    },
  });
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

// Every host a Node http(s) request can mean: the URL or options object in
// front, and the options object that may follow a URL and override its host.
function httpHosts(args) {
  const hosts = [];
  const first = args[0];
  if (typeof first === "string" || first instanceof URL) hosts.push(hostOfString(String(first)));
  for (const item of args) {
    if (item && typeof item === "object" && !(item instanceof URL)) {
      for (const key of ["hostname", "host"]) {
        if (item[key] != null) hosts.push(String(item[key]).replace(/:\d+$/, ""));
      }
      if (item.href != null) hosts.push(hostOfString(String(item.href)));
    }
  }
  if (!hosts.length) hosts.push("localhost");
  return hosts;
}

for (const name of ["http", "https"]) {
  const mod = require(name);
  for (const fn of ["request", "get"]) {
    const real = mod[fn];
    mod[fn] = function guarded(...args) {
      for (const host of httpHosts(args)) guardHost(host, `${name}.${fn}`);
      return real.apply(this, args);
    };
  }
}
{
  const http = require("http");
  const RealClientRequest = http.ClientRequest;
  http.ClientRequest = class GuardedClientRequest extends RealClientRequest {
    constructor(...args) {
      for (const host of httpHosts(args)) guardHost(host, "http.ClientRequest");
      super(...args);
    }
  };
}

// Sockets: net.connect / createConnection / Socket.prototype.connect (what
// http, https and tls end in) and tls.connect. A unix socket path is local.
function socketHost(args) {
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  if (first && typeof first === "object") {
    if (first.path != null && first.host == null && first.hostname == null) return null;
    return String(first.host ?? first.hostname ?? "localhost");
  }
  if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    return typeof args[1] === "string" ? args[1] : "localhost";
  }
  if (typeof first === "string") return null;
  return "localhost";
}

{
  const net = require("net");
  const tls = require("tls");
  for (const [mod, fn, how] of [
    [net, "connect", "net.connect"],
    [net, "createConnection", "net.createConnection"],
    [tls, "connect", "tls.connect"],
  ]) {
    const real = mod[fn];
    mod[fn] = function guarded(...args) {
      const host = socketHost(args);
      if (host !== null) guardHost(host, how);
      return real.apply(this, args);
    };
  }
  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const host = socketHost(args);
    if (host !== null) guardHost(host, "Socket.connect");
    return realConnect.apply(this, args);
  };
}

// Other ways out of the process. A child process or a worker thread starts a
// fresh Node whose fetch is not guarded, so each one is launched with the dead
// proxy (and NODE_USE_ENV_PROXY=1, which makes Node's fetch honour it) and
// loopback in NO_PROXY: only loopback can be reached from there. UDP sockets
// and DNS lookups of a non-loopback name are refused outright.
const DEAD_PROXY_ENV = {
  NODE_USE_ENV_PROXY: "1",
  HTTP_PROXY: "http://127.0.0.1:9",
  HTTPS_PROXY: "http://127.0.0.1:9",
  ALL_PROXY: "http://127.0.0.1:9",
  http_proxy: "http://127.0.0.1:9",
  https_proxy: "http://127.0.0.1:9",
  all_proxy: "http://127.0.0.1:9",
  NO_PROXY: "127.0.0.1,localhost,::1",
  no_proxy: "127.0.0.1,localhost,::1",
};

{
  const cp = require("child_process");
  // [name, index of the options argument when no args array precedes it]
  const launchers = {
    spawn: 1, spawnSync: 1, execFile: 1, execFileSync: 1, fork: 1, exec: 1, execSync: 1,
  };
  for (const [fn, at] of Object.entries(launchers)) {
    const real = cp[fn];
    if (typeof real !== "function" || real.__offlineGuard) continue;
    const wrapped = function guardedLaunch(...args) {
      let index = at;
      if (fn !== "exec" && fn !== "execSync" && Array.isArray(args[1])) index = 2;
      const given = args[index];
      if (given == null || typeof given === "function") {
        args.splice(index, 0, { env: { ...process.env, ...DEAD_PROXY_ENV } });
      } else if (typeof given === "object") {
        args[index] = { ...given, env: { ...(given.env || process.env), ...DEAD_PROXY_ENV } };
      }
      return real.apply(this, args);
    };
    wrapped.__offlineGuard = true;
    cp[fn] = wrapped;
  }
}

{
  const wt = require("worker_threads");
  const RealWorker = wt.Worker;
  if (!RealWorker.__offlineGuard) {
    class GuardedWorker extends RealWorker {
      constructor(file, options = {}) {
        const given = options && typeof options === "object" ? options : {};
        // SHARE_ENV is the parent's own environment: nothing to add there.
        const env = given.env === wt.SHARE_ENV ? given.env : { ...(given.env || process.env), ...DEAD_PROXY_ENV };
        super(file, { ...given, env });
      }
    }
    GuardedWorker.__offlineGuard = true;
    wt.Worker = GuardedWorker;
  }
}

{
  const dgram = require("dgram");
  if (!dgram.createSocket.__offlineGuard) {
    const refused = function guardedCreateSocket() {
      refuse("(any)", "dgram.createSocket");
    };
    refused.__offlineGuard = true;
    dgram.createSocket = refused;
  }
}

{
  const dns = require("dns");
  const names = [
    "lookup", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname",
    "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt",
  ];
  for (const target of [dns, dns.promises]) {
    for (const fn of names) {
      const real = target[fn];
      if (typeof real !== "function" || real.__offlineGuard) continue;
      const wrapped = function guardedDns(host, ...rest) {
        if (host != null && host !== "") guardHost(host, `dns.${fn}`);
        return real.call(this, host, ...rest);
      };
      wrapped.__offlineGuard = true;
      target[fn] = wrapped;
    }
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
