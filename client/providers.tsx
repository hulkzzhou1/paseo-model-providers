import { useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View, Text, Pressable } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon, Modal, ScrollView as ModalScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { ModelForm } from "./model-form";
import { mergeModelRows, supplierModelRows, type ModelRow } from "./model-form-state";
import { Action, Disclosure, Field, Panel, Tag, mono, sizes } from "./ui";
import { translate } from "./messages";
import { useSystemLanguage } from "./language";
import { parseTokenCount } from "./token-limits";
import { supplierPresets } from "../shared/presets";
import { aliasId, compatible, engines, modelId, stateRpc, saveRpc, probeRpc, discoverRpc, supplierSchema, type Engine, type PublicSupplier, type Supplier } from "../shared/contracts";

function EditorDialogWidth({ compact }: { compact: boolean }) {
  const marker = useRef<View>(null);
  useLayoutEffect(() => {
    // shortcut: SDK 0.12 does not expose desktop modal width; remove when it does.
    const node = marker.current as unknown as { closest?: (selector: string) => { style: { maxWidth: string } } | null };
    const dialog = node?.closest?.('[role="dialog"]');
    if (compact || !dialog) return;
    const previous = dialog.style.maxWidth;
    dialog.style.maxWidth = "880px";
    return () => { dialog.style.maxWidth = previous; };
  }, [compact]);
  return <View ref={marker} style={{ position: "absolute", width: 0, height: 0 }} />;
}

