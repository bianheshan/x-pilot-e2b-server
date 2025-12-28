import type { FastifyInstance } from 'fastify'

import { env } from '../config/env.js'
import { previewRequestSchema, PreviewFlowService } from '../services/preview/preview-flow-service.js'
import { SandboxService } from '../services/sandbox/sandbox-service.js'

export async function previewRoutes(app: FastifyInstance) {
  const sandboxService = new SandboxService({
    e2bApiKey: env.E2B_API_KEY,
    templateId: env.TEMPLATE_ID,
    templateName: env.TEMPLATE_NAME,
    studioPort: env.STUDIO_PORT,
  })

  const flow = new PreviewFlowService(sandboxService)

  app.post('/preview', async (req, reply) => {
    const reqId = (req as any).id
    app.log.info({ reqId }, 'preview: request received')

    try {
      const body = previewRequestSchema.parse(req.body ?? {})
      app.log.info(
        {
          reqId,
          startDev: body.startDev,
          waitForReady: body.waitForReady,
          scenesCount: Array.isArray(body.scenes) ? body.scenes.length : 0,
        },
        'preview: parsed body',
      )

      const result = await flow.createPreview(body)
      app.log.info({ reqId, sandboxId: result.sandboxId, jobId: result.jobId }, 'preview: completed')
      return reply.code(201).send(result)
    } catch (err) {
      app.log.error({ reqId, err }, 'preview: failed')
      throw err
    }
  })
}
