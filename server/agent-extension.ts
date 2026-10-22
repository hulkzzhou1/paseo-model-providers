export default function(api: { registerProvider: (name: string, config: Record<string, unknown>) => void }) {
  const raw = process.env.PASEO_MODEL_CONFIG;
  if (!raw) return;
  const config = JSON.parse(raw);
  api.registerProvider(config.id, {
    baseUrl: config.baseUrl,
    apiKey: process.env.PASEO_MODEL_KEY,
    api: config.api,
    ...(config.api === "anthropic-messages" && config.anthropicAuth === "bearer" ? { headers: { Authorization: `Bearer ${process.env.PASEO_MODEL_KEY}` } } : {}),
    models: config.models.map((id: string) => ({
      id, name: id, reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.contextWindow, maxTokens: config.maxTokens,
    })),
  });
}
