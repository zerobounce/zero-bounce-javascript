/**
 * @jest-environment node
 *
 * The offline guard in tests/jest.setup.js: each way of reaching a
 * non-loopback host is refused, and a loopback request still works. Nothing
 * here leaves the machine: every refusal happens before a socket is opened.
 */
import http from "http";
import https from "https";
import net from "net";
import tls from "tls";

const OTHER = "guard-target.example.invalid";

describe("network guard", () => {
  it("refuses fetch to another host, however the target is spelled", async () => {
    await expect(fetch(`https://${OTHER}/x`)).rejects.toThrow(/Network guard/);
    await expect(fetch(new URL(`https://${OTHER}/x`))).rejects.toThrow(/Network guard/);
    await expect(fetch({ url: `https://${OTHER}/x` })).rejects.toThrow(/Network guard/);
    await expect(fetch({ href: `https://${OTHER}/x` })).rejects.toThrow(/Network guard/);
    // .url says loopback, toString says another host (fetch reads toString).
    const sneaky = { url: "http://127.0.0.1:9/", toString: () => `https://${OTHER}/x` };
    await expect(fetch(sneaky)).rejects.toThrow(/Network guard/);
    // and the other way round
    const sneaky2 = { url: `https://${OTHER}/x`, toString: () => "http://127.0.0.1:9/" };
    await expect(fetch(sneaky2)).rejects.toThrow(/Network guard/);
  });

  it("guards fetch that is defined after setup, and leaves a stub alone", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    expect(typeof descriptor.get).toBe("function");
    expect(typeof descriptor.set).toBe("function");
    const saved = globalThis.fetch;
    try {
      let seen;
      globalThis.fetch = async (url) => {
        seen = String(url);
        return "stub";
      };
      await expect(fetch("https://api.example.test/v2")).resolves.toBe("stub");
      expect(seen).toBe("https://api.example.test/v2");
      globalThis.fetch = undefined;
      expect(globalThis.fetch).toBeUndefined();
    } finally {
      globalThis.fetch = saved;
    }
    await expect(fetch(`https://${OTHER}/`)).rejects.toThrow(/Network guard/);
  });

  it("refuses http and https requests to another host in every form", () => {
    expect(() => http.request(`http://${OTHER}/`)).toThrow(/Network guard/);
    expect(() => http.get(new URL(`http://${OTHER}/`))).toThrow(/Network guard/);
    expect(() => http.request({ hostname: OTHER })).toThrow(/Network guard/);
    expect(() => http.request({ host: OTHER })).toThrow(/Network guard/);
    expect(() => https.request({ hostname: OTHER })).toThrow(/Network guard/);
    // an options hostname overrides the URL's host
    expect(() => http.request("http://127.0.0.1:9/", { hostname: OTHER })).toThrow(/Network guard/);
    expect(() => http.request(new URL("http://127.0.0.1:9/"), { host: OTHER })).toThrow(/Network guard/);
    expect(() => new http.ClientRequest({ hostname: OTHER })).toThrow(/Network guard/);
    expect(() => new http.ClientRequest(`http://${OTHER}/`)).toThrow(/Network guard/);
  });

  it("refuses raw sockets to another host", () => {
    expect(() => net.connect({ host: OTHER, port: 80 })).toThrow(/Network guard/);
    expect(() => net.connect(80, OTHER)).toThrow(/Network guard/);
    expect(() => net.createConnection({ host: OTHER, port: 80 })).toThrow(/Network guard/);
    expect(() => tls.connect({ host: OTHER, port: 443 })).toThrow(/Network guard/);
    expect(() => new net.Socket().connect({ host: OTHER, port: 80 })).toThrow(/Network guard/);
    expect(() => new net.Socket().connect(80, OTHER)).toThrow(/Network guard/);
  });

  it("still lets a loopback request through, by fetch, http and a socket", async () => {
    const server = http.createServer((req, res) => res.end("ok"));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const viaFetch = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.text());
      expect(viaFetch).toBe("ok");
      const viaHttp = await new Promise((resolve, reject) => {
        http
          .get({ hostname: "127.0.0.1", port }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          })
          .on("error", reject);
      });
      expect(viaHttp).toBe("ok");
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port }, () => {
          socket.destroy();
          resolve();
        });
        socket.on("error", reject);
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
