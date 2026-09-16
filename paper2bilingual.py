#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
论文 -> 「中英对照 + 大白话解读」HTML

两种用法：
  1) 只抽取文本（不需要 API key）：
     python paper2bilingual.py paper.pdf --extract-only --out chunks.json

  2) 全流程（需要大模型 API）：
     set OPENAI_API_KEY=sk-xxx
     python paper2bilingual.py paper.pdf --out 解读.html
     python paper2bilingual.py paper.pdf --base-url https://api.deepseek.com --model deepseek-chat

兼容任何 OpenAI 格式的接口（OpenAI / DeepSeek / 月之暗面 / 通义 / 智谱 ...）
"""
import argparse
import json
import os
import re
import sys
import time

try:
    import pypdf
except ImportError:
    sys.exit("请先安装依赖：pip install -r requirements.txt")

HERE = os.path.dirname(os.path.abspath(__file__))

SYSTEM = """你是一位善于把硬核论文讲给外行听的中文科普作者，同时是严谨的学术翻译。
你的读者基础薄弱、没有专业背景。你的任务：把英文论文段落翻译成中文，并给出"大白话解释"。

要求：
1. 【翻译】忠实、通顺的中文学术表达，不要机翻腔。专有名词首次出现保留英文并加中文。
2. 【大白话】用生活类比、直觉、例子解释这段在说什么。禁止堆砌术语，禁止复述原文。
   必须让人"看完就知道这段在干嘛"。
3. 输出严格为 JSON，不要 markdown 代码围栏，不要任何多余文字。

输出格式：
{"zh": "中文翻译...", "tip": "大白话解释...", "skip": false}
如果这段是参考文献、致谢、版权声明、利益声明等无实质内容，输出 {"skip": true}。
"""

USER = """请处理下面这段论文原文（第 {page} 页）。

=== 原文开始 ===
{text}
=== 原文结束 ===
"""

HEAD_SYSTEM = """你是中文科普作者。给定一篇论文的标题、摘要和目录，请生成导读。
要求：用生活类比解释这篇论文在干什么，让人 30 秒看懂。
输出严格为 JSON（无代码围栏）：
{"one_line":"一句话总结（必填）","analogy_title":"类比小标题","analogy":"<p>类比正文HTML</p>","concepts":[["概念","人话解释"]],"roadmap":[["节号","讲什么","大白话"]]}
"""

HEAD_USER = """论文信息：
标题：{title}
摘要：
{abstract}

