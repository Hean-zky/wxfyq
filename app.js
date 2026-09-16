/* 文献翻译器 —— 纯前端版
 * 上传 PDF → 提取文字 → 调大模型逐段翻译 → 生成离线 HTML 笔记
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

  var state = { pages: [], name: '', chunks: [], out: [], stop: false, busy: false };

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
  }
  function saveCfg() {
    var p = $('#provider').value;
    localStorage.setItem('wxfyq.provider', p);
    localStorage.setItem('wxfyq.key', $('#key').value.trim());
    localStorage.setItem('wxfyq.cfg', JSON.stringify({
      base: $('#base').value.trim(), model: $('#model').value.trim()
    }));
  }
  $('#provider').addEventListener('change', function () {
    var p = PROVIDERS[$('#provider').value];
    if (p && p.base) { $('#base').value = p.base; $('#model').value = p.model; }
    saveCfg();
  });
  ['#key', '#base', '#model'].forEach(function (s) {
    $(s).addEventListener('change', saveCfg);
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
  $('#btnPick').addEventListener('click', function () { $('#file').click(); });
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  $('#file').addEventListener('change', function () {
    if (this.files[0]) handleFile(this.files[0]);
  });
  $('#btnClear').addEventListener('click', function () {
    state.pages = []; state.name = '';
    $('#file').value = '';
    $('#fileBox').style.display = 'none';
    $('#btnRun').disabled = true;
  });

  function handleFile(f) {
    if (!/pdf$/i.test(f.name)) { alert('请选一个 PDF 文件'); return; }
    state.name = f.name.replace(/\.pdf$/i, '');
    $('#fName').textContent = f.name;
    $('#fStat').textContent = '正在读取…';
    $('#fileBox').style.display = 'block';
    $('#btnRun').disabled = true;

    var rd = new FileReader();
    rd.onload = function () {
      parsePDF(new Uint8Array(rd.result)).then(function (pages) {
        var words = pages.join('').replace(/\s+/g, '').length;
        state.pages = pages;
        $('#fStat').textContent = pages.length + ' 页 · 约 ' + words + ' 字 · 预计切成 '
          + Math.max(1, Math.ceil(pages.join(' ').length / 1600)) + ' 段';
        if (words < 200) {
          $('#fStat').textContent += '（⚠️ 文字很少，可能是扫描件/图片 PDF）';
        }
        $('#btnRun').disabled = false;
      })['catch'](function (e) {
        console.error(e);
        $('#fStat').textContent = '读取失败：' + e.message;
      });
    };
    rd.readAsArrayBuffer(f);
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

  /* ---------------- 切段 ---------------- */
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

  /* ---------------- 调模型 ---------------- */
  var SYSTEM = [
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
    '4. JSON 必须合法：字符串内换行写成 \\n，不要用真实换行；不要出现未转义的引号。',
    '5. 只输出 JSON 数组本身。'
  ].join('\n');

  function callLLM(cfg, userMsg) {
    var url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
        temperature: 0.2
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

  /* ---------------- 生成最终 HTML ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var OUT_CSS = [
    ':root{--bg:#070c0a;--card:#0c1512;--ink:#e8fff6;--ink2:#b6d8cb;--muted:#7d9c92;',
    '--line:rgba(0,255,157,.16);--line2:rgba(0,255,157,.32);',
    '--en-bg:rgba(255,255,255,.035);--en-ink:#9fc9ba;',
    '--tip-bg:rgba(0,255,157,.07);--tip-line:#00ff9d;--tip-ink:#b8ffe4;--hd:#00ff9d}',
    '*{box-sizing:border-box}',
    'html,body{margin:0}',
    'body{position:relative;background:var(--bg);color:var(--ink);',
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-size:15px;line-height:1.85}',
    'body::before{content:"";position:fixed;inset:0;z-index:-1;',
    'background-image:linear-gradient(rgba(0,255,157,.04) 1px,transparent 1px),',
    'linear-gradient(90deg,rgba(0,255,157,.04) 1px,transparent 1px);background-size:46px 46px;',
    '-webkit-mask-image:radial-gradient(110% 70% at 50% 0%,#000 20%,transparent 75%);',
    'mask-image:radial-gradient(110% 70% at 50% 0%,#000 20%,transparent 75%)}',
    '.wrap{max-width:1100px;margin:0 auto;padding:26px 18px 70px}',
    '.card{background:var(--card);border:1px solid var(--line);border-radius:14px;',
    'padding:24px 26px;margin-bottom:20px;box-shadow:0 1px 2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.03)}',
    'h1{font-size:25px;margin:0 0 6px;color:#eafff7}',
    'h2{font-size:19px;margin:0 0 14px;padding-bottom:9px;border-bottom:1px solid var(--line2);color:var(--hd)}',
    'h3{font-size:16.5px;margin:24px 0 8px;color:#8fffd0}',
    '.sub{color:var(--muted);font-size:14px}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}',
    '.chip{background:rgba(0,255,157,.08);border:1px solid var(--line2);color:#8fffd0;',
    'border-radius:999px;padding:3px 12px;font-size:12.5px}',
    '.btn{border:1px solid var(--line2);background:rgba(0,255,157,.08);color:var(--hd);',
    'border-radius:10px;padding:7px 14px;font-size:13.5px;cursor:pointer;font-family:inherit}',
    '.btn:hover{background:rgba(0,255,157,.16)}',
    '.pair{margin:0 0 18px;padding-bottom:16px;border-bottom:1px dashed rgba(0,255,157,.14)}',
    '.en{background:var(--en-bg);color:var(--en-ink);border-left:3px solid rgba(0,255,157,.35);',
    'border-radius:0 8px 8px 0;padding:10px 14px;font-size:14px;margin-bottom:8px;white-space:pre-wrap}',
    '.zh{padding:2px 2px 6px;font-size:15.5px}',
    '.tip{background:var(--tip-bg);border-left:3px solid var(--tip-line);color:var(--tip-ink);',
    'border-radius:0 8px 8px 0;padding:10px 14px;font-size:14.5px;margin-top:6px;white-space:pre-wrap}',
    'body.hide-en .en{display:none}',
    'footer{text-align:center;color:var(--muted);font-size:12.5px;margin-top:24px}',
    '.tiny{margin-top:8px;font-size:11px;color:#3f6a5d;opacity:.35;transition:opacity .6s}',
    '.tiny:hover{opacity:1;color:var(--hd)}',
    '::-webkit-scrollbar{width:9px}::-webkit-scrollbar-thumb{background:rgba(0,255,157,.25);border-radius:9px}'
  ].join('');

  function buildOut() {
    var body = '';
    state.out.forEach(function (o) {
      if (o.h) body += '<h3>' + esc(o.h) + '</h3>';
      if (o.skip && !o.zh) return;
      body += '<div class="pair">';
      if (o.en) body += '<div class="en">' + esc(o.en) + '</div>';
      if (o.zh) body += '<div class="zh">' + esc(o.zh) + '</div>';
      if (o.tip) body += '<div class="tip">💡 ' + esc(o.tip) + '</div>';
      body += '</div>';
    });
    var now = new Date();
    var stamp = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
      ('0' + now.getDate()).slice(-2);
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="theme-color" content="#070c0a">' +
      '<meta name="author" content="Lirael">' +
      '<title>' + esc(state.name) + ' · 中英对照解读</title><style>' + OUT_CSS + '</style></head><body>' +
      '<div class="wrap">' +
      '<div class="card">' +
      '<h1>' + esc(state.name) + '</h1>' +
      '<div class="sub">英文原文 · 中文翻译 · 大白话解读</div>' +
      '<div class="meta">' +
      '<span class="chip">生成日期 ' + stamp + '</span>' +
      '<span class="chip">模型 ' + esc($('#model').value.trim()) + '</span>' +
      '<span class="chip">共 ' + state.out.length + ' 段</span>' +
      '</div>' +
      '<button class="btn" onclick="document.body.classList.toggle(\'hide-en\')">👁 显示 / 隐藏英文原文</button>' +
      '</div>' +
      '<div class="card"><h2>正文</h2>' + body + '</div>' +
      '<footer>本文件由「文献翻译器」生成 · 可离线打开' +
      '<div class="tiny">crafted by <b>Lirael</b></div></footer>' +
      '</div></body></html>';
  }

  /* ---------------- 主流程 ---------------- */
  $('#btnRun').addEventListener('click', function () {
    var key = $('#key').value.trim();
    var base = $('#base').value.trim();
    var model = $('#model').value.trim();
    if (!key) { alert('请先填 API Key'); return; }
    if (!base) { alert('请先填接口地址'); return; }
    if (!model) { alert('请先填模型名'); return; }
    if (!state.pages.length) { alert('请先选一个 PDF'); return; }
    saveCfg();

    $('#run').style.display = 'block';
    $('#result').style.display = 'none';
    $('#log').innerHTML = '';
    state.stop = false; state.busy = true; state.out = [];
    $('#btnRun').disabled = true; $('#btnStop').disabled = false;

    state.chunks = buildChunks(state.pages);
    log('共 ' + state.pages.length + ' 页，切成 ' + state.chunks.length + ' 段，开始翻译…');
    progress(2, '0 / ' + state.chunks.length + ' 段');

    var cfg = { key: key, base: base, model: model };
    var i = 0;

    function one() {
      if (state.stop) { finish(true); return null; }
      if (i >= state.chunks.length) { finish(false); return null; }
      var idx = i;
      var msg = '下面是论文的第 ' + (idx + 1) + ' / ' + state.chunks.length + ' 段原文：\n\n[[' +
        (idx + 1) + ']]\n' + state.chunks[idx] + '\n\n请按要求输出 JSON 数组。';
      return callLLM(cfg, msg).then(function (txt) {
        var arr;
        try { arr = parseArr(txt); }
        catch (e) {
          log('第 ' + (idx + 1) + ' 段返回不是合法 JSON，重试一次…', 'warn');
          return callLLM(cfg, msg).then(function (t2) {
            arr = parseArr(t2);
            return arr;
          });
        }
        return arr;
      }).then(function (arr) {
        (arr || []).forEach(function (o) {
          state.out.push({
            en: o.en || '', zh: o.zh || '', tip: o.tip || '',
            skip: !!o.skip, h: o.h || ''
          });
        });
        i++;
        progress(Math.round(i / state.chunks.length * 100), i + ' / ' + state.chunks.length + ' 段完成');
        log('✓ 第 ' + (idx + 1) + ' 段完成（累计 ' + state.out.length + ' 条）', 'ok');
        return one();
      })['catch'](function (e) {
        log('✗ 第 ' + (idx + 1) + ' 段失败：' + e.message, 'err');
        if (state.stop) { finish(true); return null; }
        // 失败也往下走，但把原文保留下来，方便人工补
        state.out.push({ en: state.chunks[idx], zh: '', tip: '', skip: false, h: '' });
        i++;
        progress(Math.round(i / state.chunks.length * 100), i + ' / ' + state.chunks.length + ' 段完成');
        return one();
      });
    }

    function finish(stopped) {
      state.busy = false;
      $('#btnRun').disabled = false;
      $('#btnStop').disabled = true;
      if (stopped) { log('已停止。', 'warn'); return; }
      progress(100, '完成！共 ' + state.out.length + ' 段');
      log('全部完成，正在生成 HTML…', 'ok');
      var html = buildOut();
      $('#preview').srcdoc = html;
      $('#result').style.display = 'block';
      $('#btnDown').onclick = function () {
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = state.name + '_中英对照解读.html';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      };
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    one();
  });

  $('#btnStop').addEventListener('click', function () {
    state.stop = true; $('#btnStop').disabled = true; log('正在停止…', 'warn');
  });
  $('#btnReset').addEventListener('click', function () {
    $('#result').style.display = 'none';
    $('#run').style.display = 'none';
    $('#log').innerHTML = '';
    state.out = []; state.pages = [];
    $('#btnClear').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

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
