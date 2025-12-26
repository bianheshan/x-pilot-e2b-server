import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export async function renderRoutes(app: FastifyInstance) {
  app.post('/sandboxes/:id/renders', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })

  app.get('/sandboxes/:id/renders/:jobId', async (req, reply) => {
    const params = z.object({ id: z.string().min(1), jobId: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })

  app.get('/sandboxes/:id/renders/:jobId/download', async (req, reply) => {
    const params = z.object({ id: z.string().min(1), jobId: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })
}
