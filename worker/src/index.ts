import { fetchDailyTranscript } from "./fetcher";
import { summarizeNews } from "./summarizer";
import { pushToWeChat, formatPushContent } from "./pusher";
import { Storage } from "./storage";
import { createDeepSeekModel } from "./models/deepseek";
import { createCustomModel } from "./models/custom";
import { ModelAdapter } from "./models/base";

export interface Env {
  // Database
  DB: D1Database;

  // AI Model configs
  DEEPSEEK_API_KEY?: string;
  CUSTOM_MODEL_BASE_URL?: string;
  CUSTOM_MODEL_API_KEY?: string;
  CUSTOM_MODEL_NAME?: string;

  // Push config
  SERVERCHAN_SEND_KEY?: string;

  // Runtime config
  ACTIVE_MODEL?: "deepseek" | "custom";
  DISABLE_PUSH?: string;
  ENVIRONMENT?: string;
}

export default {
  /**
   * Cron trigger: runs daily at 11:30 UTC (19:30 Beijing time)
   */
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runDailyPipeline(env);
  },

  /**
   * HTTP handler: API for the web frontend
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Manual trigger for daily pipeline (optional ?date=YYYYMMDD)
    if (url.pathname === "/api/trigger") {
      const date = url.searchParams.get("date") || undefined;
      const result = await runDailyPipeline(env, date);
      return jsonResponse(result);
    }

    // API: list recent summaries
    if (url.pathname === "/api/list") {
      const limit = parseInt(url.searchParams.get("limit") || "30");
      const storage = new Storage(env.DB);
      const records = await storage.listRecent(limit);
      return jsonResponse(records);
    }

    // API: search
    if (url.pathname === "/api/search") {
      const q = url.searchParams.get("q") || "";
      if (!q) return jsonResponse({ error: "Missing query parameter 'q'" }, 400);
      const storage = new Storage(env.DB);
      const records = await storage.search(q);
      return jsonResponse(records);
    }

    // API: get by date
    if (url.pathname === "/api/news") {
      const date = url.searchParams.get("date") || "";
      if (!date) return jsonResponse({ error: "Missing parameter 'date' (YYYY-MM-DD)" }, 400);
      const storage = new Storage(env.DB);
      const record = await storage.getByDate(date);
      if (!record) return jsonResponse({ error: "Not found" }, 404);
      return jsonResponse(record);
    }

    // Test fetch only (no AI, no push)
    if (url.pathname === "/api/test-fetch") {
      const date = url.searchParams.get("date") || undefined;
      const result = await fetchDailyTranscript(date);
      return jsonResponse(result);
    }

    // Health check
    if (url.pathname === "/api/health") {
      return jsonResponse({ status: "ok", time: new Date().toISOString() });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

async function runDailyPipeline(env: Env, dateOverride?: string): Promise<{ ok: boolean; error?: string; summary?: string }> {
  try {
    // 1. Fetch today's transcript
    const result = await fetchDailyTranscript(dateOverride);
    if (!result.success) {
      return { ok: false, error: result.error || "Failed to fetch transcript" };
    }

    console.log(`Fetched ${result.titles.length} articles, ${result.content.length} chars`);

    // 2. Get the active AI model
    const model = getModel(env);

    // 3. Summarize
    const summaryResult = await summarizeNews(result.content, result.date, model);
    console.log(`Summarized with ${summaryResult.model}`);

    // 4. Store to database
    const storage = new Storage(env.DB);
    await storage.saveDailyNews({
      date: result.date,
      raw_content: result.content,
      summary: summaryResult.summary,
      tags: "",
    });

    // 5. Push to WeChat
    if (env.DISABLE_PUSH !== "true" && env.SERVERCHAN_SEND_KEY) {
      const { title, body } = formatPushContent(result.date, summaryResult.summary);
      const pushResult = await pushToWeChat(title, body, {
        sendKey: env.SERVERCHAN_SEND_KEY,
      });
      if (!pushResult.success) {
        console.error(`Push failed: ${pushResult.error}`);
      }
    }

    return { ok: true, summary: summaryResult.summary.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function getModel(env: Env): ModelAdapter {
  const active = env.ACTIVE_MODEL || "deepseek";

  if (active === "custom" && env.CUSTOM_MODEL_API_KEY && env.CUSTOM_MODEL_BASE_URL) {
    return createCustomModel({
      baseURL: env.CUSTOM_MODEL_BASE_URL,
      apiKey: env.CUSTOM_MODEL_API_KEY,
      model: env.CUSTOM_MODEL_NAME || "default",
    });
  }

  // Default: DeepSeek
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required. Set it via `npx wrangler secret put DEEPSEEK_API_KEY`");
  }
  return createDeepSeekModel(env.DEEPSEEK_API_KEY);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
