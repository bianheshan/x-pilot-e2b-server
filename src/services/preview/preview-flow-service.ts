import { z } from 'zod'

import { env } from '../../config/env.js'
import { buildFromDifyScenes } from '../dify/dify-scenes.js'
import { SandboxService } from '../sandbox/sandbox-service.js'

const sceneSchema = z.object({
  filePath: z.string().min(1),
  code: z.string(),
})

const difySceneSchema = z.string().min(1)

export const previewRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  templateName: z.string().min(1).optional(),

  // 支持两种输入：
  // 1) Dify 直接输出的 scenes: string[]（场景代码数组）
  // 2) 直接写文件的 scenes: {filePath, code}[]
  scenes: z.array(z.union([sceneSchema, difySceneSchema])).min(1),

  startDev: z.boolean().optional().default(true),
  // 为了避免前端请求挂太久（或被网关/浏览器中途取消），默认不等待 ready。
  // 前端拿到 previewUrl 后自行打开即可。
  waitForReady: z.boolean().optional().default(false),
})

export type PreviewRequest = z.infer<typeof previewRequestSchema>

export type PreviewResponse = {
  sandboxId: string
  jobId: string
  previewUrl: string
  projectDir: string
}

function sanitizeRelativePosixPath(input: string): string {
  const p = input.replace(/\\/g, '/').replace(/^\/+/, '')
  if (p.includes('..')) throw new Error(`Invalid filePath: ${input}`)
  return p
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function runWithRetries<T>(fn: () => Promise<T>, opts: { attempts: number; baseDelayMs: number }) {
  let lastErr: unknown
  for (let i = 1; i <= opts.attempts; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const msg = String(err?.message ?? '')
      const retryable = msg.includes('fetch failed') || err?.name === 'SandboxError'
      if (!retryable || i === opts.attempts) break
      await sleep(opts.baseDelayMs * i)
    }
  }
  throw lastErr
}

export class PreviewFlowService {
  constructor(private readonly sandboxService: SandboxService) {}

  async createPreview(req: PreviewRequest): Promise<PreviewResponse> {
    const jobId = req.jobId ?? this.sandboxService.createJobId()

    // E2B 模板默认在 STUDIO_PORT（通常为 3000）启动 dev server（见 build-template/template.ts 的 waitForPort(3000)）。
    // 经验上非 3000 端口在部分环境下路由/暴露更容易踩坑，因此这里固定使用 STUDIO_PORT。
    const port = env.STUDIO_PORT

    // 在 sandbox 内，工程根目录就是 BASE_PROJECT_DIR（默认 /app）
    const projectDir = env.BASE_PROJECT_DIR

    const allocated = await this.sandboxService.allocate({
      userId: req.userId,
      templateId: req.templateId,
      templateName: req.templateName,
      studioPort: port,
    })

    const sandbox = this.sandboxService.getSandbox(allocated.sandboxId)
    if (!sandbox) throw new Error('Sandbox not found in local process (unexpected)')

    const s: any = sandbox

    const ensurePortExposed = async () => {
      try {
        if (typeof s.getPublicUrlForPort === 'function') {
          await s.getPublicUrlForPort(port)
          return
        }
        if (typeof s.exposePort === 'function') {
          await s.exposePort(port)
          return
        }
        if (s.ports && typeof s.ports.open === 'function') {
          await s.ports.open({ containerPort: port, protocol: 'tcp' })
          return
        }
        if (s.ports && typeof s.ports.openPort === 'function') {
          await s.ports.openPort(port)
          return
        }
        if (typeof s.getHost === 'function') {
          const hostOrPromise = s.getHost(port)
          await (typeof hostOrPromise?.then === 'function' ? hostOrPromise : Promise.resolve(hostOrPromise))
        }
      } catch {
        // ignore
      }
    }

    // envd 偶发未就绪会出现 "fetch failed"，这里做一次 warm-up + 重试
    await runWithRetries(() => s.commands.run(`bash -lc "echo envd_ok"`), { attempts: 5, baseDelayMs: 800 })

    // 模板工程应直接位于 BASE_PROJECT_DIR（默认 /app），并且模板 start cmd 会在该目录启动 dev server。
    // 这里不再复制到 workspace，直接在 BASE_PROJECT_DIR 下清理/写入 scenes。
    await runWithRetries(
      () =>
        s.commands.run('test -d . && (test -f package.json || test -f remotion.config.ts || test -f remotion.config.js)', {
          cwd: projectDir,
        }),
      { attempts: 5, baseDelayMs: 800 },
    )

    const scenes = req.scenes as Array<{ filePath: string; code: string } | string>

    const isDify = typeof scenes[0] === 'string'
    if (isDify && !scenes.every((s) => typeof s === 'string')) {
      throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
    }
    if (!isDify && !scenes.every((s) => typeof s === 'object' && s !== null)) {
      throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
    }

    const fileWrites = isDify
      ? buildFromDifyScenes({ scenes: scenes as string[] }).files
      : (scenes as Array<{ filePath: string; code: string }>)

    // Dify 场景模式：按你的需求，先清空模板自带的场景，再写入新场景 + manifest。
    // 这样 Remotion Studio 里不会混入模板默认场景。
    if (isDify) {
      try {
        await s.commands.run('rm -f src/scenes/*.tsx src/scenes/manifest.json', { cwd: projectDir })
      } catch {
        // ignore
      }
    }

    const dirs = new Set<string>()
    const writes = fileWrites.map((scene) => {
      const rel = sanitizeRelativePosixPath(scene.filePath)
      const remotePath = `${projectDir}/${rel}`
      dirs.add(remotePath.split('/').slice(0, -1).join('/'))
      return { remotePath, code: scene.code }
    })

    if (dirs.size > 0) {
      const mkdirs = Array.from(dirs)
        .filter(Boolean)
        .map((d) => `'${d}'`)
        .join(' ')
      await s.commands.run(`bash -lc "mkdir -p ${mkdirs}"`)
    }

    const BATCH_SIZE = 50
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      const batch = writes.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((w) => s.files.write(w.remotePath, w.code)))
    }

    if (req.startDev) {
      await ensurePortExposed()

      // 模板在 sandbox 启动时已通过 start cmd 启动 dev server（通常为 3000）。
      // 这里不重复启动，避免端口冲突/多进程带来的不确定性。

      // best-effort: do not fail the request if the public URL is slow to become ready
      if (req.waitForReady) {
        const baseUrl = allocated.previewUrl.replace(/\/+$/, '')
        const maxAttempts = 60

        for (let i = 1; i <= maxAttempts; i++) {
          try {
            const controller = new AbortController()
            const t = setTimeout(() => controller.abort(), 10_000)
            const res = await fetch(`${baseUrl}/`, { signal: controller.signal })
            clearTimeout(t)

            if (res.ok) break
          } catch {
            // ignore
          }

          await sleep(1000)
        }
      }
    }

    return {
      sandboxId: allocated.sandboxId,
      jobId,
      previewUrl: allocated.previewUrl,
      projectDir,
    }
  }
}
