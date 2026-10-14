import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { Tone } from "@/lib/meta";
import { colors, toneColors } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.inkSubtle} />
      <Text style={[styles.body, styles.textCenter, { marginTop: 12 }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 16 }} />}
    </View>
  );
}

export function Heading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: ReactNode }) {
  return (
    <View style={{ marginBottom: 4 }}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? typeof subtitle === "string" ? <Text style={[styles.muted, { marginTop: 4 }]}>{subtitle}</Text> : subtitle : null}
    </View>
  );
}

export function Card({
  title,
  action,
  children,
  padded = false,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      <View style={padded ? styles.cardBody : undefined}>{children}</View>
    </View>
  );
}

export function LinkText({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      <Text style={[styles.link, color ? { color } : null]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ tone, label }: { tone: Tone; label: string }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === "primary" || variant === "danger" ? colors.white : variant === "ghost" ? colors.brand : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        style={[styles.input, input.multiline && styles.inputMultiline, error ? { borderColor: colors.danger } : null]}
        accessibilityLabel={label}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.small}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {o.color && <View style={[styles.dot, { backgroundColor: o.color }]} />}
              <Text style={[styles.chipText, selected && { color: colors.white }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.small}>{label}</Text>
      <Text style={[styles.statValue, tone === "danger" && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint && <Text style={styles.small}>{hint}</Text>}
    </View>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={20} color={colors.inkMuted} />
      </View>
      <Text style={[styles.cardTitle, styles.textCenter]}>{title}</Text>
      {children ? <Text style={[styles.muted, styles.textCenter]}>{children}</Text> : null}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  icon,
  danger,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon && <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.inkMuted} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.small, { marginTop: 2 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paperSoft }]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Notice({ tone = "warning", children }: { tone?: Tone; children: ReactNode }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderLeftColor: t.fg }]}>
      <Text style={[styles.body, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progress}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.paper },
  textCenter: { textAlign: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: colors.gold, fontWeight: "600", marginBottom: 6 },
  title: { fontSize: 24, fontWeight: "600", color: colors.ink, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  small: { fontSize: 12, lineHeight: 17, color: colors.inkSubtle },
  label: { fontSize: 13, fontWeight: "500", color: colors.ink },
  error: { fontSize: 12, color: colors.danger },
  link: { fontSize: 14, fontWeight: "500", color: colors.brand },
  mono: { fontFamily: "Menlo", fontSize: 12, color: colors.inkSubtle },
  card: { backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 4 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  cardBody: { padding: 16, gap: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  button_primary: { backgroundColor: colors.brand },
  button_secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  dot: { width: 8, height: 8, borderRadius: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 4,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.4 },
  empty: { alignItems: "center", padding: 28, gap: 8 },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paperSoft, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 52 },
  rowTitle: { fontSize: 15, color: colors.ink, fontWeight: "500" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 16 },
  notice: { borderLeftWidth: 3, padding: 12, borderRadius: 2 },
  progress: { height: 6, backgroundColor: colors.paperSoft, borderRadius: 3, overflow: "hidden", flex: 1 },
  progressFill: { height: "100%", backgroundColor: "#10b981" },
});
