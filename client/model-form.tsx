import { ScrollView, Text, View } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Action, Field, sizes } from "./ui";
import { maxModelRows, newModelRow, type ModelRow } from "./model-form-state";
import { formatTokenCount } from "./token-limits";

export function ModelForm({ t, theme, compact, rows, onChange, message, busy, onLoad, defaults }: {
  t: (message: string) => string;
  theme: PluginScreenProps["theme"]; compact: boolean;
  rows: ModelRow[]; onChange: (rows: ModelRow[]) => void;
  message: string; busy: boolean; onLoad: () => void;
  defaults: { contextWindow: number; maxTokens: number };
}) {
  const muted = { color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 };
  function update(key: number, field: "id" | "apiId" | "contextWindow" | "maxTokens", value: string) {
    onChange(rows.map(row => row.key === key ? { ...row, [field]: value } : row));
  }
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500" }}>{t("模型")} · {rows.filter(row => row.id.trim()).length}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        <Action theme={theme} label={t("添加模型")} onPress={() => onChange([...rows, newModelRow(rows)])} disabled={busy || rows.length >= maxModelRows} icon="Plus" quiet />
        <Action theme={theme} label={busy ? t("正在加载…") : t("加载模型")} onPress={onLoad} disabled={busy} icon="Download" />
      </View>
    </View>
    <Text style={muted}>{t("每行一个模型；可手动填写，或点击「加载模型」自动填入。实际请求 ID 留空时使用模型 ID。")}</Text>
    <Text style={muted}>{t("每个模型单独配置容量，支持 K/M 简写；留空使用原有默认值，加载目录会补齐未填写的容量。容量用于 Pi/OMP。")}</Text>
    {message ? <Text accessibilityRole="alert" style={muted}>{message}</Text> : null}
    <ScrollView style={{ maxHeight: compact ? 440 : 360 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {rows.map((row, index) => <View key={row.key} style={{ padding: 12, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.controlRadius }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={muted}>{t("模型")} {String(index + 1).padStart(2, "0")}</Text>
          <Action theme={theme} label={`${t("移除模型")} ${index + 1}`} onPress={() => onChange(rows.filter(item => item.key !== row.key))} disabled={busy} icon="Trash2" quiet />
        </View>
        <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
          <View style={{ flex: compact ? undefined : 1, minWidth: 0 }}><Field theme={theme} label={t("模型 ID")} accessibilityLabel={`${t("模型 ID")} ${index + 1}`} placeholder="deepseek-flash" value={row.id} onChangeText={value => update(row.key, "id", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
          <View style={{ flex: compact ? undefined : 1, minWidth: 0 }}><Field theme={theme} label={t("实际请求 ID")} accessibilityLabel={`${t("实际请求 ID")} ${index + 1}`} placeholder={row.id || "gateway/model-id"} value={row.apiId} onChangeText={value => update(row.key, "apiId", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
        </View>
        <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
          <View style={{ flex: compact ? undefined : 1, minWidth: 0 }}><Field theme={theme} label={t("上下文窗口")} accessibilityLabel={`${t("上下文窗口")} ${index + 1}`} placeholder={formatTokenCount(defaults.contextWindow)} value={row.contextWindow ?? ""} onChangeText={value => update(row.key, "contextWindow", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
          <View style={{ flex: compact ? undefined : 1, minWidth: 0 }}><Field theme={theme} label={t("最大输出")} accessibilityLabel={`${t("最大输出")} ${index + 1}`} placeholder={formatTokenCount(defaults.maxTokens)} value={row.maxTokens ?? ""} onChangeText={value => update(row.key, "maxTokens", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
        </View>
      </View>)}
    </ScrollView>
    {!rows.length ? <Text style={muted}>{t("点击「添加模型」创建表单行，或点击「加载模型」自动填入。")}</Text> : null}
  </View>;
}
