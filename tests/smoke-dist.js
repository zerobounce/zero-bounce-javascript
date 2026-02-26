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
assert(typeof zb.sendFile === "function", "sendFile should be a function");
assert(typeof zb.sendFileStream === "function", "sendFileStream should be a function");
assert(typeof zb.sendScoringFile === "function", "sendScoringFile should be a function");
assert(typeof zb.sendScoringFileStream === "function", "sendScoringFileStream should be a function");
assert(typeof zb.getFileStatus === "function", "getFileStatus should be a function");
assert(typeof zb.getScoringFileStatus === "function", "getScoringFileStatus should be a function");
assert(typeof zb.getFile === "function", "getFile should be a function");
assert(typeof zb.getScoringFile === "function", "getScoringFile should be a function");
assert(typeof zb.deleteFile === "function", "deleteFile should be a function");
assert(typeof zb.deleteScoringFile === "function", "deleteScoringFile should be a function");
assert(typeof zb.findEmailByCompanyName === "function", "findEmailByCompanyName should be a function");
assert(typeof zb.findEmailFormatByCompanyName === "function", "findEmailFormatByCompanyName should be a function");
assert(typeof zb.guessFormat === "function", "guessFormat should be a function");

console.log("Smoke test passed: dist/zeroBounceSDK.js exports correct API.");

// Test that fetch is available in Node (issue #6: TypeError: fetch failed)
console.log("\nTesting getCredits() in Node (triggers fetch)...");
zb.init("test-api-key");
zb
  .getCredits()
  .then((r) => {
    console.log("getCredits() succeeded (fetch works). Response type:", typeof r);
    process.exit(0);
  })
  .catch((e) => {
    const msg = e?.message || String(e);
    // API returned 403 / invalid key = fetch worked, only API rejected
    if (msg.includes("api_key is invalid")) {
      console.log("getCredits() reached API (fetch works). API correctly rejected invalid key.");
      process.exit(0);
    }
    console.error("getCredits() failed (fetch may be missing in Node):", msg);
    process.exit(1);
  });
