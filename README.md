<div align="center">

<h1>📄 文献翻译器 · wxfyq</h1>

<p><b>把一篇英文文献 PDF，变成一个可以离线打开的学习笔记</b></p>

<p>英文原文 · 中文翻译 · 大白话解读，三段并排，一眼看懂</p>

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

> 顶部还有一个按钮：**一键隐藏英文**，只看中文。

黄框里写的是"人话"——不是翻译，是真的给你讲明白：

> 公式 `L ∝ √t` → **"水往里爬的距离 = 常数 × √时间，也就是越爬越慢：1 秒爬 1 毫米，4 秒才 2 毫米。"**

---

## 三种用法，挑一个

| 方式 | 难度 | 适合谁 |
|:---|:---|:---|
| **A. 网页上传**（本仓库） | ⭐ | 不想装东西、偶尔用一次 |
| **B. 本地命令行** | ⭐⭐⭐ | 论文多、想批量处理 |
| **C. WorkBuddy 技能** | ⭐ | 用 WorkBuddy 的话，拖进去说一句就行 |

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
<summary><b>支持中文论文吗？</b></summary>

目前只做「英文 → 中文」这一个方向。

</details>

---

## 许可

MIT License。随便用，改了也不用告诉我。
<div align="center">

<h1>📄 文献翻译器 · wxfyq</h1>

<p><b>把一篇英文文献 PDF，变成一个可以离线打开的学习笔记</b></p>

<p>英文原文 · 中文翻译 · 大白话解读，三段并排，一眼看懂</p>

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

> 顶部还有一个按钮：**一键隐藏英文**，只看中文。

黄框里写的是"人话"——不是翻译，是真的给你讲明白：

> 公式 `L ∝ √t` → **"水往里爬的距离 = 常数 × √时间，也就是越爬越慢：1 秒爬 1 毫米，4 秒才 2 毫米。"**

---

## 三种用法，挑一个

| 方式 | 难度 | 适合谁 |
|:---|:---|:---|
| **A. 网页上传**（本仓库） | ⭐ | 不想装东西、偶尔用一次 |
| **B. 本地命令行** | ⭐⭐⭐ | 论文多、想批量处理 |
| **C. WorkBuddy 技能** | ⭐ | 用 WorkBuddy 的话，拖进去说一句就行 |

---

## A. 网页上传（推荐先试这个）

<details open>
<summary><b>第一次用，配置 3 分钟</b></summary>

<br>

**1. 开启工作流**
点本仓库顶部的 `Actions` → 左边选 `论文自动翻译` → 点蓝色的 `Enable workflow`。

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
<summary><b>支持中文论文吗？</b></summary>

目前只做「英文 → 中文」这一个方向。

</details>

---

## 许可

MIT License。随便用，改了也不用告诉我。