const fresh: Supplier = { id: "", name: "", protocol: "anthropic", anthropicAuth: "api-key", baseUrl: "", models: [], agents: ["claude"], contextWindow: 32768, maxTokens: 4096, enabled: true };
const protocolLabels = { anthropic: "Anthropic Messages", responses: "OpenAI Responses", "chat-completions": "Chat Completions" };
export function ProvidersScreen({ theme, layout, navigation }: PluginScreenProps) {
  const language = useSystemLanguage();
  const t = (message: string) => translate(message, language);
  const paseo = usePaseo();
  const load = useRpc(stateRpc), save = useRpc(saveRpc), probe = useRpc(probeRpc), discover = useRpc(discoverRpc);
  const state = useQuery({ queryKey: ["model-suppliers"], queryFn: () => load({}), retry: false });
  const available = useQuery({ queryKey: ["supplier-engines"], queryFn: () => paseo.providers.listAvailable(), retry: false });
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [revision, setRevision] = useState("");
  const [existing, setExisting] = useState(false);
  const [editorTab, setEditorTab] = useState<"connection" | "models" | "agents">("connection");
  const editorScroll = useRef<ScrollView>(null);
  const [preset, setPreset] = useState("custom");
  const [key, setKey] = useState("");
  const [modelRows, setModelRows] = useState<ModelRow[]>([]);
  const [catalogMessage, setCatalogMessage] = useState("");
  const requestSequence = useRef(0);
  const [busy, setBusy] = useState(false);
  const [launch, setLaunch] = useState<PublicSupplier | null>(null);
  const [engine, setEngine] = useState<Engine>("claude");
  const [model, setModel] = useState("");
  const [cwd, setCwd] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const toast = useToast();
  const color = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const rows = { flexDirection: layout.compact ? "column" as const : "row" as const, gap: 12 };
  const suppliers = state.data?.suppliers ?? [];
  const installed = available.data?.providers.filter(item => item.available) ?? [];
  const selectedModels = modelRows.map(row => row.id.trim());
  function button(label: string, action: () => void, disabled = false, primary = false, icon?: string, quiet = false, iconOnly = false) {
    return <Action theme={theme} label={label} onPress={action} disabled={disabled || busy} primary={primary} quiet={quiet} icon={icon} iconOnly={iconOnly} />;
  }
  function selectEditorTab(tab: typeof editorTab) { setEditorTab(tab); editorScroll.current?.scrollTo({ y: 0, animated: false }); }
  function resetCatalog() { requestSequence.current++; setCatalogMessage(""); }
  function closeEditor() { requestSequence.current++; setEditing(null); setKey(""); }
  async function loadModels() {
    if (!editing) return;
    const sequence = ++requestSequence.current;
    setBusy(true); setCatalogMessage("");
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
  function edit(item?: PublicSupplier) {
    requestSequence.current++; setCatalogMessage("");
    setExisting(Boolean(item)); setEditing(item ? { ...item } : { ...fresh }); setKey(""); setRevision(state.data?.revision ?? "");
    setModelRows(supplierModelRows(item ?? fresh));
    setEditorTab("connection");
    setPreset("custom");
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
    if (!editing) return;
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
    setBusy(true);
    try { await save({ ...parsed.data, key: key || undefined, revision }); closeEditor(); await state.refetch(); await available.refetch(); toast.show(t("已保存；可在新建 Agent 的供应商列表中选择"), { variant: "success" }); }
    catch (error) { toast.error(error instanceof Error ? t(error.message) : t("保存失败")); }
    finally { setBusy(false); }
  }
  async function test(item: PublicSupplier) {
    setBusy(true); setResult(null);
    try { const response = await probe({ id: item.id, model: item.models[0] }); setResult({ id: item.id, ok: response.ok, message: response.message }); }
    catch { setResult({ id: item.id, ok: false, message: "测试失败，请检查供应商配置" }); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!launch || !cwd.startsWith("/") || !model || !launch.agents.includes(engine)) { toast.error(t("请选择 Agent、模型并填写服务器上的绝对工作目录")); return; }
    setBusy(true);
    try {
      const agent = await paseo.agents.create({ cwd, config: { provider: `${aliasId(launch.id, engine)}/${modelId(launch, engine, model)}` }, ...(prompt.trim() ? { prompt: prompt.trim() } : {}), title: `${launch.name} · ${model}` });
      setLaunch(null); navigation?.openAgent({ agentId: agent.id }); toast.show(t("Agent 已创建"), { variant: "success" });
    } catch { toast.error(t("创建失败，请检查工作目录、Agent 安装状态及供应商配置；不会修改现有会话")); }
    finally { setBusy(false); }
  }
  return <View style={{ flex: 1, minWidth: 0, backgroundColor: theme.colors.surface0 }}>
    <View style={{ paddingHorizontal: layout.compact ? 12 : 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", gap: 6 }}>
        <View style={{ flexDirection: layout.compact ? "column" : "row", alignItems: layout.compact ? "stretch" : "center", gap: 8 }}>
          <Text accessibilityRole="header" style={{ ...color, flex: layout.compact ? undefined : 1, minWidth: 0, fontSize: sizes.title, lineHeight: 30, fontWeight: "700" }}>{t("模型供应商")}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            {button(t("刷新"), () => { void state.refetch(); void available.refetch(); }, false, false, "RefreshCw", true, true)}
            {button(t("新增供应商"), () => edit(), !state.data, true, "Plus")}
          </View>
        </View>
        {!layout.compact ? <Text style={{ ...muted, lineHeight: 18 }}>{t("一个接口，多种 Agent。为每个会话选择合适的模型。")}</Text> : null}
      </View>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: layout.compact ? 12 : 20, paddingBottom: 32 }}>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <Text accessibilityRole="header" style={{ ...color, fontSize: sizes.heading, fontWeight: "600" }}>{t("已配置接口")}</Text>
          {state.data ? <Text style={muted}>{suppliers.length} {t("个供应商 ·")} {suppliers.filter(item => item.enabled).length} {t("个启用")}</Text> : null}
        </View>
        {state.isPending ? <View style={{ padding: 32, alignItems: "center", gap: 12 }}><ActivityIndicator color={theme.colors.accent} /><Text style={muted}>{t("正在读取供应商配置…")}</Text></View> : null}
        {state.isError ? <View style={{ padding: 16, gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.radius }}>
          <Text style={{ color: theme.colors.statusDanger }}>{t("无法读取供应商配置")}</Text><Text style={muted}>{t("请检查当前主机连接后重试。")}</Text>{button(t("重新加载"), () => void state.refetch(), false, false, "RefreshCw")}
        </View> : null}
        {state.data && suppliers.length === 0 ? <Panel theme={theme} title={t("接入你的第一个模型接口")} icon="Network">
          <Text style={{ ...muted, lineHeight: 20 }}>{t("点击右上方「新增供应商」，填写接口和模型，选择可接入的 Agent 即可开始。")}</Text>
        </Panel> : null}
        {suppliers.map(item => <Panel key={item.id} theme={theme} title={item.name} icon="Network" right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.enabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted }} />
            <Text style={{ ...muted, color: item.enabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted }}>{item.enabled ? t("已启用") : t("已停用")}</Text>
          </View>
        }>
          <Text selectable numberOfLines={2} style={{ ...muted, fontFamily: mono, lineHeight: 18 }}>{item.baseUrl}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Tag theme={theme}>{protocolLabels[item.protocol]}</Tag>
            {item.agents.map(agent => <Tag key={agent} theme={theme}>{agent}</Tag>)}
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Text style={{ ...muted, lineHeight: 20 }}>{t("模型 ·")} {item.models.length}</Text>
            <Text style={{ ...color, fontSize: sizes.body, lineHeight: 20, flex: 1 }} numberOfLines={2}>{item.models.slice(0, 3).join(" · ")}{item.models.length > 3 ? ` +${item.models.length - 3}` : ""}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 8, flexDirection: layout.compact ? "column" : "row", justifyContent: "space-between", alignItems: layout.compact ? "stretch" : "center", gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={item.hasKey ? "KeyRound" : "Key"} size={13} color={theme.colors.foregroundMuted} />
              <Text style={muted}>{item.hasKey ? t("凭据已保存") : t("无凭据")}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 4 }}>
              {button(t("编辑"), () => edit(item), false, false, "Settings2", true)}
              {button(t("测试连接"), () => void test(item), false, false, "PlugZap", true)}
              {button(t("创建 Agent"), () => { setLaunch(item); setEngine(item.agents[0]); setModel(item.models[0]); setPrompt(""); }, !item.enabled, false, "ArrowUpRight")}
            </View>
          </View>
          {result?.id === item.id ? <View accessibilityRole="alert" style={{ borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 10, flexDirection: "row", gap: 8 }}>
            <Icon name={result.ok ? "CircleCheck" : "CircleAlert"} size={16} color={result.ok ? theme.colors.statusSuccess : theme.colors.statusDanger} />
            <Text style={{ ...muted, flex: 1, lineHeight: 20 }}>{t(result.message)}</Text>
          </View> : null}
        </Panel>)}
        <Panel theme={theme} title={t("当前主机可用的 Agent")} icon="Terminal">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{installed.map(item => <Tag key={item.provider} theme={theme}>{item.provider}</Tag>)}</View>
          {available.isPending ? <Text style={muted}>{t("正在检测…")}</Text> : available.isError || available.data?.error ? <Text style={muted}>{t("检测失败，可点击页面顶部刷新重试。")}</Text> : installed.length === 0 ? <Text style={muted}>{t("当前没有检测到可用的 Agent。")}</Text> : null}
          <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Icon name="ShieldCheck" size={15} color={theme.colors.foregroundMuted} />
            <Text style={{ ...muted, flex: 1, lineHeight: 20 }}><Text style={{ ...color, fontWeight: "500" }}>{t("官方订阅独立保留")}</Text> {t("· 原有登录和 Agent 预设继续可用；自定义接口使用对应供应商的 API 额度。")}</Text>
          </View>
          <Disclosure theme={theme} label={t("计费与兼容性说明")} expanded={helpOpen} onPress={() => setHelpOpen(!helpOpen)} />
          {helpOpen ? <Text style={{ ...muted, lineHeight: 20 }}>{t("连接测试会向接口发送简短请求和工具定义，可能消耗少量 Token。测试通过不代表完整开发、MCP 或工具执行已验证。Pi/OMP 暂按文本输入、无额外推理、费用未知配置。")}</Text> : null}
        </Panel>
      </View>
    </ScrollView>

    <Modal title={existing ? t("编辑供应商") : t("新增供应商")} open={editing !== null} onOpenChange={open => { if (!open && !busy) closeEditor() }}>
      {editing ? <Modal.Content scrollable={false} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flex: 1, minHeight: 0, padding: 0, gap: 0 }}>
        <EditorDialogWidth compact={layout.compact} />
        <View style={{ paddingHorizontal: layout.compact ? 12 : 20, paddingVertical: 12, gap: 6 }}>
          <View style={{ flexDirection: layout.compact ? "column" : "row", alignItems: layout.compact ? "flex-start" : "center", gap: 8 }}>
            <Text style={{ ...color, fontSize: sizes.title, lineHeight: 30, fontWeight: "700", flex: layout.compact ? undefined : 1 }}>{editing.name || t("新增供应商")}</Text>
            <Tag theme={theme}>{protocolLabels[editing.protocol]}</Tag>
          </View>
          <Text selectable numberOfLines={1} style={{ ...muted, fontFamily: editing.baseUrl ? mono : undefined }}>{editing.baseUrl || t("选择接口协议，填写供应商提供的基础地址与凭据。")}</Text>
        </View>
        <View accessibilityRole="tablist" style={{ borderBottomWidth: 1, borderColor: theme.colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: layout.compact ? 12 : 20, gap: 4 }}>
            {([["connection", "连接设置", "Settings2"], ["models", "模型与路由", "List"], ["agents", "Agent 设置", "Terminal"]] as const).map(([id, label, icon]) =>
              <Action key={id} theme={theme} label={t(label)} icon={icon} selected={editorTab === id} disabled={busy} onPress={() => selectEditorTab(id)} />)}
          </ScrollView>
        </View>
        <ModalScrollView ref={editorScroll} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: layout.compact ? 12 : 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ display: editorTab === "connection" ? "flex" : "none" }}>
            <Panel theme={theme} icon="Settings2" title={t("连接设置")} description={t("选择接口协议，填写供应商提供的基础地址与凭据。")}>
              {!existing ? <SettingsSelect label={t("供应商预设")} hint={t("选择预设会填写连接信息、模型和容量，并清空已输入的密钥。")} value={preset} disabled={busy} options={[{ value: "custom", label: t("自定义") }, ...Object.entries(supplierPresets).map(([value, item]) => ({ value, label: item.name }))]} onValueChange={applyPreset} /> : null}
              <View style={rows}>
                <Field theme={theme} label={t("显示名称")} placeholder={t("例如：内部模型网关")} value={editing.name} onChangeText={name => setEditing({ ...editing, name })} />
                <Field theme={theme} label={t("供应商标识")} hint={existing ? t("保存后不可修改") : t("小写字母、数字与连字符")} placeholder="internal-gateway" value={editing.id} editable={!existing && !busy} onChangeText={id => setEditing({ ...editing, id })} />
              </View>
              <View style={rows}>
                <View style={{ flex: 1, minWidth: 0 }}><SettingsSelect label={t("接口协议")} value={editing.protocol} options={[{ value: "anthropic", label: "Anthropic Messages" }, { value: "responses", label: "OpenAI Responses" }, { value: "chat-completions", label: "OpenAI Chat Completions" }]} onValueChange={protocol => { resetCatalog(); setEditing({ ...editing, protocol, agents: editing.agents.filter(agent => compatible(protocol, agent)) }); }} /></View>
                {editing.protocol === "anthropic" ? <View style={{ flex: 1, minWidth: 0 }}><SettingsSelect label={t("鉴权方式")} value={editing.anthropicAuth} options={[{ value: "api-key", label: "API Key (x-api-key)" }, { value: "bearer", label: t("Bearer Token（内部网关）") }]} onValueChange={anthropicAuth => { resetCatalog(); setEditing({ ...editing, anthropicAuth }); }} /></View> : null}
              </View>
              <Field theme={theme} label={t("API 基础地址")} hint={t("填写兼容网关的基础路径，如 /v2；不要包含 /chat/completions 等请求路径")} placeholder="https://example.com/v1" value={editing.baseUrl} onChangeText={baseUrl => { resetCatalog(); setEditing({ ...editing, baseUrl }); }} autoCapitalize="none" />
              <Field theme={theme} label={t("API 密钥")} hint={existing ? t("留空沿用已保存的凭据，密钥不会回显") : t("凭据保存在当前服务器；无需认证的接口可留空")} placeholder={existing ? t("已保存的密钥不会显示") : t("输入 API Key")} value={key} onChangeText={value => { resetCatalog(); setKey(value); }} secureTextEntry autoCapitalize="none" />
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
                {engines.map(agent => <Pressable key={agent} accessibilityRole="checkbox" aria-checked={editing.agents.includes(agent)} accessibilityLabel={agent} accessibilityState={{ checked: editing.agents.includes(agent), disabled: !compatible(editing.protocol, agent) }} disabled={!compatible(editing.protocol, agent)}
                  onPress={() => setEditing({ ...editing, agents: editing.agents.includes(agent) ? editing.agents.filter(item => item !== agent) : [...editing.agents, agent] })}
                  style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: editing.agents.includes(agent) ? theme.colors.accent : theme.colors.border, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, opacity: compatible(editing.protocol, agent) ? 1 : 0.4 }}>
                  <Icon name={editing.agents.includes(agent) ? "SquareCheck" : "Square"} size={16} color={editing.agents.includes(agent) ? theme.colors.accent : theme.colors.foregroundMuted} /><Text style={{ ...color, fontSize: sizes.body }}>{agent}</Text>
                </Pressable>)}
              </View>
              <Text style={{ ...muted, lineHeight: 20 }}>{t("Codex 需要 OpenAI Responses 协议；Claude 需要 Anthropic Messages 协议。灰色选项表示与当前协议不兼容。")}</Text>
              <SettingsSwitch label={t("启用供应商")} hint={t("新建或重新打开会话时生效")} value={editing.enabled} onValueChange={enabled => setEditing({ ...editing, enabled })} />
            </Panel>
          </View>
        </ModalScrollView>
        <View style={{ paddingHorizontal: layout.compact ? 12 : 20, paddingVertical: 12, flexShrink: 0, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {!layout.compact ? <Text style={{ ...muted, flex: 1, lineHeight: 18 }}>{t("新建或重新打开会话时生效")}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", flexGrow: 1, gap: 8 }}>
            {button(t("取消"), closeEditor, false, false, undefined, true)}
            {button(busy ? t("正在保存…") : t("保存供应商"), () => void store(), false, true, "Check")}
          </View>
        </View>
      </Modal.Content> : null}
    </Modal>
    <Modal title={t("创建 Agent")} open={launch !== null} onOpenChange={open => { if (!open && !busy) setLaunch(null); }}>
      {launch ? <Modal.Content contentContainerStyle={{ padding: layout.compact ? 12 : 20, gap: 16 }}>
        <Panel theme={theme} title={launch.name} icon="Network" right={<Tag theme={theme}>{protocolLabels[launch.protocol]}</Tag>}>
          <Text selectable numberOfLines={2} style={{ ...muted, fontFamily: mono }}>{launch.baseUrl}</Text>
        </Panel>
        <View style={rows}>
          <View style={{ flex: 1 }}><SettingsSelect<Engine> label="Agent" value={engine} options={launch.agents.map(value => ({ value, label: value }))} onValueChange={setEngine} /></View>
          <View style={{ flex: 1 }}><SettingsSelect label={t("模型")} value={model} options={launch.models.map(value => ({ value, label: value }))} onValueChange={setModel} /></View>
        </View>
        <Field theme={theme} label={t("工作目录")} hint={t("填写当前服务器上的绝对路径")} placeholder="/path/to/project" value={cwd} onChangeText={setCwd} autoCapitalize="none" />
        <Field theme={theme} label={t("初始任务")} hint={t("可留空，创建后再发送")} placeholder={t("描述希望 Agent 完成的工作…")} value={prompt} onChangeText={setPrompt} multiline />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          {button(t("取消"), () => setLaunch(null))}{button(busy ? t("正在创建…") : t("创建 Agent"), () => void create(), false, true, "ArrowUpRight")}
        </View>
      </Modal.Content> : null}
    </Modal>
  </View>;
}
