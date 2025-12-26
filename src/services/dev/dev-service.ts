export type EnsureDevServerInput = {
  sandboxId: string
  cwd: string
  port: number
}

export class DevService {
  async ensureStarted(_input: EnsureDevServerInput): Promise<void> {
    throw new Error('Not implemented')
  }
}
