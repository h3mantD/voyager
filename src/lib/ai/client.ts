/**
 * Unified AI client — calls Groq, OpenAI, or Anthropic based on config.
 * All three support an OpenAI-compatible chat completions API (Groq and OpenAI natively,
 * Anthropic via their messages API with a different format).
 */

import { type AIConfig, PROVIDER_INFO } from "./config";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export async function callAI(
  config: AIConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, messages);
  }
  // Groq and OpenAI both use the OpenAI-compatible API
  return callOpenAICompatible(config, messages);
}

async function callOpenAICompatible(
  config: AIConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  const info = PROVIDER_INFO[config.provider];

  const response = await fetch(`${info.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `${info.name} API error (${response.status}): ${error}`,
    );
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content ?? "",
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

async function callAnthropic(
  config: AIConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  // Separate system message from user/assistant messages
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(
    `${PROVIDER_INFO.anthropic.baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        ...(systemMessage ? { system: systemMessage.content } : {}),
        messages: chatMessages,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content =
    data.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("") ?? "";

  return {
    content,
    usage: data.usage
      ? {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        }
      : undefined,
  };
}
