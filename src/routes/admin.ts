import type { FastifyInstance } from 'fastify'

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>x-pilot-e2b-server 管理界面</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 0; background: #0b1020; color: #e7eaf3; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px; }
    label { display: block; font-size: 12px; opacity: 0.85; margin-bottom: 6px; }
    input, textarea, select { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(0,0,0,0.22); color: #e7eaf3; padding: 10px; outline: none; }
    textarea { min-height: 420px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.45; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .actions { display: flex; gap: 10px; align-items: center; }
    button { border: 1px solid rgba(255,255,255,0.18); background: rgba(59,130,246,0.28); color: #e7eaf3; padding: 10px 14px; border-radius: 10px; cursor: pointer; }
    button.secondary { background: rgba(255,255,255,0.08); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .hint { font-size: 12px; opacity: 0.75; }
    pre { white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.12); padding: 10px; border-radius: 10px; margin: 0; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>x-pilot-e2b-server 管理界面（快速验证：粘贴 scenes 数组 → 推送 E2B → 返回预览链接）</h1>

    <div class="grid">
      <div class="card">
        <div class="row">
          <div>
            <label>userId（可选）</label>
            <input id="userId" placeholder="u_123" />
          </div>
          <div>
            <label>jobId（可选，不填则自动生成）</label>
            <input id="jobId" placeholder="" />
          </div>
        </div>

        <div class="row" style="margin-top:10px">
          <div>
            <label>templateName（可选，覆盖服务端默认）</label>
            <input id="templateName" placeholder="x-pilot-remotion-template" />
          </div>
          <div>
            <label>templateId（可选，优先级最高）</label>
            <input id="templateId" placeholder="" />
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
            <label>waitForReady</label>
            <select id="waitForReady">
              <option value="true" selected>true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>

        <div style="margin-top:10px" class="actions">
          <button id="btnRun">推送并启动预览</button>
          <button id="btnFmt" class="secondary">格式化 JSON</button>
          <span id="status" class="hint"></span>
        </div>

        <div style="margin-top:10px" class="hint">
          支持粘贴：
          <ul>
            <li>Dify 原始格式：<code>{ scenes: ["code1", "code2", ...] }</code></li>
            <li>或直接数组：<code>["code1", "code2", ...]</code></li>
            <li>或文件写入格式：<code>[{filePath, code}, ...]</code></li>
          </ul>

        </div>

        <label style="margin-top:10px">scenes JSON</label>
        <textarea id="scenes"></textarea>
      </div>

      <div class="card">
        <label>结果</label>
        <pre id="result">（等待执行）</pre>

        <div style="margin-top:10px" class="actions">
          <button id="btnOpen" class="secondary" disabled>打开预览链接</button>
          <a id="previewLink" href="#" target="_blank" rel="noreferrer" style="display:none">preview</a>
        </div>

        <div style="margin-top:10px" class="hint">
          Tip：为了让你一眼看到变化，建议先覆盖一个肯定会被加载的文件，例如 <code>src/Root.tsx</code> 或 <code>src/VideoComposition.tsx</code>。
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id)

  const statusEl = $('status')
  const resultEl = $('result')
  const btnRun = $('btnRun')
  const btnFmt = $('btnFmt')
  const btnOpen = $('btnOpen')
  const previewLink = $('previewLink')

  function setStatus(msg) {
    statusEl.textContent = msg || ''
  }

  function parseScenes(text) {
    const trimmed = (text || '').trim()
    if (!trimmed) throw new Error('scenes 为空')

    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch (e) {
      throw new Error('JSON 解析失败：' + e.message)
    }

    let scenes = parsed
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.scenes)) {
      scenes = parsed.scenes
    }

    if (!Array.isArray(scenes)) {
      throw new Error('scenes 必须是数组，或对象里包含 scenes 数组')
    }

    if (scenes.length === 0) throw new Error('scenes 数组为空')

    // 1) Dify 格式：string[]（纯场景代码数组）
    if (typeof scenes[0] === 'string') {
      if (!scenes.every((s) => typeof s === 'string' && s.trim().length > 0)) {
        throw new Error('Dify scenes 必须是非空字符串数组')
      }
      return scenes
    }

    // 2) 文件写入格式：[{filePath, code}, ...]
    const normalized = scenes.map((s, idx) => {
      if (!s || typeof s !== 'object') throw new Error('scenes[' + idx + '] 不是对象')
      const filePath = s.filePath || s.path
      const code = s.code
      if (typeof filePath !== 'string' || !filePath) throw new Error('scenes[' + idx + '].filePath 缺失/非法')
      if (typeof code !== 'string') throw new Error('scenes[' + idx + '].code 缺失/非法')
      return { filePath, code }
    })

    return normalized
  }


  function setPreview(url) {
    if (url) {
      previewLink.href = url
      previewLink.style.display = 'inline'
      btnOpen.disabled = false
      btnOpen.onclick = () => window.open(url, '_blank', 'noreferrer')
    } else {
      previewLink.href = '#'
      previewLink.style.display = 'none'
      btnOpen.disabled = true
      btnOpen.onclick = null
    }
  }

  btnFmt.addEventListener('click', () => {
    try {
      const scenes = parseScenes($('scenes').value)
      $('scenes').value = JSON.stringify(scenes, null, 2)
      setStatus('已格式化')
    } catch (e) {
      setStatus(e.message)
    }
  })

  btnRun.addEventListener('click', async () => {
    setStatus('')
    setPreview(null)
    resultEl.textContent = ''

    let scenes
    try {
      scenes = parseScenes($('scenes').value)
    } catch (e) {
      setStatus(e.message)
      return
    }

    const payload = {
      userId: $('userId').value.trim() || undefined,
      jobId: $('jobId').value.trim() || undefined,
      templateName: $('templateName').value.trim() || undefined,
      templateId: $('templateId').value.trim() || undefined,
      scenes,
      startDev: $('startDev').value === 'true',
      waitForReady: $('waitForReady').value === 'true',
    }

    btnRun.disabled = true
    setStatus('请求中...')

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = text }

      if (!res.ok) {
        resultEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        setStatus('失败：HTTP ' + res.status)
        return
      }

      resultEl.textContent = JSON.stringify(data, null, 2)
      if (data && data.previewUrl) setPreview(data.previewUrl)
      setStatus('完成')
    } catch (e) {
      resultEl.textContent = String(e && e.stack ? e.stack : e)
      setStatus('请求异常')
    } finally {
      btnRun.disabled = false
    }
  })

  // 默认示例：Dify 原始 scenes（string[]）
  $('scenes').value = JSON.stringify({
    scenes: [
      "// @scene 预览验证\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function PreviewSmokeScene() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0b1020', color: 'white', justifyContent: 'center', alignItems: 'center', fontSize: 56 }}\n    >x-pilot-e2b-server admin preview OK</AbsoluteFill>\n  );\n}\n"
    ]
  }, null, 2)

</script>
</body>
</html>`

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin', async (_req, reply) => {
    return reply.type('text/html; charset=utf-8').send(html)
  })
}
