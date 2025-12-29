export type DifyBuildInput = {
  scenes: string[]
}

export type DifyBundleInput = {
  json_string: string
  code_array: string[]
}

export type EnrichedScene = {
  id: string
  name: string
  durationInFrames: number
  code: string
}

export type ManifestScene = {
  id: string
  name: string
  durationInFrames: number
  component: string
}

export type Manifest = {
  version: string
  fps: number
  width: number
  height: number
  theme: string
  scenes: ManifestScene[]
}

export type DifyBuildResult = {
  enrichedScenes: EnrichedScene[]
  manifest: Manifest
  files: Array<{ filePath: string; code: string }>
}

function stripMarkdownCodeFence(input: string): string {
  const s = String(input || '')
  const m = s.match(/\x60\x60\x60[^\n]*\n([\s\S]*?)\x60\x60\x60/)
  if (m && typeof m[1] === 'string') return m[1]
  return s
}

function stripOuterMarkdownFence(input: string): string {
  const s = String(input || '')
  const m = s.match(/^\s*\x60\x60\x60[^\n]*\n([\s\S]*?)\n?\x60\x60\x60\s*$/)
  if (m && typeof m[1] === 'string') return m[1]
  return s
}

function normalizeSceneCode(code: string): string {
  const raw = stripMarkdownCodeFence(code)
  const trimmed = String(raw).replace(/^\uFEFF/, '').trim()
  return trimmed.length > 0 ? trimmed + '\n' : ''
}

