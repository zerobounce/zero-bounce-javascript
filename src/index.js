import { ZeroBounceSDK } from "./zero-bounce.js";
import { ZeroBounceWarmup } from "./warmup.js";

// The Warmup API is a separate product with its own key and host, so it is a
// separate client rather than methods on ZeroBounceSDK.
//
// The webpack bundle ships only the default export (libraryExport: "default"),
// so Warmup is also hung off it to stay reachable from the UMD build.
ZeroBounceSDK.Warmup = ZeroBounceWarmup;

export { ZeroBounceSDK, ZeroBounceWarmup };
export default ZeroBounceSDK;
