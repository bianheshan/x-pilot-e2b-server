export type BuildTemplateResult = {
  ok: boolean
  templateId?: string
  logs?: string
  error?: string
}

export class TemplateService {
  async build(): Promise<BuildTemplateResult> {
    return { ok: false, error: 'Not implemented' }
  }
}
