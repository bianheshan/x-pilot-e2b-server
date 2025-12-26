export type DifyBuildInput = {
  scenes: string[]
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

  const usedIds = new Set<string>()

  const enrichedScenes: EnrichedScene[] = input.scenes.map((code, index) => {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new Error(`scenes[${index}] 必须是非空字符串`)
    }
    if (!code.includes('export default')) {
      throw new Error(`scenes[${index}] 必须包含 export default`)
    }

    const functionName = extractFunctionName(code)
    if (!functionName) {
      throw new Error(
        `scenes[${index}] 无法提取函数名，请使用 export default function FunctionName()`
      )
    }

    const commentMeta = extractMetadataFromComments(code)
    const baseId = toSceneId(functionName)
    const id = ensureUniqueId(baseId, usedIds)
    const name = commentMeta.name || toSceneName(functionName)
    const durationInFrames = commentMeta.duration || 90

    return { id, name, durationInFrames, code }
  })

  const manifest: Manifest = {
    version: '1.0.0',
    fps: 30,
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
