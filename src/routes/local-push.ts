import fs from 'node:fs/promises'
import path from 'node:path'

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { env } from '../config/env.js'
import { buildFromDifyBundle, buildFromDifyScenes } from '../services/dify/dify-scenes.js'

const sceneSchema = z.object({
  filePath: z.string().min(1),
  code: z.string(),
})

const difyBundleSchema = z.object({
  json_string: z.string().min(1),
  code_array: z.array(z.string().min(1)).min(1),
})

export const localPushRequestSchema = z
  .object({
    // 服务器本机路径：支持两种写法
    // 1) 模板工程根目录（例如 C:\\Users\\bianh\\x-pilot-video-render）
    // 2) 直接指定 scenes 目录（例如 C:\\Users\\bianh\\x-pilot-video-render\\src\\scenes）
    // 不填则使用 env.LOCAL_PROJECT_DIR（再不填则用 env.BASE_PROJECT_DIR）。
    projectDir: z.string().min(1).optional(),

    // dify 模式下是否先清空 src/scenes/*.tsx + manifest.json
    clearScenes: z.boolean().optional().default(true),

    // 支持两种输入：
    // 1) Dify bundle：{ json_string, code_array }
    // 2) Dify 直接输出的 scenes: string[]（场景代码数组）
    // 3) 直接写文件的 scenes: {filePath, code}[]
    dify: difyBundleSchema.optional(),
    scenes: z.array(z.union([sceneSchema, z.string().min(1)])).min(1).optional(),
  })
  .refine((v) => Boolean(v.dify) || (Array.isArray(v.scenes) && v.scenes.length > 0), {
    message: '必须提供 dify 或 scenes',
  })


function sanitizeRelativePosixPath(input: string): string {
  const p = input.replace(/\\/g, '/').replace(/^\/\/+/, '')
  if (/^[a-zA-Z]:\//.test(p)) throw new Error(`Invalid filePath (absolute): ${input}`)
  if (p.includes('..')) throw new Error(`Invalid filePath: ${input}`)
  return p
}

function detectScenesDir(inputAbsDir: string): { projectDir: string; scenesDir: string; baseIsScenesDir: boolean } {
  const normalized = inputAbsDir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const baseIsScenesDir = normalized.endsWith('/src/scenes')
  const scenesDir = baseIsScenesDir ? inputAbsDir : path.join(inputAbsDir, 'src', 'scenes')
  return { projectDir: inputAbsDir, scenesDir, baseIsScenesDir }
}

function maybeUnescapeCode(input: string): string {
  const s = String(input ?? '')

  // If it already contains real newlines, keep as-is.
  if (s.includes('\n') || s.includes('\r')) return s

  // Only attempt unescape when it looks like a double-escaped string.
  if (!s.includes('\\')) return s

  return s
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
    .replaceAll('\\t', '\t')
}


async function clearScenesInDir(scenesDir: string) {

  try {
    const entries = await fs.readdir(scenesDir, { withFileTypes: true })
    await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
        .map((e) => fs.rm(path.join(scenesDir, e.name), { force: true })),
    )
  } catch {
    // ignore
  }

  try {
    await fs.rm(path.join(scenesDir, 'manifest.json'), { force: true })
  } catch {
    // ignore
  }
}

export async function localPushRoutes(app: FastifyInstance) {
  app.post('/local/push', async (req, reply) => {
    const body = localPushRequestSchema.parse(req.body ?? {})

    const projectDirRaw = (body.projectDir ?? env.LOCAL_PROJECT_DIR ?? env.BASE_PROJECT_DIR).trim()
    const projectDir = projectDirRaw.replace(/[\\/]+$/, '')

    if (!path.isAbsolute(projectDir)) {
      throw new Error(`projectDir 必须是绝对路径：${projectDir}`)
    }

    const detected = detectScenesDir(projectDir)
    const scenesDir = detected.scenesDir
    const baseIsScenesDir = detected.baseIsScenesDir

    let mode: 'dify' | 'files'
    let cleared = false
    let fileWritesRaw: Array<{ filePath: string; code: string }>

    if (body.dify) {
      mode = 'dify'
      fileWritesRaw = buildFromDifyBundle(body.dify).files

      if (body.clearScenes) {
        await clearScenesInDir(scenesDir)
        cleared = true
      }
    } else {
      const scenes = body.scenes as Array<{ filePath: string; code: string } | string>
      const isDify = typeof scenes[0] === 'string'

      if (isDify && !scenes.every((s) => typeof s === 'string')) {
        throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
      }
      if (!isDify && !scenes.every((s) => typeof s === 'object' && s !== null)) {
        throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
      }

      mode = isDify ? 'dify' : 'files'

      fileWritesRaw = isDify
        ? buildFromDifyScenes({ scenes: scenes as string[] }).files
        : (scenes as Array<{ filePath: string; code: string }>)

      if (isDify && body.clearScenes) {
        await clearScenesInDir(scenesDir)
        cleared = true
      }
    }

    const fileWrites = fileWritesRaw.map((f) => ({ ...f, code: maybeUnescapeCode(f.code) }))


    const written: string[] = []

    const mapWritePath = (inputRel: string) => {
      if (!baseIsScenesDir) {
        const abs = path.resolve(projectDir, inputRel)
        return { abs, out: inputRel }
      }

      // base 是 src/scenes：允许传入 "src/scenes/xxx"（会自动去前缀），或直接 "xxx.tsx" / "manifest.json"
      const prefix = 'src/scenes/'
      const outRel = inputRel.startsWith(prefix) ? inputRel.slice(prefix.length) : inputRel
      if (outRel.includes('/')) {
        throw new Error(`base=src/scenes 时不允许写入子目录：${inputRel}`)
      }
      const abs = path.resolve(scenesDir, outRel)
      return { abs, out: outRel }
    }

    const BATCH_SIZE = 50
    for (let i = 0; i < fileWrites.length; i += BATCH_SIZE) {
      const batch = fileWrites.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (f) => {
          const rel = sanitizeRelativePosixPath(f.filePath)
          const mapped = mapWritePath(rel)
          await fs.mkdir(path.dirname(mapped.abs), { recursive: true })
          await fs.writeFile(mapped.abs, f.code, 'utf8')
          written.push(mapped.out)
        }),
      )
    }

    return reply.code(201).send({
      ok: true,
      projectDir,
      scenesDir,
      baseIsScenesDir,
      mode,
      cleared,

      writtenCount: written.length,
      writtenFiles: written,
    })
  })
}
