/**
 * Smoke test: load the built UMD bundle and verify the SDK API exists.
 * Run after: npm run build
 * Run: node tests/smoke-dist.js
 */
const path = require("path");

// Load built bundle (UMD attaches to exports in Node)
const distPath = path.join(__dirname, "..", "dist", "zeroBounceSDK.js");
const ZeroBounceSDK = require(distPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(typeof ZeroBounceSDK === "function", "ZeroBounceSDK should be a constructor");
assert(ZeroBounceSDK.ApiURL?.DEFAULT_API_URL, "ApiURL.DEFAULT_API_URL should exist");
assert(ZeroBounceSDK.ApiURL?.USA_API_URL, "ApiURL.USA_API_URL should exist");
assert(ZeroBounceSDK.ApiURL?.EU_API_URL, "ApiURL.EU_API_URL should exist");
assert(ZeroBounceSDK.ZBValidateStatus?.VALID === "valid", "ZBValidateStatus.VALID should be 'valid'");
assert(ZeroBounceSDK.ZBValidateSubStatus?.GREYLISTED === "greylisted", "ZBValidateSubStatus.GREYLISTED should exist");

const zb = new ZeroBounceSDK();
assert(typeof zb.init === "function", "init should be a function");
assert(typeof zb.getCredits === "function", "getCredits should be a function");
assert(typeof zb.validateEmail === "function", "validateEmail should be a function");
assert(typeof zb.validateBatch === "function", "validateBatch should be a function");
assert(typeof zb.getApiUsage === "function", "getApiUsage should be a function");
assert(typeof zb.getEmailActivity === "function", "getEmailActivity should be a function");
assert(typeof zb.findEmailByDomain === "function", "findEmailByDomain should be a function");
assert(typeof zb.findEmailFormatByDomain === "function", "findEmailFormatByDomain should be a function");

console.log("Smoke test passed: dist/zeroBounceSDK.js exports correct API.");
process.exit(0);
