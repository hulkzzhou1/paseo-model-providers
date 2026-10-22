import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View, type TextInputProps } from "react-native";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";

type Theme = PluginScreenProps["theme"];
export const sizes = { title: 22, heading: 15, section: 15, body: 13, caption: 12, radius: 8, controlRadius: 6, gap: 16 };
export const mono = Platform.OS === "ios" ? "Menlo" : "monospace";
export function Action({ theme, label, onPress, disabled, primary, quiet, icon, iconOnly, selected }: {
  theme: Theme; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; quiet?: boolean; icon?: string; iconOnly?: boolean; selected?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const foreground = primary ? theme.colors.accentForeground : theme.colors.foreground;
  return <Pressable accessibilityRole={selected === undefined ? "button" : "tab"} accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled), ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 44, minWidth: iconOnly ? 44 : undefined, paddingHorizontal: iconOnly ? 10 : 12, paddingVertical: 8, borderRadius: selected === undefined ? sizes.controlRadius : 0,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1, borderBottomWidth: selected === undefined ? 1 : 2,
      borderColor: focused || primary ? theme.colors.accent : quiet || selected !== undefined ? "transparent" : theme.colors.border,
      borderBottomColor: focused || primary || selected ? theme.colors.accent : quiet || selected !== undefined ? "transparent" : theme.colors.border,
      backgroundColor: primary ? theme.colors.accent : pressed ? theme.colors.surface2 : "transparent",
      opacity: disabled ? 0.45 : 1 })}>
    {icon ? <Icon name={icon} size={15} color={primary ? foreground : theme.colors.foregroundMuted} /> : null}
    {!iconOnly ? <Text style={{ color: selected === false || quiet ? theme.colors.foregroundMuted : foreground, fontSize: sizes.body, fontWeight: primary || selected ? "600" : "400" }}>{label}</Text> : null}
  </Pressable>;
}
export function Tag({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }}>
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption }}>{children}</Text>
  </View>;
}
export function Field({ theme, label, hint, hideLabel, ...input }: TextInputProps & { theme: Theme; label: string; hint?: string; hideLabel?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
    {!hideLabel ? <Text style={{ color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500" }}>{label}</Text> : null}
    <TextInput {...input} accessibilityLabel={input.accessibilityLabel ?? label} placeholderTextColor={theme.colors.foregroundMuted}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, padding: 10,
        minHeight: input.multiline ? 88 : 44, borderWidth: 1, borderColor: focused ? theme.colors.accent : theme.colors.border,
        borderRadius: sizes.controlRadius, fontSize: sizes.body, textAlignVertical: input.multiline ? "top" : "center" }} />
    {hint ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{hint}</Text> : null}
  </View>;
}
export function Panel({ theme, icon, title, description, right, children }: { theme: Theme; icon: string; title: string; description?: string; right?: ReactNode; children: ReactNode }) {
  return <View style={{ borderWidth: 1, borderLeftWidth: 3, borderColor: theme.colors.border, borderLeftColor: theme.colors.accent, borderRadius: sizes.radius, overflow: "hidden", backgroundColor: theme.colors.surface0 }}>
    <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.surface1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <Icon name={icon} size={16} color={theme.colors.accent} />
      <Text accessibilityRole="header" style={{ color: theme.colors.foreground, fontSize: sizes.heading, fontWeight: "600", lineHeight: 22, flex: 1 }}>{title}</Text>
      {right}
    </View>
    <View style={{ padding: 12, gap: 14 }}>
      {description ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{description}</Text> : null}
      {children}
    </View>
  </View>;
}

export function Disclosure({ theme, label, detail, expanded, onPress }: { theme: Theme; label: string; detail?: string; expanded: boolean; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 10, flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderRadius: sizes.controlRadius,
      borderColor: focused ? theme.colors.accent : "transparent", backgroundColor: pressed ? theme.colors.surface2 : "transparent" })}>
    <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={15} color={theme.colors.foregroundMuted} />
    <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500" }}>{label}</Text>
    {detail ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption }}>{detail}</Text> : null}
  </Pressable>;
}
