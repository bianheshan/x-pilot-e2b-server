export type WorkspacePaths = {
  root: string
  projectDir: string
  assetsDir: string
}

export class WorkspaceService {
  constructor(
    private readonly opts: {
      workspacesRoot: string
      baseProjectDir: string
      projectName: string
    },
  ) {}

  getPaths(jobId: string): WorkspacePaths {
    const root = `${this.opts.workspacesRoot}/${jobId}`
    const projectDir = `${root}/${this.opts.projectName}`
    const assetsDir = `${projectDir}/public/assets`

    return { root, projectDir, assetsDir }
  }
}
