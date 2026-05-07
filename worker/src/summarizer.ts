import { ModelAdapter } from "./models/base";
import { buildChatMessages } from "./prompts";

export interface SummarizeResult {
  date: string;
  summary: string;
  model: string;
  tokenUsage?: number;
}

/**
 * Summarize a long news transcript using AI.
 * Splits content into chunks if needed, summarizes each, then combines.
 */
export async function summarizeNews(
  rawContent: string,
  date: string,
  model: ModelAdapter,
): Promise<SummarizeResult> {
  const maxChunkSize = 6000; // chars per chunk
  const chunks = splitContent(rawContent, maxChunkSize);

  let summary: string;

  if (chunks.length === 1) {
    // Single chunk: summarize directly
    const messages = [
      { role: "system" as const, content: buildChatMessages(rawContent, date).system },
      { role: "user" as const, content: buildChatMessages(chunks[0], date).user },
    ];
    summary = await model.chat(messages, { maxTokens: 2048 });
  } else {
    // Multiple chunks: summarize each, then combine
    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const messages = [
        {
          role: "system" as const,
          content: `请用 200 字以内简要总结这段新闻联播文字稿（第 ${i + 1}/${chunks.length} 部分）。只提取关键信息点。`,
        },
        { role: "user" as const, content: chunks[i] },
      ];
      const chunkSummary = await model.chat(messages, { maxTokens: 500 });
      chunkSummaries.push(chunkSummary);
    }

    // Combine chunk summaries
    const combined = chunkSummaries.join("\n\n");
    const messages = [
      {
        role: "system" as const,
        content: buildChatMessages(combined, date).system,
      },
      {
        role: "user" as const,
        content: `以下是今日新闻联播的分段摘要，请按格式合并总结：\n\n${combined}`,
      },
    ];
    summary = await model.chat(messages, { maxTokens: 2048 });
  }

  return {
    date,
    summary,
    model: model.name,
  };
}

function splitContent(content: string, maxSize: number): string[] {
  if (content.length <= maxSize) return [content];

  const chunks: string[] = [];
  const paragraphs = content.split(/\n{2,}/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
