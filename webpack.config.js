const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "zeroBounceSDK.js",
    globalObject: "this",
    library: "ZeroBounceSDK",
    libraryTarget: "umd",
    libraryExport: "default",
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
      },
    ],
  },
};
