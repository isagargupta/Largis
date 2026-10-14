import type { ExpoConfig } from "expo/config";

const projectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "Largis",
  slug: "largis",
  scheme: "largis",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
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
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://app.largis.co",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://hnowkywozcoebafhlwgn.supabase.co",
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "sb_publishable_vuo4PyF1dtdaFLgJGCJ6ig_BUE-4QF9",
    ...(projectId ? { eas: { projectId } } : {}),
  },
};

export default config;
