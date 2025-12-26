import { Sandbox } from 'e2b'


export type CreateSandboxInput = {
  template: string
}

export class E2BSandboxClient {
  private readonly apiKey?: string
  private readonly sandboxes = new Map<string, Sandbox>()

  constructor(opts: { apiKey?: string }) {
    this.apiKey = opts.apiKey
  }

  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId)
  }

  async createSandbox(input: CreateSandboxInput): Promise<Sandbox> {

    if (!this.apiKey) {
      throw new Error('E2B_API_KEY is required')
    }

    let sandbox: Sandbox
    try {
      // e2b SDK：Sandbox.create(templateNameOrId, { apiKey })
      sandbox = await (Sandbox as any).create(input.template, { apiKey: this.apiKey, requestTimeoutMs: 60_000 })

    } catch {
      // 兼容极少数旧签名/包装层
      sandbox = await (Sandbox as any).create({ template: input.template, apiKey: this.apiKey })
    }



    this.sandboxes.set(sandbox.sandboxId, sandbox)
    return sandbox
  }

  async closeSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId)
    if (!sandbox) return

    const s: any = sandbox
    if (typeof s.close === 'function') {
      await s.close()
    } else if (typeof s.kill === 'function') {
      await s.kill()
    } else if (typeof s.destroy === 'function') {
      await s.destroy()
    }

    this.sandboxes.delete(sandboxId)
  }
}

