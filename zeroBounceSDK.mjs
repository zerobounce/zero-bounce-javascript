// ES module entry for `import` (package.json "exports" -> "import").
//
// dist/zeroBounceSDK.js is a UMD bundle, which Node loads as CommonJS. Node
// cannot see named exports on it, so `import { ZeroBounceWarmup } from ...`
// would fail with "does not provide an export named". This file re-exports the
// same bundle with real named exports. It adds no second copy of the SDK:
// import and require share one ZeroBounceSDK, so `instanceof ZBApiError` holds
// across both.
import ZeroBounceSDK from "./dist/zeroBounceSDK.js";

export const { ZeroBounceWarmup, ZBApiError } = ZeroBounceSDK;
export { ZeroBounceSDK };
export default ZeroBounceSDK;
