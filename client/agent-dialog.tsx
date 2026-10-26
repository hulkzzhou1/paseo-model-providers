import { useState } from "react";
import { View, Text } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { Modal, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsSelect } from "@getpaseo/plugin/client/ui";
import { Action, Field, Panel, Tag, mono, sizes } from "./ui";
import { translate, type Language } from "./messages";
import { aliasId, modelId, type Engine, type PublicSupplier } from "../shared/contracts";
import { protocolLabels } from "./supplier-detail";

export function AgentDialog({ theme, layout, navigation, language, supplier: launch, onClose }: Pick<PluginScreenProps, "theme" | "layout" | "navigation"> & {
  language: Language; supplier: PublicSupplier; onClose(): void;
}) {
  const paseo = usePaseo(), toast = useToast();
  const t = (message: string) => translate(message, language);
  const [engine, setEngine] = useState<Engine>(launch.agents[0]);
  const [model, setModel] = useState(launch.models[0]);
  const [cwd, setCwd] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const muted = { color: theme.colors.foregroundMuted, fontSize: sizes.caption };
  const rows = { flexDirection: layout.compact ? "column" as const : "row" as const, gap: 10 };
  async function create() {
    if (!cwd.startsWith("/") || !model || !launch.agents.includes(engine)) { toast.error(t("请选择 Agent、模型并填写服务器上的绝对工作目录")); return; }
    setBusy(true);
    try {
      const agent = await paseo.agents.create({ cwd, config: { provider: `${aliasId(launch.id, engine)}/${modelId(launch, engine, model)}` }, ...(prompt.trim() ? { prompt: prompt.trim() } : {}), title: `${launch.name} · ${model}` });
      onClose(); navigation?.openAgent({ agentId: agent.id }); toast.show(t("Agent 已创建"), { variant: "success" });
    } catch { toast.error(t("创建失败，请检查工作目录、Agent 安装状态及供应商配置；不会修改现有会话")); }
    finally { setBusy(false); }
  }
  return <Modal title={t("创建 Agent")} open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <Modal.Content contentContainerStyle={{ padding: layout.compact ? 12 : 16, gap: 12 }}>
        <Panel theme={theme} title={launch.name} icon="Network" right={<Tag theme={theme}>{protocolLabels[launch.protocol]}</Tag>}>
          <Text selectable numberOfLines={2} style={{ ...muted, fontFamily: mono }}>{launch.baseUrl}</Text>
        </Panel>
        <View style={rows}>
          <View style={{ flex: 1 }}><SettingsSelect<Engine> label="Agent" value={engine} disabled={busy} options={launch.agents.map(value => ({ value, label: value }))} onValueChange={setEngine} /></View>
          <View style={{ flex: 1 }}><SettingsSelect label={t("模型")} value={model} disabled={busy} options={launch.models.map(value => ({ value, label: value }))} onValueChange={setModel} /></View>
        </View>
        <Field theme={theme} label={t("工作目录")} hint={t("填写当前服务器上的绝对路径")} placeholder="/path/to/project" value={cwd} editable={!busy} onChangeText={setCwd} autoCapitalize="none" />
        <Field theme={theme} label={t("初始任务")} hint={t("可留空，创建后再发送")} placeholder={t("描述希望 Agent 完成的工作…")} value={prompt} editable={!busy} onChangeText={setPrompt} multiline />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Action theme={theme} label={t("取消")} onPress={onClose} disabled={busy} quiet />
          <Action theme={theme} label={busy ? t("正在创建…") : t("创建 Agent")} onPress={() => void create()} disabled={busy} primary icon="ArrowUpRight" />
        </View>
      </Modal.Content>
    </Modal>;
}
