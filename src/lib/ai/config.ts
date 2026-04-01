/**
 * AI provider configuration — stored in chrome.storage.local.
 * Supports Groq, OpenAI, and Anthropic.
 * Models are fetched dynamically from each provider's API.
 */

export type AIProvider = "groq" | "openai" | "anthropic";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface ProviderInfo {
  name: string;
  defaultModel: string;
  baseUrl: string;
}

export const PROVIDER_INFO: Record<AIProvider, ProviderInfo> = {
  groq: {
    name: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-5-20250514",
    baseUrl: "https://api.anthropic.com",
  },
};

// ── Model Fetching ──────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
}

/**
 * Fetch available models from the provider's API.
 * Requires a valid API key. Returns sorted model list.
 */
export async function fetchModels(
  provider: AIProvider,
  apiKey: string,
): Promise<ModelInfo[]> {
  if (!apiKey) return [];

  try {
    if (provider === "anthropic") {
      return await fetchAnthropicModels(apiKey);
    }
    return await fetchOpenAICompatibleModels(provider, apiKey);
  } catch (error) {
    console.warn(
      `[Voyager] Failed to fetch models from ${provider}:`,
      error,
    );
    return [];
  }
}

/** OpenAI and Groq both use GET /v1/models */
async function fetchOpenAICompatibleModels(
  provider: AIProvider,
  apiKey: string,
): Promise<ModelInfo[]> {
  const info = PROVIDER_INFO[provider];
  const response = await fetch(`${info.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const models: ModelInfo[] = (data.data ?? [])
    .map((m: { id: string; owned_by?: string }) => ({
      id: m.id,
      name: m.id,
      owned_by: m.owned_by,
    }))
    .filter((m: ModelInfo) => {
      if (provider === "openai") {
        // Filter to chat models only (skip embeddings, tts, dall-e, whisper, etc.)
        return /^(gpt-|o[1-9]|chatgpt)/.test(m.id);
      }
      return true;
    })
    .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));

  return models;
}

/** Anthropic uses GET /v1/models */
async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(
    `${PROVIDER_INFO.anthropic.baseUrl}/v1/models`,
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    },
  );

  if (!response.ok) return [];

  const data = await response.json();
  const models: ModelInfo[] = (data.data ?? [])
    .map((m: { id: string; display_name?: string }) => ({
      id: m.id,
      name: m.display_name || m.id,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));

  return models;
}

// ── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "voyager-ai-config";

export async function getAIConfig(): Promise<AIConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const config = result[STORAGE_KEY] as AIConfig | undefined;
  if (!config?.apiKey) return null;
  return config;
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

export async function clearAIConfig(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
