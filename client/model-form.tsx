import { useState } from "react";
import { Text, View } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Action, Disclosure, Field, mono, sizes } from "./ui";
import { maxModelRows, newModelRow, type ModelRow } from "./model-form-state";
import { formatTokenCount } from "./token-limits";

export function ModelForm({ t, theme, compact, rows, onChange, message, busy, onLoad, defaults }: {
  t: (message: string) => string;
  theme: PluginScreenProps["theme"]; compact: boolean;
  rows: ModelRow[]; onChange: (rows: ModelRow[]) => void;
  message: string; busy: boolean; onLoad: () => void;
  defaults: { contextWindow: number; maxTokens: number };
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const muted = { color: theme.colors.foregroundMuted, fontSize: sizes.caption, lineHeight: 18 };
  function update(key: number, field: "id" | "apiId" | "contextWindow" | "maxTokens", value: string) {
    onChange(rows.map(row => row.key === key ? { ...row, [field]: value } : row));
  }
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 4 }}>
      <Action theme={theme} label={t("添加模型")} onPress={() => onChange([...rows, newModelRow(rows)])} disabled={busy || rows.length >= maxModelRows} icon="Plus" quiet />
      <Action theme={theme} label={busy ? t("正在加载…") : t("加载模型")} onPress={onLoad} disabled={busy} icon="Download" />
    </View>
    <Text style={muted}>{t("容量用于 Pi/OMP，支持 K/M；留空沿用原有默认值。")}</Text>
    {message ? <Text accessibilityRole="alert" style={muted}>{message}</Text> : null}
    <View style={{ gap: 8 }}>
      {rows.map((row, index) => <View key={row.key} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.controlRadius, overflow: "hidden" }}>
        <View style={{ paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.surface1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ ...muted, fontFamily: mono }}>{String(index + 1).padStart(2, "0")}</Text>
          <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: sizes.body, fontWeight: "500", flex: 1 }}>{row.id || t("模型")}</Text>
          <Action theme={theme} label={`${t("移除模型")} ${index + 1}`} onPress={() => onChange(rows.filter(item => item.key !== row.key))} disabled={busy} icon="Trash2" quiet iconOnly />
        </View>
        <View style={{ padding: 8, flexDirection: compact ? "column" : "row", gap: 8 }}>
          <View style={{ flex: compact ? undefined : 2, minWidth: 0 }}><Field theme={theme} label={t("模型 ID")} accessibilityLabel={`${t("模型 ID")} ${index + 1}`} placeholder="deepseek-flash" value={row.id} onChangeText={value => update(row.key, "id", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
          <View style={{ flex: compact ? undefined : 2, minWidth: 0 }}><Field theme={theme} label={t("实际请求 ID")} accessibilityLabel={`${t("实际请求 ID")} ${index + 1}`} placeholder={row.id || "gateway/model-id"} value={row.apiId} onChangeText={value => update(row.key, "apiId", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
          <View style={{ flex: compact ? undefined : 2, minWidth: 0, flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Field theme={theme} label={t("上下文窗口")} accessibilityLabel={`${t("上下文窗口")} ${index + 1}`} placeholder={formatTokenCount(defaults.contextWindow)} value={row.contextWindow ?? ""} onChangeText={value => update(row.key, "contextWindow", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Field theme={theme} label={t("最大输出")} accessibilityLabel={`${t("最大输出")} ${index + 1}`} placeholder={formatTokenCount(defaults.maxTokens)} value={row.maxTokens ?? ""} onChangeText={value => update(row.key, "maxTokens", value)} editable={!busy} autoCapitalize="none" autoCorrect={false} /></View>
          </View>
        </View>
      </View>)}
    </View>
    {!rows.length ? <Text style={muted}>{t("点击「添加模型」创建表单行，或点击「加载模型」自动填入。")}</Text> : null}
    <Disclosure theme={theme} label={t("模型填写说明")} expanded={instructionsOpen} onPress={() => setInstructionsOpen(!instructionsOpen)} />
    {instructionsOpen ? <View style={{ gap: 8 }}>
      <Text style={muted}>{t("每行一个模型；可手动填写，或点击「加载模型」自动填入。实际请求 ID 留空时使用模型 ID。")}</Text>
      <Text style={muted}>{t("每个模型单独配置容量，支持 K/M 简写；留空使用原有默认值，加载目录会补齐未填写的容量。容量用于 Pi/OMP。")}</Text>
    </View> : null}
  </View>;
}
