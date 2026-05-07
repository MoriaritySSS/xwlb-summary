import { D1Database } from "@cloudflare/workers-types";

export interface NewsRecord {
  id?: number;
  date: string;
  raw_content: string;
  summary: string;
  tags: string;
  created_at?: string;
}

/**
 * Storage layer wrapping Cloudflare D1 database
 */
export class Storage {
  constructor(private db: D1Database) {}

  async saveDailyNews(record: NewsRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO daily_news (date, raw_content, summary, tags)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         raw_content = excluded.raw_content,
         summary = excluded.summary,
         tags = excluded.tags`
      )
      .bind(record.date, record.raw_content, record.summary, record.tags)
      .run();
  }

  async getByDate(date: string): Promise<NewsRecord | null> {
    const result = await this.db
      .prepare("SELECT * FROM daily_news WHERE date = ?")
      .bind(date)
      .first<NewsRecord>();
    return result || null;
  }

  async listRecent(limit = 30): Promise<NewsRecord[]> {
    const { results } = await this.db
      .prepare("SELECT id, date, summary, tags, created_at FROM daily_news ORDER BY date DESC LIMIT ?")
      .bind(limit)
      .all<NewsRecord>();
    return results || [];
  }

  async search(keyword: string, limit = 20): Promise<NewsRecord[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, date, summary, tags, created_at
       FROM daily_news
       WHERE summary LIKE ? OR raw_content LIKE ? OR tags LIKE ?
       ORDER BY date DESC LIMIT ?`
      )
      .bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, limit)
      .all<NewsRecord>();
    return results || [];
  }
}
