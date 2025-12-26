export type WriteFileInput = {
  sandboxId: string
  path: string
  content: string | Uint8Array
}

export class FilesService {
  async write(_input: WriteFileInput): Promise<void> {
    throw new Error('Not implemented')
  }
}
