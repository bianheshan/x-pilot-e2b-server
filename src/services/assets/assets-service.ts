export type UploadAssetInput = {
  sandboxId: string
  assetPath: string
  content: Uint8Array
}

export class AssetsService {
  async upload(_input: UploadAssetInput): Promise<void> {
    throw new Error('Not implemented')
  }
}