function extractFunctionName(code: string): string | null {
  const match = code.match(/export\s+default\s+(?:async\s+)?function\s+(\w+)\s*\(/)
  return match ? match[1] : null
}

function extractMetadataFromComments(code: string): { name?: string; duration?: number } {
  const nameMatch = code.match(/@scene\s+(.+)/)
  const durationMatch = code.match(/@duration\s+(\d+)/)

  return {
    name: nameMatch ? nameMatch[1].trim() : undefined,
    duration: durationMatch ? Number.parseInt(durationMatch[1], 10) : undefined,
  }
}

function extractSceneIdFromScriptComments(code: string): string | null {
  const m1 = code.match(/场景\s*ID\s*[:：]\s*([a-zA-Z0-9_-]+)/)
  if (m1 && m1[1]) return m1[1]

  const m2 = code.match(/Scene\s*ID\s*[:：]\s*([a-zA-Z0-9_-]+)/i)
  if (m2 && m2[1]) return m2[1]

  return null
}

function extractSceneTargetFromScriptComments(code: string): string | null {
  const m = code.match(/场景目标\s*[:：]\s*(.+)/)
  if (m && m[1]) return m[1].trim()
  return null
}

function extractDurationFramesFromScriptComments(code: string, fps: number): number | null {
  // e.g. "持续时间：40.0 秒 (1200 帧)"
  const m1 = code.match(/持续时间\s*[:：]\s*([\d.]+)\s*秒\s*\(\s*(\d+)\s*帧\s*\)/)
  if (m1 && m1[2]) {
    const frames = Number.parseInt(m1[2], 10)
    if (Number.isFinite(frames) && frames > 0) return frames
  }

  const m2 = code.match(/持续时间\s*[:：]\s*([\d.]+)\s*秒/)
  if (m2 && m2[1]) {
    const sec = Number.parseFloat(m2[1])
    if (Number.isFinite(sec) && sec > 0) return Math.max(1, Math.round(sec * fps))
  }

  return null
}

function sanitizeSceneId(input: string): string {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')

  if (!s) throw new Error(`Invalid scene id: ${input}`)
  return s
}

function toSceneId(functionName: string): string {
  return functionName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

function toSceneName(functionName: string): string {
  return functionName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .trim()
}

function ensureUniqueId(baseId: string, used: Set<string>): string {
  let id = baseId
  let n = 2
  while (used.has(id)) {
    id = `${baseId}_${n}`
    n++
  }
  used.add(id)
  return id
}

export function buildFromDifyScenes(input: DifyBuildInput): DifyBuildResult {
  if (!input || !Array.isArray(input.scenes)) {
    throw new Error('scenes 必须是数组')
  }
  if (input.scenes.length === 0) {
    throw new Error('scenes 数组不能为空')
  }

  const fps = 30
  const usedIds = new Set<string>()

  const enrichedScenes: EnrichedScene[] = input.scenes.map((rawCode, index) => {
    const code = normalizeSceneCode(rawCode)

    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new Error(`scenes[${index}] 必须是非空字符串`)
    }
    if (!code.includes('export default')) {
      throw new Error(`scenes[${index}] 必须包含 export default`)
    }

    const functionName = extractFunctionName(code)
    if (!functionName) {
      throw new Error(`scenes[${index}] 无法提取函数名，请使用 export default function FunctionName()`)
    }

    const commentMeta = extractMetadataFromComments(code)

    const sceneIdFromScript = extractSceneIdFromScriptComments(code)
    const baseId = sceneIdFromScript ? sanitizeSceneId(sceneIdFromScript) : sanitizeSceneId(toSceneId(functionName))
    const id = ensureUniqueId(baseId, usedIds)

    const targetFromScript = extractSceneTargetFromScriptComments(code)
    const name = commentMeta.name || targetFromScript || toSceneName(functionName)

    const durationFromScript = extractDurationFramesFromScriptComments(code, fps)
    const durationInFrames = commentMeta.duration || durationFromScript || 90

    return { id, name, durationInFrames, code }
  })

  const manifest: Manifest = {
    version: '1.0.0',
    fps,
    width: 1920,
    height: 1080,
    theme: 'tech',
    scenes: enrichedScenes.map((s) => ({
      id: s.id,
      name: s.name,
      durationInFrames: s.durationInFrames,
      component: `${s.id}.tsx`,
    })),
  }

  const files: Array<{ filePath: string; code: string }> = enrichedScenes.map((s) => ({
    filePath: `src/scenes/${s.id}.tsx`,
    code: s.code,
  }))

  files.push({
    filePath: 'src/scenes/manifest.json',
    code: JSON.stringify(manifest, null, 2) + '\n',
  })

  return { enrichedScenes, manifest, files }
}

export function buildFromDifyBundle(input: DifyBundleInput): DifyBuildResult {
  if (!input || typeof input.json_string !== 'string' || input.json_string.trim().length === 0) {
    throw new Error('json_string 必须是非空字符串')
  }
  if (!Array.isArray(input.code_array) || input.code_array.length === 0) {
    throw new Error('code_array 必须是非空数组')
  }

  const fps = 30

  let script: any
  try {
    const raw = stripOuterMarkdownFence(input.json_string).trim()
    script = JSON.parse(raw)
  } catch (e: any) {
    throw new Error(`json_string 解析失败：${e?.message ?? String(e)}`)
  }

  if (!script || typeof script !== 'object' || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('json_string 内必须包含 scenes 数组')
  }

  const codeCandidates = input.code_array
    .map((c) => normalizeSceneCode(c))
    .filter((c) => c && c.includes('export default'))

  if (codeCandidates.length === 0) {
    throw new Error('code_array 内未找到包含 export default 的 TSX 代码')
  }

  const byId = new Map<string, string>()
  for (const code of codeCandidates) {
    const id = extractSceneIdFromScriptComments(code)
    if (id) {
      try {
        byId.set(sanitizeSceneId(id), code)
      } catch {
        // ignore invalid ids
      }
    }
  }

  const usedIds = new Set<string>()
  const usedCodes = new Set<string>()

  const enrichedScenes: EnrichedScene[] = script.scenes.map((s: any, idx: number) => {
    const rawId = typeof s?.id === 'string' ? s.id : ''
    const rawName = typeof s?.target === 'string' ? s.target : ''
    const sec = typeof s?.estimated_duration_seconds === 'number' ? s.estimated_duration_seconds : undefined

    const baseId = ensureUniqueId(sanitizeSceneId(rawId || `scene_${idx + 1}`), usedIds)

    const durationInFrames = Number.isFinite(sec) && (sec as number) > 0 ? Math.max(1, Math.round((sec as number) * fps)) : 90

    const name = rawName || baseId

    const byIdCode = byId.get(baseId)
    if (byIdCode && !usedCodes.has(byIdCode)) {
      usedCodes.add(byIdCode)
      return { id: baseId, name, durationInFrames, code: byIdCode }
    }

    // fallback: assign remaining codes by order
    const remaining = codeCandidates.find((c) => !usedCodes.has(c))
    if (!remaining) {
      throw new Error(`找不到 scene 的 TSX 代码：${baseId}`)
    }

    usedCodes.add(remaining)
    return { id: baseId, name, durationInFrames, code: remaining }
  })

  const manifest: Manifest = {
    version: '1.0.0',
    fps,
    width: 1920,
    height: 1080,
    theme: 'tech',
    scenes: enrichedScenes.map((s) => ({
      id: s.id,
      name: s.name,
      durationInFrames: s.durationInFrames,
      component: `${s.id}.tsx`,
    })),
  }

  const files: Array<{ filePath: string; code: string }> = enrichedScenes.map((s) => ({
    filePath: `src/scenes/${s.id}.tsx`,
    code: s.code,
  }))

  files.push({
    filePath: 'src/scenes/manifest.json',
    code: JSON.stringify(manifest, null, 2) + '\n',
  })

  return { enrichedScenes, manifest, files }
}
