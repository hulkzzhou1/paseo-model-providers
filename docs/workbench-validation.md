# Supplier workbench validation

The workbench adopts the compact toolbars, list/detail separation, neutral panels and draft protection used by the local TAPD and Gongfeng plugins. It keeps Paseo's own modal presentation and existing 0.12 SDK contract.

## Changed boundaries

- `client/providers.tsx`: host queries, provider selection, refresh and connection-test results.
- `client/providers-state.ts`: provider search and enabled-status filtering, covered by `npm test`.
- `client/supplier-list.tsx`: selectable provider rows with visible status and keyboard focus.
- `client/supplier-detail.tsx`: endpoint, credentials status, model mappings, effective configured limits and agent settings.
- `client/supplier-editor.tsx`: isolated connection/model/agent draft, discovery, validation, save and discard confirmation.
- `client/agent-dialog.tsx`: isolated agent creation and retry state.
- `client/ui.tsx`: shared dimensions, typography, themed surfaces, actions and fields. Desktop controls remain 32px and touch controls 44px.

No server, RPC contract, provider adapter, persisted supplier schema or generated configuration changed. Existing API keys are never supplied to the client. The editor no longer changes the host modal's DOM width.

## Checks

`npm run typecheck`, `npm test` and `git diff --check` pass. Translation checks now inspect Chinese string literals in every client TSX file, including labels stored in tab arrays. Provider filtering tests cover URL, model alias, mapped API ID, agent, combined status filters, empty results and preservation of the original records.

Browser checks render the actual components with synthetic React Native, Paseo and RPC fixtures. They are interaction and layout checks, not native-device certification or real supplier inference tests.

Validated viewport widths: 320, 375, 820, 1000 and 1280px. Coverage includes English, Simplified Chinese and a dark theme:

1. Search by provider name, endpoint and model; combine search with enabled-status tabs. Show a useful empty state and recover when clearing the filter.
2. Select a provider, inspect its model routing and per-model limits, search its models, and return to the list on narrow screens. Disabled providers cannot create agents.
3. Close an untouched editor directly. Change a name or mapping, dismiss the editor, continue editing, and confirm the draft remains. Confirm discard removes it.
4. Add, remove and load models. Keep manual mappings and capacities after repeated or failed loads. Switch tabs without resetting drafts; validation selects the relevant tab.
5. Fail a save, retain the draft, then retry successfully. During deferred discovery or save, inputs and save/cancel are disabled and host dismissal cannot close the form.
6. Fail agent creation, retain the directory, then retry. Verify the selected supplier/model is passed to the agent SDK.
7. Load 100 model rows at 320 and 1280px. Adding another row is disabled; the last model remains reachable and the save footer stays in the viewport while the model list scrolls.
8. Check loading, empty and error states, keyboard tab activation, visible input focus, fixed footer position and horizontal overflow.

The screenshots in `assets/` use synthetic endpoints, model IDs and credentials status. Local runtime verification reloads only `model-providers`; it does not restart the daemon, rewrite saved suppliers or send inference requests.
