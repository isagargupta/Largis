import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

const TOKEN_KEY = "largis-push-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Asks for permission and links this device to the signed-in user. Quietly does nothing where push
 * isn't available: simulators, Expo Go on Android, or builds without an EAS project id.
 */
export async function registerPush() {
  if (!Device.isDevice || !config.projectId) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Messages and updates",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: config.projectId })).data;
    const { error } = await supabase.rpc("register_device_token", {
      p_token: token,
      p_platform: Platform.OS === "ios" ? "ios" : "android",
    });
    if (!error) await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    console.warn("[push] Registration skipped", err);
  }
}

/** Run before signing out, while the session can still remove the device. */
export async function unregisterPush() {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc("unregister_device_token", { p_token: token });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn("[push] Unregister failed", err);
  }
}

export type PushTarget = { path: string; organizationId: string | null };

/** Maps the `data` the server sends with each notification to a screen in the app. */
export function pushTarget(data: Record<string, unknown> | undefined | null): PushTarget | null {
  if (!data) return null;
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : null;
  const id = typeof data.id === "string" ? data.id : null;
  switch (data.screen) {
    case "messages":
      return { path: "/messages", organizationId };
    case "ticket":
      return id ? { path: `/ticket/${id}`, organizationId } : { path: "/support", organizationId };
    case "report":
      return id ? { path: `/reports/${id}`, organizationId } : { path: "/reports", organizationId };
    case "billing":
      return { path: "/billing", organizationId };
    default:
      return null;
  }
}
