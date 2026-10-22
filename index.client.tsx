import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ProvidersScreen } from "./client/providers";
function Entry({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return <SidebarRow icon="Network" active={currentScreen?.screenId === "providers"} onPress={() => openScreen({ screenId: "providers" })} />;
}
export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "providers", title: "Model providers · 模型供应商", Component: ProvidersScreen });
  client.addSidebarHeaderItem({ id: "providers", title: "Model providers · 模型供应商", Component: Entry });
  client.addCommandCenterItem({ id: "open-providers", title: "Manage model providers · 管理模型供应商", icon: "Network", context: "global", onSelect: ({ openScreen }) => openScreen({ screenId: "providers" }) });
  return () => {};
}
