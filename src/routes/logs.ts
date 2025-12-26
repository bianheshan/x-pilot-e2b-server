import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export async function logsRoutes(app: FastifyInstance) {
  app.get('/sandboxes/:id/logs', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })
}
