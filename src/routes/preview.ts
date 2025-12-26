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
    const body = previewRequestSchema.parse(req.body ?? {})
    const result = await flow.createPreview(body)
    return reply.code(201).send(result)
  })
}
