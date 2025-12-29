import { nanoid } from 'nanoid'

import { E2BSandboxClient } from './e2b-client.js'

export type AllocateSandboxInput = {
  userId?: string
  templateId?: string
  templateName?: string
  studioPort?: number
}

export type AllocateSandboxResult = {
  sandboxId: string
  previewUrl: string
}

export type SandboxServiceOptions = {
  e2bApiKey?: string
  templateId?: string
  templateName: string
  studioPort: number
}

export class SandboxService {
  private readonly e2b: E2BSandboxClient
  private readonly templateId?: string
  private readonly templateName: string
  private readonly studioPort: number

  // admin 测试用途：同一个 token（复用 key）复用同一个 sandbox，减少重复启动。
  // 注意：这是进程内内存缓存，服务重启后会丢。
  private readonly reuseIndex = new Map<string, { sandboxId: string; lastUsedAt: number }>()

  constructor(opts: SandboxServiceOptions) {
    this.e2b = new E2BSandboxClient({ apiKey: opts.e2bApiKey })
    this.templateId = opts.templateId
    this.templateName = opts.templateName
    this.studioPort = opts.studioPort
  }

  private makeReuseKey(input: { userId?: string; template: string; studioPort: number }) {
    const u = (input.userId || '').trim()
    if (!u) return null
    return `${input.template}::${input.studioPort}::${u}`
  }

  private async getPreviewUrlForSandbox(sandbox: any, studioPort: number, sandboxId: string): Promise<string> {
    try {
      if (typeof sandbox.getPublicUrlForPort === 'function') {
        const url = await sandbox.getPublicUrlForPort(studioPort)
        if (url) return url
      }
    } catch {
      // ignore
    }

    try {
      if (typeof sandbox.getHost === 'function') {
        const hostOrPromise = sandbox.getHost(studioPort)
        const host = typeof hostOrPromise?.then === 'function' ? await hostOrPromise : hostOrPromise
        if (host) return `https://${host}`
      }
    } catch {
      // ignore
    }

    return `https://${studioPort}-${sandboxId}.e2b.app`
  }

  async allocate(input: AllocateSandboxInput): Promise<AllocateSandboxResult> {
    const template = input.templateId ?? this.templateId ?? input.templateName ?? this.templateName
    const studioPort = input.studioPort ?? this.studioPort

    const reuseKey = this.makeReuseKey({ userId: input.userId, template, studioPort })
    if (reuseKey) {
      const existing = this.reuseIndex.get(reuseKey)
      if (existing) {
        const sandbox = this.e2b.getSandbox(existing.sandboxId)
        if (sandbox) {
          const s: any = sandbox
          // best-effort 检查是否还活着；不行就走新建
          try {
            if (s.commands && typeof s.commands.run === 'function') {
              await s.commands.run(`bash -lc "echo ping"`)
            }
            const previewUrl = await this.getPreviewUrlForSandbox(s, studioPort, existing.sandboxId)
            existing.lastUsedAt = Date.now()
            return { sandboxId: existing.sandboxId, previewUrl }
          } catch {
            // ignore and recreate
          }
        }

        this.reuseIndex.delete(reuseKey)
      }
    }

    const sandbox = await this.e2b.createSandbox({ template })
    const sandboxId = sandbox.sandboxId

    const s: any = sandbox
    const previewUrl = await this.getPreviewUrlForSandbox(s, studioPort, sandboxId)

    if (reuseKey) {
      this.reuseIndex.set(reuseKey, { sandboxId, lastUsedAt: Date.now() })
    }

    return {
      sandboxId,
      previewUrl,
    }
  }


  async getStatus(sandboxId: string): Promise<{ sandboxId: string; status: 'unknown' }> {
    void sandboxId
    return { sandboxId, status: 'unknown' }
  }

  getSandbox(sandboxId: string) {
    return this.e2b.getSandbox(sandboxId)
  }

  async destroy(sandboxId: string): Promise<void> {
    await this.e2b.closeSandbox(sandboxId)
  }


  createJobId() {
    return nanoid()
  }
}
