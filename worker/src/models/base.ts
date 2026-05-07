export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelAdapter {
  name: string;
  chat(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<string>;
}

export function createOpenAICompatibleModel(config: ModelConfig): ModelAdapter {
  const { baseURL, apiKey, model, maxTokens: defaultMaxTokens, temperature: defaultTemp } = config;

  return {
    name: model,
    async chat(messages, options) {
      const resp = await fetch(`${baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options?.maxTokens ?? defaultMaxTokens ?? 2048,
          temperature: options?.temperature ?? defaultTemp ?? 0.3,
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Model API error (${resp.status}): ${err}`);
      }

      const data = (await resp.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0]?.message?.content ?? "";
    },
  };
}
