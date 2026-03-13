const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add Node.js polyfills for React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve("react-native-quick-crypto"),
  stream: require.resolve("readable-stream"),
  buffer: require.resolve("buffer"),
  util: require.resolve("util"),
  process: require.resolve("process/browser"),
  zlib: require.resolve("./polyfills/zlib.js"),
  http: require.resolve("./polyfills/http.js"),
  https: require.resolve("./polyfills/http.js"),
  net: require.resolve("./polyfills/net.js"),
};

// Prefer browser builds for packages like jose
config.resolver.mainFields = ["react-native", "browser", "main"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-keep-awake") {
    return {
      filePath: path.join(__dirname, "polyfills/expo-keep-awake.js"),
      type: "sourceFile",
    };
  }

  // Force jose to use browser build
  if (moduleName === "jose") {
    return {
      filePath: path.join(__dirname, "node_modules/jose/dist/browser/index.js"),
      type: "sourceFile",
    };
  }

  // Handle ox module .js extensions
  if (
    moduleName.endsWith(".js") &&
    context.originModulePath.includes("node_modules/ox/")
  ) {
    const newModuleName = moduleName.replace(/\.js$/, "");
    return context.resolveRequest(context, newModuleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
