/**
 * @jest-environment node
 *
 * The built bundle must provide every export zeroBounceSDK.d.ts declares, for
 * both require() and import. Builds dist/ with webpack, then loads the package
 * by name in a separate Node process, outside Jest's module system, so the
 * real package.json "exports" resolution is what is tested. Offline.
 */
const { execFileSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

function runNode(script) {
  return execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("source entry exports", () => {
  it("hangs every named export off the default, which is all the UMD bundle keeps", () => {
    const entry = require("../src/index.js");
    const { ZeroBounceSDK, ZeroBounceWarmup, ZBApiError } = entry;
    expect(entry.default).toBe(ZeroBounceSDK);
    expect(ZeroBounceSDK.ZeroBounceSDK).toBe(ZeroBounceSDK);
    expect(ZeroBounceSDK.default).toBe(ZeroBounceSDK);
    expect(ZeroBounceSDK.ZeroBounceWarmup).toBe(ZeroBounceWarmup);
    expect(ZeroBounceSDK.Warmup).toBe(ZeroBounceWarmup);
    expect(ZeroBounceSDK.ZBApiError).toBe(ZBApiError);
    expect(new ZBApiError("x", 429).statusCode).toBe(429);
  });
});

describe("built dist exports", () => {
  beforeAll(() => {
    execFileSync(process.execPath, [require.resolve("webpack-cli/bin/cli.js"), "--mode=production"], {
      cwd: root,
      stdio: "ignore",
    });
  }, 120000);

  it("provides ZeroBounceSDK, ZeroBounceWarmup, ZBApiError and the default to require()", () => {
    expect(runNode("dist-exports-require.cjs")).toContain("require(): ok");
  });

  it("provides ZeroBounceSDK, ZeroBounceWarmup, ZBApiError and the default to import", () => {
    expect(runNode("dist-exports-import.mjs")).toContain("import: ok");
  });
});
