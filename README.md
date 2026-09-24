<div align="center">

<h1>📄 文献翻译器 · wxfyq</h1>

<p><b>把一篇英文文献 PDF，变成一个可以离线打开的学习笔记</b></p>

<p>按 Keshav《How to Read a Paper》的<b>三遍法</b>读文献：先扫读决定要不要读，再读懂内容，最后虚拟复现</p>

<p>英文原文 · 中文翻译 · 大白话解读，三段并排，一眼看懂</p>

<br>

<p><b>👉 <a href="https://hean-zky.github.io/wxfyq/">打开网页版：上传 PDF → 启动翻译 → 下载笔记</a></b></p>

<br>

![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-97CA00?style=flat-square)
![Actions](https://img.shields.io/badge/GitHub%20Actions-自动翻译-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Offline](https://img.shields.io/badge/输出-单文件%20HTML%20离线可用-orange?style=flat-square)

</div>

---

## 长什么样

生成的就是一个 HTML 文件，双击就能打开，不用联网：

| 左栏 | 右栏 | 下面黄框 |
|:---|:---|:---|
| 英文原文 | 中文翻译 | 💡 **大白话解释** |

> 顶部还有两个按钮：**一键隐藏英文**（只看中文）、**🌙 / ☀️ 日夜切换**（换主题）。

黄框里写的是"人话"——不是翻译，是真的给你讲明白：

> 公式 `L ∝ √t` → **"水往里爬的距离 = 常数 × √时间，也就是越爬越慢：1 秒爬 1 毫米，4 秒才 2 毫米。"**

---

## 四种用法，挑一个

| 方式 | 难度 | 适合谁 |
|:---|:---|:---|
| **0. 网页版**（推荐） | ⭐ | 马上用，不用配置任何东西 |
| **A. 网页上传**（本仓库） | ⭐ | 不想装东西、偶尔用一次 |
| **B. 本地命令行** | ⭐⭐⭐ | 论文多、想批量处理 |
| **C. WorkBuddy 技能** | ⭐ | 用 WorkBuddy 的话，拖进去说一句就行 |

---

## 0. 网页版（推荐，30 秒上手）

打开 **<https://hean-zky.github.io/wxfyq/>**，然后：

1. 点 **📄 上传原文 PDF**（电脑、手机上下载的都行，也可以直接把文件拖进去）
2. **选阅读深度**（三遍法四档，见下表——不确定就选「② 读懂」）
3. 填一次你的大模型 API Key（只存在你自己浏览器里，下次自动带出）
4. 点 **🚀 启动翻译 / 生成速览卡**，进度条走完
5. 点 **⬇️ 下载 HTML 笔记** —— 一个文件，双击就能看，不用联网

| 项目 | 说明 |
|:---|:---|
| 支持的服务商 | DeepSeek（默认）、Kimi、通义千问、智谱、OpenAI，以及任何 OpenAI 兼容接口 |
| 一篇 10 页论文 | 大约 1–3 分钟，几毛钱 |
| 你的文件去哪了 | 哪也没去，全在你自己电脑的浏览器里 |
| 生成的文件里有什么 | 按所选档位而定：速览卡 / 中英对照 + 💡大白话解读 / 复现分析 / 综述地图，都带「一键隐藏英文」和「日夜切换」按钮 |
| 两套皮肤 | 🌙 夜间 = 黑绿科技风，☀️ 日间 = 清爽蓝白；点右上角切换，会自动记住你的选择 |

> 扫描件（图片型 PDF）不行，得先 OCR。

---

## 阅读深度怎么选

方法论来自 S. Keshav 的经典短文《How to Read a Paper》——**不要一上来就从第一页读到最后一页**。
作者的「三遍法」是：第一遍先扫读，决定是否值得读；第二遍读懂内容、跳过证明细节；第三遍做"虚拟复现"，
想象自己重新做一遍这个研究，找出作者没说的假设和漏洞。本工具把这套方法做成了四个档位：

| 档位 | 花多久 | 你会拿到 | 什么时候选它 |
|:---|:---|:---|:---|
| **① 扫读** | 约 1 分钟（1 次调用） | **速览卡**：五个 C（类别 / 上下文 / 正确性 / 贡献 / 清晰度）+ 一句结论「值得继续读 / 当背景资料 / 可以丢了」+ 生词表 | 刚检索到一堆文献，要快速筛掉不相关的 |
| **② 读懂**（默认） | 约 1–3 分钟 | **中英对照解读**：逐段英文原文 + 中文翻译 + 💡 大白话解释，词表、图表说明、公式解读 | 确定这篇要读，想看懂它在讲什么（跳过证明细节） |
| **③ 复现** | 约 3–5 分钟 | ② 的全部 + **虚拟复现分析**：创新点、被省略的细节、隐含假设、缺失的引用、可改进之处、未来工作 | 要写综述 / 做汇报 / 打算复现这个方法 |
| **④ 批量综述** | 看篇数（需多文件） | **综述地图**：领域概览 + 子方向划分 + 论文横向对比表 + 共同引用 / 高频作者统计 + 建议阅读顺序 | 拿到 3 篇以上同方向文献，想看清它们之间的关系 |

> **五个 C**（第一遍扫读时会逐项给出）：
> **类别** Category（这是哪类论文：测量 / 分析 / 模型 / 系统？）·
> **上下文** Context（它和哪些论文相关、基于什么假设）·
> **正确性** Correctness（假设和方法站得住脚吗）·
> **贡献** Contributions（到底新在哪里）·
> **清晰度** Clarity（写得好不好读）。
>
> **虚拟复现**（第三遍）：不看作者原文，假想自己按同样的方法重做一遍。
> 凡是"你自己做不出来"的地方，就是作者隐藏的关键假设——这是找论文漏洞最有效的手段。

对应原文第 3 节的**文献综述**做法也内置了：上传多篇，工具会自动统计**共同引用**（被引用次数最多的那几篇，
通常就是该领域的奠基性工作）和**反复出现的作者名**（某个名字反复出现，多半是这一块的扛把子），
并给出建议的阅读顺序。

---

## A. 网页上传（推荐先试这个）

<details open>
<summary><b>第一次用，配置 3 分钟</b></summary>

<br>

**1. 确认工作流已开启**
点本仓库顶部的 `Actions` → 左边能看到 `论文自动翻译` 就说明已经开了。
如果页面提示 "workflows are disabled"，点蓝色的 `Enable workflow` 即可（一般不用管这步）。

**2. 配置密钥**
`Settings` → `Secrets and variables` → `Actions` → `New repository secret`，加下面这些：

| 名字 | 填什么 | 必填 |
|:---|:---|:---|
| `OPENAI_API_KEY` | 你的大模型 API key | ✅ |
| `OPENAI_BASE_URL` | 接口地址（用 OpenAI 官方就不填） | 可选 |
| `MODEL` | 模型名，默认 `gpt-4o-mini` | 可选 |

**3. 上传论文**
进入 `papers/` 文件夹 → `Add file` → `Upload files` → 把 PDF 拖进去 → 提交。

**4. 下载结果**
去 `Actions` 看任务跑完 → `output/` 里就出现了 `xxx_中英对照解读.html` → 点进去，右上角下载按钮。

</details>

---

## B. 本地命令行

```bash
# 1. 装依赖
pip install -r requirements.txt

# 2. 设置 key（Windows 用 set，Mac/Linux 用 export）
set OPENAI_API_KEY=sk-你的key

# 3. 跑
python paper2bilingual.py "论文.pdf"
```

**用别家的模型**（DeepSeek / Kimi / 通义都行）：

```bash
python paper2bilingual.py "论文.pdf" --base-url https://api.deepseek.com --model deepseek-chat
```

| 服务商 | `--base-url` | `--model` |
|:---|:---|:---|
| OpenAI | 不填 | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-32k` |
| 阿里通义 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |

**其他参数**

```bash
python paper2bilingual.py "论文.pdf" --layout      # 双栏排版的论文加上这个，效果好很多
python paper2bilingual.py "论文.pdf" --extract-only --out chunks.json   # 只导文本，不花 API 的钱
```

---

## 目录结构

```
wxfyq/
├── index.html                      网页版页面（GitHub Pages 入口）
├── app.js                          网页版逻辑（PDF 提取 + 三遍法四档 + 生成）
├── paper2bilingual.py              主脚本
├── style.css                       生成的 HTML 用的样式
├── requirements.txt                依赖
├── papers/                         ← 把 PDF 放这里
├── output/                         ← 生成的 HTML 在这里
└── .github/workflows/
    └── paper-translate.yml         自动化配置
```

---

## 常见问题

<details>
<summary><b>要花多少钱？</b></summary>

一篇 12 页的论文：DeepSeek 大概 **几毛钱**人民币，GPT-4o 大概 **几块钱**。

</details>

<details>
<summary><b>生成的 HTML 能离线看吗？</b></summary>

能。CSS 是内联的，不依赖任何网络资源。可以直接打印成 PDF。

</details>

<details>
<summary><b>公式显示不对怎么办？</b></summary>

PDF 里的公式经常提取不准：`?` 通常是减号、`m 2` 通常是 `m⁻²`。
脚本已做基础清洗，但复杂公式建议对照原刊核对。

</details>

<details>
<summary><b>同一个 PDF 想重新生成？</b></summary>

把 `output/` 里对应的 HTML 删掉，再传一次 PDF（或重新跑脚本）。已有输出会被自动跳过。

</details>

<details>
<summary><b>「三遍法」是什么？一定要按它来吗？</b></summary>

出自 S. Keshav《How to Read a Paper》，是学术界读了三十年的经典方法：
第一遍 5–10 分钟扫读决定去留，第二遍约 1 小时读懂内容（跳过证明），第三遍虚拟复现。
不强制——你只想看中文翻译就选「② 读懂」，想快速筛文献就选「① 扫读」。

</details>

<details>
<summary><b>「① 扫读」会不会太粗，漏掉重点？</b></summary>

它本来就不是用来替代精读的，用途是**决定这篇值不值得花一小时**。
它只读标题、摘要、各级小标题、图表和结论（约 8000 字），1 次调用就出结果，
所以特别适合先拿 20 篇文献批量扫一遍，再挑 3 篇精读。

</details>

<details>
<summary><b>支持中文论文吗？</b></summary>

目前只做「英文 → 中文」这一个方向。

</details>

---

## 许可

MIT License。随便用，改了也不用告诉我。
