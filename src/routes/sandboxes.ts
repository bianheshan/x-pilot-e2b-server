import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { env } from '../config/env.js'
import { SandboxService } from '../services/sandbox/sandbox-service.js'

export async function sandboxRoutes(app: FastifyInstance) {
  const sandboxService = new SandboxService({
    e2bApiKey: env.E2B_API_KEY,
    templateId: env.TEMPLATE_ID,
    templateName: env.TEMPLATE_NAME,
    studioPort: env.STUDIO_PORT,
  })

  app.post('/', async (req, reply) => {
    const body = z
      .object({
        userId: z.string().min(1).optional(),
        templateId: z.string().min(1).optional(),
        templateName: z.string().min(1).optional(),
      })
      .parse(req.body ?? {})

    const result = await sandboxService.allocate({
      userId: body.userId,
      templateId: body.templateId,
      templateName: body.templateName,
    })

    return reply.code(201).send(result)
  })

  app.get('/:id', async (req) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    return sandboxService.getStatus(params.id)
  })

  app.delete('/:id', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    await sandboxService.destroy(params.id)
    return reply.code(204).send()
  })
}
