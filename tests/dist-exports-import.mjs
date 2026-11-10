/**
 * Loads the built package by name with import, so it resolves through
 * package.json "exports" (the "import" condition), and uses every named
 * export. Run after `npm run build`; tests/dist-exports.test.js does both.
 */
import { createRequire } from "node:module";
import ZeroBounceSDKDefault, {
  ZeroBounceSDK,
  ZeroBounceWarmup,
  ZBApiError,
} from "@zerobounce/zero-bounce-sdk";

const require = createRequire(import.meta.url);
const { check } = require("./dist-exports-check.cjs");

try {
  await check(
    { default: ZeroBounceSDKDefault, ZeroBounceSDK, ZeroBounceWarmup, ZBApiError },
    "import"
  );
  // One build behind both entries: an error from one is an instance of the
  // other's ZBApiError.
  const required = require("@zerobounce/zero-bounce-sdk");
  if (required !== ZeroBounceSDK || required.ZBApiError !== ZBApiError) {
    throw new Error("import and require should resolve to the same build");
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
