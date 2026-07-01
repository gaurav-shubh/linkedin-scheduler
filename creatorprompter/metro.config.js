const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// whisper.rn's ggml model files aren't bundled by default (they're
// downloaded to app storage at runtime — see whisperModelManager.ts), but
// these extensions are registered in case a model is ever added as a
// static asset instead.
config.resolver.assetExts.push("bin", "mil");

module.exports = config;
