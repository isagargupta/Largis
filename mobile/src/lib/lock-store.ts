import * as SecureStore from "expo-secure-store";

export const LOCK_KEY = "largis-app-lock";

/** The lock belongs to the signed-in person, so it is cleared on sign-out. */
export function clearAppLock() {
  return SecureStore.deleteItemAsync(LOCK_KEY).catch(() => {});
}
