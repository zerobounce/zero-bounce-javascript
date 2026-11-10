import { ZeroBounceSDK } from "./zero-bounce.js";
import { ZeroBounceWarmup } from "./warmup.js";
import { ZBApiError } from "./utils.js";

// The Warmup API is a separate product with its own key and host, so it is a
// separate client rather than methods on ZeroBounceSDK.
//
// The webpack bundle ships only the default export (libraryExport: "default"),
// so require() returns ZeroBounceSDK itself. The named exports that
// zeroBounceSDK.d.ts declares are hung off it so that require() and the ESM
// entry (zeroBounceSDK.mjs) both provide them. Warmup is the older alias.
ZeroBounceSDK.Warmup = ZeroBounceWarmup;
ZeroBounceSDK.ZeroBounceWarmup = ZeroBounceWarmup;
ZeroBounceSDK.ZBApiError = ZBApiError;
ZeroBounceSDK.ZeroBounceSDK = ZeroBounceSDK;
// For CommonJS consumers compiled without esModuleInterop, which read `.default`.
ZeroBounceSDK.default = ZeroBounceSDK;

export { ZeroBounceSDK, ZeroBounceWarmup, ZBApiError };
export default ZeroBounceSDK;
