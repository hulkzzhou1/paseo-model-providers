import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type TextInputProps } from "react-native";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";

type Theme = PluginScreenProps["theme"];
export const sizes = { title: 28, heading: 18, section: 16, body: 14, caption: 12, radius: 10, controlRadius: 8, gap: 16 };
export function Action({ theme, label, onPress, disabled, primary, quiet, icon }: {
  theme: Theme; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; quiet?: boolean; icon?: string;
}) {
  const [focused, setFocused] = useState(false);
  const foreground = primary ? theme.colors.accentForeground : theme.colors.foreground;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: quiet ? 10 : 14, paddingVertical: 10, borderRadius: sizes.controlRadius,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderWidth: 1, borderColor: focused || primary ? theme.colors.accent : quiet ? "transparent" : theme.colors.border,
      backgroundColor: primary ? theme.colors.accent : pressed ? theme.colors.surface2 : quiet ? "transparent" : theme.colors.surface0,
      opacity: disabled ? 0.45 : pressed ? 0.8 : 1 })}>
    {icon ? <Icon name={icon} size={16} color={foreground} /> : null}
    <Text style={{ color: foreground, fontSize: sizes.body, fontWeight: primary ? "600" : "400" }}>{label}</Text>
  </Pressable>;
}
export function Tag({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: theme.colors.surface2 }}>
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption }}>{children}</Text>
  </View>;
}
export function Field({ theme, label, hint, hideLabel, ...input }: TextInputProps & { theme: Theme; label: string; hint?: string; hideLabel?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
    {!hideLabel ? <Text style={{ color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500" }}>{label}</Text> : null}
    <TextInput {...input} accessibilityLabel={input.accessibilityLabel ?? label} placeholderTextColor={theme.colors.foregroundMuted}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, padding: 12,
        minHeight: input.multiline ? 88 : 44, borderWidth: 1, borderColor: focused ? theme.colors.accent : theme.colors.border,
        borderRadius: sizes.controlRadius, fontSize: sizes.body, textAlignVertical: input.multiline ? "top" : "center" }} />
    {hint ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{hint}</Text> : null}
  </View>;
}
export function FormSection({ theme, step, title, description, children }: { theme: Theme; step: string; title: string; description?: string; children: ReactNode }) {
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 32, height: 32, borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.controlRadius, backgroundColor: theme.colors.surface1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.colors.accent, fontSize: sizes.caption, fontWeight: "600" }}>{step}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityRole="header" style={{ color: theme.colors.foreground, fontSize: sizes.section, fontWeight: "600", lineHeight: 22 }}>{title}</Text>
        {description ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{description}</Text> : null}
      </View>
    </View>
    {children}
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
