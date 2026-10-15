import { Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { status } = useAuth();
  const { colors, navigation, scheme, ready } = useTheme();
  const loading = status === "loading" || !ready;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <NavigationThemeProvider value={navigation}>
      <StatusBar style={status === "signedIn" && scheme === "light" ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status !== "signedIn"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
