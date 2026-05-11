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

    // Debug: test CCTV fetch
    if (url.pathname === "/api/debug") {
      const date = url.searchParams.get("date") || "20260507";
      const step = url.searchParams.get("step") || "list";

      if (step === "episode") {
        // Fetch the full episode page
        const episodeUrl = url.searchParams.get("url");
        if (!episodeUrl) return jsonResponse({ error: "Missing url param" }, 400);
        const resp = await fetch(episodeUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9",
            Referer: "https://tv.cctv.com/lm/xwlb/",
          },
        });
        const body = await resp.text();
        const linkRegex = /href\s*=\s*["']([^"']*VIDE[^"']*\.shtml)["']/gi;
        const links: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(body)) !== null) {
          links.push(m[1]);
        }
        const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
        const contentMatch = body.match(/<div[^>]*id\s*=\s*["']content_area["'][^>]*>([\s\S]*?)<\/div>/i);
        return jsonResponse({
          status: resp.status,
          bodyLength: body.length,
          title: titleMatch ? titleMatch[1] : "",
          linkCount: links.length,
          links,
          hasContentArea: !!contentMatch,
          contentPreview: contentMatch ? stripHtmlDebug(contentMatch[1]).slice(0, 1000) : "",
          bodyPreview: body.slice(0, 3000),
        });
      }

      // Default: fetch daily list page
      const testUrl = `https://tv.cctv.com/lm/xwlb/day/${date}.shtml`;
      const resp = await fetch(testUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-CN,zh;q=0.9",
          Referer: "https://tv.cctv.com/lm/xwlb/",
        },
      });
      const body = await resp.text();
      const linkRegex = /href\s*=\s*["']([^"']*VIDE[^"']*\.shtml)["']/gi;
      const links: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(body)) !== null) {
        links.push(m[1]);
      }
      return jsonResponse({
        status: resp.status,
        bodyLength: body.length,
        linkCount: links.length,
        links,
        bodyPreview: body.slice(0, 2000),
      });
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
    // 1. Fetch today's transcript (CCTV publishes by 20:00)
    const result = await fetchDailyTranscript(dateOverride);
    if (!result.success) {
      return { ok: false, error: result.error || "Failed to fetch transcript" };
    }

    console.log(`Fetched ${result.titles.length} articles, ${result.content.length} chars`);

    // 2. Skip if already summarized (retry guard — don't waste API calls)
    const storage = new Storage(env.DB);
    const existing = await storage.getByDate(result.date);
    if (existing && existing.summary) {
      console.log(`Skipping ${result.date}: already summarized`);
      return { ok: true, summary: existing.summary.slice(0, 200) };
    }

    // 3. Get the active AI model
    const model = getModel(env);

    // 4. Summarize
    const summaryResult = await summarizeNews(result.content, result.date, model);
    console.log(`Summarized with ${summaryResult.model}`);

    // 5. Store to database
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

function stripHtmlDebug(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
