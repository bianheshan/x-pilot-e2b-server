export type JobId = string
export type SandboxId = string

export type SandboxStatus = 'idle' | 'busy' | 'error' | 'unknown'

export type AllocateSandboxResponse = {
  sandboxId: SandboxId
  previewUrl: string
}

export type ErrorPhase = 'upload' | 'install' | 'dev' | 'render'

export type StructuredError = {
  phase: ErrorPhase
  message: string
  exitCode?: number
  command?: string
  stderrTail?: string
}
