export interface PushConfig {
  sendKey: string;
  endpoint?: string;
}

export interface PushResult {
  success: boolean;
  error?: string;
}

/**
 * Push summary to WeChat via ServerChan (Server酱)
 * API doc: https://sct.ftqq.com
 */
export async function pushToWeChat(
  title: string,
  content: string,
  config: PushConfig,
): Promise<PushResult> {
  const endpoint = config.endpoint || "https://sctapi.ftqq.com";

  try {
    const url = `${endpoint}/${config.sendKey}.send`;

    // ServerChan supports markdown in the "desp" field
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title,
        desp: content,
      }).toString(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: `Push failed (${resp.status}): ${err}` };
    }

    const result = (await resp.json()) as { code: number; message?: string };
    if (result.code !== 0) {
      return { success: false, error: result.message || "Unknown push error" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Format summary for WeChat push (simplified markdown)
 */
export function formatPushContent(
  date: string,
  summary: string,
): { title: string; body: string } {
  return {
    title: `📰 新闻联播摘要 ${date.slice(5)}`,
    body: summary
      // Ensure basic markdown compatibility with ServerChan
      .replace(/^#{1,3}\s/gm, "**")
      .replace(/\n$/, "")
      .slice(0, 4096), // ServerChan message limit
  };
}
