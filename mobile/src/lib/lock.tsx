import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { Logo } from "@/components/Logo";
import { Button, LinkText, type IconName } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { LOCK_KEY } from "@/lib/lock-store";
import { palettes } from "@/lib/theme";

/** Coming back within this long after leaving the app doesn't ask again. */
const GRACE_MS = 60 * 1000;

export type Biometry = { available: boolean; label: string; icon: IconName };

const unavailable: Biometry = { available: false, label: "Face ID or fingerprint", icon: "finger-print" };

async function detectBiometry(): Promise<Biometry> {
  try {
    const [level, types] = await Promise.all([
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (level === LocalAuthentication.SecurityLevel.NONE) return unavailable;
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const biometric = level !== LocalAuthentication.SecurityLevel.SECRET;
    if (!biometric) return { available: true, label: "device passcode", icon: "keypad-outline" };
    if (Platform.OS === "ios") return face ? { available: true, label: "Face ID", icon: "scan-outline" } : { available: true, label: "Touch ID", icon: "finger-print" };
    return face && !finger ? { available: true, label: "face unlock", icon: "scan-outline" } : { available: true, label: "fingerprint", icon: "finger-print" };
  } catch {
    return unavailable;
  }
}

async function authenticate(reason: string) {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Cancel" });
    return result.success;
  } catch {
    return false;
  }
}

type Cover = "none" | "privacy" | "locked";

type LockValue = {
  enabled: boolean;
  biometry: Biometry;
  setEnabled: (value: boolean) => Promise<boolean>;
};

const LockContext = createContext<LockValue | null>(null);

/** Optional app lock: asks for Face ID, fingerprint, or the device passcode on launch and after time away. */
export function LockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [biometry, setBiometry] = useState<Biometry>(unavailable);
  const [cover, setCover] = useState<Cover>("none");
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(LOCK_KEY).catch(() => null), detectBiometry()]).then(([saved, found]) => {
      const on = saved === "on" && found.available;
      setBiometry(found);
      setEnabledState(on);
      setCover(on ? "locked" : "none");
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (!enabled) return;
      if (state === "background") {
        leftAt.current = Date.now();
        setCover((c) => (c === "locked" ? c : "privacy"));
      } else if (state === "active") {
        const away = leftAt.current === null ? 0 : Date.now() - leftAt.current;
        leftAt.current = null;
        setCover((c) => (c === "locked" || away >= GRACE_MS ? "locked" : "none"));
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      if (value && !biometry.available) return false;
      const ok = await authenticate(value ? "Turn on app lock" : "Turn off app lock");
      if (!ok) return false;
      if (value) await SecureStore.setItemAsync(LOCK_KEY, "on");
      else await SecureStore.deleteItemAsync(LOCK_KEY);
      setEnabledState(value);
      return true;
    },
    [biometry.available],
  );

  const value = useMemo<LockValue>(() => ({ enabled: Boolean(enabled), biometry, setEnabled }), [enabled, biometry, setEnabled]);

  return (
    <LockContext.Provider value={value}>
      {enabled !== null && children}
      {(enabled === null || cover !== "none") && (
        <LockScreen locked={cover === "locked"} biometry={biometry} onUnlock={() => setCover("none")} />
      )}
    </LockContext.Provider>
  );
}

export function useAppLock() {
  const value = useContext(LockContext);
  if (!value) throw new Error("useAppLock must be used inside LockProvider");
  return value;
}

function LockScreen({ locked, biometry, onUnlock }: { locked: boolean; biometry: Biometry; onUnlock: () => void }) {
  const { signOut } = useAuth();
  const [failed, setFailed] = useState(false);
  const prompted = useRef(false);

  const unlock = useCallback(() => {
    authenticate("Unlock Largis").then((ok) => {
      if (ok) onUnlock();
      else setFailed(true);
    });
  }, [onUnlock]);

  useEffect(() => {
    if (!locked || prompted.current || AppState.currentState !== "active") return;
    prompted.current = true;
    unlock();
  }, [locked, unlock]);

  return (
    <View style={s.cover} accessibilityViewIsModal>
      <Logo size={48} />
      {locked && (
        <View style={s.panel}>
          <Text style={s.title}>Largis is locked</Text>
          <Text style={s.text}>
            {failed ? `Unlock with ${biometry.label} to continue.` : `Use ${biometry.label} to open your client portal.`}
          </Text>
          <Button title={`Unlock with ${biometry.label}`} icon={biometry.icon} onPress={unlock} style={{ alignSelf: "stretch" }} />
          <LinkText title="Sign out" color="#c9cfe6" onPress={() => signOut()} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palettes.dark.night,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 28,
    zIndex: 100,
  },
  panel: { alignItems: "center", gap: 14, alignSelf: "stretch" },
  title: { color: "#ffffff", fontSize: 20, fontWeight: "600" },
  text: { color: "#a3a8b8", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
