import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Action, Field } from "./ui";
export function ModelPicker({ t, theme, selectedText, onChange, catalog, message, busy, onLoad }: {
  t: (message: string) => string;
  theme: PluginScreenProps["theme"]; selectedText: string; onChange: (value: string) => void;
  catalog: { id: string; name: string }[]; message: string; busy: boolean; onLoad: () => void;
}) {
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState(false);
  const selected = [...new Set(selectedText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean))];
  const options = [...new Map([...selected.map(id => ({ id, name: id })), ...catalog].map(item => [item.id, item])).values()];
  const filtered = options.filter(item => `${item.id} ${item.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 18 };
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "500" }}>{t("启用模型 · 已选")} {selected.length}</Text>
      <Action theme={theme} label={busy ? t("正在获取…") : t("获取供应商模型")} onPress={onLoad} disabled={busy} icon="RefreshCw" />
    </View>
    {message ? <Text accessibilityRole="alert" style={muted}>{message}</Text> : null}
    {options.length ? <>
      <Field theme={theme} label={t("搜索模型")} placeholder={t("按模型名称或 ID 搜索")} value={search} onChangeText={setSearch} />
      <ScrollView style={{ maxHeight: 220, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {filtered.map(item => <Pressable key={item.id} accessibilityRole="checkbox" aria-checked={selected.includes(item.id)} accessibilityLabel={item.id} accessibilityState={{ checked: selected.includes(item.id), disabled: busy }} disabled={busy}
          onPress={() => onChange((selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id]).join("\n"))}
          style={{ minHeight: 48, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: theme.colors.border }}>
          <Icon name={selected.includes(item.id) ? "SquareCheck" : "Square"} size={17} color={selected.includes(item.id) ? theme.colors.accent : theme.colors.foregroundMuted} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{item.name}</Text>{item.name !== item.id ? <Text style={muted}>{item.id}</Text> : null}</View>
        </Pressable>)}
        {!filtered.length ? <Text style={{ ...muted, padding: 16 }}>{t("没有匹配的模型")}</Text> : null}
      </ScrollView>
    </> : <Text style={muted}>{t("填写连接信息后获取模型列表，再勾选允许 Agent 使用的模型。")}</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: manual }} onPress={() => setManual(!manual)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={manual ? "ChevronDown" : "ChevronRight"} size={14} color={theme.colors.foregroundMuted} /><Text style={muted}>{t("手动填写模型 ID")}</Text>
    </Pressable>
    {manual ? <Field theme={theme} label={t("模型 ID")} hint={t("每行一个；适用于没有模型列表接口的供应商")} value={selectedText} onChangeText={onChange} multiline editable={!busy} placeholder="model-id" /> : null}
  </View>;
}
