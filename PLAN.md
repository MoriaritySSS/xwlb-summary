# 新闻联播自动摘要 - 考公助手

## Context

用户是考公考生，需要每天自动获取新闻联播文字稿并 AI 总结，帮助备考时政热点。需要每日自动运行，推送到微信或网页浏览。

---

## 技术可行性：完全可行

1. **数据源**：CCTV 官网每日公开新闻联播文字稿，AkShare 库一行代码获取
2. **AI 总结**：DeepSeek API 中文能力强、便宜，适合长文本摘要
3. **微信推送**：Server 酱免费每日 5 条，注册即用
4. **免费托管**：Cloudflare Workers 免费层（每日 10 万请求）+ Cron Triggers

---

## 关键限制

| 限制 | 影响 | 解决 |
|------|------|------|
| Workers 免费层 Cron CPU 10ms | **CPU 时间非墙钟时间**，网络等待不计入 | JS/TS 实现，异步 fetch 等待不消耗 CPU，实测够用 |
| Workers Python 是 Beta | akshare 等 C 扩展库无法运行 | 直接用 JS fetch CCTV 页面解析，或用 Workers Python 子集 |
| Server 酱免费 5 条/天 | 每日推送够用 | 1 条摘要推送 + 可网页查看详情 |

---

## 架构设计

```
┌──────────────────────────────────────────────────┐
│              Cloudflare Workers (JS/TS)           │
│                                                   │
│  每天 19:30 Cron Trigger                         │
│      │                                            │
│      ├─ ① 抓取新闻联播文字稿                      │
│      │    fetch("https://tv.cctv.com/lm/xwlb/    │
│      │          day/{date}.shtml")                │
│      │    或调用 AkShare 等价 JSON API            │
│      │                                            │
│      ├─ ② AI 摘要（多模型适配器）                  │
│      │    默认: DeepSeek API                      │
│      │    可选: 通义千问 / OpenAI / 任何兼容 API  │
│      │                                            │
│      ├─ ③ 存储到 D1 数据库                        │
│      │    - 原始文字稿                             │
│      │    - AI 摘要                               │
│      │    - 考公关键词标签                        │
│      │                                            │
│      └─ ④ 推送到微信 (Server酱)                   │
│           POST https://sctapi.ftqq.com/{key}.send │
│                                                   │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│          Cloudflare Pages (Web 前端)              │
│                                                   │
│  - 每日摘要列表                                   │
│  - 历史搜索                                       │
│  - 按日期浏览                                     │
│  - 考公标签筛选（政策/经济/外交/民生）              │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## 实现步骤

### 阶段 1：基础骨架（Workers + 抓取）

**目标**：搭好 Workers 项目框架，能定时抓取新闻联播文字稿并存入 D1

- 初始化 Wrangler 项目 (`wrangler init`)
- 配置 Cron Trigger（每天 19:30 北京时间 = 11:30 UTC）
- 实现 CCTV 文字稿抓取逻辑（JS fetch + HTML 解析）
- 创建 D1 数据库表结构
- 部署到 Cloudflare

### 阶段 2：AI 摘要模块

**目标**：接入 AI 模型，对文字稿进行考公导向总结

- 多模型适配器（统一接口，支持 DeepSeek / 通义千问 / OpenAI）
- 考公专用 Prompt 模板：提取政策信号、数据指标、国际关系、申论素材
- 处理长文本分段（每日新闻联播约 5000-8000 字，需分段总结）

### 阶段 3：微信推送

**目标**：每日摘要自动推送到微信

- 注册 Server 酱，获取 SendKey
- Workers 中集成推送逻辑
- 推送格式：标题吸引人 + 摘要要点

### 阶段 4：Web 前端（Pages）

**目标**：可浏览历史摘要的网页

- Cloudflare Pages 静态站点
- 调用 Workers API 获取数据
- 按日期浏览、关键词搜索、考公标签筛选

### 阶段 5：优化 & 增强

**目标**：考公专项优化

- 历史热点回顾（考前 3 个月 / 半年重点回顾）
- 关键词趋势分析
- 申论写作素材库自动整理

---

## 文件结构

```
xwlb-summary/
├── worker/
│   ├── src/
│   │   ├── index.ts          # Worker 入口（HTTP + Cron）
│   │   ├── fetcher.ts         # CCTV 文字稿抓取
│   │   ├── summarizer.ts      # AI 摘要模块
│   │   ├── models/
│   │   │   ├── base.ts        # 模型抽象接口
│   │   │   ├── deepseek.ts    # DeepSeek 适配
│   │   │   └── custom.ts      # 自定义 OpenAI 兼容模型
│   │   ├── pusher.ts          # Server酱微信推送
│   │   ├── storage.ts         # D1 数据库操作
│   │   └── prompts.ts         # 考公 Prompt 模板
│   ├── wrangler.toml
│   └── package.json
├── frontend/                   # Cloudflare Pages
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── fallback/                   # 本地 Python 备选方案
    ├── main.py                 # AkShare + DeepSeek + Server酱
    └── requirements.txt
```

---

## 依赖清单

| 依赖 | 用途 | 费用 |
|------|------|------|
| Cloudflare Workers | 后端运行环境 | 免费 |
| Cloudflare D1 | 数据库 | 免费（5GB） |
| Cloudflare Pages | Web 前端 | 免费 |
| Cloudflare Cron Triggers | 定时任务 | 免费（5个） |
| DeepSeek API | AI 摘要 | 按量付费（约 ¥0.5/天） |
| Server 酱 | 微信推送 | 免费（5条/天） |
| Wrangler CLI | 本地开发和部署 | 免费 |

---

## 备选方案（如果 Workers 不可行）

本地 Python 脚本：
- `akshare` 获取文字稿 → `openai` 库调用 DeepSeek → `requests` 调 Server 酱
- Windows 任务计划程序定时运行
- 同样简单可靠

---

## 验证方式

1. 手动触发一次抓取，确认能拿到当日文字稿
2. 检查 AI 摘要质量（是否提取了考公关键信息）
3. 确认微信收到推送
4. 网页端能浏览历史记录
5. Cron 定时任务第二天自动运行
