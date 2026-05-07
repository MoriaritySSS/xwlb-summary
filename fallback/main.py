"""
新闻联播自动摘要 - 本地 Python 备选方案
依赖: akshare, openai, requests
运行: python main.py [日期 YYYYMMDD，默认今天]

需要设置环境变量:
  DEEPSEEK_API_KEY    DeepSeek API Key
  SERVERCHAN_SEND_KEY Server酱 SendKey
"""

import os
import sys
from datetime import datetime

import akshare as ak
from openai import OpenAI


def fetch_transcript(date_str: str) -> tuple[str, str]:
    """从 AkShare 获取新闻联播文字稿"""
    df = ak.news_cctv(date=date_str)
    if df.empty:
        raise ValueError(f"未找到 {date_str} 的新闻联播数据")

    content = "\n\n".join(
        f"【{row['title']}】\n{row['content']}"
        for _, row in df.iterrows()
    )
    readable = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    return readable, content


def summarize(content: str, date: str) -> str:
    """调用 DeepSeek API 进行考公导向总结"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("请设置环境变量 DEEPSEEK_API_KEY")

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    system_prompt = """你是一位资深的公务员考试（考公）备考导师，擅长分析《新闻联播》内容并提炼考试要点。

请对以下新闻联播文字稿进行总结，用中文输出，按以下结构组织：

## 今日要闻速览
用 3-5 句话概括今日最重要的新闻。

## 政策风向标
提取涉及的新政策、新提法、领导人讲话要点。

## 关键数据
列出文中出现的经济数据、统计数字，并简述其意义。

## 国际动态
梳理外交活动、国际关系变动、重要国际会议等。

## 申论素材积累
提取 2-3 个可作为申论大作文论点的素材。

## 行测常识提醒
列出可能出现在行测常识判断中的知识点。

要求：
- 每条要点简洁有力，控制在 100-200 字
- 专业术语保留原名
- 总数控制在 800 字以内"""

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"以下是{date}《新闻联播》的文字稿，请按格式总结：\n\n{content}"},
        ],
        max_tokens=2048,
        temperature=0.3,
    )
    return response.choices[0].message.content


def push_wechat(title: str, content: str) -> None:
    """通过 Server酱 推送到微信"""
    send_key = os.environ.get("SERVERCHAN_SEND_KEY")
    if not send_key:
        print("警告: 未设置 SERVERCHAN_SEND_KEY，跳过微信推送")
        return

    import requests

    resp = requests.post(
        f"https://sctapi.ftqq.com/{send_key}.send",
        data={"title": title, "desp": content},
        timeout=10,
    )
    result = resp.json()
    if result.get("code") != 0:
        print(f"推送失败: {result}")
    else:
        print("微信推送成功")


def main():
    date_str = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y%m%d")

    print(f"正在获取 {date_str} 新闻联播...")
    readable_date, content = fetch_transcript(date_str)
    print(f"获取成功: {len(content)} 字")

    print("正在 AI 总结...")
    summary = summarize(content, readable_date)
    print(f"总结完成:\n{summary}")

    title = f"📰 新闻联播摘要 {readable_date[5:]}"
    push_wechat(title, summary)

    # 保存本地
    os.makedirs("output", exist_ok=True)
    with open(f"output/{date_str}.txt", "w", encoding="utf-8") as f:
        f.write(f"## 原始文字稿\n\n{content}\n\n## AI 摘要\n\n{summary}")
    print(f"已保存到 output/{date_str}.txt")


if __name__ == "__main__":
    main()
