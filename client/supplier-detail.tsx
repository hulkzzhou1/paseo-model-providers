import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { limitsForModel, requestModelId, type PublicSupplier } from "../shared/contracts";
import { Action, Field, Tag, mono, sizes, workbenchStyles, type Theme } from "./ui";
import { formatTokenCount } from "./token-limits";

export const protocolLabels = { anthropic: "Anthropic Messages", responses: "OpenAI Responses", "chat-completions": "Chat Completions" };

export function SupplierStatus({ theme, enabled, t }: { theme: Theme; enabled: boolean; t(message: string): string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: enabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted }} />
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: sizes.caption }}>{enabled ? t("已启用") : t("已停用")}</Text>
  </View>;
}

export function SupplierDetail({ theme, compact, supplier, t, onEdit, onTest, onLaunch, testing, result }: {
  theme: Theme; compact: boolean; supplier: PublicSupplier; t(message: string): string;
  onEdit(): void; onTest(): void; onLaunch(): void; testing: boolean;
  result?: { ok: boolean; message: string };
}) {
  const [query, setQuery] = useState("");
  const styles = workbenchStyles(theme), c = theme.colors;
  const models = supplier.models.filter(id => `${id} ${requestModelId(supplier, id)}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 8 }}>
      <View style={styles.toolbar}>
        <Text accessibilityRole="header" style={{ ...styles.text, fontSize: sizes.title, lineHeight: 26, fontWeight: "700", flex: 1 }}>{supplier.name}</Text>
        <SupplierStatus theme={theme} enabled={supplier.enabled} t={t} />
      </View>
      <Text selectable style={{ ...styles.muted, fontFamily: mono }}>{supplier.baseUrl}</Text>
      <View style={styles.toolbar}>
        <Tag theme={theme}>{protocolLabels[supplier.protocol]}</Tag>
        <Text style={styles.muted}>{supplier.id}</Text>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon name={supplier.hasKey ? "KeyRound" : "Key"} size={13} color={c.foregroundMuted} />
          <Text style={styles.muted}>{supplier.hasKey ? t("凭据已保存") : t("无凭据")}</Text>
        </View>
      </View>
      <View style={styles.toolbar}>
        <Action theme={theme} label={t("编辑")} icon="Settings2" onPress={onEdit} disabled={testing} />
        <Action theme={theme} label={testing ? t("正在测试…") : t("测试连接")} icon="PlugZap" onPress={onTest} disabled={testing} quiet iconOnly={compact} />
        <View style={{ flex: 1 }} />
        <Action theme={theme} label={t("创建 Agent")} icon="ArrowUpRight" onPress={onLaunch} disabled={!supplier.enabled} />
      </View>
      {result ? <View accessibilityRole="alert" style={{ ...styles.toolbar, alignItems: "flex-start", padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: sizes.controlRadius }}>
        <Icon name={result.ok ? "CircleCheck" : "CircleAlert"} size={15} color={result.ok ? c.statusSuccess : c.statusDanger} />
        <Text style={{ ...styles.text, flex: 1 }}>{t(result.message)}</Text>
      </View> : null}
    </View>
    <View style={{ gap: 8 }}>
      <View style={styles.toolbar}>
        <Text accessibilityRole="header" style={{ ...styles.text, fontWeight: "600", flex: 1 }}>{t("模型与路由")}</Text>
        <Text style={styles.muted}>{models.length} / {supplier.models.length}</Text>
      </View>
      <Field theme={theme} label={t("搜索模型")} hideLabel placeholder={t("按模型名称或 ID 搜索")} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: sizes.radius, overflow: "hidden" }}>
        {!compact ? <View style={{ ...styles.toolbar, flexWrap: "nowrap", padding: 10, backgroundColor: c.surface1 }}>
          <Text style={{ ...styles.muted, flex: 2 }}>{t("模型 ID")}</Text>
          <Text style={{ ...styles.muted, flex: 2 }}>{t("实际请求 ID")}</Text>
          <Text style={{ ...styles.muted, flex: 1, textAlign: "right" }}>{t("上下文窗口")}</Text>
          <Text style={{ ...styles.muted, flex: 1, textAlign: "right" }}>{t("最大输出")}</Text>
        </View> : null}
        {models.map(id => {
          const limits = limitsForModel(supplier, id), actual = requestModelId(supplier, id);
          return <View key={id} style={{ padding: 10, gap: 6, borderTopWidth: 1, borderColor: c.border }}>
            {compact ? <>
              <Text selectable style={{ ...styles.text, fontFamily: mono }}>{id}</Text>
              {actual !== id ? <Text selectable style={{ ...styles.muted, fontFamily: mono }}>→ {actual}</Text> : null}
              <View style={styles.toolbar}>
                <Text style={styles.muted}>{t("上下文窗口")} {formatTokenCount(limits.contextWindow)}</Text>
                <Text style={styles.muted}>{t("最大输出")} {formatTokenCount(limits.maxTokens)}</Text>
              </View>
            </> : <View style={{ ...styles.toolbar, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Text selectable style={{ ...styles.text, fontFamily: mono, flex: 2 }}>{id}</Text>
              <Text selectable style={{ ...styles.muted, fontFamily: mono, flex: 2 }}>{actual === id ? "—" : actual}</Text>
              <Text style={{ ...styles.text, fontFamily: mono, flex: 1, textAlign: "right" }}>{formatTokenCount(limits.contextWindow)}</Text>
              <Text style={{ ...styles.text, fontFamily: mono, flex: 1, textAlign: "right" }}>{formatTokenCount(limits.maxTokens)}</Text>
            </View>}
          </View>;
        })}
        {!models.length ? <Text style={{ ...styles.muted, padding: 16 }}>{t("没有匹配的模型")}</Text> : null}
      </View>
      <Text style={styles.muted}>{t("上下文用于 Codex、OpenCode、Pi/OMP；最大输出用于 OpenCode、Pi/OMP。Codex 会预留部分上下文，Claude Code 使用自身容量规则。")}</Text>
    </View>
    <View style={{ gap: 8, borderTopWidth: 1, borderColor: c.border, paddingTop: 12 }}>
      <Text accessibilityRole="header" style={{ ...styles.text, fontWeight: "600" }}>{t("Agent 设置")}</Text>
      <View style={styles.toolbar}>{supplier.agents.map(agent => <Tag key={agent} theme={theme}>{agent}</Tag>)}</View>
      <Text style={styles.muted}>{t("新建或重新打开会话时生效")}</Text>
    </View>
  </View>;
}
