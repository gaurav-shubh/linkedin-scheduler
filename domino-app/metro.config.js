const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite web support needs .wasm treated as an asset
config.resolver.assetExts.push('wasm');

module.exports = config;
