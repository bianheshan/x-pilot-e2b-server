import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export async function assetsRoutes(app: FastifyInstance) {
  app.post('/sandboxes/:id/assets', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })
}
