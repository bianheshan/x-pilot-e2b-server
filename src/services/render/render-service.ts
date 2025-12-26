export type CreateRenderInput = {
  sandboxId: string
  cwd: string
}

export type RenderJob = {
  jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
}

export class RenderService {
  async create(_input: CreateRenderInput): Promise<RenderJob> {
    throw new Error('Not implemented')
  }
}
