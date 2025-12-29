import { z } from 'zod'

import { env } from '../../config/env.js'
import { buildFromDifyBundle, buildFromDifyScenes } from '../dify/dify-scenes.js'

import { SandboxService } from '../sandbox/sandbox-service.js'

const sceneSchema = z.object({
  filePath: z.string().min(1),
  code: z.string(),
})

const difySceneSchema = z.string().min(1)

const difyBundleSchema = z.object({
  json_string: z.string().min(1),
  code_array: z.array(z.string().min(1)).min(1),
})

export const previewRequestSchema = z
  .object({
    userId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
    templateId: z.string().min(1).optional(),
    templateName: z.string().min(1).optional(),

    // 支持三种输入：
    // 1) Dify bundle：{ json_string, code_array }
    // 2) Dify 直接输出的 scenes: string[]（场景代码数组）
    // 3) 直接写文件的 scenes: {filePath, code}[]
    dify: difyBundleSchema.optional(),
    scenes: z.array(z.union([sceneSchema, difySceneSchema])).min(1).optional(),

    startDev: z.boolean().optional().default(true),
    // 为了避免前端请求挂太久（或被网关/浏览器中途取消），默认不等待 ready。
    // 前端拿到 previewUrl 后自行打开即可。
    waitForReady: z.boolean().optional().default(false),
  })
  .refine((v) => Boolean(v.dify) || (Array.isArray(v.scenes) && v.scenes.length > 0), {
    message: '必须提供 dify 或 scenes',
  })


export type PreviewRequest = z.infer<typeof previewRequestSchema>

