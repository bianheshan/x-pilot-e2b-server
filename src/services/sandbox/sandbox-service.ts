import { nanoid } from 'nanoid'

import { E2BSandboxClient } from './e2b-client.js'

export type AllocateSandboxInput = {
  userId?: string
  templateId?: string
  templateName?: string
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

  constructor(opts: SandboxServiceOptions) {
    this.e2b = new E2BSandboxClient({ apiKey: opts.e2bApiKey })
    this.templateId = opts.templateId
    this.templateName = opts.templateName
    this.studioPort = opts.studioPort
  }

  async allocate(input: AllocateSandboxInput): Promise<AllocateSandboxResult> {
    const template = input.templateId ?? this.templateId ?? input.templateName ?? this.templateName
    const sandbox = await this.e2b.createSandbox({ template })
    const sandboxId = sandbox.sandboxId

    return {
      sandboxId,
      previewUrl: `https://${this.studioPort}-${sandboxId}.e2b.app`,
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
