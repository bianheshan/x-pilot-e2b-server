import type { FastifyInstance } from 'fastify'

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>x-pilot-e2b-server Local Admin</title>
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
    code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
    .wrap{max-width:1180px;margin:0 auto;padding:22px}
    .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
    .title{display:flex;flex-direction:column;gap:6px}
    h1{font-size:16px;margin:0;letter-spacing:.2px}
    .subtitle{font-size:12px;color:var(--muted)}
    .grid{display:grid;grid-template-columns: 1.15fr .85fr; gap:12px}
    @media (max-width: 980px){ .grid{grid-template-columns:1fr} }
    .card{background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
    .cardHeader{padding:12px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card2)}
    .cardTitle{font-size:13px;color:var(--text)}
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
    .muted2{color:var(--muted2)}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="title">
        <h1>Local Admin（仅写入本地模板目录）</h1>
        <div class="subtitle">把 <span class="mono">scenes</span> 推送到局域网服务器的模板工程目录（接口：<span class="mono">POST /api/local/push</span>）。不创建 sandbox、不鉴权。</div>
      </div>
      <div class="muted2" style="font-size:12px">提示：如果跨机器访问，请把“目标服务器 Base URL”填成局域网 IP</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">请求参数</div>
          <div class="cardHint">支持 Dify scenes / files[] 写入</div>
        </div>
        <div class="cardBody">
          <div class="row">
            <div>
              <label>预置示例</label>
              <select id="preset">
                <option value="dify_smoke" selected>Dify scenes（string[]）：Smoke</option>
                <option value="dify_multi">Dify scenes（string[]）：3 段场景</option>
                <option value="files_manifest">文件写入：写 src/scenes/*.tsx + manifest.json</option>
              </select>
            </div>
            <div>
              <label>clearScenes（Dify 模式：先清空 src/scenes/*.tsx + manifest.json）</label>
              <select id="clearScenes">
                <option value="true" selected>true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div>
              <label>目标环境快捷填充</label>
              <select id="targetPreset">
                <option value="local_mac" selected>本机（localhost + mac 路径）</option>
                <option value="lan_windows">局域网 Windows（192.168.50.186 + C:\\...）</option>
              </select>
            </div>
            <div>
              <label>说明</label>
              <div class="muted2" style="font-size:12px; line-height:1.4">可先选预设再手动微调下方两项</div>
            </div>
          </div>

          <div style="margin-top:10px">
            <label>目标服务器 Base URL（可选，不填默认当前页面 origin）</label>
            <input id="targetBase" placeholder="http://localhost:8080" />
          </div>

          <div style="margin-top:10px">
            <label>projectDir（可选，服务器本机绝对路径：可填项目根目录或直接填 src/scenes 目录；不填用服务端默认 env.LOCAL_PROJECT_DIR）</label>
            <input id="projectDir" placeholder="/Users/bianheshan/code/x-pilot-video-render/src/scenes" />
          </div>

          <div style="margin-top:10px" class="actions">
            <button id="btnRun">推送到本地服务器</button>
            <button id="btnFmt" class="secondary">格式化 JSON</button>
            <button id="btnReset" class="danger">恢复默认示例</button>
            <span id="status" class="muted2"></span>
          </div>

          <label style="margin-top:10px">scenes JSON</label>
          <textarea id="scenes"></textarea>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">结果 / curl</div>
          <div class="cardHint">写入成功后，在服务器上跑本地 Remotion Studio 即可看到新场景</div>
        </div>
        <div class="cardBody">
          <div>
            <label>curl（可复制）</label>
            <pre id="curl" class="mono">(waiting)</pre>
          </div>
          <div style="margin-top:10px">
            <label>返回结果</label>
            <pre id="result">(waiting)</pre>
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id)

  const els = {
    preset: $('preset'),
    clearScenes: $('clearScenes'),
    targetPreset: $('targetPreset'),
    targetBase: $('targetBase'),
    projectDir: $('projectDir'),
    scenes: $('scenes'),
    status: $('status'),
    btnRun: $('btnRun'),
    btnFmt: $('btnFmt'),
    btnReset: $('btnReset'),
    result: $('result'),
    curl: $('curl'),
  }

  const targetPresets = {
    local_mac: {
      targetBase: 'http://localhost:8080',
      projectDir: '/Users/bianheshan/code/x-pilot-video-render/src/scenes',
    },
    lan_windows: {
      targetBase: 'http://192.168.50.186:8080',
      projectDir: 'C:\\Users\\bianh\\x-pilot-video-render\\src\\scenes',
    },
  }

  function applyTargetPreset() {
    const key = els.targetPreset && els.targetPreset.value ? els.targetPreset.value : 'local_mac'
    const p = targetPresets[key] || targetPresets.local_mac
    els.targetBase.value = p.targetBase
    els.projectDir.value = p.projectDir
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

  function stripMarkdownCodeFence(input) {
    const s = String(input || '')
    const m = s.match(/\x60\x60\x60[^\n]*\n([\s\S]*?)\x60\x60\x60/)
    if (m && typeof m[1] === 'string') return m[1]
    return s
  }

  function normalizeSceneCode(code) {
    const raw = stripMarkdownCodeFence(code)
    const trimmed = String(raw).replace(/^\uFEFF/, '').trim()
    return trimmed.length > 0 ? trimmed + '\n' : ''
  }

  function hasValidDefaultExport(code) {
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

    if (typeof scenes[0] === 'string') {
      const normalized = scenes.map((s, idx) => {
        const code = normalizeSceneCode(s)
        if (!code) throw new Error('scenes[' + idx + '] 为空')
        if (!hasValidDefaultExport(code)) {
          throw new Error('scenes[' + idx + '] 缺少 "export default function Xxx()"')
        }
        return code
      })

      return normalized
    }

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

  function escapeBashSingleQuotes(s) {
    return String(s).replace(/'/g, "'\"'\"'")
  }

  function getTargetBase() {
    const v = (els.targetBase.value || '').trim().replace(/\/+$/, '')
    if (v) return v
    return window.location.origin
  }

  function buildPayload() {
    const input = parseScenes(els.scenes.value)
    const projectDir = (els.projectDir.value || '').trim()

    const payload = {
      projectDir: projectDir || undefined,
      clearScenes: els.clearScenes.value === 'true',
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


  function renderCurl(payload) {
    const base = getTargetBase()
    const json = JSON.stringify(payload)
    const body = escapeBashSingleQuotes(json)
    els.curl.textContent =
      'curl -sS -X POST ' + base + '/api/local/push \\\n' +
      "  -H 'Content-Type: application/json' \\\n" +
      "  -d '" +
      body +
      "' | cat"
  }

  async function runPush() {
    els.btnRun.disabled = true
    setStatus('请求中...', 'info')
    els.result.textContent = ''

    let payload
    try {
      payload = buildPayload()
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      setStatus(msg, 'bad')
      els.result.textContent = msg
      els.btnRun.disabled = false
      return
    }

    renderCurl(payload)

    const base = getTargetBase()

    try {
      const res = await fetch(base + '/api/local/push', {
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
        return
      }

      setStatus('完成：已写入本地模板目录', 'ok')
    } catch (e) {
      els.result.textContent = String(e && e.stack ? e.stack : e)
      setStatus('请求异常', 'bad')
    } finally {
      els.btnRun.disabled = false
    }
  }

  function setPreset(name) {
    const difySmoke = {
      scenes: [
        "// @scene 预览验证\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function ScenePreviewSmoke() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center', fontSize: 56, fontWeight: 800 }}\n    >local push OK</AbsoluteFill>\n  );\n}\n",
      ],
    }

    const difyMulti = {
      scenes: [
        "// @scene 标题页\n// @duration 60\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function SceneTitle() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ textAlign: 'center' }}>\n        <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: 0.4 }}>Local Push</div>\n        <div style={{ marginTop: 14, fontSize: 22, opacity: 0.75 }}>Dify scenes（string[]）</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 内容页\n// @duration 120\nimport React from 'react';\nimport { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';\n\nexport default function SceneBody() {\n  const f = useCurrentFrame();\n  const y = interpolate(f, [0, 25], [16, 0], { extrapolateRight: 'clamp' });\n  const o = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#111827', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ transform: 'translateY(' + y + 'px)', opacity: o, textAlign: 'center' }}>\n        <div style={{ fontSize: 36, fontWeight: 800 }}>写入成功</div>\n        <div style={{ marginTop: 10, fontSize: 18, opacity: 0.8 }}>请在服务器上运行 Remotion Studio 预览</div>\n      </div>\n    </AbsoluteFill>\n  );\n}\n",
        "// @scene 尾页\n// @duration 60\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function SceneOutro() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center' }}>\n      <div style={{ fontSize: 34, opacity: 0.9 }}>Local Push Done</div>\n    </AbsoluteFill>\n  );\n}\n",
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

    if (name === 'files_manifest') {
      els.scenes.value = JSON.stringify(filesManifest, null, 2)
      return
    }

    els.scenes.value = JSON.stringify(difySmoke, null, 2)
  }

  function resetDefaults() {
    if (els.targetPreset) {
      els.targetPreset.value = 'local_mac'
    }
    applyTargetPreset()
    els.clearScenes.value = 'true'
    els.preset.value = 'dify_smoke'
    setPreset('dify_smoke')
    els.result.textContent = '(waiting)'
    els.curl.textContent = '(waiting)'
    setStatus('已恢复默认示例', 'ok')
  }

  els.preset.addEventListener('change', () => {
    setPreset(els.preset.value)
    setStatus('已切换预置', 'ok')
  })

  if (els.targetPreset) {
    els.targetPreset.addEventListener('change', () => {
      applyTargetPreset()
      setStatus('已应用目标环境', 'ok')
    })
  }

  els.btnFmt.addEventListener('click', () => {
    try {
      const scenes = parseScenes(els.scenes.value)
      els.scenes.value = JSON.stringify(scenes, null, 2)
      setStatus('已格式化 JSON', 'ok')
    } catch (e) {
      setStatus(e.message, 'bad')
    }
  })

  els.btnReset.addEventListener('click', () => resetDefaults())
  els.btnRun.addEventListener('click', () => runPush())

  resetDefaults()
</script>
</body>
</html>`

export async function localAdminRoutes(app: FastifyInstance) {
  app.get('/admin-local', async (_req, reply) => {
    return reply.type('text/html; charset=utf-8').send(html)
  })
}