export type PreviewResponse = {
  sandboxId: string
  jobId: string
  previewUrl: string
  projectDir: string

  // debug（给 admin 用）：用于判断 previewUrl 是否可达
  devServerReachable?: boolean
  devServerStatus?: number
  devServerError?: string

  // debug：进一步判断前端 bundle 是否可达（避免“/ 200 但页面白屏/空白”）
  devBundleReachable?: boolean
  devBundleStatus?: number

  // debug：从 sandbox 内部探测 dev server（排除“容器内 3000 没起来” vs “公网路由/浏览器侧问题”）
  localDevServerReachable?: boolean
  localDevServerStatus?: number
  localDevServerError?: string
  localDevBundleReachable?: boolean
  localDevBundleStatus?: number
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

    let mode: 'dify' | 'files'
    let fileWrites: Array<{ filePath: string; code: string }>

    if (req.dify) {
      mode = 'dify'
      fileWrites = buildFromDifyBundle(req.dify).files
    } else {
      const scenes = req.scenes as Array<{ filePath: string; code: string } | string>

      const isDify = typeof scenes[0] === 'string'
      if (isDify && !scenes.every((s) => typeof s === 'string')) {
        throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
      }
      if (!isDify && !scenes.every((s) => typeof s === 'object' && s !== null)) {
        throw new Error('scenes 输入必须是纯 string[]（Dify）或纯 {filePath,code}[]（文件写入）')
      }

      mode = isDify ? 'dify' : 'files'

      fileWrites = isDify
        ? buildFromDifyScenes({ scenes: scenes as string[] }).files
        : (scenes as Array<{ filePath: string; code: string }>)
    }

    // Dify 场景模式：按你的需求，先清空模板自带的场景，再写入新场景 + manifest。
    // 这样 Remotion Studio 里不会混入模板默认场景。
    if (mode === 'dify') {
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

    let devServerReachable: boolean | undefined
    let devServerStatus: number | undefined
    let devServerError: string | undefined
    let devBundleReachable: boolean | undefined
    let devBundleStatus: number | undefined

    let localDevServerReachable: boolean | undefined
    let localDevServerStatus: number | undefined
    let localDevServerError: string | undefined
    let localDevBundleReachable: boolean | undefined
    let localDevBundleStatus: number | undefined

    const getStdout = (r: any) => {
      if (typeof r === 'string') return r
      return String(r?.stdout ?? '')
    }

    const pingLocalDev = async (path: string, timeoutMs: number) => {
      const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000))
      const url = `http://127.0.0.1:${port}${path}`
      const cmd =
        `bash -lc 'URL="${url}"; ` +
        `if command -v curl >/dev/null 2>&1; then ` +
        `curl -sS --max-time ${timeoutSec} -o /dev/null -w "%{http_code}" "$URL" || echo "ERR"; ` +
        `else ` +
        `URL="$URL" node -e "const c=new AbortController(); setTimeout(()=>c.abort(), ${timeoutSec}000); fetch(process.env.URL,{signal:c.signal}).then(r=>process.stdout.write(String(r.status))).catch(e=>process.stdout.write(\"ERR:\"+(e?.message||String(e))));"; ` +
        `fi'`

      try {
        const r = await s.commands.run(cmd)
        const out = getStdout(r).trim()
        if (out.startsWith('ERR:') || out === 'ERR' || out === '') {
          return { ok: false, status: undefined as unknown as number, error: out || 'ERR' }
        }
        const status = Number.parseInt(out, 10)
        return { ok: Number.isFinite(status) && status >= 200 && status < 400, status }
      } catch (e: any) {
        return { ok: false, status: undefined as unknown as number, error: String(e?.message ?? e) }
      }
    }

    const pingPreviewUrl = async (url: string, path: string, timeoutMs: number) => {
      const baseUrl = url.replace(/\/+$/, '')
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal })
        return { ok: res.ok, status: res.status as number }
      } catch (e: any) {
        return { ok: false, status: undefined as unknown as number, error: String(e?.message ?? e) }
      } finally {
        clearTimeout(t)
      }
    }

    if (req.startDev) {
      await ensurePortExposed()

      // 模板在 sandbox 启动时已通过 start cmd 启动 dev server（通常为 3000）。
      // 这里不重复启动，避免端口冲突/多进程带来的不确定性。

      // 先探测 sandbox 内部 3000（排除“容器内根本没起来”）
      const localRoot = await pingLocalDev('/', 8_000)
      localDevServerReachable = localRoot.ok
      localDevServerStatus = localRoot.status
      localDevServerError = (localRoot as any).error

      const localBundle = await pingLocalDev('/bundle.js', 8_000)
      localDevBundleReachable = localBundle.ok
      localDevBundleStatus = localBundle.status

      // 再探测公网 previewUrl（排除“路由/边缘层/浏览器侧连接问题”）
      const first = await pingPreviewUrl(allocated.previewUrl, '/', 12_000)
      devServerReachable = first.ok
      devServerStatus = first.status
      devServerError = (first as any).error

      const bundle = await pingPreviewUrl(allocated.previewUrl, '/bundle.js', 12_000)
      devBundleReachable = bundle.ok
      devBundleStatus = bundle.status

      // 有时 / 会在编译/重载窗口期超时，但 bundle 已经可用。
      // 这种情况下不应判定为不可达。
      if (devServerReachable === false && devBundleReachable === true) {
        devServerReachable = true
      }

      // best-effort: do not fail the request if the public URL is slow to become ready
      if (req.waitForReady && !devServerReachable) {
        const maxAttempts = 60

        for (let i = 1; i <= maxAttempts; i++) {
          await sleep(1000)

          const lr = await pingLocalDev('/', 8_000)
          localDevServerReachable = lr.ok
          localDevServerStatus = lr.status
          localDevServerError = (lr as any).error

          const lb = await pingLocalDev('/bundle.js', 8_000)
          localDevBundleReachable = lb.ok
          localDevBundleStatus = lb.status

          const r = await pingPreviewUrl(allocated.previewUrl, '/', 10_000)
          devServerReachable = r.ok
          devServerStatus = r.status
          devServerError = (r as any).error

          const b = await pingPreviewUrl(allocated.previewUrl, '/bundle.js', 10_000)
          devBundleReachable = b.ok
          devBundleStatus = b.status

          if (devServerReachable && devBundleReachable) break
        }
      }
    }

    return {
      sandboxId: allocated.sandboxId,
      jobId,
      previewUrl: allocated.previewUrl,
      projectDir,
      devServerReachable,
      devServerStatus,
      devServerError,
      devBundleReachable,
      devBundleStatus,
      localDevServerReachable,
      localDevServerStatus,
      localDevServerError,
      localDevBundleReachable,
      localDevBundleStatus,
    }
  }
}
