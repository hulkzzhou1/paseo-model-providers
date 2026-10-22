# Paseo 模型供应商

[English](README.md)

在一个 Paseo 页面中管理多种 Agent 的模型接口与模型列表，保留现有官方订阅登录，为独立会话选择自定义 API。

![供应商管理页，使用示例数据](assets/providers-zh-CN.png)

## 支持范围

| API 协议 | Agent |
| --- | --- |
| Anthropic Messages | Claude Code、OpenCode、Pi、OMP |
| OpenAI Responses | Codex、Pi、OMP |
| OpenAI Chat Completions | OpenCode、Pi、OMP |

不做协议转换。例如 Codex 需要供应商实现 Responses 接口。Anthropic 可选择 x-api-key 或 Bearer Token 鉴权。

## 安装与使用

Paseo daemon 和客户端均需 **0.12.0+**，所选 Agent CLI 需预先安装并对 daemon 可见。在目标宿主启用插件后执行：

```bash
paseo plugin add git:hulkzzhou1/paseo-model-providers --ref v0.1.0
```

从侧边栏打开 **Model providers · 模型供应商**。页面提供 **English / 简体中文** 选择，首次进入按设备默认语言显示。

1. 点击「新增供应商」，填写名称、唯一标识、协议、API 基础地址和密钥。
2. 点击「获取供应商模型」，搜索并勾选启用模型；没有模型列表接口时可手动填写模型 ID。
3. 选择兼容的 Agent 后保存。Pi/OMP 需要按模型规格填写上下文与输出上限。
4. 执行「测试连接」，再通过「创建 Agent」填写服务器绝对工作目录启动。也可在 Paseo 原生创建入口选择生成的供应商。

![供应商编辑弹窗，使用示例数据](assets/editor-zh-CN.png)

配置在新建或重新打开会话时生效，进行中的会话不会热切换。自定义 API 使用对应供应商额度，与官方订阅独立计费。

## 凭据与数据

密钥以明文存储在 daemon 的 `PASEO_HOME/model-providers/suppliers.json`（目录权限 700、文件权限 600）及生成的 Paseo Provider 环境配置中。页面不会回显密钥，编辑时留空沿用原密钥。插件不读取或改写官方认证文件。

模型查询和连接测试会访问你配置的接口。测试会发送简短提示词与工具定义，可能产生 API 费用。启动 Agent 后，提示词、代码上下文和工具结果会按 CLI 行为发送到该供应商。插件无遥测服务。完整说明见[数据与兼容性说明](OVERVIEW.zh-CN.md)。

## 验证与限制

自动化测试覆盖五种 Agent 的配置适配、模型分页与异常、协议请求、凭据隐藏、并发修改检测、失败回滚、配置冲突、文件权限、扩展生成及翻译。桌面和手机布局使用示例数据及预览环境验证，不代表原生设备认证。

尚未针对所有 Agent 完成真实供应商的流式响应、工具执行及 MCP 全流程验证。连接测试仅检查基础响应结构。Pi/OMP 当前按文本输入、无额外推理、费用未知注册模型。桌面加宽弹窗使用了针对 Paseo 0.12 宿主结构的兼容处理。

## 本地开发

```bash
npm ci --include=dev --ignore-scripts
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-model-providers
# 修改已安装的项目后：
paseo plugin reload model-providers
```

运行依赖由 Paseo 提供，无运行时下载或构建步骤。凭据与生成配置存储在仓库外。采用 [MIT 许可证](LICENSE)。
