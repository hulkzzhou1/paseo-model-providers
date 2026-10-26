import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PublicSupplier } from "../shared/contracts";
import { mono, sizes, workbenchStyles, type Theme } from "./ui";
import { SupplierStatus, protocolLabels } from "./supplier-detail";

export function SupplierRow({ theme, supplier, selected, t, onPress }: {
  theme: Theme; supplier: PublicSupplier; selected: boolean; t(message: string): string; onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  const styles = workbenchStyles(theme), c = theme.colors;
  return <Pressable accessibilityRole="button" accessibilityLabel={supplier.name} accessibilityState={{ selected }} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ padding: 12, gap: 6, borderWidth: 1, borderColor: focused ? c.accent : "transparent", borderLeftWidth: 3, borderLeftColor: focused || selected ? c.accent : "transparent",
      borderBottomColor: c.border, backgroundColor: selected || pressed ? c.surface1 : c.surface0 })}>
    <View style={styles.toolbar}>
      <Text numberOfLines={1} style={{ ...styles.text, fontWeight: "600", flex: 1 }}>{supplier.name}</Text>
      <SupplierStatus theme={theme} enabled={supplier.enabled} t={t} />
    </View>
    <Text numberOfLines={1} style={{ ...styles.muted, fontFamily: mono }}>{supplier.baseUrl}</Text>
    <View style={styles.toolbar}>
      <Text style={{ ...styles.muted, flex: 1 }}>{protocolLabels[supplier.protocol]}</Text>
      <Text style={{ ...styles.muted, fontSize: sizes.caption }}>{t("模型 ·")} {supplier.models.length}</Text>
    </View>
    <Text numberOfLines={1} style={styles.muted}>{supplier.agents.join(" · ")}</Text>
  </Pressable>;
}
