import { createOpenAICompatibleModel, ModelAdapter } from "./base";

export function createCustomModel(config: {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}): ModelAdapter {
  return createOpenAICompatibleModel(config);
}
