import type { FastifyInstance } from 'fastify'

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>x-pilot-e2b-server Admin</title>
  <style>
    :root{
      --bg:#060a16;
      --card:rgba(255,255,255,.06);
      --card2:rgba(255,255,255,.04);
      --border:rgba(255,255,255,.12);
      --text:#e8ebf5;
      --muted:rgba(232,235,245,.72);
      --muted2:rgba(232,235,245,.55);
      --primary:#60a5fa;
      --danger:#f87171;
      --ok:#34d399;
      --shadow: 0 20px 60px rgba(0,0,0,.55);
      color-scheme: dark;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      background: radial-gradient(1200px 600px at 10% 0%, rgba(96,165,250,.22), transparent 60%),
                  radial-gradient(900px 500px at 90% 20%, rgba(52,211,153,.14), transparent 60%),
                  var(--bg);
      color:var(--text);
    }
    a{color: #93c5fd; text-decoration:none}
    a:hover{text-decoration:underline}
    code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}

    .wrap{max-width:1180px;margin:0 auto;padding:22px}
    .top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .title{display:flex;flex-direction:column;gap:6px}
    h1{font-size:16px;margin:0;letter-spacing:.2px}
    .subtitle{font-size:12px;color:var(--muted)}

    .pill{
      display:inline-flex;align-items:center;gap:8px;
      padding:6px 10px;border:1px solid var(--border);
      border-radius:999px;background:rgba(0,0,0,.22);
      font-size:12px;color:var(--muted);
    }
    .dot{width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.35)}
    .dot.ok{background:var(--ok)}
    .dot.bad{background:var(--danger)}

    .grid{display:grid;grid-template-columns: 1.15fr .85fr; gap:12px}
    @media (max-width: 980px){ .grid{grid-template-columns:1fr} }

    .card{background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
    .cardHeader{padding:12px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card2)}
    .cardTitle{font-size:13px;color:var(--text);display:flex;align-items:center;gap:10px}
    .cardHint{font-size:12px;color:var(--muted)}
    .cardBody{padding:12px}

    label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px}
    input, textarea, select{
      width:100%;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.26);
      color:var(--text);
      padding:10px 12px;
      outline:none;
    }
    input:focus, textarea:focus, select:focus{border-color:rgba(96,165,250,.55); box-shadow: 0 0 0 4px rgba(96,165,250,.14)}

    textarea{min-height:420px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; line-height:1.5}

    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media (max-width: 620px){ .row{grid-template-columns:1fr} }

    .actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}

    button{
      border:1px solid rgba(255,255,255,.16);
      background:rgba(96,165,250,.18);
      color:var(--text);
      padding:10px 12px;
      border-radius:12px;
      cursor:pointer;
      font-size:13px;
    }
    button:hover{background:rgba(96,165,250,.26)}
    button.secondary{background:rgba(255,255,255,.08)}
    button.secondary:hover{background:rgba(255,255,255,.12)}
    button.danger{background:rgba(248,113,113,.16)}
    button.danger:hover{background:rgba(248,113,113,.22)}
    button:disabled{opacity:.55;cursor:not-allowed}

    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
    pre{
      margin:0;
      padding:12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(0,0,0,.26);
      white-space: pre-wrap;
      word-break: break-word;
      font-size:12px;
      line-height:1.5;
      color: rgba(232,235,245,.92);
    }
    .muted{color:var(--muted)}
    .muted2{color:var(--muted2)}

    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22)}
    .badge.ok{border-color:rgba(52,211,153,.35)}
    .badge.bad{border-color:rgba(248,113,113,.35)}

    .split{display:grid;grid-template-columns:1fr;gap:10px}
    .help ul{margin:8px 0 0 18px; padding:0}
    .help li{margin:6px 0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="title">
        <h1>x-pilot-e2b-server 管理面板</h1>
        <div class="subtitle">只改前端页面：一键推送 <span class="mono">scenes</span> → 返回并打开 <span class="mono">previewUrl</span>（接口：<span class="mono">POST /api/preview</span>）</div>
      </div>
      <div class="pill" id="healthPill" title="Health">
        <span class="dot" id="healthDot"></span>
        <span id="healthText">Health: 未检查</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">请求参数</div>
          <div class="cardHint">建议先用预置示例验证链路</div>
        </div>
        <div class="cardBody">
          <div class="row">
            <div>
              <label>预置示例</label>
              <select id="preset">
                <option value="dify_smoke" selected>Dify scenes（string[]）：Smoke（最稳）</option>
                <option value="dify_multi">Dify scenes（string[]）：3 段场景（带 @scene/@duration）</option>
                <option value="dify_components">Dify scenes（string[]）：使用内置组件（TitleCard/TitleGradient/useTheme）</option>
                <option value="files_manifest">文件写入：仅写 src/scenes/*.tsx + manifest.json</option>
              </select>
            </div>
            <div>
              <label>jobId（可选，不填自动生成）</label>
              <input id="jobId" placeholder="" />
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>token（相同 token 复用同一 sandbox）</label>
              <input id="token" placeholder="t_abc" />
            </div>
            <div>
              <label>userId（可选）</label>
              <input id="userId" placeholder="u_123" />
            </div>
          </div>

          <div style="margin-top:10px">
            <label>templateName（可选，覆盖服务端默认）</label>
            <input id="templateName" placeholder="x-pilot-remotion-template" />
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>templateId（可选，优先级最高）</label>
              <input id="templateId" placeholder="" />
            </div>
            <div>
              <label>waitForReady（默认 false）</label>
              <select id="waitForReady">
                <option value="false" selected>false</option>
                <option value="true">true</option>
              </select>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>startDev</label>
              <select id="startDev">
                <option value="true" selected>true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label>curl Base URL（仅用于生成 curl）</label>
              <input id="curlBase" value="http://localhost:8080" />
            </div>
          </div>

          <div style="margin-top:10px" class="actions">
            <button id="btnRun">一键测试（推送并返回 previewUrl）</button>
            <button id="btnRunOpen" class="secondary">一键测试并打开</button>
            <button id="btnFmt" class="secondary">格式化 JSON</button>
            <button id="btnReset" class="danger">恢复默认示例</button>
            <span id="status" class="muted2"></span>
          </div>

          <div class="help muted2" style="margin-top:10px">
            支持粘贴：
            <ul>
              <li><span class="mono">{ scenes: ["code", ...] }</span> 或直接 <span class="mono">["code", ...]</span></li>
              <li>或文件写入：<span class="mono">[{filePath, code}, ...]</span></li>
              <li>或你的 Dify 输出：<span class="mono">{ json_string: "...", code_array: ["...", ...] }</span></li>
              <li>兼容 <span class="mono">&#96;&#96;&#96;tsx ... &#96;&#96;&#96;</span> 代码围栏：会自动抽取围栏内 TSX 再推送</li>
              <li>约束：每个场景必须包含 <span class="mono">export default function Xxx()</span>（用于生成 scene id）</li>
            </ul>
          </div>

          <label style="margin-top:10px">scenes JSON</label>
          <textarea id="scenes"></textarea>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">结果 / 操作</div>
          <div class="cardHint"><span class="mono">previewUrl</span> 为空/白屏时，试试 <span class="mono">waitForReady=true</span></div>
        </div>
        <div class="cardBody">
          <div class="split">
            <div>
              <label>预览链接</label>
              <div class="actions">
                <button id="btnOpen" class="secondary" disabled>打开预览链接</button>
                <a id="previewLink" href="#" target="_blank" rel="noreferrer" style="display:none" class="badge ok">previewUrl</a>
                <button id="btnCopyUrl" class="secondary" disabled>复制 previewUrl</button>
              </div>
            </div>

            <div>
              <label>curl（可复制）</label>
              <div class="actions" style="margin-bottom:8px">
                <button id="btnCopyCurl" class="secondary">复制 curl</button>
                <button id="btnCopyPayload" class="secondary">复制 payload</button>
                <button id="btnHealth" class="secondary">检查 /health</button>
              </div>
              <pre id="curl" class="mono">(waiting)</pre>
            </div>

            <div>
              <label>返回结果</label>
              <pre id="result">(waiting)</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id)

  const els = {
    preset: $('preset'),
    token: $('token'),
    userId: $('userId'),
    jobId: $('jobId'),
    templateName: $('templateName'),
    templateId: $('templateId'),
    startDev: $('startDev'),
    waitForReady: $('waitForReady'),
    curlBase: $('curlBase'),
    scenes: $('scenes'),
    status: $('status'),
    btnRun: $('btnRun'),
    btnRunOpen: $('btnRunOpen'),
    btnFmt: $('btnFmt'),
    btnReset: $('btnReset'),
    result: $('result'),
    curl: $('curl'),
    previewLink: $('previewLink'),
    btnOpen: $('btnOpen'),
    btnCopyUrl: $('btnCopyUrl'),
    btnCopyCurl: $('btnCopyCurl'),
    btnCopyPayload: $('btnCopyPayload'),
    btnHealth: $('btnHealth'),
    healthDot: $('healthDot'),
    healthText: $('healthText'),
  }

  function now() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    )
  }

  function setStatus(msg, kind) {
    const k = kind || 'info'
    const prefix = k === 'ok' ? 'OK' : (k === 'bad' ? 'ERR' : 'INFO')
    els.status.textContent = '[' + prefix + '] ' + now() + '  ' + (msg || '')
  }

  function setPreview(url) {
    if (url) {
      els.previewLink.href = url
      els.previewLink.style.display = 'inline-flex'
      els.btnOpen.disabled = false
      els.btnCopyUrl.disabled = false
      els.btnOpen.onclick = () => window.open(url, '_blank', 'noreferrer')
      els.btnCopyUrl.onclick = async () => {
        try {
          await navigator.clipboard.writeText(url)
          setStatus('已复制 previewUrl', 'ok')
        } catch {
          setStatus('复制失败（浏览器权限限制）', 'bad')
        }
      }
    } else {
      els.previewLink.href = '#'
      els.previewLink.style.display = 'none'
      els.btnOpen.disabled = true
      els.btnCopyUrl.disabled = true
      els.btnOpen.onclick = null
      els.btnCopyUrl.onclick = null
    }
  }

  function stripMarkdownCodeFence(input) {
    const s = String(input || '')

    // Dify 可能直接把 TSX 包在 Markdown 代码块里（tsx fenced code block）
    const m = s.match(/\x60\x60\x60[^\n]*\n([\s\S]*?)\x60\x60\x60/)
    if (m && typeof m[1] === 'string') return m[1]

    return s
  }

  function normalizeSceneCode(code) {
    const raw = stripMarkdownCodeFence(code)
    // 去掉 BOM / 多余空白，保留末尾换行，避免写入文件时粘连
    const trimmed = String(raw).replace(/^\uFEFF/, '').trim()
    return trimmed.length > 0 ? trimmed + '\n' : ''
  }

  function hasValidDefaultExport(code) {
    // 服务端会用函数名生成 scene id：要求 export default function Xxx()
    return /export\s+default\s+(?:async\s+)?function\s+\w+\s*\(/.test(code)
  }

  function stripOuterMarkdownFence(input) {
    const s = String(input || '')
    const m = s.match(/^\s*\x60\x60\x60[^\n]*\n([\s\S]*?)\n?\x60\x60\x60\s*$/)
    if (m && typeof m[1] === 'string') return m[1]
    return s
  }

  function extractLikelyJson(input) {
    const s = String(input || '')
    const firstBrace = s.indexOf('{')
    const firstBracket = s.indexOf('[')
    const first =
      firstBrace === -1 ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket))

    if (first === -1) return null

    const lastBrace = s.lastIndexOf('}')
    const lastBracket = s.lastIndexOf(']')
    const last = Math.max(lastBrace, lastBracket)

    if (last === -1 || last <= first) return null

    return s.slice(first, last + 1)
  }

  function parseScenes(text) {
    const pre = stripOuterMarkdownFence(text)
    const trimmed = (pre || '').trim()
    if (!trimmed) throw new Error('输入为空')

    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch (e) {
      const extracted = extractLikelyJson(trimmed)
      if (extracted) {
        try {
          parsed = JSON.parse(extracted)
        } catch {
          // fall through
        }
      }

      throw new Error('JSON 解析失败：' + (e && e.message ? e.message : String(e)))
    }

    // 兼容多种输入：
    // 1) { scenes: string[] }
    // 2) string[]
    // 3) [{filePath, code}, ...]
    // 4) { json_string: "...", code_array: string[] }（你的 Dify 输出）
    // 5) { json_string: "..." }（json_string 自身就是一个可解析的 JSON，且内部包含 scenes / code_array）

    // Dify bundle：保留 json_string + code_array，让服务端生成正确的 manifest（duration/name/id）
    if (parsed && typeof parsed === 'object' && typeof parsed.json_string === 'string' && Array.isArray(parsed.code_array)) {
      const json_string = stripOuterMarkdownFence(parsed.json_string).trim()
      const code_array = parsed.code_array.map((s) => normalizeSceneCode(s)).filter(Boolean)
      if (!json_string) throw new Error('json_string 为空')
      if (code_array.length === 0) throw new Error('code_array 为空')
      return { dify: { json_string, code_array } }
    }

    let scenes = parsed

    let parsedFromJsonString = null

    if (parsed && typeof parsed === 'object' && typeof parsed.json_string === 'string') {
      try {
        const inner = stripOuterMarkdownFence(parsed.json_string)
        parsedFromJsonString = JSON.parse(inner)
      } catch {
        parsedFromJsonString = null
      }
    }

    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.scenes)) scenes = parsed.scenes
      else if (Array.isArray(parsed.code_array)) scenes = parsed.code_array
      else if (parsedFromJsonString && typeof parsedFromJsonString === 'object') {
        if (Array.isArray(parsedFromJsonString.scenes)) scenes = parsedFromJsonString.scenes
        else if (Array.isArray(parsedFromJsonString.code_array)) scenes = parsedFromJsonString.code_array
      }
    }

    if (!Array.isArray(scenes)) {
      throw new Error('输入必须是数组，或对象里包含 scenes / code_array 数组')
    }

    if (scenes.length === 0) throw new Error('数组为空')

    // 1) string[]：Dify 场景代码数组（可能带 tsx fenced code block / 夹杂 Markdown）
    if (typeof scenes[0] === 'string') {
      const normalized = scenes.map((s, idx) => {
        const code = normalizeSceneCode(s)
        if (!code) throw new Error('scenes[' + idx + '] 为空')
        if (!hasValidDefaultExport(code)) {
          throw new Error('scenes[' + idx + '] 缺少 "export default function Xxx()"（可能粘贴了 Markdown，或围栏未去掉）')
        }
        return code
      })

      return normalized
    }

    // 2) 文件写入：[{filePath, code}, ...]
    const normalized = scenes.map((s, idx) => {
      if (!s || typeof s !== 'object') throw new Error('scenes[' + idx + '] 不是对象')
      const filePath = s.filePath || s.path
      const code = normalizeSceneCode(s.code)
      if (typeof filePath !== 'string' || !filePath) throw new Error('scenes[' + idx + '].filePath 缺失/非法')
      if (!code) throw new Error('scenes[' + idx + '].code 缺失/非法')
      return { filePath, code }
    })

    return normalized
  }

  function buildPayload() {
    const input = parseScenes(els.scenes.value)

    const payload = {
      userId: els.token.value.trim() || els.userId.value.trim() || undefined,
      jobId: els.jobId.value.trim() || undefined,
      templateName: els.templateName.value.trim() || undefined,
      templateId: els.templateId.value.trim() || undefined,
      startDev: els.startDev.value === 'true',
      waitForReady: els.waitForReady.value === 'true',
    }

    if (Array.isArray(input)) {
      payload.scenes = input
      return payload
    }

    if (input && typeof input === 'object' && input.dify) {
      payload.dify = input.dify
      return payload
    }

    throw new Error('输入解析失败：未知格式')
  }


  function escapeBashSingleQuotes(s) {
    return String(s).replace(/'/g, "'\"'\"'")
  }

  function renderCurl(payload) {
    const base = (els.curlBase.value || '').trim().replace(/\/+$/, '') || 'http://localhost:8080'
    const json = JSON.stringify(payload)
    const body = escapeBashSingleQuotes(json)
    els.curl.textContent =
      'curl -sS -X POST ' + base + '/api/preview \\\n' +
      "  -H 'Content-Type: application/json' \\\n" +
      "  -d '" +
      body +
      "' | cat"
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(okMsg, 'ok')
    } catch {
      setStatus('复制失败（浏览器权限限制）', 'bad')
    }
  }

  async function runPreview({ autoOpen }) {
    els.btnRun.disabled = true
    els.btnRunOpen.disabled = true
    setPreview(null)
    els.result.textContent = ''

    // 注意：如果等 fetch 完再 window.open，会被浏览器当成非用户手势而拦截，表现为 about:blank 白屏且无网络。
    // 因此 autoOpen 时先同步打开一个窗口，后续再把 location 指向 previewUrl。
    let pop = null
    if (autoOpen) {
      try {
        pop = window.open('about:blank', '_blank')
      } catch {
        pop = null
      }
    }

    let payload
    try {
      payload = buildPayload()
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      setStatus(msg, 'bad')
      els.result.textContent = msg
      els.curl.textContent = '(waiting)'
      if (pop && typeof pop.close === 'function') {
        try { pop.close() } catch { /* ignore */ }
      }
      els.btnRun.disabled = false
      els.btnRunOpen.disabled = false
      return
    }

    renderCurl(payload)
    setStatus('请求中...', 'info')

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = text }

      els.result.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

      if (!res.ok) {
        setStatus('失败：HTTP ' + res.status, 'bad')
        if (pop && typeof pop.close === 'function') {
          try { pop.close() } catch { /* ignore */ }
        }
        return
      }

      if (data && data.previewUrl) {
        setPreview(data.previewUrl)

        if (data.devServerReachable === false && data.devBundleReachable === false) {
          const s1 = data.devServerStatus || '-'
          const s2 = data.devBundleStatus || '-'
          setStatus('已返回 previewUrl，但探测不可达：/=' + s1 + ' /bundle.js=' + s2 + '（可尝试 waitForReady=true 或换 token 新建 sandbox）', 'bad')
          if (pop && typeof pop.close === 'function') {
            try { pop.close() } catch { /* ignore */ }
          }
          return
        }

        if (data.devServerReachable === false || data.devBundleReachable === false) {
          const s1 = data.devServerStatus || '-'
          const s2 = data.devBundleStatus || '-'
          setStatus('已返回 previewUrl，但探测不稳定：/=' + s1 + ' /bundle.js=' + s2 + '（建议 waitForReady=true；必要时刷新 preview）', 'bad')
        } else {
          setStatus('完成：已返回 previewUrl', 'ok')
        }

        if (autoOpen) {
          if (pop && pop.location) {
            try { pop.location.href = data.previewUrl } catch { /* ignore */ }
          } else {
            setStatus('浏览器拦截了弹窗：请点击右侧“打开预览链接”手动打开', 'bad')
          }
        }
      } else {
        setStatus('完成：未返回 previewUrl（检查返回内容）', 'bad')
        if (pop && typeof pop.close === 'function') {
          try { pop.close() } catch { /* ignore */ }
        }
      }
    } catch (e) {
      els.result.textContent = String(e && e.stack ? e.stack : e)
      setStatus('请求异常', 'bad')
      if (pop && typeof pop.close === 'function') {
        try { pop.close() } catch { /* ignore */ }
      }
    } finally {
      els.btnRun.disabled = false
      els.btnRunOpen.disabled = false
    }
  }

  async function checkHealth() {
    els.healthDot.className = 'dot'
    els.healthText.textContent = 'Health: 检查中...'
    try {
      const res = await fetch('/health/', { method: 'GET' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json().catch(() => null)
      const ok = data && data.ok === true
      els.healthDot.className = 'dot ' + (ok ? 'ok' : 'bad')
      els.healthText.textContent = 'Health: ' + (ok ? 'OK' : 'Unknown')
    } catch {
      els.healthDot.className = 'dot bad'
      els.healthText.textContent = 'Health: Error'
    }
  }

  function setPreset(name) {
    const difySmoke = {
      scenes: [
        "// @scene 预览验证\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function ScenePreviewSmoke() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center', fontSize: 56, fontWeight: 800 }}\n    >x-pilot-e2b-server admin preview OK</AbsoluteFill>\n  );\n}\n",
      ],
    }

    const difyMulti = {
      scenes: [
        "// @scene 标题页\n// @duration 60\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function SceneTitle() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ textAlign: 'center' }}>\n        <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: 0.4 }}>Admin 一键测试</div>\n        <div style={{ marginTop: 14, fontSize: 22, opacity: 0.75 }}>Dify scenes（string[]）</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 内容页\n// @duration 120\nimport React from 'react';\nimport { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';\n\nexport default function SceneBody() {\n  const f = useCurrentFrame();\n  const y = interpolate(f, [0, 25], [16, 0], { extrapolateRight: 'clamp' });\n  const o = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#111827', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ transform: 'translateY(' + y + 'px)', opacity: o, textAlign: 'center' }}>\n        <div style={{ fontSize: 36, fontWeight: 800 }}>链路 OK</div>\n        <div style={{ marginTop: 10, fontSize: 18, opacity: 0.8 }}>只写 scenes + manifest，不改 Root/VideoComposition</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 尾页\n// @duration 60\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function SceneOutro() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ fontSize: 34, opacity: 0.9 }}>打开 Remotion Studio 选择 Composition 预览</div>\n    </AbsoluteFill>\n  );\n}\n",
      ],
    }

    const difyComponents = {
      scenes: [
        "// @scene 标题卡\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\nimport { TitleCard } from '../components';\n\nexport default function SceneTitleCard() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020' }}>\n      <TitleCard title=\"Dify → E2B\" subtitle=\"内置组件示例（TitleCard）\" />\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 渐变标题\n// @duration 120\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\nimport { TitleGradient } from '../components/narrative-typography/TitleGradient';\n\nexport default function SceneGradientTitle() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ width: 1200 }}>\n        <TitleGradient text=\"概率与统计\" />\n        <div style={{ marginTop: 14, fontSize: 20, opacity: 0.75, color: 'white' }}>components/narrative-typography/TitleGradient</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 主题颜色\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\nimport { useTheme } from '../contexts/ThemeContext';\n\nexport default function SceneTheme() {\n  const t = useTheme();\n  return (\n    <AbsoluteFill style={{ backgroundColor: t.background, justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ textAlign: 'center' }}>\n        <div style={{ fontSize: 52, fontWeight: 900, color: t.primary }}>Theme OK</div>\n        <div style={{ marginTop: 10, fontSize: 20, color: t.text, opacity: 0.85 }}>useTheme() from contexts/ThemeContext</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
      ],
    }

    const manifest = {
      version: '1.0.0',
      fps: 30,
      width: 1920,
      height: 1080,
      theme: 'tech',
      scenes: [
        { id: 'scene_preview_smoke', name: '预览验证', durationInFrames: 90, component: 'scene_preview_smoke.tsx' },
      ],
    }

    const filesManifest = [
      {
        filePath: 'src/scenes/scene_preview_smoke.tsx',
        code:
          "// @scene 预览验证\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function ScenePreviewSmoke() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center', fontSize: 52, fontWeight: 800 }}\n    >files[] write OK</AbsoluteFill>\n  );\n}\n" ,
      },
      {
        filePath: 'src/scenes/manifest.json',
        code: JSON.stringify(manifest, null, 2) + '\n',
      },
    ]

    if (name === 'dify_multi') {
      els.scenes.value = JSON.stringify(difyMulti, null, 2)
      return
    }

    if (name === 'dify_components') {
      els.scenes.value = JSON.stringify(difyComponents, null, 2)
      return
    }

    if (name === 'files_manifest') {
      els.scenes.value = JSON.stringify(filesManifest, null, 2)
      return
    }

    els.scenes.value = JSON.stringify(difySmoke, null, 2)
  }

  function resetDefaults() {
    els.token.value = ''
    els.userId.value = ''
    els.jobId.value = ''
    els.templateName.value = ''
    els.templateId.value = ''
    els.startDev.value = 'true'
    els.waitForReady.value = 'false'
    els.preset.value = 'dify_smoke'
    setPreset('dify_smoke')
    els.result.textContent = '(waiting)'
    els.curl.textContent = '(waiting)'
    setPreview(null)
    setStatus('已恢复默认示例', 'ok')
  }

  els.preset.addEventListener('change', () => {
    setPreset(els.preset.value)
    setStatus('已切换预置', 'ok')
  })

  els.btnFmt.addEventListener('click', () => {
    try {
      const scenes = parseScenes(els.scenes.value)
      els.scenes.value = JSON.stringify(scenes, null, 2)
      setStatus('已格式化 JSON', 'ok')
    } catch (e) {
      setStatus(e.message, 'bad')
    }
  })

  els.btnReset.addEventListener('click', () => {
    resetDefaults()
  })

  els.btnRun.addEventListener('click', () => runPreview({ autoOpen: false }))
  els.btnRunOpen.addEventListener('click', () => runPreview({ autoOpen: true }))

  els.btnCopyCurl.addEventListener('click', () => {
    const t = els.curl.textContent || ''
    void copyText(t, '已复制 curl')
  })

  els.btnCopyPayload.addEventListener('click', () => {
    try {
      const payload = buildPayload()
      void copyText(JSON.stringify(payload, null, 2), '已复制 payload')
    } catch (e) {
      setStatus(e.message, 'bad')
    }
  })

  els.btnHealth.addEventListener('click', () => {
    void checkHealth()
  })

  // init
  resetDefaults()
  void checkHealth()
</script>
</body>
</html>`

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin', async (_req, reply) => {
    return reply.type('text/html; charset=utf-8').send(html)
  })
}
