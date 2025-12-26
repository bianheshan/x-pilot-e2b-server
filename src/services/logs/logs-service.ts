export type LogsCursor = string

export type LogsPage = {
  lines: string[]
  nextCursor?: LogsCursor
}

export class LogsService {
  async get(_sandboxId: string, _cursor?: LogsCursor): Promise<LogsPage> {
    throw new Error('Not implemented')
  }
}
