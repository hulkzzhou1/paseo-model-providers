import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
const module = ts.transpileModule(await readFile(new URL('./messages.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { translate, resolveLanguage } = await import('data:text/javascript;base64,' + Buffer.from(module.outputText).toString('base64'));
for (const [locales, expected] of [
  [[], 'en'], [['en-US'], 'en'], [['zh'], 'zh-CN'], [['zh-CN'], 'zh-CN'],
  [['zh-Hans-SG'], 'zh-CN'], [['ZH-cn'], 'zh-CN'], [['zh-TW'], 'en'],
  [['zh-Hant-HK'], 'en'], [['fr-FR'], 'en'], [['fr-FR', 'zh-CN'], 'zh-CN'],
  [['en-US', 'zh-CN'], 'en'], [['zh-CN', 'en-US'], 'zh-CN'],
]) assert.equal(resolveLanguage(locales), expected, locales.join(', '));
let checked = 0;
for (const file of (await readdir(new URL('.', import.meta.url))).filter(file => file.endsWith('.tsx'))) {
  const source = ts.createSourceFile(file, await readFile(new URL('./' + file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isStringLiteral(node) && /[\u4e00-\u9fff]/.test(node.text)) {
      const text = node.text;
      assert.equal(translate(text, 'zh-CN'), text);
      assert(!/[\u4e00-\u9fff]/.test(translate(text, 'en')), 'Missing English translation: ' + text);
      checked++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
assert(checked > 70);
for(const message of [
 '列表由供应商返回，不代表模型调用权限或推理兼容性已验证。',
 '供应商没有返回可用目录项，可手动填写。',
]) assert(!/[\u4e00-\u9fff]/.test(translate(message,'en')),'Missing catalog translation: '+message);
assert.match(translate('无法获取模型（HTTP 403），可手动填写模型 ID。', 'en'), /HTTP 403/);
assert.match(translate('接口返回 HTTP 401，请检查地址、凭据和模型权限', 'en'), /HTTP 401/);
assert.equal(translate('Provider returned a custom error', 'en'), 'Provider returned a custom error');
assert.match(translate('Request failed: 配置已被其他窗口修改，请刷新后重试 code=handler_error', 'en'), /Refresh and try again/);
console.log('PASS: system language resolution, English and Chinese UI coverage, HTTP status messages and raw error preservation');
