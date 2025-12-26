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
    const allocated = await this.sandboxService.allocate({
      userId: req.userId,
      templateId: req.templateId,
      templateName: req.templateName,
    })

    const sandbox = this.sandboxService.getSandbox(allocated.sandboxId)
    if (!sandbox) throw new Error('Sandbox not found in local process (unexpected)')

    const jobId = req.jobId ?? this.sandboxService.createJobId()
    const { root, projectDir } = this.ws.getPaths(jobId)

    const s: any = sandbox

    // envd 偶发未就绪会出现 "fetch failed"，这里做一次 warm-up + 重试
    await runWithRetries(
      () => s.commands.run(`bash -lc "echo envd_ok"`),
      { attempts: 5, baseDelayMs: 800 },
    )

    await runWithRetries(
      () =>
        s.commands.run(
          `bash -lc "set -euo pipefail; mkdir -p ${root}; rm -rf ${projectDir}; mkdir -p ${projectDir}; BASE_DIR=''; for d in '${env.BASE_PROJECT_DIR}' /app /code /home/user /home/user/app /home/user/code /workspace; do if [ -d \"$d\" ] && ( [ -f \"$d/package.json\" ] || [ -f \"$d/remotion.config.ts\" ] ); then BASE_DIR=\"$d\"; break; fi; done; if [ -z \"$BASE_DIR\" ]; then echo 'BASE_PROJECT_DIR not found (auto-detect failed). Tried: ${env.BASE_PROJECT_DIR}, /app, /code, /home/user, /home/user/app, /home/user/code, /workspace' >&2; echo 'Tip: set TEMPLATE_NAME/TEMPLATE_ID to your built template and/or set BASE_PROJECT_DIR to the correct path inside the sandbox.' >&2; echo '--- ls -la / ---' >&2; ls -la / >&2 || true; echo '--- ls -la /home/user ---' >&2; ls -la /home/user >&2 || true; echo '--- ls -la /code ---' >&2; ls -la /code >&2 || true; exit 1; fi; cp -R \"$BASE_DIR\"/. ${projectDir}/"`,
        ),
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
      await s.commands.run(
        `bash -lc "cd ${projectDir} && (nohup npm run dev -- --host 0.0.0.0 --port ${env.STUDIO_PORT} > /tmp/dev-${jobId}.log 2>&1 &)"`,
      )

      if (req.waitForReady) {
        await s.commands.run(
          `bash -lc "for i in $(seq 1 30); do curl -fsS http://localhost:${env.STUDIO_PORT}/ >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1"`,
        )
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
