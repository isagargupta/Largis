import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { Tone } from "@/lib/meta";
import { CONTENT_MAX_WIDTH, makeStyles, useTheme } from "@/lib/theme";

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
  const ui = useUi();
  const { colors } = useTheme();
  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={[ui.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  const ui = useUi();
  const { colors } = useTheme();
  return (
    <View style={ui.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const ui = useUi();
  const { colors } = useTheme();
  return (
    <View style={ui.center}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.inkSubtle} />
      <Text style={[ui.body, ui.textCenter, { marginTop: 12 }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 16 }} />}
    </View>
  );
}

export function Heading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: ReactNode }) {
  const ui = useUi();
  return (
    <View style={{ marginBottom: 4 }}>
      {eyebrow && <Text style={ui.eyebrow}>{eyebrow}</Text>}
      <Text style={ui.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? typeof subtitle === "string" ? <Text style={[ui.muted, { marginTop: 4 }]}>{subtitle}</Text> : subtitle : null}
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
  const ui = useUi();
  return (
    <View style={[ui.card, style]}>
      {(title || action) && (
        <View style={ui.cardHeader}>
          {title ? (
            <Text style={ui.cardTitle} accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      <View style={padded ? ui.cardBody : undefined}>{children}</View>
    </View>
  );
}

export function LinkText({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const ui = useUi();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      <Text style={[ui.link, color ? { color } : null]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ tone, label }: { tone: Tone; label: string }) {
  const ui = useUi();
  const t = useTheme().tones[tone];
  return (
    <View style={[ui.badge, { backgroundColor: t.bg }]}>
      <Text style={[ui.badgeText, { color: t.fg }]} numberOfLines={1}>
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
  const ui = useUi();
  const { colors } = useTheme();
  const fg = variant === "primary" || variant === "danger" ? colors.onBrand : variant === "ghost" ? colors.accent : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        ui.button,
        ui[`button_${variant}`],
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
          <Text style={[ui.buttonText, { color: fg }]}>{title}</Text>
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
  const ui = useUi();
  const { colors, scheme } = useTheme();
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        keyboardAppearance={scheme}
        style={[ui.input, input.multiline && ui.inputMultiline, error ? { borderColor: colors.danger } : null]}
        accessibilityLabel={label}
        {...input}
      />
      {error ? <Text style={ui.error}>{error}</Text> : hint ? <Text style={ui.small}>{hint}</Text> : null}
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
  const ui = useUi();
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={ui.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[ui.chip, selected && ui.chipSelected]}
            >
              {o.color && <View style={[ui.dot, { backgroundColor: o.color }]} />}
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  const ui = useUi();
  return <View style={ui.statGrid}>{children}</View>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  const ui = useUi();
  const { colors } = useTheme();
  return (
    <View style={ui.stat}>
      <Text style={ui.small}>{label}</Text>
      <Text style={[ui.statValue, tone === "danger" && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint && <Text style={ui.small}>{hint}</Text>}
    </View>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  const ui = useUi();
  const { colors } = useTheme();
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}>
        <Ionicons name={icon} size={20} color={colors.inkMuted} />
      </View>
      <Text style={[ui.cardTitle, ui.textCenter]}>{title}</Text>
      {children ? <Text style={[ui.muted, ui.textCenter]}>{children}</Text> : null}
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
  const ui = useUi();
  const { colors } = useTheme();
  const content = (
    <>
      {icon && <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.inkMuted} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ui.rowTitle, danger && { color: colors.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[ui.small, { marginTop: 2 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [ui.row, pressed && ui.pressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={ui.row}>{content}</View>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      icon={icon}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: colors.brand, false: colors.line }}
          accessibilityLabel={title}
        />
      }
    />
  );
}

export function Divider() {
  const ui = useUi();
  return <View style={ui.divider} />;
}

export function Notice({ tone = "warning", children }: { tone?: Tone; children: ReactNode }) {
  const ui = useUi();
  const t = useTheme().tones[tone];
  return (
    <View style={[ui.notice, { backgroundColor: t.bg, borderLeftColor: t.fg }]}>
      <Text style={[ui.body, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  const ui = useUi();
  return (
    <View style={ui.progress}>
      <View style={[ui.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export const useUi = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.paper },
  screenContent: { padding: 16, gap: 16, paddingBottom: 40, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.paper },
  textCenter: { textAlign: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: c.gold, fontWeight: "600", marginBottom: 6 },
  title: { fontSize: 24, fontWeight: "600", color: c.ink, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22, color: c.ink },
  muted: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  small: { fontSize: 12, lineHeight: 17, color: c.inkSubtle },
  label: { fontSize: 13, fontWeight: "500", color: c.ink },
  error: { fontSize: 12, color: c.danger },
  link: { fontSize: 14, fontWeight: "500", color: c.accent },
  mono: { fontFamily: "Menlo", fontSize: 12, color: c.inkSubtle },
  pressed: { backgroundColor: c.paperSoft },
  card: { backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderRadius: 4 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: c.ink },
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
  button_primary: { backgroundColor: c.brand },
  button_secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  button_danger: { backgroundColor: c.danger },
  button_ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 4,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: c.ink,
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
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  chipSelected: { backgroundColor: c.ink, borderColor: c.ink },
  chipText: { fontSize: 13, color: c.ink, fontWeight: "500" },
  chipTextSelected: { color: c.paper },
  dot: { width: 8, height: 8, borderRadius: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.line,
    borderRadius: 4,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "600", color: c.ink, letterSpacing: -0.4 },
  empty: { alignItems: "center", padding: 28, gap: 8 },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.paperSoft, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 52 },
  rowTitle: { fontSize: 15, color: c.ink, fontWeight: "500" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: 16 },
  notice: { borderLeftWidth: 3, padding: 12, borderRadius: 2 },
  progress: { height: 6, backgroundColor: c.paperSoft, borderRadius: 3, overflow: "hidden", flex: 1 },
  progressFill: { height: "100%", backgroundColor: c.success },
}));
