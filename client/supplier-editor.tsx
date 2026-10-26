import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Icon, Modal, ScrollView as ModalScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { ModelForm } from "./model-form";
import { mergeModelRows, supplierModelRows } from "./model-form-state";
import { Action, Field, Panel, Tag, mono, sizes, useControlHeight } from "./ui";
import { translate, type Language } from "./messages";
import { parseTokenCount } from "./token-limits";
import { supplierPresets } from "../shared/presets";
import { compatible, engines, saveRpc, discoverRpc, supplierSchema, type PublicSupplier, type Supplier } from "../shared/contracts";
import { protocolLabels } from "./supplier-detail";

const fresh: Supplier = { id: "", name: "", protocol: "anthropic", anthropicAuth: "api-key", baseUrl: "", models: [], agents: ["claude"], contextWindow: 32768, maxTokens: 4096, enabled: true };

export function SupplierEditor({ theme, layout, language, supplier, suppliers, revision, onClose, onSaved }: Pick<PluginScreenProps, "theme" | "layout"> & {
  language: Language; supplier?: PublicSupplier; suppliers: PublicSupplier[]; revision: string;
  onClose(): void; onSaved(id: string): void;
}) {
  const t = (message: string) => translate(message, language);
  const save = useRpc(saveRpc), discover = useRpc(discoverRpc), toast = useToast();
  const existing = Boolean(supplier);
  const initial = supplier ?? fresh;
  const [editing, setEditing] = useState<Supplier>(() => ({ ...initial }));
  const [key, setKey] = useState("");
  const [modelRows, setModelRows] = useState(() => supplierModelRows(initial));
  const [catalogMessage, setCatalogMessage] = useState("");
  const [preset, setPreset] = useState("custom");
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<"load" | "save">("load");
  const [discard, setDiscard] = useState(false);
  const [editorTab, setEditorTab] = useState<"connection" | "models" | "agents">("connection");
  const editorScroll = useRef<ScrollView>(null);
  const requestSequence = useRef(0);
  useEffect(() => () => { requestSequence.current++; }, []);
  const dirty = Boolean(key) || JSON.stringify(editing) !== JSON.stringify(initial) || JSON.stringify(modelRows) !== JSON.stringify(supplierModelRows(initial));
  const selectedModels = modelRows.map(row => row.id.trim());
  const controlHeight = useControlHeight();
  const color = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted, fontSize: sizes.caption };
  const rows = { flexDirection: layout.compact ? "column" as const : "row" as const, gap: 10 };
  function selectEditorTab(tab: typeof editorTab) { setEditorTab(tab); editorScroll.current?.scrollTo({ y: 0, animated: false }); }
  function resetCatalog() { requestSequence.current++; setCatalogMessage(""); }
  function closeEditor() { if (!busy) { if (dirty) setDiscard(true); else onClose(); } }
  async function loadModels() {
    const sequence = ++requestSequence.current;
    setBusy(true); setOperation("load"); setCatalogMessage("");
    try {
      const response = await discover({ id: existing ? editing.id : undefined, baseUrl: editing.baseUrl, protocol: editing.protocol, anthropicAuth: editing.anthropicAuth, key: key || undefined });
      if (sequence === requestSequence.current) {
        const merged = mergeModelRows(modelRows, response.models);
        setModelRows(merged.rows);
        setCatalogMessage(merged.omitted ? "已自动填充至 100 个模型；可移除现有行后手动添加其他模型。" : response.message);
      }
    } catch { if (sequence === requestSequence.current) setCatalogMessage("请检查接口地址，也可以手动填写模型 ID。"); }
    finally { setBusy(false); }
  }
  function applyPreset(id: string) {
    const template = id === "custom" ? fresh : supplierPresets[id];
    if (!template) return;
    resetCatalog(); setKey(""); setPreset(id);
    let supplierId = template.id;
    for (let suffix = 2; supplierId && suppliers.some(item => item.id === supplierId); suffix++) supplierId = `${template.id}-${suffix}`;
    setEditing({ ...template, id: supplierId });
    setModelRows(supplierModelRows(template));
    if (id !== "custom") {
      setCatalogMessage("已填入预设；可获取最新模型列表，所有设置均可修改。");
    }
  }
  async function store() {
    const modelLimits = Object.fromEntries(modelRows.map(row => [row.id.trim(), {
      contextWindow: parseTokenCount(row.contextWindow?.trim() || String(editing.contextWindow)),
      maxTokens: parseTokenCount(row.maxTokens?.trim() || String(editing.maxTokens)),
    }]));
    if (Object.values(modelLimits).some(limits => !Number.isFinite(limits.contextWindow) || !Number.isFinite(limits.maxTokens))) { selectEditorTab("models"); toast.error(t("请输入完整 Token 数或 K/M 简写，例如 256K、1M")); return; }
    const modelMappings = Object.fromEntries(modelRows.filter(row => row.apiId.trim() && row.apiId.trim() !== row.id.trim()).map(row => [row.id.trim(), row.apiId.trim()]));
    const parsed = supplierSchema.safeParse({ ...editing, modelLimits, models: selectedModels, modelMappings });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      selectEditorTab(field === "models" || field === "modelMappings" || field === "modelLimits" ? "models" : field === "agents" ? "agents" : "connection");
      toast.error(parsed.error.issues.map(item => `${item.path.join('.')}: ${t(item.message)}`).join("\n")); return;
    }
    setBusy(true); setOperation("save");
    try { await save({ ...parsed.data, key: key || undefined, revision }); onSaved(parsed.data.id); toast.show(t("已保存；可在新建 Agent 的供应商列表中选择"), { variant: "success" }); }
    catch (error) { toast.error(error instanceof Error ? t(error.message) : t("保存失败")); }
    finally { setBusy(false); }
  }
  return <Modal title={existing ? t("编辑供应商") : t("新增供应商")} open onOpenChange={open => { if (!open) closeEditor(); }}>
      <Modal.Content scrollable={false} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flex: 1, minHeight: 0, padding: 0, gap: 0 }}>
        {discard ? <View style={{ padding: 16, gap: 12 }}>
          <Text accessibilityRole="alert" style={{ ...color, fontSize: sizes.body }}>{t("放弃尚未保存的修改？")}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Action theme={theme} label={t("继续编辑")} onPress={() => setDiscard(false)} />
            <Action theme={theme} label={t("放弃修改")} primary onPress={onClose} />
          </View>
        </View> : null}
        <View style={{ flex: 1, minHeight: 0, display: discard ? "none" : "flex" }}>
        <View style={{ paddingHorizontal: layout.compact ? 12 : 16, paddingVertical: 8, gap: 6 }}>
          <View style={{ flexDirection: layout.compact ? "column" : "row", alignItems: layout.compact ? "flex-start" : "center", gap: 8 }}>
            <Text style={{ ...color, fontSize: sizes.title, lineHeight: 26, fontWeight: "700", flex: layout.compact ? undefined : 1 }}>{editing.name || t("新增供应商")}</Text>
            <Tag theme={theme}>{protocolLabels[editing.protocol]}</Tag>
          </View>
          <Text selectable numberOfLines={1} style={{ ...muted, fontFamily: editing.baseUrl ? mono : undefined }}>{editing.baseUrl || t("选择接口协议，填写供应商提供的基础地址与凭据。")}</Text>
        </View>
        <View accessibilityRole="tablist" style={{ borderBottomWidth: 1, borderColor: theme.colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: layout.compact ? 12 : 16, gap: 2 }}>
            {([["connection", "连接设置", "Settings2"], ["models", "模型与路由", "List"], ["agents", "Agent 设置", "Terminal"]] as const).map(([id, label, icon]) =>
              <Action key={id} theme={theme} label={t(label)} icon={icon} selected={editorTab === id} disabled={busy} onPress={() => selectEditorTab(id)} />)}
          </ScrollView>
        </View>
        <ModalScrollView ref={editorScroll} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: layout.compact ? 12 : 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ display: editorTab === "connection" ? "flex" : "none" }}>
            <Panel theme={theme} icon="Settings2" title={t("连接设置")} description={t("选择接口协议，填写供应商提供的基础地址与凭据。")}>
              {!existing ? <SettingsSelect label={t("供应商预设")} hint={t("选择预设会填写连接信息、模型和容量，并清空已输入的密钥。")} value={preset} disabled={busy} options={[{ value: "custom", label: t("自定义") }, ...Object.entries(supplierPresets).map(([value, item]) => ({ value, label: item.name }))]} onValueChange={applyPreset} /> : null}
              <View style={rows}>
                <Field theme={theme} label={t("显示名称")} placeholder={t("例如：内部模型网关")} value={editing.name} editable={!busy} onChangeText={name => setEditing({ ...editing, name })} />
                <Field theme={theme} label={t("供应商标识")} hint={existing ? t("保存后不可修改") : t("小写字母、数字与连字符")} placeholder="internal-gateway" value={editing.id} editable={!existing && !busy} onChangeText={id => setEditing({ ...editing, id })} />
              </View>
              <View style={rows}>
                <View style={{ flex: 1, minWidth: 0 }}><SettingsSelect label={t("接口协议")} value={editing.protocol} disabled={busy} options={[{ value: "anthropic", label: "Anthropic Messages" }, { value: "responses", label: "OpenAI Responses" }, { value: "chat-completions", label: "OpenAI Chat Completions" }]} onValueChange={protocol => { resetCatalog(); setEditing({ ...editing, protocol, agents: editing.agents.filter(agent => compatible(protocol, agent)) }); }} /></View>
                {editing.protocol === "anthropic" ? <View style={{ flex: 1, minWidth: 0 }}><SettingsSelect label={t("鉴权方式")} value={editing.anthropicAuth} disabled={busy} options={[{ value: "api-key", label: "API Key (x-api-key)" }, { value: "bearer", label: t("Bearer Token（内部网关）") }]} onValueChange={anthropicAuth => { resetCatalog(); setEditing({ ...editing, anthropicAuth }); }} /></View> : null}
              </View>
              <Field theme={theme} label={t("API 基础地址")} hint={t("填写兼容网关的基础路径，如 /v2；不要包含 /chat/completions 等请求路径")} placeholder="https://example.com/v1" value={editing.baseUrl} editable={!busy} onChangeText={baseUrl => { resetCatalog(); setEditing({ ...editing, baseUrl }); }} autoCapitalize="none" />
              <Field theme={theme} label={t("API 密钥")} hint={existing ? t("留空沿用已保存的凭据，密钥不会回显") : t("凭据保存在当前服务器；无需认证的接口可留空")} placeholder={existing ? t("已保存的密钥不会显示") : t("输入 API Key")} value={key} editable={!busy} onChangeText={value => { resetCatalog(); setKey(value); }} secureTextEntry autoCapitalize="none" />
            </Panel>
          </View>
          <View style={{ display: editorTab === "models" ? "flex" : "none" }}>
            <Panel theme={theme} icon="List" title={t("模型与路由")} right={<Tag theme={theme}>{selectedModels.filter(Boolean).length}</Tag>}>
              <ModelForm defaults={editing} t={t} theme={theme} compact={layout.compact} rows={modelRows} onChange={setModelRows} message={t(catalogMessage)} busy={busy} onLoad={() => void loadModels()} />
            </Panel>
          </View>
          <View style={{ display: editorTab === "agents" ? "flex" : "none" }}>
            <Panel theme={theme} icon="Terminal" title={t("Agent 设置")} description={t("选择使用此接口的 Agent；容量在各模型行中设置。")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {engines.map(agent => <Pressable key={agent} accessibilityRole="checkbox" aria-checked={editing.agents.includes(agent)} accessibilityLabel={agent} accessibilityState={{ checked: editing.agents.includes(agent), disabled: !compatible(editing.protocol, agent) }} disabled={busy || !compatible(editing.protocol, agent)}
                  onPress={() => setEditing({ ...editing, agents: editing.agents.includes(agent) ? editing.agents.filter(item => item !== agent) : [...editing.agents, agent] })}
                  style={{ minHeight: controlHeight, paddingHorizontal: 8, borderWidth: 1, borderColor: editing.agents.includes(agent) ? theme.colors.accent : theme.colors.border, borderRadius: sizes.controlRadius, flexDirection: "row", alignItems: "center", gap: 6, opacity: compatible(editing.protocol, agent) ? 1 : 0.4 }}>
                  <Icon name={editing.agents.includes(agent) ? "SquareCheck" : "Square"} size={14} color={editing.agents.includes(agent) ? theme.colors.accent : theme.colors.foregroundMuted} /><Text style={{ ...color, fontSize: sizes.caption }}>{agent}</Text>
                </Pressable>)}
              </View>
              <Text style={{ ...muted, lineHeight: 20 }}>{t("Codex 需要 OpenAI Responses 协议；Claude 需要 Anthropic Messages 协议。灰色选项表示与当前协议不兼容。")}</Text>
              <SettingsSwitch label={t("启用供应商")} hint={t("新建或重新打开会话时生效")} value={editing.enabled} disabled={busy} onValueChange={enabled => setEditing({ ...editing, enabled })} />
            </Panel>
          </View>
        </ModalScrollView>
        <View style={{ paddingHorizontal: layout.compact ? 12 : 16, paddingVertical: 8, flexShrink: 0, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {!layout.compact ? <Text style={{ ...muted, flex: 1, lineHeight: 18 }}>{t("新建或重新打开会话时生效")}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", flexGrow: 1, gap: 8 }}>
            <Action theme={theme} label={t("取消")} onPress={closeEditor} disabled={busy} quiet />
            <Action theme={theme} label={busy && operation === "save" ? t("正在保存…") : t("保存供应商")} onPress={() => void store()} disabled={busy} primary icon="Check" />
          </View>
        </View>
        </View>
      </Modal.Content>
    </Modal>;
}
