if (typeof window !== "undefined" && window.URL) {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {};
  }
}

// jsdom has no TextDecoder; browsers and Node (>= 18) do, and the SDK reads
// JSON bodies with it (keeping a byte order mark, so it is rejected).
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = require("util").TextDecoder;
}
