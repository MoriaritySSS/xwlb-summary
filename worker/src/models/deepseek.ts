import { createOpenAICompatibleModel, ModelAdapter } from "./base";

export function createDeepSeekModel(
  apiKey: string,
  model = "deepseek-chat"
): ModelAdapter {
  return createOpenAICompatibleModel({
    baseURL: "https://api.deepseek.com",
    apiKey,
    model,
    maxTokens: 4096,
    temperature: 0.3,
  });
}