目录/前几页内容：
{toc}
"""


def clean(t):
    return "".join(c if (c in "\n\r\t" or ord(c) >= 32) else " " for c in t)


def extract_pages(pdf_path, layout=False):
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for p in reader.pages:
        raw = p.extract_text(extraction_mode="layout") if layout else p.extract_text()
        pages.append(clean(raw or ""))
    return pages


def split_chunks(text, max_chars=1600):
    """按空行分段落，再合并到 max_chars 以内。"""
    paras = [x.strip() for x in re.split(r"\n\s*\n", text) if x.strip()]
    paras = [re.sub(r"[ \t]+", " ", p) for p in paras]
    chunks, cur = [], ""
    for p in paras:
        if cur and len(cur) + len(p) > max_chars:
            chunks.append(cur)
            cur = p
        else:
            cur = (cur + "\n\n" + p).strip()
    if cur:
        chunks.append(cur)
    return chunks


def make_client(base_url, api_key):
    from openai import OpenAI
    return OpenAI(base_url=base_url or None, api_key=api_key)


def ask_json(client, model, system, user, retries=3):
    for i in range(retries):
        try:
            r = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                temperature=0.3,
            )
            s = r.choices[0].message.content.strip()
            s = re.sub(r"^```(?:json)?|```$", "", s, flags=re.M).strip()
            return json.loads(s)
        except Exception as e:
            print(f"  [warn] 第 {i+1} 次失败: {e}")
            time.sleep(3)
    return None


def build_html(meta, lead, sections, out_path):
    css = open(os.path.join(HERE, "style.css"), encoding="utf-8").read()

    def tipbox(t):
        return f'<div class="tip"><b>💡 人话：</b>{t}</div>' if t else ""

    nav = " · ".join(
        f'<a href="#{s["id"]}" style="color:#0f766e;font-size:13.5px">{s["nav"]}</a>'
        for s in sections)

    parts = [
        "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1.0'>",
        f"<title>{meta['title_zh']}</title>",
        f"<style>{css}</style></head><body><div class='wrap'>",
        "<div class='card'>",
        f"<h1>{meta['title_zh']}</h1>",
        f"<div class='sub'>{meta.get('title_en','')}</div>",
        "<div class='meta'>" + "".join(
            f"<span class='chip'>{c}</span>" for c in meta.get("chips", [])) + "</div>",
        "<div style='margin-top:16px' class='lead'>本文件 = <b>英文原文</b> + <b>中文翻译</b>（逐段对照）+ <b>大白话解读</b>（黄色框）。</div>",
        "</div>",
        "<div class='bar'><button onclick=\"document.body.classList.toggle('hide-en')\">"
        "切换：显示 / 隐藏英文原文</button><span>目录：</span>" + nav + "</div>",
    ]

    if lead:
        parts.append('<div class="card" id="lead"><h2>🧠 先说人话：这篇文章到底在讲啥</h2>')
        if lead.get("one_line"):
            parts.append(f'<div class="tip" style="font-size:16px"><b>一句话版本：</b>{lead["one_line"]}</div>')
        if lead.get("analogy"):
            if lead.get("analogy_title"):
                parts.append(f'<h3>{lead["analogy_title"]}</h3>')
            parts.append(lead["analogy"])
        if lead.get("concepts"):
            parts.append('<h3>必须记住的几个概念</h3><table>'
                         '<tr><th style="width:180px">概念</th><th>人话解释</th></tr>')
            for c in lead["concepts"]:
                parts.append(f"<tr><td><b>{c[0]}</b></td><td>{c[1]}</td></tr>")
            parts.append("</table>")
        if lead.get("roadmap"):
            parts.append('<h3>文章路线图</h3><table>'
                         '<tr><th style="width:60px">节</th><th>讲什么</th>'
                         '<th style="width:280px">大白话</th></tr>')
            for r in lead["roadmap"]:
                parts.append(f"<tr><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>")
            parts.append("</table>")
        parts.append("</div>")

    for s in sections:
        parts.append(f'<div class="card" id="{s["id"]}"><h2>{s["title"]}</h2>')
        for b in s["blocks"]:
            parts.append(
                '<div class="blk"><div class="pair">'
                f'<div class="en"><span class="tag">ENGLISH</span>{b["en"]}</div>'
                f'<div class="zh"><span class="tag">中文翻译</span>{b["zh"]}</div>'
                f'</div>{tipbox(b.get("tip",""))}</div>')
        parts.append("</div>")

    parts.append("<div class='foot'>本文件由 AI 生成，用于学习交流。原文版权归原作者与出版方所有。</div>")
    parts.append("</div></body></html>")

    html = "\n".join(parts)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return len(html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out", default=None)
    ap.add_argument("--base-url", default=os.getenv("OPENAI_BASE_URL", ""))
    ap.add_argument("--api-key", default=os.getenv("OPENAI_API_KEY", ""))
    ap.add_argument("--model", default=os.getenv("MODEL", "gpt-4o-mini"))
    ap.add_argument("--layout", action="store_true", help="双栏论文请加此参数")
    ap.add_argument("--extract-only", action="store_true", help="只抽取文本，不调用 API")
    ap.add_argument("--max-chars", type=int, default=1600)
    args = ap.parse_args()

    pdf = os.path.abspath(args.pdf)
    if not os.path.exists(pdf):
        sys.exit(f"找不到文件: {pdf}")
    out = args.out or (os.path.splitext(pdf)[0] + "_中英对照解读.html")

    print(f"[1/4] 读取 PDF ...")
    pages = extract_pages(pdf, layout=args.layout)
    print(f"      共 {len(pages)} 页")

    chunks = []
    for i, t in enumerate(pages):
        for c in split_chunks(t, args.max_chars):
            chunks.append({"page": i + 1, "en": c})
    print(f"[2/4] 切分为 {len(chunks)} 个片段")

    if args.extract_only:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False, indent=1)
        print(f"[done] 已导出文本 -> {out}")
        return

    if not args.api_key:
        sys.exit("缺少 API key。请设置环境变量 OPENAI_API_KEY，或用 --api-key 传入。\n"
                 "（不想用 API 也可以用 --extract-only 只导出文本）")

    client = make_client(args.base_url, args.api_key)
    title = os.path.splitext(os.path.basename(pdf))[0]

    print("[3/4] 生成导读 ...")
    lead = ask_json(client, args.model, HEAD_SYSTEM, HEAD_USER.format(
        title=title,
        abstract=(pages[1] if len(pages) > 1 else pages[0])[:3000],
        toc="\n".join(pages[:2])[:3000],
    )) or {}

    print(f"[4/4] 翻译 {len(chunks)} 个片段 ...")
    blocks = []
    for i, c in enumerate(chunks, 1):
        r = ask_json(client, args.model, SYSTEM, USER.format(page=c["page"], text=c["en"]))
        if not r or r.get("skip"):
            print(f"      ({i}/{len(chunks)}) 跳过")
            continue
        blocks.append({"en": c["en"].replace("\n\n", "<br><br>"),
                       "zh": r.get("zh", ""), "tip": r.get("tip", "")})
        print(f"      ({i}/{len(chunks)}) ok")
        time.sleep(0.4)

    meta = {"title_zh": title, "title_en": title,
            "chips": [f"共 {len(pages)} 页", f"模型：{args.model}"]}
    sections = [{"id": "s1", "nav": "全文", "title": title, "blocks": blocks}]
    n = build_html(meta, lead, sections, out)
    print(f"[done] {out}  ({n} chars)")


if __name__ == "__main__":
    main()
