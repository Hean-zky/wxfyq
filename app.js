/* 文献翻译器 —— 纯前端版
 * 方法论来自 S. Keshav《How to Read a Paper》的「三遍法」：
 *   第一遍 扫读（5-10 分钟）→ 决定还要不要读
 *   第二遍 读懂（约 1 小时）→ 把握内容，跳过证明细节
 *   第三遍 复现（数小时）  → 虚拟复现，找出隐含假设与漏洞
 *   附：批量综述模式（对应原文第 3 节）
 * 所有数据只留在本机浏览器里。
 */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var PROVIDERS = {
    deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    kimi:     { base: 'https://api.moonshot.cn/v1',  model: 'moonshot-v1-32k' },
    qwen:     { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    glm:      { base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    openai:   { base: 'https://api.openai.com/v1',   model: 'gpt-4o-mini' },
    custom:   { base: '', model: '' }
  };

  /* 四档阅读深度 */
  var PASSES = {
    '1': { name: '第一遍 · 扫读', sub: '5–10 分钟 · 1 次调用 · 最便宜', suffix: '_速览' },
    '2': { name: '第二遍 · 读懂', sub: '约 1 小时 · 全文逐段对照',      suffix: '_中英对照解读' },
    '3': { name: '第三遍 · 复现', sub: '深度 · 全文 + 虚拟复现分析',    suffix: '_精读复现' },
    '4': { name: '批量综述',      sub: '多篇一起扫 · 拼出领域地图',      suffix: '_文献综述' }
  };

  var state = { docs: [], chunks: [], out: [], extra: null, survey: [], stop: false, busy: false };

  /* ---------------- 设置读写 ---------------- */
  function loadCfg() {
    var p = localStorage.getItem('wxfyq.provider') || 'deepseek';
    $('#provider').value = p;
    var saved = JSON.parse(localStorage.getItem('wxfyq.cfg') || '{}');
    if (!saved.base) saved.base = PROVIDERS[p] ? PROVIDERS[p].base : '';
    if (!saved.model) saved.model = PROVIDERS[p] ? PROVIDERS[p].model : '';
    $('#base').value = saved.base;
    $('#model').value = saved.model;
    $('#key').value = localStorage.getItem('wxfyq.key') || '';
    var pass = localStorage.getItem('wxfyq.pass') || '2';
    setPass(pass);
  }
  function saveCfg() {
    var p = $('#provider').value;
    localStorage.setItem('wxfyq.provider', p);
    localStorage.setItem('wxfyq.key', $('#key').value.trim());
    localStorage.setItem('wxfyq.cfg', JSON.stringify({
      base: $('#base').value.trim(), model: $('#model').value.trim()
    }));
    localStorage.setItem('wxfyq.pass', curPass());
  }
  $('#provider').addEventListener('change', function () {
    var p = PROVIDERS[$('#provider').value];
    if (p && p.base) { $('#base').value = p.base; $('#model').value = p.model; }
    saveCfg();
  });
  ['#key', '#base', '#model'].forEach(function (s) {
    $(s).addEventListener('change', saveCfg);
  });

  /* ---------------- 阅读深度选择 ---------------- */
  function curPass() {
    var r = document.querySelector('input[name=pass]:checked');
    return r ? r.value : '2';
  }
  function setPass(v) {
    var r = document.querySelector('input[name=pass][value="' + v + '"]');
    if (r) r.checked = true;
    refreshPassUI();
  }
  function refreshPassUI() {
    var v = curPass();
    document.querySelectorAll('.pass-opt').forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-pass') === v);
    });
    var tip = $('#passTip');
    if (tip) tip.textContent = PASS_TIPS[v] || '';
    var btn = $('#btnRun');
    if (btn) btn.textContent = RUN_LABEL[v] || '🚀 启动';
    // 综述模式允许多文件
    $('#file').multiple = (v === '4');
    $('#dropMulti').style.display = (v === '4') ? 'block' : 'none';
    $('#dropSingle').style.display = (v === '4') ? 'none' : 'block';
    saveCfg();
  }
  var PASS_TIPS = {
    '1': '只读标题、摘要、引言、各级小标题、结论和参考文献 → 输出「五个 C」速览卡，并给出建议：继续读 / 先补背景 / 可以放下。原文说：第一遍的目的不只是了解，更是决定还要不要读下去。',
    '2': '全文逐段翻译 + 大白话解读，但跳过证明等细节。验收标准：读完能把论文主旨连证据一起讲给别人听。',
    '3': '在第二遍的基础上，多做一次「虚拟复现」：假设你是作者，在同样前提下把工作重做一遍，再和原文对照 → 找出创新点、隐含假设、缺失引用、实验漏洞，以及你能想到的后续方向。',
    '4': '一次上传多篇 PDF，对每篇只做第一遍，再统计共同引用和高频作者，拼出一张领域地图 + 建议阅读顺序。对应原文第 3 节。'
  };
  var RUN_LABEL = {
    '1': '🔍 生成速览卡',
    '2': '🚀 启动翻译',
    '3': '🔬 深度精读（含复现分析）',
    '4': '🗺️ 生成综述地图'
  };
  document.querySelectorAll('input[name=pass]').forEach(function (r) {
    r.addEventListener('change', refreshPassUI);
  });

  /* ---------------- 日志 ---------------- */
  function log(msg, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = msg;
    $('#log').appendChild(d);
    $('#log').scrollTop = $('#log').scrollHeight;
  }
  function progress(pct, txt) {
    $('#barFill').style.width = pct + '%';
    if (txt) $('#barTxt').textContent = txt;
  }

  /* ---------------- 选文件 ---------------- */
  $('#btnPick').addEventListener('click', function (e) {
    e.stopPropagation(); $('#file').click();
  });
  $('#drop').addEventListener('click', function (e) {
    if (e.target !== $('#btnPick')) $('#file').click();
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    $('#drop').addEventListener(ev, function (e) {
      e.preventDefault(); $('#drop').classList.add('over');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    $('#drop').addEventListener(ev, function (e) {
      e.preventDefault(); $('#drop').classList.remove('over');
    });
  });
  $('#drop').addEventListener('drop', function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  $('#file').addEventListener('change', function () {
    if (this.files.length) handleFiles(this.files);
  });
  $('#btnClear').addEventListener('click', function () {
    state.docs = [];
    $('#file').value = '';
    $('#fileBox').style.display = 'none';
    $('#btnRun').disabled = true;
  });

  function handleFiles(list) {
    var files = Array.prototype.slice.call(list)
      .filter(function (f) { return /\.pdf$/i.test(f.name); });
    if (!files.length) { alert('请选一个 PDF 文件'); return; }
    var multi = (curPass() === '4');
    if (!multi && files.length > 1) {
      setPass('4');
      log('选了多个文件，已自动切到「批量综述」模式。', 'warn');
    }
    if (multi && files.length === 1) {
      log('只选了 1 篇，仍按综述模式处理。', 'warn');
    }
    var use = multi ? files : [files[0]];

    state.docs = [];
    $('#fileBox').style.display = 'block';
    $('#fName').textContent = use.length > 1
      ? use.length + ' 篇文献' : use[0].name;
    $('#fStat').textContent = '正在读取…';
    $('#btnRun').disabled = true;

    var done = 0;
    use.forEach(function (f, k) {
      var rd = new FileReader();
      rd.onload = function () {
        parsePDF(new Uint8Array(rd.result)).then(function (pages) {
          state.docs.push({ idx: k, name: f.name.replace(/\.pdf$/i, ''), pages: pages });
        })['catch'](function (e) {
          log('✗ ' + f.name + ' 读取失败：' + e.message, 'err');
          state.docs.push({ idx: k, name: f.name.replace(/\.pdf$/i, ''), pages: [], err: e.message });
        }).then(function () {
          done++;
          if (done === use.length) afterLoad();
        });
      };
      rd.readAsArrayBuffer(f);
    });
  }

  function afterLoad() {
    state.docs.sort(function (a, b) { return a.idx - b.idx; });
    var ok = state.docs.filter(function (d) { return d.pages.length; });
    if (!ok.length) { $('#fStat').textContent = '读取失败'; return; }
    var names = ok.map(function (d) { return d.name; });
    $('#fName').textContent = ok.length > 1
      ? ok.length + ' 篇：' + names.join(' / ')
      : names[0];
    var total = ok.reduce(function (s, d) { return s + d.pages.join('').length; }, 0);
    var p = curPass();
    var est = '';
    if (p === '1') est = '速览模式 · 1 次调用';
    else if (p === '4') est = '综述模式 · ' + ok.length + ' 次 + 1 次汇总';
    else est = '预计切成 ' + Math.max(1, Math.ceil(total / 1600)) + ' 段'
      + (p === '3' ? ' + 1 次复现分析' : '');
    $('#fStat').textContent = ok.length + ' 篇 · ' +
      ok.reduce(function (s, d) { return s + d.pages.length; }, 0) + ' 页 · ' + est;
    var few = ok.filter(function (d) {
      return d.pages.join('').replace(/\s+/g, '').length < 200;
    });
    if (few.length) $('#fStat').textContent += '（⚠️ ' + few.length + ' 篇文字很少，可能是扫描件）';
    $('#btnRun').disabled = false;
  }

  function parsePDF(data) {
    if (typeof pdfjsLib === 'undefined') {
      return Promise.reject(new Error('PDF 解析库没加载出来，请检查网络后刷新页面'));
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    return pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) {
      var pages = [], i = 1;
      function next() {
        if (i > pdf.numPages) return Promise.resolve(pages);
        return pdf.getPage(i).then(function (page) {
          return page.getTextContent();
        }).then(function (tc) {
          var txt = '', lastY = null;
          tc.items.forEach(function (it) {
            if (!it.str) return;
            var y = it.transform ? it.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) txt += '\n';
            else if (txt && !/[\s\-]$/.test(txt) && !/^[\s]/.test(it.str)) txt += ' ';
            txt += it.str;
            lastY = y;
          });
          pages.push(txt.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
          i++;
          return next();
        });
      }
      return next();
    });
  }

  /* ---------------- 骨架提取（第一遍 / 综述用） ---------------- */
  var HEADING_RE = /^(?:\d+(?:\.\d+)*\.?\s+\S|[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,6}\s*$|(?:Abstract|Introduction|Introduction and|Related Work|Background|Method|Methods|Methodology|Approach|Model|Experiment|Experiments|Results|Results and|Discussion|Evaluation|Conclusion|Conclusions|Future Work|Acknowledg|References)\b)/;

  function extractHeadings(pages) {
    var seen = {}, out = [];
    pages.join('\n').split('\n').forEach(function (l) {
      var t = l.trim();
      if (!t || t.length > 80 || t.length < 3) return;
      if (/[.。;:,]$/.test(t)) return;         // 以句号等结尾的是正文
      if (!HEADING_RE.test(t)) return;
      if (seen[t]) return;
      seen[t] = 1; out.push(t);
    });
    return out;
  }

  function buildScanInput(pages) {
    var all = pages.join('\n\n');
    var heads = extractHeadings(pages).join('\n');
    return '【开头：标题 / 摘要 / 引言】\n' + all.slice(0, 5000) +
      '\n\n【全文各级小标题】\n' + (heads || '（没识别出小标题）') +
      '\n\n【结尾：结论 / 参考文献】\n' + all.slice(-3500);
  }

  /* ---------------- 切段（第二 / 三遍用） ---------------- */
  function buildChunks(pages) {
    var all = pages.join('\n\n');
    var paras = all.split(/\n{1,}/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 1; });
    var chunks = [], cur = '';
    paras.forEach(function (p) {
      if ((cur + ' ' + p).length > 1600 && cur.length > 300) {
        chunks.push(cur.trim()); cur = p;
      } else {
        cur = cur ? cur + '\n' + p : p;
      }
    });
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
  }

  /* ---------------- 提示词 ---------------- */
  var SYS_TRANSLATE = [
    '你是一位面向中文初学者的文献精读助手。读者专业基础薄弱，需要"大白话"解释，不只是翻译。',
    '任务：把用户给出的英文学术段落逐段处理，输出严格的 JSON 数组，不要输出任何多余文字。',
    '数组每个元素格式：',
    '{"en":"英文原文（原样照抄，不要改写、不要省略）",',
    ' "zh":"中文翻译（通顺、准确、术语后可用括号保留英文）",',
    ' "tip":"大白话解读：用生活里的类比讲明白这段在干嘛、为什么这么干；公式要说明它在算什么、每个符号啥意思；实在没什么可讲的写一句概括；参考文献/致谢/页眉页脚可留空",',
    ' "skip":false,',
    ' "h":""}',
    '规则：',
    '1. 输入中每个 [[编号]] 块对应一个元素，顺序和数量必须完全一致。',
    '2. h 只在原文是"小标题"时填中文标题，其余一律空字符串。',
    '3. 原文是参考文献列表、致谢、页眉页脚、纯图表编号时 skip 设 true，zh 写一句概括。',
    '4. 遇到数学证明、推导细节，不要展开——按原文第 2 节的做法，第二遍应当跳过证明，只说清它证明了什么、结论是什么。',
    '5. JSON 必须合法：字符串内换行写成 \\n，不要用真实换行；不要出现未转义的引号。',
    '6. 只输出 JSON 数组本身。'
  ].join('\n');

  var SYS_SCAN = [
    '你是一位文献速读助手。读者专业基础薄弱，需要大白话。',
    '你只读到一篇论文的骨架（标题、摘要、引言、各级小标题、结论、参考文献），'
    + '没有正文细节。请据此判断这篇论文值不值得继续读。',
    '输出严格的 JSON 对象（不是数组），不要任何多余文字。格式：',
    '{"one_line":"一句话说清这篇论文在干什么、结论是什么",',
    ' "category":"论文类型：新方法 / 测量型 / 分析现有系统 / 研究原型 / 理论 / 综述，并一句话说明",',
    ' "context":"它和哪些工作相关、用了什么理论基础",',
    ' "correctness":"它的假设看起来成立吗（只凭骨架判断；列出需要留意的假设）",',
    ' "contributions":"主要贡献，3 条以内，用分号隔开",',
    ' "clarity":"写得清晰吗，一句话评价",',
    ' "verdict":"continue / background / drop 三选一",',
    ' "reason":"为什么给出这个建议",',
    ' "glossary":[["英文术语","中文","大白话解释"]]}',
    'verdict 的含义（严格按这个标准选）：',
    '- continue：值得一读，可以进第二遍',
    '- background：主题太新或术语太多，需要先补背景再读',
    '- drop：不感兴趣、或作者假设明显站不住，可以放下',
    '全部用中文大白话，不要堆术语。只输出 JSON 本身。'
  ].join('\n');

  var SYS_REIMPLEMENT = [
    '你是一位严格的审稿人，正在用「虚拟复现法」（Keshav 三遍法的第三遍）深读一篇论文。',
    '做法是：假设你和作者面对同一个问题、拥有同样的前提，你会怎么把这项工作做出来；',
    '然后把你脑中的方案和原文对照——他做到而你没想到的，就是真正的创新；',
    '你想到而他没做的，就是缺漏；你们都默认了却都没写出来的，就是隐含假设。',
    '下面是这篇论文已翻译好的中文要点。输出严格的 JSON 对象，不要任何多余文字。格式：',
    '{"reimplement":"如果你是作者，你会怎么设计这项工作？写出方案要点，3-5 条，用分号隔开",',
    ' "innovation":"他做到了而你没想到的（真正的创新点）",',
    ' "omission":"你想到而他没做的（缺漏）",',
    ' "assumptions":["隐含假设1","隐含假设2"],',
    ' "missing_citations":["可能遗漏的相关工作或引用"],',
    ' "technique_issues":["实验或分析方法上的问题，例如缺误差棒、样本量不足、无对照组、指标选取可疑等"],',
    ' "improvements":["可以怎么改进"],',
    ' "future_work":["由此想到的后续研究方向"],',
    ' "verdict_summary":"一句话评价这篇论文的强项与弱项"}',
    '要求：具体、可执行，不要写空话套话。全部中文。只输出 JSON 本身。'
  ].join('\n');

  var SYS_SURVEY_ONE = [
    '你是文献综述助手。你只读到一篇论文的骨架，输出严格的 JSON 对象，不要多余文字。格式：',
    '{"one_line":"一句话：这篇在干什么、结论是什么",',
    ' "category":"论文类型（新方法 / 测量型 / 分析现有系统 / 研究原型 / 理论 / 综述）",',
    ' "contributions":"主要贡献，2 条以内，用分号隔开",',
    ' "method":"用什么方法做到的，一句话",',
    ' "limitations":"局限，一句话",',
    ' "authors":["第一作者","通讯作者或第二作者"],',
    ' "key_refs":["它反复引用的关键文献：标题或第一作者+年份，最多 3 条"],',
    ' "venue_hint":"从参考文献看它可能属于哪个会议或期刊方向，不确定就留空"}',
    '全部中文。只输出 JSON 本身。'
  ].join('\n');

  var SYS_SURVEY_ALL = [
    '你是文献综述助手。下面是一批论文的骨架摘要，以及统计出来的高频作者和共同引用。',
    '请据此给出一张「领域地图」。输出严格的 JSON 对象，不要多余文字。格式：',
    '{"overview":"这个领域在做什么、关注什么，一到三句话",',
    ' "landscape":[["子方向名","包含哪几篇（写论文序号）","一句话说明"]],',
    ' "reading_order":["先读第 N 篇（原因）","再读第 N 篇（原因）"],',
    ' "key_papers":["最该优先精读的 2-3 篇及原因"],',
    ' "gaps":"这批论文共同的空白或不足",',
    ' "next_step":"接下来该做什么，例如去找综述、补背景、扫顶会论文集"}',
    '全部中文大白话。只输出 JSON 本身。'
  ].join('\n');

  /* ---------------- 调模型 ---------------- */
  function callLLM(cfg, sysMsg, userMsg, temp) {
    var url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: userMsg }],
        temperature: (temp == null ? 0.2 : temp)
      })
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 160));
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('返回不是 JSON：' + t.slice(0, 160)); }
        var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!c) throw new Error('返回里没有内容：' + t.slice(0, 160));
        return c;
      });
    });
  }

  function parseArr(text) {
    var s = String(text).trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = s.indexOf('['), b = s.lastIndexOf(']');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    return JSON.parse(s);
  }
  function parseObj(text) {
    var s = String(text).trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    return JSON.parse(s);
  }
  /* 重试一次，仍失败就抛出 */
  function callJSON(cfg, sysMsg, userMsg, isArr, tag) {
    function once() {
      return callLLM(cfg, sysMsg, userMsg).then(function (t) {
        try { return isArr ? parseArr(t) : parseObj(t); }
        catch (e) { throw new Error('JSON 解析失败'); }
      });
    }
    return once()['catch'](function (e1) {
      log(tag + ' 返回不是合法 JSON，重试一次…', 'warn');
      return once()['catch'](function (e2) {
        throw new Error(e2.message + '（第二次仍失败）');
      });
    });
  }

  /* ---------------- 生成最终 HTML ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function lis(items, cls) {
    var a = arr(items).filter(function (x) { return x && String(x).trim(); });
    if (!a.length) return '<p class="sub">（模型没有给出这一项）</p>';
    return '<ul class="' + (cls || '') + '">' + a.map(function (x) {
      return '<li>' + esc(x) + '</li>';
    }).join('') + '</ul>';
  }
  function kv(k, v) {
    if (!v) return '';
    return '<div class="kv"><div class="k">' + esc(k) + '</div><div class="v">'
      + esc(v) + '</div></div>';
  }

  var OUT_CSS = [
    /* 夜间 · 黑绿 */
    ':root{--bg:#070c0a;--card:#0c1512;--ink:#e8fff6;--ink2:#b6d8cb;--muted:#7d9c92;',
    '--line:rgba(0,255,157,.16);--line2:rgba(0,255,157,.32);',
    '--en-bg:rgba(255,255,255,.035);--en-ink:#9fc9ba;--en-line:rgba(0,255,157,.35);',
    '--tip-bg:rgba(0,255,157,.07);--tip-line:#00ff9d;--tip-ink:#b8ffe4;',
    '--hd:#00ff9d;--hd2:#8fffd0;--chip:rgba(0,255,157,.08);',
    '--btn-bg:rgba(0,255,157,.10);--btn-ink:#00ff9d;',
    '--go-bg:rgba(0,255,157,.14);--go-ink:#5cffb0;',
    '--mid-bg:rgba(255,209,102,.14);--mid-ink:#ffd166;',
    '--stop-bg:rgba(255,143,143,.14);--stop-ink:#ff8f8f;',
    '--grid:rgba(0,255,157,.04);--tiny:#3f6a5d;--scroll:rgba(0,255,157,.25);color-scheme:dark}',
    /* 日间 · 清爽 */
    'html[data-theme=light]{--bg:#f6f7f9;--card:#ffffff;--ink:#1f2937;--ink2:#4b5563;--muted:#6b7280;',
    '--line:#e5e7eb;--line2:#cbd5e1;--en-bg:#f3f4f6;--en-ink:#4b5563;--en-line:#cbd5e1;',
    '--tip-bg:#fffbeb;--tip-line:#f59e0b;--tip-ink:#78350f;',
    '--hd:#0f766e;--hd2:#0f766e;--chip:#f1f5f9;--btn-bg:#ffffff;--btn-ink:#0f766e;',
    '--go-bg:#ecfdf5;--go-ink:#047857;--mid-bg:#fffbeb;--mid-ink:#b45309;',
    '--stop-bg:#fef2f2;--stop-ink:#b91c1c;',
    '--grid:rgba(15,118,110,.05);--tiny:#9ca3af;--scroll:#cbd5e1;color-scheme:light}',
    '*{box-sizing:border-box}',
    'html,body{margin:0}',
    'body{position:relative;background:var(--bg);color:var(--ink);transition:background .25s,color .25s;',
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-size:15px;line-height:1.85}',
    'body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;',
    'background-image:linear-gradient(var(--grid) 1px,transparent 1px),',
    'linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:46px 46px;',
    '-webkit-mask-image:radial-gradient(110% 70% at 50% 0%,#000 20%,transparent 75%);',
    'mask-image:radial-gradient(110% 70% at 50% 0%,#000 20%,transparent 75%)}',
    '.wrap{max-width:1100px;margin:0 auto;padding:26px 18px 70px}',
    '.card{background:var(--card);border:1px solid var(--line);border-radius:14px;',
    'padding:24px 26px;margin-bottom:20px;box-shadow:0 1px 2px rgba(0,0,0,.14)}',
    'h1{font-size:25px;margin:0 0 6px;color:var(--ink)}',
    'h2{font-size:19px;margin:0 0 14px;padding-bottom:9px;border-bottom:1px solid var(--line2);color:var(--hd)}',
    'h3{font-size:16.5px;margin:24px 0 8px;color:var(--hd2)}',
    '.sub{color:var(--muted);font-size:14px}',
    '.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:center}',
    '.chip{background:var(--chip);border:1px solid var(--line2);color:var(--hd2);',
    'border-radius:999px;padding:3px 12px;font-size:12.5px}',
    '.btn{border:1px solid var(--line2);background:var(--btn-bg);color:var(--btn-ink);',
    'border-radius:10px;padding:7px 14px;font-size:13.5px;cursor:pointer;font-family:inherit}',
    '.btn:hover{filter:brightness(1.12)}',
    /* 速览卡 */
    '.kv{display:grid;grid-template-columns:110px 1fr;gap:10px 14px;font-size:14.5px;',
    'padding:10px 0;border-bottom:1px dashed var(--line)}',
    '.kv .k{color:var(--hd2);font-weight:600}',
    '.kv .v{line-height:1.75}',
    '.verdict{display:inline-block;padding:7px 16px;border-radius:999px;font-weight:700;font-size:15px}',
    '.v-go{background:var(--go-bg);color:var(--go-ink)}',
    '.v-mid{background:var(--mid-bg);color:var(--mid-ink)}',
    '.v-stop{background:var(--stop-bg);color:var(--stop-ink)}',
    'table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}',
    'th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;line-height:1.7}',
    'th{background:var(--chip);color:var(--hd2);font-weight:600}',
    '.big{background:var(--tip-bg);border-left:4px solid var(--tip-line);color:var(--tip-ink);',
    'border-radius:0 10px 10px 0;padding:14px 18px;font-size:16px;line-height:1.9;margin:6px 0 14px}',
    'ul,ol{padding-left:22px;margin:8px 0}li{margin:5px 0}',
    /* 正文对照 */
    '.pair{margin:0 0 18px;padding-bottom:16px;border-bottom:1px dashed var(--line)}',
    '.en{background:var(--en-bg);color:var(--en-ink);border-left:3px solid var(--en-line);',
    'border-radius:0 8px 8px 0;padding:10px 14px;font-size:14px;margin-bottom:8px;white-space:pre-wrap}',
    '.zh{padding:2px 2px 6px;font-size:15.5px}',
    '.tip{background:var(--tip-bg);border-left:3px solid var(--tip-line);color:var(--tip-ink);',
    'border-radius:0 8px 8px 0;padding:10px 14px;font-size:14.5px;margin-top:6px;white-space:pre-wrap}',
    'body.hide-en .en{display:none}',
    'footer{text-align:center;color:var(--muted);font-size:12.5px;margin-top:24px}',
    '.tiny{margin-top:8px;font-size:11px;color:var(--tiny);opacity:.35;transition:opacity .6s}',
    '.tiny:hover{opacity:1;color:var(--hd)}',
    '::-webkit-scrollbar{width:9px}::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:9px}'
  ].join('');

  function pageShell(title, sub, chips, bodyHtml, stamp) {
    return '<!DOCTYPE html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="theme-color" content="#070c0a">' +
      '<meta name="author" content="Lirael">' +
      '<title>' + esc(title) + '</title><style>' + OUT_CSS + '</style></head><body>' +
      '<div class="wrap"><div class="card">' +
      '<h1>' + esc(title) + '</h1>' +
      '<div class="sub">' + esc(sub) + '</div>' +
      '<div class="meta">' + chips + '</div>' +
      '<button class="btn" onclick="document.body.classList.toggle(\'hide-en\')">👁 显示 / 隐藏英文原文</button> ' +
      '<button class="btn" id="thBtn" onclick="__swapTheme()">🌙 夜间</button>' +
      '</div>' + bodyHtml +
      '<footer>本文件由「文献翻译器」生成 · 可离线打开 · 方法来自 Keshav《How to Read a Paper》三遍法' +
      '<div class="tiny">crafted by <b>Lirael</b></div></footer>' +
      '</div><script>function __swapTheme(){' +
      'var r=document.documentElement;' +
      'var t=r.getAttribute("data-theme")==="light"?"dark":"light";' +
      'r.setAttribute("data-theme",t);' +
      'var b=document.getElementById("thBtn");' +
      'if(b){b.textContent=t==="light"?"\u2600\uFE0F 日间":"\uD83C\uDF19 夜间";}' +
      'var m=document.querySelector("meta[name=theme-color]");' +
      'if(m){m.setAttribute("content",t==="light"?"#0f766e":"#070c0a");}}' +
      '<\/script></body></html>';
  }
  function stampStr() {
    var n = new Date();
    return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' +
      ('0' + n.getDate()).slice(-2);
  }
  function chip(t) { return '<span class="chip">' + esc(t) + '</span>'; }

  /* ---- 第一遍：速览卡 ---- */
  function buildScan() {
    var d = state.scan || {}, doc = state.docs[0];
    var v = (d.verdict || 'continue').toLowerCase();
    var vmap = {
      'continue': ['v-go', '✅ 建议：值得继续读第二遍'],
      'background': ['v-mid', '📚 建议：先补背景再读'],
      'drop': ['v-stop', '🛑 建议：可以放下这篇']
    };
    var vm = vmap[v] || vmap['continue'];
    var heads = extractHeadings(doc.pages);
    var body = '<div class="card"><h2>🔍 速览结论</h2>' +
      '<div class="big">' + esc(d.one_line || '（模型没有给出一句话总结）') + '</div>' +
      '<p><span class="verdict ' + vm[0] + '">' + vm[1] + '</span></p>' +
      (d.reason ? '<p style="margin-top:12px">' + esc(d.reason) + '</p>' : '') +
      '</div>' +
      '<div class="card"><h2>五个 C（第一遍的验收清单）</h2>' +
      kv('① Category 类型', d.category) +
      kv('② Context 背景', d.context) +
      kv('③ Correctness 正确性', d.correctness) +
      kv('④ Contributions 贡献', d.contributions) +
      kv('⑤ Clarity 清晰度', d.clarity) +
      '</div>';
    if (heads.length) {
      body += '<div class="card"><h2>论文骨架（识别出的小标题）</h2><ul>' +
        heads.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
        '</ul><p class="sub">第一遍只读这些标题，不看具体正文。</p></div>';
    }
    var g = arr(d.glossary).filter(function (x) { return x && x[0]; });
    if (g.length) {
      body += '<div class="card"><h2>术语速查</h2><table><tr><th>英文</th><th>中文</th>' +
        '<th>大白话解释</th></tr>' + g.map(function (x) {
          return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(x[1] || '') +
            '</td><td>' + esc(x[2] || '') + '</td></tr>';
        }).join('') + '</table></div>';
    }
    body += '<div class="card"><h2>接下来</h2><ul>' +
      '<li>若建议「继续读」：切回本页选<b>第二遍 · 读懂</b>，做全文对照。</li>' +
      '<li>若建议「先补背景」：去读它参考文献里反复出现的那几篇，再回来。</li>' +
      '<li>若建议「放下」：把这篇归档，把时间投到别的论文上——第一遍的意义就是帮你省下这几小时。</li>' +
      '</ul></div>';
    return pageShell(doc.name + ' · 速览', '第一遍 · 扫读（三遍法之一）',
      chip('生成日期 ' + stampStr()) + chip('模型 ' + $('#model').value.trim()) + chip('1 次调用'),
      body, stampStr());
  }

  /* ---- 第二 / 三遍：正文 ---- */
  function buildBodyHtml() {
    var s = '';
    state.out.forEach(function (o) {
      if (o.h) s += '<h3>' + esc(o.h) + '</h3>';
      if (o.skip && !o.zh) return;
      s += '<div class="pair">';
      if (o.en) s += '<div class="en">' + esc(o.en) + '</div>';
      if (o.zh) s += '<div class="zh">' + esc(o.zh) + '</div>';
      if (o.tip) s += '<div class="tip">💡 ' + esc(o.tip) + '</div>';
      s += '</div>';
    });
    return s;
  }
  function buildRead(withReimpl) {
    var doc = state.docs[0];
    var body = '<div class="card"><h2>📖 正文（英文 · 中文 · 大白话）</h2>' + buildBodyHtml() + '</div>';
    var chips = chip('生成日期 ' + stampStr()) + chip('模型 ' + $('#model').value.trim()) +
      chip('共 ' + state.out.length + ' 段');
    if (withReimpl && state.extra) {
      var x = state.extra;
      chips += chip('含虚拟复现分析');
      body += '<div class="card"><h2>🔬 虚拟复现分析（第三遍）</h2>' +
        '<div class="big">' + esc(x.verdict_summary || '') + '</div>' +
        kv('如果是你来做', x.reimplement) +
        kv('真正的创新（他想到你没想到）', x.innovation) +
        kv('缺漏（你想到他没做）', x.omission) +
        '</div>' +
        '<div class="card"><h2>需要警惕的地方</h2>' +
        '<h3>隐含假设（作者没明说、但结论依赖它）</h3>' + lis(x.assumptions) +
        '<h3>可能缺失的引用</h3>' + lis(x.missing_citations) +
        '<h3>实验 / 分析方法上的问题</h3>' + lis(x.technique_issues) +
        '</div>' +
        '<div class="card"><h2>可以做什么</h2>' +
        '<h3>改进建议</h3>' + lis(x.improvements) +
        '<h3>由此想到的后续方向</h3>' + lis(x.future_work) +
        '</div>';
    }
    return pageShell(doc.name + (withReimpl ? ' · 精读复现' : ' · 中英对照解读'),
      withReimpl ? '第三遍 · 复现（含全文对照）' : '第二遍 · 读懂',
      chips, body, stampStr());
  }

  /* ---- 批量综述 ---- */
  function buildSurvey() {
    var s = state.surveyAll || {};
    var docs = state.docs;
    var rows = docs.map(function (d, i) {
      var o = state.survey[i] || {};
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(d.name) + '</b></td>' +
        '<td>' + esc(o.category || '') + '</td>' +
        '<td>' + esc(o.one_line || '') + '</td>' +
        '<td>' + esc(o.contributions || '') + '</td>' +
        '<td>' + esc(o.method || '') + '</td>' +
        '<td>' + esc(o.limitations || '') + '</td></tr>';
    }).join('');
    var body = '<div class="card"><h2>🗺️ 领域概览</h2><div class="big">' +
      esc(s.overview || '（模型没有给出概览）') + '</div></div>';

    body += '<div class="card"><h2>论文对照表（' + docs.length + ' 篇）</h2>' +
      '<table><tr><th>#</th><th>论文</th><th>类型</th><th>一句话</th>' +
      '<th>贡献</th><th>方法</th><th>局限</th></tr>' + rows + '</table></div>';

    var ls = arr(s.landscape).filter(function (x) { return x && x[0]; });
    if (ls.length) {
      body += '<div class="card"><h2>子方向分布</h2><table><tr><th>子方向</th>' +
        '<th>包含</th><th>说明</th></tr>' + ls.map(function (x) {
          return '<tr><td><b>' + esc(x[0]) + '</b></td><td>' + esc(x[1] || '') +
            '</td><td>' + esc(x[2] || '') + '</td></tr>';
        }).join('') + '</table></div>';
    }
    if (state.stats && (state.stats.authors.length || state.stats.refs.length)) {
      var st = state.stats;
      body += '<div class="card"><h2>共同引用与高频作者</h2>' +
        '<p class="sub">按 Keshav 第 3 节的做法：参考文献里被反复引用、以及反复出现的作者名字，'
        + '就是这个领域的关键论文和关键人物。</p>';
      if (st.refs.length) {
        body += '<h3>被多篇共同引用（≥2 次）</h3><table><tr><th>被引用</th><th>次数</th>' +
          '<th>来自哪几篇</th></tr>' + st.refs.map(function (r) {
            return '<tr><td>' + esc(r.k) + '</td><td>' + r.n + '</td><td>' +
              esc(r.src.join('、')) + '</td></tr>';
          }).join('') + '</table>';
      }
      if (st.authors.length) {
        body += '<h3>高频作者（≥2 次）</h3><ul>' + st.authors.map(function (a) {
          return '<li><b>' + esc(a.k) + '</b> —— 出现 ' + a.n + ' 次（' +
            esc(a.src.join('、')) + '）</li>';
        }).join('') + '</ul>';
      }
      body += '</div>';
    }
    body += '<div class="card"><h2>怎么读这批论文</h2>' +
      '<h3>建议阅读顺序</h3>' + lis(s.reading_order) +
      '<h3>优先精读</h3>' + lis(s.key_papers) +
      '<h3>这批论文共同的空白</h3>' + lis([s.gaps]) +
      '<h3>下一步</h3>' + lis([s.next_step]) +
      '</div>';
    return pageShell('文献综述 · ' + docs.length + ' 篇', '批量扫读（三遍法第一遍 × N）',
      chip('生成日期 ' + stampStr()) + chip('模型 ' + $('#model').value.trim()) +
      chip(docs.length + ' 篇'),
      body, stampStr());
  }

  /* ---------------- 统计共同引用 / 高频作者 ---------------- */
  function normRef(s) {
    return String(s || '').toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim().slice(0, 60);
  }
  function computeStats(list) {
    var refs = {}, authors = {};
    list.forEach(function (o, i) {
      var tag = '第' + (i + 1) + '篇';
      arr(o.key_refs).forEach(function (r) {
        var k = normRef(r); if (!k) return;
        refs[k] = refs[k] || { n: 0, src: [], label: String(r) };
        refs[k].n++;
        if (refs[k].src.indexOf(tag) < 0) refs[k].src.push(tag);
      });
      arr(o.authors).forEach(function (a) {
        var k = String(a || '').trim(); if (!k) return;
        authors[k] = authors[k] || { n: 0, src: [] };
        authors[k].n++;
        if (authors[k].src.indexOf(tag) < 0) authors[k].src.push(tag);
      });
    });
    function top(m) {
      return Object.keys(m).map(function (k) { return m[k]; })
        .filter(function (x) { return x.n >= 2; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 12)
        .map(function (x) { x.k = x.label || x.k_src || x.k; return x; });
    }
    // refs 需要显示原始标签
    var rTop = Object.keys(refs).map(function (k) {
      return { k: refs[k].label, n: refs[k].n, src: refs[k].src };
    }).filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
    var aTop = Object.keys(authors).map(function (k) {
      return { k: k, n: authors[k].n, src: authors[k].src };
    }).filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
    return { refs: rTop, authors: aTop };
  }

  /* ---------------- 主流程 ---------------- */
  $('#btnRun').addEventListener('click', function () {
    var key = $('#key').value.trim();
    var base = $('#base').value.trim();
    var model = $('#model').value.trim();
    if (!key) { alert('请先填 API Key'); return; }
    if (!base) { alert('请先填接口地址'); return; }
    if (!model) { alert('请先填模型名'); return; }
    if (!state.docs.length) { alert('请先选一个 PDF'); return; }
    saveCfg();

    $('#run').style.display = 'block';
    $('#result').style.display = 'none';
    $('#log').innerHTML = '';
    state.stop = false; state.busy = true; state.out = [];
    state.extra = null; state.scan = null; state.survey = []; state.surveyAll = null;
    state.stats = null;
    $('#btnRun').disabled = true; $('#btnStop').disabled = false;

    var cfg = { key: key, base: base, model: model };
    var pass = curPass();
    progress(2, '准备中…');

    if (pass === '1') runScan(cfg);
    else if (pass === '4') runSurvey(cfg);
    else runRead(cfg, pass === '3');
  });

  /* ---- 第一遍 ---- */
  function runScan(cfg) {
    var doc = state.docs[0];
    log('第一遍 · 扫读：只把骨架（标题/摘要/引言/小标题/结论/参考文献）交给模型…');
    var input = buildScanInput(doc.pages);
    callJSON(cfg, SYS_SCAN,
      '下面是论文《' + doc.name + '》的骨架。请输出 JSON。\n\n' + input,
      false, '扫读').then(function (o) {
      state.scan = o;
      log('✓ 速览卡已生成', 'ok');
      finish(false);
    })['catch'](function (e) {
      log('✗ 失败：' + e.message, 'err');
      finish(true);
    });
  }

  /* ---- 第二 / 三遍 ---- */
  function runRead(cfg, withReimpl) {
    state.chunks = buildChunks(state.docs[0].pages);
    log((withReimpl ? '第三遍 · 复现' : '第二遍 · 读懂') + '：共 ' +
      state.chunks.length + ' 段，开始翻译…');
    if (withReimpl) log('（第二遍先做完，最后再多做一次「虚拟复现」分析）');
    progress(2, '0 / ' + state.chunks.length + ' 段');

    var i = 0;
    function one() {
      if (state.stop) { finish(true); return null; }
      if (i >= state.chunks.length) return afterChunks();
      var idx = i;
      var msg = '下面是论文的第 ' + (idx + 1) + ' / ' + state.chunks.length + ' 段原文：\n\n[[' +
        (idx + 1) + ']]\n' + state.chunks[idx] + '\n\n请按要求输出 JSON 数组。';
      return callJSON(cfg, SYS_TRANSLATE, msg, true, '第 ' + (idx + 1) + ' 段')
        .then(function (a) {
          arr(a).forEach(function (o) {
            state.out.push({
              en: o.en || '', zh: o.zh || '', tip: o.tip || '',
              skip: !!o.skip, h: o.h || ''
            });
          });
          i++;
          progress(Math.round(i / state.chunks.length * 100),
            i + ' / ' + state.chunks.length + ' 段完成');
          log('✓ 第 ' + (idx + 1) + ' 段完成（累计 ' + state.out.length + ' 条）', 'ok');
          return one();
        })['catch'](function (e) {
          log('✗ 第 ' + (idx + 1) + ' 段失败：' + e.message, 'err');
          if (state.stop) { finish(true); return null; }
          state.out.push({ en: state.chunks[idx], zh: '', tip: '', skip: false, h: '' });
          i++;
          progress(Math.round(i / state.chunks.length * 100),
            i + ' / ' + state.chunks.length + ' 段完成');
          return one();
        });
    }

    function afterChunks() {
      if (!withReimpl) { finish(false); return null; }
      progress(92, '正在做虚拟复现分析…');
      log('正文完成，开始第三遍的「虚拟复现」分析…');
      var digest = state.out.filter(function (o) { return o.zh || o.h; })
        .slice(0, 120).map(function (o) {
          return (o.h ? '【' + o.h + '】' : '') + (o.zh || '');
        }).join('\n');
      return callJSON(cfg, SYS_REIMPLEMENT,
        '论文名：' + state.docs[0].name + '\n\n下面是全文的中文要点：\n' + digest +
        '\n\n请做虚拟复现分析，输出 JSON。',
        false, '复现分析').then(function (o) {
        state.extra = o;
        log('✓ 虚拟复现分析完成', 'ok');
        finish(false);
      })['catch'](function (e) {
        log('✗ 复现分析失败：' + e.message + '（正文部分仍然可用）', 'err');
        finish(false);
      });
    }

    one();
  }

  /* ---- 批量综述 ---- */
  function runSurvey(cfg) {
    var docs = state.docs;
    log('批量综述：对 ' + docs.length + ' 篇各做一次第一遍…');
    var i = 0;
    function one() {
      if (state.stop) { finish(true); return null; }
      if (i >= docs.length) return aggregate();
      var idx = i, d = docs[idx];
      progress(Math.round(idx / (docs.length + 1) * 100),
        '第 ' + (idx + 1) + ' / ' + docs.length + ' 篇');
      return callJSON(cfg, SYS_SURVEY_ONE,
        '下面是论文《' + d.name + '》的骨架。请输出 JSON。\n\n' + buildScanInput(d.pages),
        false, '第 ' + (idx + 1) + ' 篇').then(function (o) {
        state.survey[idx] = o;
        log('✓ 第 ' + (idx + 1) + ' 篇：' + (o.one_line || '').slice(0, 40) + '…', 'ok');
        i++;
        return one();
      })['catch'](function (e) {
        log('✗ 第 ' + (idx + 1) + ' 篇失败：' + e.message, 'err');
        state.survey[idx] = {};
        i++;
        return one();
      });
    }
    function aggregate() {
      progress(Math.round(docs.length / (docs.length + 1) * 100), '正在汇总…');
      log('全部扫完，统计共同引用与高频作者…');
      state.stats = computeStats(state.survey);
      log('共同引用 ' + state.stats.refs.length + ' 条 · 高频作者 ' +
        state.stats.authors.length + ' 位', 'ok');
      var brief = state.survey.map(function (o, k) {
        return '第' + (k + 1) + '篇《' + docs[k].name + '》\n' +
          '一句话：' + (o.one_line || '') + '\n' +
          '类型：' + (o.category || '') + '\n' +
          '贡献：' + (o.contributions || '') + '\n' +
          '方法：' + (o.method || '') + '\n' +
          '局限：' + (o.limitations || '') + '\n' +
          '作者：' + arr(o.authors).join('、') + '\n' +
          '关键引用：' + arr(o.key_refs).join('；');
      }).join('\n\n');
      var stat = '【统计】共同被引用（≥2 次）：' +
        (state.stats.refs.map(function (r) { return r.k + '(' + r.n + ')'; }).join('；') || '无') +
        '\n高频作者（≥2 次）：' +
        (state.stats.authors.map(function (a) { return a.k + '(' + a.n + ')'; }).join('；') || '无');
      return callJSON(cfg, SYS_SURVEY_ALL,
        '共 ' + docs.length + ' 篇。\n\n' + brief + '\n\n' + stat + '\n\n请输出 JSON。',
        false, '综述汇总').then(function (o) {
        state.surveyAll = o;
        log('✓ 领域地图已生成', 'ok');
        finish(false);
      })['catch'](function (e) {
        log('✗ 汇总失败：' + e.message + '（各篇速览仍然可用）', 'err');
        state.surveyAll = {};
        finish(false);
      });
    }
    one();
  }

  /* ---------------- 收尾 ---------------- */
  function finish(stopped) {
    state.busy = false;
    $('#btnRun').disabled = false;
    $('#btnStop').disabled = true;
    if (stopped) { log('已停止。', 'warn'); return; }
    var pass = curPass(), html, fname;
    if (pass === '1') { html = buildScan(); fname = state.docs[0].name + PASSES['1'].suffix; }
    else if (pass === '4') { html = buildSurvey(); fname = '文献综述_' + state.docs.length + '篇'; }
    else if (pass === '3') { html = buildRead(true); fname = state.docs[0].name + PASSES['3'].suffix; }
    else { html = buildRead(false); fname = state.docs[0].name + PASSES['2'].suffix; }
    progress(100, '完成！');
    log('全部完成，正在生成 HTML…', 'ok');
    state.html = html;
    $('#preview').srcdoc = html;
    $('#result').style.display = 'block';
    $('#btnDown').onclick = function () {
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname + '.html';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    };
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#btnStop').addEventListener('click', function () {
    state.stop = true; $('#btnStop').disabled = true; log('正在停止…', 'warn');
  });
  $('#btnReset').addEventListener('click', function () {
    $('#result').style.display = 'none';
    $('#run').style.display = 'none';
    $('#log').innerHTML = '';
    state.out = []; state.docs = [];
    $('#btnClear').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------------- 日夜主题 ---------------- */
  var THEME_KEY = 'wxfyq.theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? '#4f46e5' : '#070c0a');
    var ic = document.getElementById('themeIcon');
    var tx = document.getElementById('themeTxt');
    if (ic) ic.textContent = t === 'light' ? '☀️' : '🌙';
    if (tx) tx.textContent = t === 'light' ? '日间' : '夜间';
  }
  (function () {
    var t = 'dark';
    try { t = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
    applyTheme(t);
    var b = document.getElementById('btnTheme');
    if (b) b.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light'
        ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  })();

  /* ---------------- 彩蛋 ---------------- */
  var clicks = 0, timer = null;
  $('#title').addEventListener('click', function () {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(function () { clicks = 0; }, 1200);
    if (clicks >= 5) {
      clicks = 0;
      var e = $('#egg');
      e.style.display = 'flex';
      setTimeout(function () { e.style.display = 'none'; }, 1600);
    }
  });

  loadCfg();
})();
