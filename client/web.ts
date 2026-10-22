import { Platform } from "react-native";

declare const navigator: { languages?: readonly string[] } | undefined;
declare const window: {
  addEventListener(type: "languagechange", listener: () => void): void;
  removeEventListener(type: "languagechange", listener: () => void): void;
} | undefined;

export function getBrowserLocales(): readonly string[] {
  return Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.languages ?? [] : [];
}

export function watchBrowserLanguage(listener: () => void): () => void {
  if (Platform.OS !== "web" || typeof window === "undefined") return () => {};
  window.addEventListener("languagechange", listener);
  return () => window?.removeEventListener("languagechange", listener);
}
