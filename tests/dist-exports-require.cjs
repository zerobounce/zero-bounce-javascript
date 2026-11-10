/**
 * Loads the built package by name with require(), so it resolves through
 * package.json "exports" (the "require" condition) to dist/, and uses every
 * named export. Run after `npm run build`; tests/dist-exports.test.js does both.
 */
"use strict";

const { check } = require("./dist-exports-check.cjs");
const required = require("@zerobounce/zero-bounce-sdk");
const { ZeroBounceSDK, ZeroBounceWarmup, ZBApiError } = required;

check(
  // `.default` is what CommonJS code compiled without esModuleInterop reads.
  { default: required.default, ZeroBounceSDK, ZeroBounceWarmup, ZBApiError },
  "require()"
)
  .then(() => {
    if (required !== ZeroBounceSDK) throw new Error("require() should return ZeroBounceSDK itself");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
