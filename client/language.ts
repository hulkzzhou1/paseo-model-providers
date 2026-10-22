import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { resolveLanguage } from "./messages";
import { getBrowserLocales, watchBrowserLanguage } from "./web";

export function getSystemLanguage() {
  const locales = getBrowserLocales();
  return resolveLanguage(locales.length ? locales : [Intl.DateTimeFormat().resolvedOptions().locale]);
}

export function useSystemLanguage() {
  // shortcut: Paseo 0.12 has no public app-language API; adopt it when released.
  const [language, setLanguage] = useState(getSystemLanguage);
  useEffect(() => {
    const update = () => setLanguage(getSystemLanguage());
    const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
    const unwatch = watchBrowserLanguage(update);
    update();
    return () => { subscription.remove(); unwatch(); };
  }, []);
  return language;
}
