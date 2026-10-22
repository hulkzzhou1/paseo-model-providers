# Paseo model providers

[简体中文](README.zh-CN.md)

Manage API endpoints and models for multiple coding agents from one Paseo screen. Keep existing subscription logins available and use custom API providers for separate sessions.

![Provider screen with sample data](assets/providers-en.png)

## Supported protocols

| API protocol | Agents |
| --- | --- |
| Anthropic Messages | Claude Code, OpenCode, Pi, OMP |
| OpenAI Responses | Codex, Pi, OMP |
| OpenAI Chat Completions | OpenCode, Pi, OMP |

Protocols are not converted. For example, Codex requires an endpoint implementing Responses. Anthropic authentication supports x-api-key or Bearer tokens.

## Setup

Requires Paseo **0.12.0+** on the daemon and clients, with the agent CLIs already installed and visible to the daemon. Enable plugins on the intended host, then install from GitHub:

```bash
paseo plugin add git:hulkzzhou1/paseo-model-providers --ref v0.1.0
```

Open **Model providers · 模型供应商** in the sidebar. The screen has an **English / 简体中文** selector and initially follows the device locale.

1. Select **Add provider** and enter its name, unique ID, protocol, API base URL and key.
2. Select **Fetch models**, search the catalog and choose models to enable. Use manual model IDs if the endpoint has no catalog API.
3. Select compatible agents and save. For Pi/OMP, enter the model's context and output limits.
4. Run **Test connection**, then **Create agent** with an absolute working directory on the daemon. Generated provider entries also appear in Paseo's normal agent picker.

![Provider editor with sample data](assets/editor-en.png)

Changes apply to new or reopened sessions. Existing sessions do not switch endpoints live. Custom APIs use the selected provider's API quota, independently of official subscriptions.

## Credentials and data

Keys are plaintext in the daemon's `PASEO_HOME/model-providers/suppliers.json` (directory 700, file 600) and generated Paseo provider environment configuration. Saved keys never return to the screen; a blank key during editing preserves the saved value. Official authentication files are not read or rewritten.

Catalog requests and tests contact the endpoint you configure. Tests send a short prompt and tool definition and can incur API charges. Started agents send prompts, code context and tool results to that provider according to the CLI's behavior. There is no plugin telemetry service. Read [the full data and compatibility notes](OVERVIEW.md) before connecting a provider.

## Validation and limitations

The automated suite covers adapter configuration for all five agents, catalog pagination and failures, protocol request construction, key redaction, concurrent edit detection, rollback, alias collisions, file permissions, generated extensions and translations. Desktop/mobile layout checks use synthetic data and a preview harness; they are not native-device certification.

Real supplier streaming and complete agent tool/MCP workflows have not been verified across all five engines. Connection tests check basic response structure, not a full agent workflow. Pi/OMP custom models currently use text input, no extra reasoning and unknown pricing. The wide desktop editor has a documented compatibility workaround for Paseo 0.12's dialog structure.

## Development

```bash
npm ci --include=dev --ignore-scripts
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-model-providers
# After editing an installed checkout:
paseo plugin reload model-providers
```

Paseo provides runtime libraries; there are no runtime downloads or build commands. Generated credentials and configuration live outside this repository. The license is [MIT](LICENSE).
