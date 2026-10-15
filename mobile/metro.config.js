// Adds debug IDs to bundles so Sentry can match crash reports to source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
