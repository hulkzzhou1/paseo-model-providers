import { useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View, Text, Pressable } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon, Modal, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { ModelPicker } from "./model-picker";
import { Action, Field, FormSection, Tag, sizes } from "./ui";
import { translate, type Language } from "./messages";
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
export function ProvidersScreen({ theme, layout, navigation }: PluginScreenProps) {
  const [language, setLanguage] = useState<Language>(() => Intl.DateTimeFormat().resolvedOptions().locale.startsWith("zh") ? "zh-CN" : "en");
  const t = (message: string) => translate(message, language);
  const paseo = usePaseo();
  const load = useRpc(stateRpc), save = useRpc(saveRpc), probe = useRpc(probeRpc), discover = useRpc(discoverRpc);
  const state = useQuery({ queryKey: ["model-suppliers"], queryFn: () => load({}), retry: false });
  const available = useQuery({ queryKey: ["supplier-engines"], queryFn: () => paseo.providers.listAvailable(), retry: false });
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [revision, setRevision] = useState("");
  const [existing, setExisting] = useState(false);
  const [key, setKey] = useState("");
  const [modelsText, setModelsText] = useState("");
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
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
  const rows = { flexDirection: layout.compact ? "column" as const : "row" as const, gap: 16 };
  const suppliers = state.data?.suppliers ?? [];
  const installed = available.data?.providers.filter(item => item.available) ?? [];
  function button(label: string, action: () => void, disabled = false, primary = false, icon?: string) {
    return <Action theme={theme} label={label} onPress={action} disabled={disabled || busy} primary={primary} icon={icon} />;
  }
  function resetCatalog() { requestSequence.current++; setCatalog([]); setCatalogMessage(""); }
  function closeEditor() { requestSequence.current++; setEditing(null); setKey(""); }
  async function loadModels() {
    if (!editing) return;
    const sequence = ++requestSequence.current;
    setBusy(true); setCatalogMessage("");
    try {
      const response = await discover({ id: existing ? editing.id : undefined, baseUrl: editing.baseUrl, protocol: editing.protocol, anthropicAuth: editing.anthropicAuth, key: key || undefined });
      if (sequence === requestSequence.current) { setCatalog(response.models); setCatalogMessage(t(response.message)); }
    } catch { if (sequence === requestSequence.current) setCatalogMessage(t("请填写有效的接口地址后再获取，也可以手动填写模型 ID。")); }
    finally { setBusy(false); }
  }
  function edit(item?: PublicSupplier) {
    requestSequence.current++; setCatalog([]); setCatalogMessage("");
    setExisting(Boolean(item)); setEditing(item ? { ...item } : { ...fresh }); setModelsText(item?.models.join("\n") ?? ""); setKey(""); setRevision(state.data?.revision ?? "");
  }
  async function store() {
    if (!editing) return;
    const parsed = supplierSchema.safeParse({ ...editing, models: [...new Set(modelsText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean))] });
    if (!parsed.success) { toast.error(parsed.error.issues.map(item => `${item.path.join('.')}: ${t(item.message)}`).join("\n")); return; }
    setBusy(true);
    try { await save({ ...parsed.data, key: key || undefined, revision }); closeEditor(); await state.refetch(); await available.refetch(); toast.show(t("已保存；可在新建 Agent 的供应商列表中选择"), { variant: "success" }); }
    catch (error) { toast.error(error instanceof Error ? t(error.message) : t("保存失败")); }
    finally { setBusy(false); }
  }
  async function test(item: PublicSupplier) {
    setBusy(true); setResult(null);
    try { const response = await probe({ id: item.id, model: item.models[0] }); setResult({ id: item.id, ok: response.ok, message: t(response.message) }); }
    catch { setResult({ id: item.id, ok: false, message: t("测试失败，请检查供应商配置") }); }
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
  return <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: layout.compact ? 16 : 32 }}>
    <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", gap: 24 }}>
      <View style={{ ...rows, alignItems: layout.compact ? "stretch" : "center", justifyContent: "space-between" }}>
        <View style={{ gap: 8, flex: 1 }}>
          <Text accessibilityRole="header" style={{ ...color, fontSize: sizes.title, fontWeight: "600", letterSpacing: -0.5 }}>{t("模型供应商")}</Text>
          <Text style={{ ...muted, fontSize: sizes.body, lineHeight: 22 }}>{t("一个接口，多种 Agent。为每个会话选择合适的模型。")}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <SettingsSelect<Language> label="Language / 语言" value={language} options={[{ value: "en", label: "English" }, { value: "zh-CN", label: "简体中文" }]} onValueChange={setLanguage} />
          {button(t("刷新"), () => { void state.refetch(); void available.refetch(); }, false, false, "RefreshCw")}
          {button(t("新增供应商"), () => edit(), !state.data, true, "Plus")}
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: sizes.radius, borderWidth: 1, borderColor: theme.colors.border }}>
        <Icon name="ShieldCheck" size={18} color={theme.colors.foregroundMuted} />
        <Text style={{ ...muted, flex: 1, lineHeight: 20 }}><Text style={{ ...color, fontWeight: "500" }}>{t("官方订阅独立保留")}</Text> {t("· 原有登录和 Agent 预设继续可用；自定义接口使用对应供应商的 API 额度。")}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text accessibilityRole="header" style={{ ...color, fontSize: sizes.heading, fontWeight: "600" }}>{t("已配置接口")}</Text>
          {state.data ? <Text style={muted}>{suppliers.length} {t("个供应商 ·")} {suppliers.filter(item => item.enabled).length} {t("个启用")}</Text> : null}
        </View>
        {state.isPending ? <View style={{ padding: 40, alignItems: "center", gap: 12 }}><ActivityIndicator color={theme.colors.accent} /><Text style={muted}>{t("正在读取供应商配置…")}</Text></View> : null}
        {state.isError ? <View style={{ padding: 24, gap: 12, alignItems: "flex-start", borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.radius }}>
          <Text style={{ color: theme.colors.statusDanger }}>{t("无法读取供应商配置")}</Text><Text style={muted}>{t("请检查当前主机连接后重试。")}</Text>{button(t("重新加载"), () => void state.refetch(), false, false, "RefreshCw")}
        </View> : null}
        {state.data && suppliers.length === 0 ? <View style={{ padding: layout.compact ? 28 : 48, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border, borderRadius: sizes.radius, alignItems: "center", gap: 14 }}>
          <View style={{ padding: 14, backgroundColor: theme.colors.surface1, borderRadius: 12 }}><Icon name="Network" size={26} color={theme.colors.foregroundMuted} /></View>
          <Text style={{ ...color, fontSize: sizes.heading, fontWeight: "500" }}>{t("接入你的第一个模型接口")}</Text>
          <Text style={{ ...muted, lineHeight: 21, maxWidth: 400, textAlign: "center" }}>{t("点击右上方「新增供应商」，填写接口和模型，选择可接入的 Agent 即可开始。")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 }}>{[t("01 填写接口"), t("02 选择 Agent"), t("03 创建会话")].map(label => <Tag key={label} theme={theme}>{label}</Tag>)}</View>
        </View> : null}
        {suppliers.map(item => <View key={item.id} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: sizes.radius, backgroundColor: theme.colors.surface1, overflow: "hidden" }}>
          <View style={{ padding: layout.compact ? 16 : 20, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{ width: 38, height: 38, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: "center", justifyContent: "center" }}><Icon name="Network" size={18} color={theme.colors.foregroundMuted} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ ...color, fontSize: sizes.heading, fontWeight: "600" }}>{item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.enabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted }} /><Text style={muted}>{item.enabled ? t("已启用") : t("已停用")}</Text></View>
                </View>
                <Text selectable style={{ ...muted, lineHeight: 18 }} numberOfLines={2}>{item.baseUrl}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Tag theme={theme}>{item.protocol === "anthropic" ? "Anthropic Messages" : item.protocol === "responses" ? "OpenAI Responses" : "Chat Completions"}</Tag>
              {item.agents.map(agent => <Tag key={agent} theme={theme}>{agent}</Tag>)}
            </View>
            <View style={rows}>
              <View style={{ flex: 1, gap: 6 }}><Text style={muted}>{t("模型 ·")} {item.models.length}</Text><Text style={{ ...color, fontSize: sizes.body, lineHeight: 21 }} numberOfLines={2}>{item.models.join(" · ")}</Text></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name={item.hasKey ? "KeyRound" : "Key"} size={14} color={theme.colors.foregroundMuted} /><Text style={muted}>{item.hasKey ? t("凭据已保存") : t("无凭据")}</Text></View>
            </View>
          </View>
          <View style={{ paddingHorizontal: layout.compact ? 16 : 20, paddingVertical: 12, borderTopWidth: 1, borderColor: theme.colors.border, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
            {button(t("编辑"), () => edit(item), false, false, "Settings2")}
            {button(t("测试连接"), () => void test(item), false, false, "PlugZap")}
            {button(t("创建 Agent"), () => { setLaunch(item); setEngine(item.agents[0]); setModel(item.models[0]); setPrompt(""); }, !item.enabled, false, "ArrowUpRight")}
          </View>
          {result?.id === item.id ? <View accessibilityRole="alert" style={{ borderTopWidth: 1, borderColor: theme.colors.border, padding: 16, flexDirection: "row", gap: 8 }}>
            <Icon name={result.ok ? "CircleCheck" : "CircleAlert"} size={16} color={result.ok ? theme.colors.statusSuccess : theme.colors.statusDanger} />
            <Text style={{ ...muted, flex: 1, lineHeight: 20 }}>{result.message}</Text>
          </View> : null}
        </View>)}
      </View>

      <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 20, gap: 12 }}>
        <Text style={muted}>{t("当前主机可用的 Agent")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{installed.map(item => <Tag key={item.provider} theme={theme}>{item.provider}</Tag>)}</View>
        {available.isPending ? <Text style={muted}>{t("正在检测…")}</Text> : available.isError || available.data?.error ? <Text style={muted}>{t("检测失败，可点击页面顶部刷新重试。")}</Text> : installed.length === 0 ? <Text style={muted}>{t("当前没有检测到可用的 Agent。")}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t("展开或收起使用说明")} accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(!helpOpen)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
          <Icon name={helpOpen ? "ChevronDown" : "ChevronRight"} size={14} color={theme.colors.foregroundMuted} /><Text style={muted}>{t("计费与兼容性说明")}</Text>
        </Pressable>
        {helpOpen ? <Text style={{ ...muted, lineHeight: 21 }}>{t("连接测试会向接口发送简短请求和工具定义，可能消耗少量 Token。测试通过不代表完整开发、MCP 或工具执行已验证。Pi/OMP 暂按文本输入、无额外推理、费用未知配置。")}</Text> : null}
      </View>
    </View>

    <Modal title={existing ? t("编辑供应商") : t("新增供应商")} open={editing !== null} onOpenChange={open => { if (!open && !busy) closeEditor() }}>
      {editing ? <Modal.Content contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 28 }}>
        <EditorDialogWidth compact={layout.compact} />
        <FormSection theme={theme} step="01" title={t("连接设置")} description={t("选择接口协议，填写供应商提供的基础地址与凭据。")}>
          <View style={rows}>
            <Field theme={theme} label={t("显示名称")} placeholder={t("例如：内部模型网关")} value={editing.name} onChangeText={name => setEditing({ ...editing, name })} />
            <Field theme={theme} label={t("供应商标识")} hint={existing ? t("保存后不可修改") : t("小写字母、数字与连字符")} placeholder="internal-gateway" value={editing.id} editable={!existing && !busy} onChangeText={id => setEditing({ ...editing, id })} />
          </View>
          <SettingsSelect label={t("接口协议")} value={editing.protocol} options={[{ value: "anthropic", label: "Anthropic Messages" }, { value: "responses", label: "OpenAI Responses" }, { value: "chat-completions", label: "OpenAI Chat Completions" }]} onValueChange={protocol => { resetCatalog(); setEditing({ ...editing, protocol, agents: editing.agents.filter(agent => compatible(protocol, agent)) }); }} />
          <Field theme={theme} label={t("API 基础地址")} placeholder="https://example.com/v1" value={editing.baseUrl} onChangeText={baseUrl => { resetCatalog(); setEditing({ ...editing, baseUrl }); }} autoCapitalize="none" />
          {editing.protocol === "anthropic" ? <SettingsSelect label={t("鉴权方式")} value={editing.anthropicAuth} options={[{ value: "api-key", label: "API Key（x-api-key）" }, { value: "bearer", label: t("Bearer Token（内部网关）") }]} onValueChange={anthropicAuth => { resetCatalog(); setEditing({ ...editing, anthropicAuth }); }} /> : null}
          <Field theme={theme} label={t("API 密钥")} hint={existing ? t("留空沿用已保存的凭据，密钥不会回显") : t("凭据保存在当前服务器；无需认证的接口可留空")} placeholder={existing ? t("已保存的密钥不会显示") : t("输入 API Key")} value={key} onChangeText={value => { resetCatalog(); setKey(value); }} secureTextEntry autoCapitalize="none" />
        </FormSection>
        <FormSection theme={theme} step="02" title={t("模型与 Agent")} description={t("选择启用的模型，以及与接口协议兼容的 Agent。")}>
          <ModelPicker t={t} theme={theme} selectedText={modelsText} onChange={setModelsText} catalog={catalog} message={catalogMessage} busy={busy} onLoad={() => void loadModels()} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {engines.map(agent => <Pressable key={agent} accessibilityRole="checkbox" aria-checked={editing.agents.includes(agent)} accessibilityLabel={agent} accessibilityState={{ checked: editing.agents.includes(agent), disabled: !compatible(editing.protocol, agent) }} disabled={!compatible(editing.protocol, agent)}
              onPress={() => setEditing({ ...editing, agents: editing.agents.includes(agent) ? editing.agents.filter(item => item !== agent) : [...editing.agents, agent] })}
              style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: editing.agents.includes(agent) ? theme.colors.accent : theme.colors.border, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, opacity: compatible(editing.protocol, agent) ? 1 : 0.4 }}>
              <Icon name={editing.agents.includes(agent) ? "SquareCheck" : "Square"} size={16} color={editing.agents.includes(agent) ? theme.colors.accent : theme.colors.foregroundMuted} /><Text style={{ ...color, fontSize: sizes.body }}>{agent}</Text>
            </Pressable>)}
          </View>
          <Text style={{ ...muted, lineHeight: 20 }}>{t("Codex 需要 OpenAI Responses 协议；Claude 需要 Anthropic Messages 协议。灰色选项表示与当前协议不兼容。")}</Text>
          {editing.agents.some(agent => agent === "pi" || agent === "omp") ? <View style={{ gap: 10 }}>
            <Text style={muted}>{t("Pi / OMP 模型容量，按实际规格填写")}</Text>
            <View style={rows}>
              <Field theme={theme} label={t("上下文窗口")} hint="Token" value={String(editing.contextWindow)} onChangeText={value => setEditing({ ...editing, contextWindow: Number(value) })} keyboardType="number-pad" />
              <Field theme={theme} label={t("最大输出")} hint="Token" value={String(editing.maxTokens)} onChangeText={value => setEditing({ ...editing, maxTokens: Number(value) })} keyboardType="number-pad" />
            </View>
          </View> : null}
        </FormSection>
        <View style={{ gap: 16, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 16 }}>
          <SettingsSwitch label={t("启用供应商")} hint={t("新建或重新打开会话时生效")} value={editing.enabled} onValueChange={enabled => setEditing({ ...editing, enabled })} />
          <Text style={{ ...muted, lineHeight: 20 }}>{t("保存后将新增独立的 Paseo 接入入口，官方订阅保持原样。已有会话不会热切换。")}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            {button(t("取消"), closeEditor)}
            {button(busy ? t("正在保存…") : t("保存供应商"), () => void store(), false, true, "Check")}
          </View>
        </View>
      </Modal.Content> : null}
    </Modal>
    <Modal title={t("创建 Agent")} open={launch !== null} onOpenChange={open => { if (!open && !busy) setLaunch(null); }}>
      {launch ? <Modal.Content contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 24 }}>
        <View style={{ padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, gap: 6 }}><Text style={{ ...color, fontSize: sizes.heading, fontWeight: "500" }}>{launch.name}</Text><Text style={muted}>{launch.baseUrl}</Text></View>
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
  </ScrollView>;
}
