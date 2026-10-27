import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const messages = ts.transpileModule(await readFile(new URL('./messages.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const imports = {
  './client/providers': 'export const ProvidersScreen = () => null;',
  './client/language': 'export const getSystemLanguage = () => globalThis.entryTestLanguage;',
  './client/messages': messages,
};
const code = ts.transpileModule(await readFile(new URL('../index.client.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace(/from "([^"]+)"/g, (match, name) => {
    assert(Object.hasOwn(imports, name), 'Unexpected entry runtime import: ' + name);
    return 'from ' + JSON.stringify(dataUrl(imports[name]));
  });
const { default: contribute } = await import(dataUrl(code));
try {
  for (const [language, title] of [['en', 'Model providers'], ['zh-CN', '模型供应商']]) {
    globalThis.entryTestLanguage = language;
    let settings, command, opened;
    contribute({
      addSettingsScreen(value) { settings = value; },
      addCommandCenterItem(value) { command = value; },
      addScreen() { assert.fail('Provider management must live in settings'); },
      addSidebarHeaderItem() { assert.fail('No homepage sidebar entry'); },
      addSidebarFooterItem() { assert.fail('No homepage sidebar entry'); },
    });
    assert.equal(settings.id, 'providers');
    assert.equal(settings.title, title);
    assert.equal(settings.icon, 'Network');
    assert.equal(typeof settings.Component, 'function');
    assert.equal(command.id, 'open-providers');
    assert.equal(command.title, title);
    command.onSelect({ openSettings(id) { opened = id; }, openScreen() { assert.fail('Shortcut must open settings'); } });
    assert.equal(opened, settings.id);
  }
} finally { delete globalThis.entryTestLanguage; }
console.log('PASS: settings-only entry, no homepage sidebar, localized labels and Command Center settings navigation');
