# 新闻联播自动摘要 - 考公助手

每日自动抓取新闻联播文字稿，使用 AI 总结考公重点，推送到微信。

## 架构

```
frontend.tonbi.workers.dev (React) → xwlb-summary.tonbi.workers.dev (Worker API)
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                           CCTV抓取   DeepSeek AI   Server酱推送
```

## 目录结构

```
worker/          # Cloudflare Worker 后端
  src/
    index.ts     # Worker 入口（Cron + HTTP API）
    fetcher.ts   # CCTV 文字稿抓取
    summarizer.ts # AI 摘要模块
    models/      # 多模型适配器（DeepSeek / 自定义）
    pusher.ts    # Server 酱微信推送
    storage.ts   # D1 数据库操作
    prompts.ts   # 考公 Prompt 模板
fallback/        # 本地 Python 备选方案
  main.py        # AkShare + DeepSeek + Server酱
frontend-v2/     # React + Vite + Tailwind 前端
```

## 部署

### 后端 Worker
```bash
cd worker
npm install
npx wrangler d1 create xwlb-db
npx wrangler d1 execute xwlb-db --remote --file=./schema.sql
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put SERVERCHAN_SEND_KEY
npx wrangler deploy
```

### 前端
```bash
cd frontend-v2
npm install
npm run build
npx wrangler pages deploy dist --project-name=xwlb-frontend
```

## API

| 接口 | 说明 |
|------|------|
| `/api/list?limit=30` | 最新摘要列表 |
| `/api/news?date=2026-05-05` | 按日期查详情 |
| `/api/search?q=关键词` | 全文搜索 |
| `/api/trigger?date=YYYYMMDD` | 手动触发 |

## 限制

- Cloudflare Workers 免费层：10 万请求/天，5 个 Cron 触发器
- Server 酱免费：5 条推送/天
- 数据仅供学习参考，版权归 CCTV 所有
