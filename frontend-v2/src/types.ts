export interface NewsSummary {
  id: number;
  date: string;
  summary: string;
  tags: string;
  created_at: string;
}

export interface NewsDetail extends NewsSummary {
  raw_content: string;
}
