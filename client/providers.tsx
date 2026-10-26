import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { probeRpc, stateRpc, type PublicSupplier } from "../shared/contracts";
import { filterSuppliers, type SupplierFilter } from "./providers-state";
import { AgentDialog } from "./agent-dialog";
import { SupplierEditor } from "./supplier-editor";
import { SupplierDetail } from "./supplier-detail";
import { SupplierRow } from "./supplier-list";
import { Action, Field, workbenchStyles } from "./ui";
import { translate } from "./messages";
import { useSystemLanguage } from "./language";

export function ProvidersScreen({ theme, layout, navigation }: PluginScreenProps) {
  const language = useSystemLanguage();
  const t = (message: string) => translate(message, language);
  const styles = workbenchStyles(theme), c = theme.colors;
  const { width } = useWindowDimensions();
  const split = !layout.compact && width >= 1000;
  const paseo = usePaseo();
  const load = useRpc(stateRpc), probe = useRpc(probeRpc);
  const state = useQuery({ queryKey: ["model-suppliers"], queryFn: () => load({}), retry: false });
  const available = useQuery({ queryKey: ["supplier-engines"], queryFn: () => paseo.providers.listAvailable(), retry: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SupplierFilter>("all");
  const [editing, setEditing] = useState<{ supplier?: PublicSupplier; revision: string } | null>(null);
  const [launch, setLaunch] = useState<PublicSupplier | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const suppliers = state.data?.suppliers ?? [];
  const visible = filterSuppliers(suppliers, query, filter);
  const selected = visible.find(item => item.id === selectedId) ?? (split ? visible[0] : undefined);
  const installed = available.data?.providers.filter(item => item.available) ?? [];
  function edit(supplier?: PublicSupplier) {
    if (state.data) setEditing({ supplier, revision: state.data.revision });
  }
  function refresh() { void state.refetch(); void available.refetch(); }
  async function test(item: PublicSupplier) {
    if (testing[item.id]) return;
    setTesting(current => ({ ...current, [item.id]: true }));
    try { const response = await probe({ id: item.id, model: item.models[0] }); setResults(current => ({ ...current, [item.id]: response })); }
    catch { setResults(current => ({ ...current, [item.id]: { ok: false, message: "测试失败，请检查供应商配置" } })); }
    finally { setTesting(current => { const next = { ...current }; delete next[item.id]; return next; }); }
  }
  const showList = split || !selected;
  return <View style={styles.page}>
    <View style={{ ...styles.toolbar, flexWrap: "nowrap", paddingHorizontal: layout.compact ? 12 : 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
      <Icon name="Network" size={17} color={c.foregroundMuted} />
      <Text accessibilityRole="header" numberOfLines={1} style={{ ...styles.text, fontWeight: "700", fontSize: 17, flex: 1 }}>{t("模型供应商")}</Text>
      {!layout.compact && state.data ? <Text style={styles.muted}>{suppliers.length} {t("个供应商 ·")} {suppliers.filter(item => item.enabled).length} {t("个启用")}</Text> : null}
      <Action theme={theme} label={t("刷新")} icon="RefreshCw" iconOnly quiet disabled={state.isFetching || available.isFetching} onPress={refresh} />
      <Action theme={theme} label={t("新增供应商")} icon="Plus" primary iconOnly={layout.compact} disabled={!state.data} onPress={() => edit()} />
    </View>
    {state.isError ? <View accessibilityRole="alert" style={{ ...styles.toolbar, padding: 12, borderBottomWidth: 1, borderColor: c.border }}>
      <Icon name="CircleAlert" size={15} color={c.statusDanger} />
      <Text style={{ ...styles.text, flex: 1 }}>{t("无法读取供应商配置")} · {t("请检查当前主机连接后重试。")}</Text>
      <Action theme={theme} label={t("重新加载")} icon="RefreshCw" disabled={state.isFetching} onPress={() => void state.refetch()} />
    </View> : null}
    {state.isPending ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={c.accent} /><Text style={styles.muted}>{t("正在读取供应商配置…")}</Text>
    </View> : null}
    {state.data ? <View style={{ flex: 1, minHeight: 0, flexDirection: split ? "row" : "column" }}>
      {showList ? <View style={{ width: split ? 300 : undefined, flex: split ? undefined : 1, minHeight: 0, borderRightWidth: split ? 1 : 0, borderColor: c.border }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 12, gap: 8, borderBottomWidth: 1, borderColor: c.border }}>
          <Field theme={theme} label={t("搜索供应商")} hideLabel placeholder={t("名称、地址或模型 ID")} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          <View accessibilityRole="tablist" style={styles.toolbar}>
            {([["all", "全部"], ["enabled", "已启用"], ["disabled", "已停用"]] as const).map(([id, label]) => <Action key={id} theme={theme} label={t(label)} selected={filter === id} onPress={() => setFilter(id)} />)}
          </View>
        </View>
        <ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled">
          {visible.map(supplier => <SupplierRow key={supplier.id} theme={theme} supplier={supplier} selected={selected?.id === supplier.id} t={t} onPress={() => setSelectedId(supplier.id)} />)}
          {!visible.length ? <View style={{ padding: 16, gap: 8 }}>
            <Text accessibilityRole="header" style={{ ...styles.text, fontWeight: "600" }}>{suppliers.length ? t("没有匹配的供应商") : t("接入你的第一个模型接口")}</Text>
            <Text style={styles.muted}>{suppliers.length ? t("尝试其他关键词或切换筛选条件。") : t("点击右上方「新增供应商」，填写接口和模型，选择可接入的 Agent 即可开始。")}</Text>
          </View> : null}
        </ScrollView>
        <View style={{ padding: 12, borderTopWidth: 1, borderColor: c.border }}>
          <Text style={styles.muted}>{visible.length} / {suppliers.length} {t("供应商")}</Text>
        </View>
      </View> : null}
      {selected ? <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {!split ? <View style={{ ...styles.toolbar, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: c.border }}>
          <Action theme={theme} label={t("返回供应商列表")} icon="ArrowLeft" quiet onPress={() => setSelectedId(null)} />
        </View> : null}
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: layout.compact ? 12 : 20, paddingBottom: 24 }}>
          <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center" }}>
            <SupplierDetail key={selected.id} theme={theme} compact={layout.compact || !split} supplier={selected} t={t} testing={Boolean(testing[selected.id])} result={results[selected.id]}
              onEdit={() => edit(selected)} onTest={() => void test(selected)} onLaunch={() => setLaunch(selected)} />
          </View>
        </ScrollView>
      </View> : split ? <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 8 }}>
        <Icon name="Network" size={28} color={c.foregroundMuted} />
        <Text style={styles.muted}>{t("选择供应商查看模型、容量与 Agent 设置。")}</Text>
      </View> : null}
    </View> : null}
    <View style={{ borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface1, paddingHorizontal: layout.compact ? 12 : 16, paddingVertical: 6, gap: 6 }}>
      <View style={styles.toolbar}>
        <Icon name="Terminal" size={14} color={c.foregroundMuted} />
        {!layout.compact ? <Text style={styles.muted}>{t("当前主机可用的 Agent")}</Text> : null}
        <Text numberOfLines={1} style={{ ...styles.muted, flex: 1 }}>{available.isPending ? t("正在检测…") : available.isError || available.data?.error ? t("检测失败，可点击页面顶部刷新重试。") : installed.length ? installed.map(item => item.provider).join(" · ") : t("当前没有检测到可用的 Agent。")}</Text>
        <Action theme={theme} label={t("计费与兼容性说明")} icon="Info" iconOnly quiet onPress={() => setHelpOpen(value => !value)} />
      </View>
      {helpOpen ? <View style={{ gap: 6, paddingBottom: 6 }}>
        <Text style={styles.muted}>{t("官方订阅独立保留")}{t("· 原有登录和 Agent 预设继续可用；自定义接口使用对应供应商的 API 额度。")}</Text>
        <Text style={styles.muted}>{t("连接测试会向接口发送简短请求和工具定义，可能消耗少量 Token。测试通过不代表完整开发、MCP 或工具执行已验证。Pi/OMP 暂按文本输入、无额外推理、费用未知配置。")}</Text>
      </View> : null}
    </View>
    {editing ? <SupplierEditor theme={theme} layout={layout} language={language} supplier={editing.supplier} suppliers={suppliers} revision={editing.revision} onClose={() => setEditing(null)} onSaved={id => {
      setEditing(null); setSelectedId(id); setQuery(""); setFilter("all");
      setResults(current => { const next = { ...current }; delete next[id]; return next; }); refresh();
    }} /> : null}
    {launch ? <AgentDialog theme={theme} layout={layout} navigation={navigation} language={language} supplier={launch} onClose={() => setLaunch(null)} /> : null}
  </View>;
}
