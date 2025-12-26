import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export async function devRoutes(app: FastifyInstance) {
  app.post('/sandboxes/:id/dev:start', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })

  app.get('/sandboxes/:id/preview', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    return reply.code(200).send({ sandboxId: params.id, previewUrl: null })
  })
}
