import type { ExpoConfig } from "expo/config";

const projectId = process.env.EAS_PROJECT_ID ?? "d2522ff9-32a4-4f0d-9fe7-138814983555";

const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryUpload: NonNullable<ExpoConfig["plugins"]> =
  process.env.SENTRY_AUTH_TOKEN && sentryOrg && sentryProject
    ? [["@sentry/react-native/expo", { url: "https://sentry.io/", organization: sentryOrg, project: sentryProject }]]
    : [];

const config: ExpoConfig = {
  name: "Largis",
  slug: "largis",
  owner: "sgupta43",
  scheme: "largis",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "co.largis.app",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "co.largis.app",
    adaptiveIcon: {
      backgroundColor: "#0a1628",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    "expo-sharing",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 120, resizeMode: "contain", backgroundColor: "#0b0b0d" },
    ],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#2f438e" }],
    ["expo-local-authentication", { faceIDPermission: "Allow Largis to use Face ID to unlock the app." }],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Largis to access your photos so you can attach them to messages and tickets.",
        cameraPermission: "Allow Largis to use the camera so you can attach photos to messages and tickets.",
        microphonePermission: false,
      },
    ],
    "expo-document-picker",
    "expo-system-ui",
    ...sentryUpload,
  ],
  experiments: { typedRoutes: true },
  runtimeVersion: { policy: "appVersion" },
  updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 },
  extra: {
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://app.largis.co",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://hnowkywozcoebafhlwgn.supabase.co",
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "sb_publishable_vuo4PyF1dtdaFLgJGCJ6ig_BUE-4QF9",
    eas: { projectId },
  },
};

export default config;
