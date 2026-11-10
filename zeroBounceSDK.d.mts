// Types for the ES module entry (zeroBounceSDK.mjs).
//
// zeroBounceSDK.d.ts describes the CommonJS bundle. Under "module": "node16" /
// "nodenext", an ES module that imports a CommonJS declaration file gets the
// whole module object as its default import, so `new ZeroBounceSDK()` would
// not type-check. Re-exporting the class as a real ESM default fixes that.
export * from "./zeroBounceSDK.js";
import { ZeroBounceSDK } from "./zeroBounceSDK.js";
export default ZeroBounceSDK;
