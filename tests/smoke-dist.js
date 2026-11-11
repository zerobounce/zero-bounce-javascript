/**
 * Smoke test: load the built UMD bundle and verify the SDK API exists.
 * Run after: npm run build
 * Run: node tests/smoke-dist.js
 * Live part: only with ZEROBOUNCE_API_KEY set to a real key; skipped otherwise.
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
assert(ZeroBounceSDK.ZBDownloadType?.COMBINED === "combined", "ZBDownloadType.COMBINED should be 'combined'");

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

// Live check: one real getCredits request, which proves fetch works in this
// Node and the bundle reaches the API. It needs a real key: Cloudflare answers
// a placeholder key with "403 error code: 1020" before the API sees it, so a
// dummy key can no longer show anything. Without ZEROBOUNCE_API_KEY the live
// check is skipped and only the export checks above have run.
const apiKey = process.env.ZEROBOUNCE_API_KEY;
if (!apiKey || !apiKey.trim()) {
  console.log(
    "\nSkipping the live getCredits() check: set ZEROBOUNCE_API_KEY to a real key to run it."
  );
  process.exit(0);
}

console.log("\nTesting getCredits() in Node against the live API...");
zb.init(apiKey.trim());
zb
  .getCredits()
  .then((r) => {
    const credits = Number(r && r.Credits);
    // -1 is what a dead or invalid key gets back.
    if (!Number.isFinite(credits) || credits < 0) {
      console.error("getCredits() answered, but not with a usable credit balance. Is the key valid?");
      process.exit(1);
    }
    console.log("getCredits() succeeded: fetch works and the key is valid.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("getCredits() failed:", e?.message || String(e));
    process.exit(1);
  });
