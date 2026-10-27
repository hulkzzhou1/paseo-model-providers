import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ProvidersScreen } from "./client/providers";
import { getSystemLanguage } from "./client/language";
import { translate } from "./client/messages";

export default function contribute(client: PluginClientContext) {
  const title = translate("模型供应商", getSystemLanguage());
  client.addSettingsScreen({ id: "providers", title, icon: "Network", Component: ProvidersScreen });
  client.addCommandCenterItem({ id: "open-providers", title, icon: "Network", context: "global", onSelect: ({ openSettings }) => openSettings("providers") });
  return () => {};
}
