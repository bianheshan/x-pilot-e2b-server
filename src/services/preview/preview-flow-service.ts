import http from 'node:http'
import https from 'node:https'

import { z } from 'zod'

import { env } from '../../config/env.js'
import { buildFromDifyScenes } from '../dify/dify-scenes.js'
import { SandboxService } from '../sandbox/sandbox-service.js'
import { WorkspaceService } from '../workspace/workspace-service.js'

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
  waitForReady: z.boolean().optional().default(true),
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
  private readonly ws = new WorkspaceService({
    workspacesRoot: env.WORKSPACES_ROOT,
    baseProjectDir: env.BASE_PROJECT_DIR,
    projectName: env.PROJECT_NAME,
  })

  constructor(private readonly sandboxService: SandboxService) {}


  async createPreview(req: PreviewRequest): Promise<PreviewResponse> {
    const startedAt = Date.now()
    const log = (step: string, extra?: Record<string, any>) => {
      const ms = Date.now() - startedAt
      // 这里用 console，确保即使没有注入 fastify logger 也能看到进度
      console.log(`[preview] +${ms}ms ${step}${extra ? ` ${JSON.stringify(extra)}` : ''}`)
    }

    const jobId = req.jobId ?? this.sandboxService.createJobId()
    const { root, projectDir } = this.ws.getPaths(jobId)

    const pickPort = (seed: string) => {
      // deterministic, avoids port collisions across concurrent jobs without needing lsof/fuser
      let h = 0
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
      return env.STUDIO_PORT + (h % 200)
    }

    const port = pickPort(jobId)
    const devLogPath = `${root}/dev.log`

    log('allocate:start', {
      hasTemplateId: !!req.templateId,
      templateName: req.templateName,
      startDev: req.startDev,
      waitForReady: req.waitForReady,
      jobId,
      port,
    })

    const allocated = await this.sandboxService.allocate({
      userId: req.userId,
      templateId: req.templateId,
      templateName: req.templateName,
      studioPort: port,
    })

    log('allocate:done', { sandboxId: allocated.sandboxId, previewUrl: allocated.previewUrl })

    const sandbox = this.sandboxService.getSandbox(allocated.sandboxId)
    if (!sandbox) throw new Error('Sandbox not found in local process (unexpected)')

    log('workspace:paths', { jobId, root, projectDir })

    const s: any = sandbox

    const ensurePortExposed = async () => {
      try {
        if (typeof s.exposePort === 'function') {
          await s.exposePort(port)
          log('dev:exposePort', { method: 'exposePort', port })
          return
        }
        if (s.ports && typeof s.ports.open === 'function') {
          // common signature in some SDKs
          await s.ports.open({ containerPort: port, protocol: 'tcp' })
          log('dev:exposePort', { method: 'ports.open', port })
          return
        }
        if (s.ports && typeof s.ports.openPort === 'function') {
          await s.ports.openPort(port)
          log('dev:exposePort', { method: 'ports.openPort', port })
          return
        }
        if (typeof s.getPublicUrlForPort === 'function') {
          await s.getPublicUrlForPort(port)
          log('dev:exposePort', { method: 'getPublicUrlForPort', port })
          return
        }
        if (typeof s.getHost === 'function') {
          const hostOrPromise = s.getHost(port)
          await (typeof hostOrPromise?.then === 'function' ? hostOrPromise : Promise.resolve(hostOrPromise))
          log('dev:exposePort', { method: 'getHost', port })
          return
        }

        log('dev:exposePort:skip', { port })
      } catch (e: any) {
        log('dev:exposePort:failed', { port, message: String(e?.message ?? e) })
      }
    }

    // envd 偶发未就绪会出现 "fetch failed"，这里做一次 warm-up + 重试
    log('envd:warmup:start')
    await runWithRetries(
      () => s.commands.run(`bash -lc "echo envd_ok"`),
      { attempts: 5, baseDelayMs: 800 },
    )
    log('envd:warmup:done')

    log('project:copy:start')
    await runWithRetries(
      () =>
        s.commands.run(
          `bash -lc 'set -euo pipefail
mkdir -p ${root}
rm -rf ${projectDir}
mkdir -p ${projectDir}

detect_dir() {
  local d="$1"
  if [ ! -d "$d" ]; then return 1; fi
  if [ -f "$d/package.json" ] || [ -f "$d/remotion.config.ts" ]; then
    echo "$d"
    return 0
  fi
  if [ -d "$d/src" ] && [ -f "$d/src/index.ts" ]; then
    echo "$d"
    return 0
  fi
  return 1
}


BASE_DIR=""
for d in "${env.BASE_PROJECT_DIR}" /app /code /home/user /home/user/app /home/user/code /workspace; do
  if out=$(detect_dir "$d"); then
    BASE_DIR="$out"
    break
  fi
done

if [ -z "$BASE_DIR" ]; then
  echo "BASE_PROJECT_DIR not found (auto-detect failed). Tried: ${env.BASE_PROJECT_DIR}, /app, /code, /home/user, /home/user/app, /home/user/code, /workspace"
  echo "Tip: set TEMPLATE_NAME/TEMPLATE_ID to your built template and/or set BASE_PROJECT_DIR to the correct path inside the sandbox."
  echo "--- ls -la / ---"; ls -la / || true
  echo "--- ls -la /app ---"; ls -la /app || true
  echo "--- ls -la /home/user ---"; ls -la /home/user || true
  echo "--- ls -la /code ---"; ls -la /code || true
  exit 1

fi

cp -R "$BASE_DIR"/. ${projectDir}/'`,
        ),
      { attempts: 5, baseDelayMs: 800 },
    )
    log('project:copy:done')




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

    log('files:write:start', { files: writes.length })
    const BATCH_SIZE = 50
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      const batch = writes.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((w) => s.files.write(w.remotePath, w.code)))
    }
    log('files:write:done')

    if (req.startDev) {
      await ensurePortExposed()
      log('dev:start', { port, devLogPath })

      // 用 e2b 的 background 命令能力；同时把 stdout/stderr 写到文件，便于排查（否则 background 失败看不到原因）
      await runWithRetries(
        () =>
          s.commands.run(
            `bash -lc 'set -euo pipefail
mkdir -p "${root}"
rm -f "${devLogPath}" || true
: > "${devLogPath}"

# 把启动阶段的所有输出也写进 dev.log（否则 background 模式下看不到失败原因）
exec >>"${devLogPath}" 2>&1

echo "[dev] starting $(date -Iseconds) port=${port}"
cd "${projectDir}"
echo "[dev] cwd=$(pwd)"

echo "[dev] node=$(command -v node 2>/dev/null || true)"
echo "[dev] npm=$(command -v npm 2>/dev/null || true)"


if [ -f package.json ]; then
  echo "[dev] package.json present"
else
  echo "[dev] package.json missing"; ls -la . || true; exit 1
fi

if [ -d node_modules ]; then
  echo "[dev] node_modules present"
else
  echo "[dev] node_modules missing -> running npm ci"
  if command -v timeout >/dev/null 2>&1; then
    timeout 600 npm ci || (echo "[dev] npm ci failed"; exit 1)
  else
    npm ci || (echo "[dev] npm ci failed"; exit 1)
  fi
fi

echo "[dev] starting npm run dev"
if command -v stdbuf >/dev/null 2>&1; then
  exec stdbuf -oL -eL npm run dev -- --host 0.0.0.0 --port ${port}
else
  exec npm run dev -- --host 0.0.0.0 --port ${port}
fi'`,
            { background: true },
          ),
        { attempts: 5, baseDelayMs: 800 },
      )

      // 立刻读一眼日志，很多错误（缺依赖/端口占用）会马上出现
      try {
        const t = await s.commands.run(`bash -lc "tail -n 80 \"${devLogPath}\" 2>&1 || true"`)
        const out = String((t as any)?.stdout ?? (t as any)?.output ?? '')
        if (out.trim()) log('dev:log:initial', { tail: out.slice(-2000) })
      } catch {
        // ignore
      }

      log('dev:start:done', { port })

      if (req.waitForReady) {
        // 关键：不要在 sandbox 里用 127.0.0.1/localhost 做 ready 判定。
        // E2B 最新文档推荐用 sandbox.getHost(port) 得到公网 URL；我们直接从“沙箱外部”(本服务进程)去探测 allocated.previewUrl，
        // 这样与用户实际打开的 URL 完全一致，也避开 loopback/网卡差异。

        const maxAttempts = 240
        const expectedCwdMarker = `window.remotion_cwd = \"${projectDir}\";`
        let lastErr: unknown
        let lastDevTail = ''

        const request = async (url: string, method: 'GET' | 'HEAD', timeoutMs: number) => {
          return await new Promise<{ status: number; body: string }>((resolve, reject) => {
            const u = new URL(url)
            const lib = u.protocol === 'https:' ? https : http

            const req = lib.request(
              {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port,
                path: `${u.pathname}${u.search}`,
                method,
                headers: {
                  'user-agent': 'x-pilot-e2b-server/preview-ready',
                },
              },
              (res) => {
                if (method === 'HEAD') {
                  res.resume()
                  return resolve({ status: res.statusCode ?? 0, body: '' })
                }

                const chunks: Buffer[] = []
                let total = 0
                res.on('data', (c: Buffer) => {
                  total += c.length
                  if (total <= 200_000) chunks.push(c)
                })
                res.on('end', () => {
                  const body = Buffer.concat(chunks).toString('utf8')
                  resolve({ status: res.statusCode ?? 0, body })
                })
              },
            )

            req.on('error', reject)
            req.setTimeout(timeoutMs, () => {
              req.destroy(new Error(`Request timeout after ${timeoutMs}ms`))
            })
            req.end()
          })
        }

        const baseUrl = allocated.previewUrl.replace(/\/+$/, '')
        log('dev:publicProbe', { baseUrl })

        // 给 remotion 一点点起机时间，避免第一轮就 connection refused
        await sleep(1000)

        for (let i = 1; i <= maxAttempts; i++) {
          try {
            if (i === 1 || i % 10 === 0) {
              const tailCmd = `bash -lc "tail -n 120 \"${devLogPath}\" 2>&1 || true"`
              const tailRes = await runWithRetries(() => s.commands.run(tailCmd), { attempts: 2, baseDelayMs: 200 })
              lastDevTail = String((tailRes as any)?.stdout ?? (tailRes as any)?.output ?? '')
              if (lastDevTail.trim()) log('dev:log:tail', { tail: lastDevTail.slice(-2000) })

              try {
                const internal = await s.commands.run(
                  `bash -lc 'set +e
echo "--- ps (remotion/npm/node) ---"
ps aux 2>&1 | grep -E "remotion|npm run dev|node" | grep -v grep || true
echo "--- listen port ${port} ---"
if command -v ss >/dev/null 2>&1; then ss -ltnp 2>&1 | grep ":${port} " || true; fi
if command -v netstat >/dev/null 2>&1; then netstat -ltnp 2>&1 | grep ":${port} " || true; fi
exit 0'`,
                )
                const out = String((internal as any)?.stdout ?? (internal as any)?.output ?? '')
                if (out.trim()) log('dev:internalState', { out: out.slice(-4000) })
              } catch {
                // ignore
              }

              log('dev:waitForReady:tick', { attempt: i, maxAttempts, port })
            }

            const html = await request(`${baseUrl}/`, 'GET', 3000)
            if (html.status < 200 || html.status >= 500) {
              throw new Error(`public GET / bad status: ${html.status}`)
            }

            if (!html.body.includes(expectedCwdMarker)) {
              throw new Error(`public HTML cwd marker mismatch (status=${html.status})`)
            }

            const head = await request(`${baseUrl}/bundle.js`, 'HEAD', 3000)
            if (head.status < 200 || head.status >= 500) {
              // 有些 server 不支持 HEAD，兜底 GET（只要能连通且不是 5xx）
              const g = await request(`${baseUrl}/bundle.js`, 'GET', 3000)
              if (g.status < 200 || g.status >= 500) throw new Error(`public /bundle.js not ready (status=${g.status})`)
            }

            log('dev:waitForReady:done', { port, attempt: i, baseUrl })
            break
          } catch (err) {
            lastErr = err
            const msg = String((err as any)?.message ?? err ?? '')

            if (i === 1 || i % 10 === 0) {
              log('dev:waitForReady:error', { attempt: i, msg: msg.slice(0, 500) })
            }

            if (msg.includes('Sandbox is probably not running anymore')) {
              throw new Error(`Sandbox stopped while waiting for dev server. Last error: ${msg}`)
            }

            if (i === maxAttempts) {
              const tail = String((lastErr as any)?.message ?? lastErr ?? '')
              const extra = lastDevTail.trim() ? `\n--- dev.log tail ---\n${lastDevTail.slice(-4000)}` : ''
              throw new Error(`Dev server not ready after ${maxAttempts}s. Last error: ${tail}${extra}`)
            }

            await sleep(1000)
          }
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
