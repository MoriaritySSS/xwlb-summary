// Cloudflare Workers compatible HTML parsing (no external deps)
export interface FetchResult {
  date: string;
  content: string;
  titles: string[];
  success: boolean;
  error?: string;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Fetch 新闻联播 transcript from CCTV website.
 * Based on the proven approach from bigger124/xin-wen-lian-bo.
 */
export async function fetchDailyTranscript(date?: string): Promise<FetchResult> {
  const targetDate = date || formatDate(new Date());
  const readableDate = `${targetDate.slice(0, 4)}-${targetDate.slice(4, 6)}-${targetDate.slice(6, 8)}`;

  try {
    return await fetchFromCCTV(targetDate, readableDate);
  } catch (e) {
    return {
      date: readableDate,
      content: "",
      titles: [],
      success: false,
      error: String(e),
    };
  }
}

async function fetchFromCCTV(
  date: string,
  readableDate: string,
): Promise<FetchResult> {
  // Step 1: Fetch the daily list page
  const listUrl = `https://tv.cctv.com/lm/xwlb/day/${date}.shtml`;
  const listResp = await fetch(listUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://tv.cctv.com/lm/xwlb/",
    },
    cf: { cacheTtl: 3600 },
  });

  if (!listResp.ok) {
    return { date: readableDate, content: "", titles: [], success: false, error: `List page returned ${listResp.status}` };
  }

  const listHtml = await listResp.text();

  // Step 2: Extract all article links
  const links = extractAllLinks(listHtml);
  if (links.length === 0) {
    return { date: readableDate, content: "", titles: [], success: false, error: "No article links found" };
  }

  // First link is the abstract, rest are individual news
  const abstractUrl = links[0];
  const articleUrls = links.slice(1);

  // Step 3: Fetch abstract
  const abstractContent = await fetchAndParseAbstract(abstractUrl);

  // Step 4: Fetch individual news articles
  const contents: string[] = abstractContent ? [abstractContent] : [];
  const titles: string[] = [];

  const maxArticles = Math.min(articleUrls.length, 25);
  for (let i = 0; i < maxArticles; i++) {
    try {
      const html = await fetchUrl(articleUrls[i]);
      if (!html) continue;

      const title = extractTitle(html);
      const content = extractContent(html);
      if (title) titles.push(title);
      if (content) contents.push(`【${title || "新闻"}】\n${content}`);
    } catch {
      // Skip failed articles
    }
  }

  if (contents.length === 0) {
    return { date: readableDate, content: "", titles: [], success: false, error: "No content extracted" };
  }

  return {
    date: readableDate,
    content: contents.join("\n\n"),
    titles,
    success: true,
  };
}

// ---- Link extraction ----

function extractAllLinks(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  // Match <a href="..."> patterns for CCTV video pages
  const regex = /<a\s[^>]*href\s*=\s*["']([^"']*VIDE[^"']*\.shtml)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith("http")) {
      url = `https:${url.startsWith("/") ? "" : "//"}${url}`;
    }
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

// ---- Content parsing (regex-based, Workers compatible) ----

async function fetchUrl(url: string): Promise<string | null> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!resp.ok) return null;
  return await resp.text();
}

async function fetchAndParseAbstract(url: string): Promise<string | null> {
  const html = await fetchUrl(url);
  if (!html) return null;

  // Extract from the abstract content area
  // Pattern: #page_body > ... > li:nth-child(1) > p
  const contentMatch = html.match(
    /<div\s[^>]*class\s*=\s*["'][^"']*nrjianjie[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
  );
  if (contentMatch) {
    return stripHtml(contentMatch[1])
      .replace(/；/g, "；\n\n")
      .replace(/：/g, "：\n\n");
  }

  // Fallback: try to find any paragraph in the content area
  const fallback = html.match(/<div\s[^>]*id\s*=\s*["']content_area["'][^>]*>([\s\S]*?)<\/div>/i);
  if (fallback) {
    return stripHtml(fallback[1]).slice(0, 2000);
  }

  return null;
}

function extractTitle(html: string): string {
  // Try the specific title selector first
  const titMatch = html.match(/<div\s[^>]*class\s*=\s*["'][^"']*tit["'][^>]*>([\s\S]*?)<\/div>/i);
  if (titMatch) {
    return stripHtml(titMatch[1]).replace(/\[视频\]/g, "").trim();
  }

  // Fallback: <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].replace(/[-_]\s*CCTV.*/, "").trim() : "";
}

function extractContent(html: string): string {
  // Primary: #content_area div
  const match = html.match(/<div\s[^>]*id\s*=\s*["']content_area["'][^>]*>([\s\S]*?)<\/div>/i);
  if (match) {
    return stripHtml(match[1]).slice(0, 3000);
  }

  // Fallback: extract all text from body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]).slice(0, 2000);
  }

  return "";
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
