import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ProvidersScreen } from "./client/providers";
import { getSystemLanguage, useSystemLanguage } from "./client/language";
import { translate } from "./client/messages";
function Entry({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const language = useSystemLanguage();
  return <SidebarRow label={translate("模型供应商", language)} icon="Network" active={currentScreen?.screenId === "providers"} onPress={() => openScreen({ screenId: "providers" })} />;
}
export default function contribute(client: PluginClientContext) {
  const title = () => translate("模型供应商", getSystemLanguage());
  client.addScreen({ id: "providers", title, Component: ProvidersScreen });
  client.addSidebarHeaderItem({ id: "providers", title: title(), Component: Entry });
  client.addCommandCenterItem({ id: "open-providers", title: title(), icon: "Network", context: "global", onSelect: ({ openScreen }) => openScreen({ screenId: "providers" }) });
  return () => {};
}
