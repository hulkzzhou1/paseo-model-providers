import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type TextInputProps } from "react-native";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";

type Theme = PluginScreenProps["theme"];
export const sizes = { title: 28, heading: 18, body: 14, caption: 12, radius: 10, gap: 16 };
export function Action({ theme, label, onPress, disabled, primary, icon }: {
  theme: Theme; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; icon?: string;
}) {
  const [focused, setFocused] = useState(false);
  const foreground = primary ? theme.colors.accentForeground : theme.colors.foreground;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderWidth: 1, borderColor: focused ? theme.colors.accent : primary ? theme.colors.accent : theme.colors.border,
      backgroundColor: primary ? theme.colors.accent : pressed ? theme.colors.surface2 : theme.colors.surface1,
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
export function Field({ theme, label, hint, ...input }: TextInputProps & { theme: Theme; label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
    <Text style={{ color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500" }}>{label}</Text>
    <TextInput {...input} accessibilityLabel={label} placeholderTextColor={theme.colors.foregroundMuted}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, padding: 12,
        minHeight: input.multiline ? 88 : 44, borderWidth: 1, borderColor: focused ? theme.colors.accent : theme.colors.border,
        borderRadius: 8, fontSize: sizes.body, textAlignVertical: input.multiline ? "top" : "center" }} />
    {hint ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{hint}</Text> : null}
  </View>;
}
export function FormSection({ theme, step, title, description, children }: { theme: Theme; step: string; title: string; description?: string; children: ReactNode }) {
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <Text style={{ color: theme.colors.accent, fontSize: sizes.caption, fontWeight: "600" }}>{step}</Text>
      <Text accessibilityRole="header" style={{ color: theme.colors.foreground, fontSize: sizes.heading, fontWeight: "600" }}>{title}</Text>
      <View style={{ height: 1, flex: 1, backgroundColor: theme.colors.border }} />
    </View>
    {description ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 }}>{description}</Text> : null}
    {children}
  </View>;
}
