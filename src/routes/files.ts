import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export async function filesRoutes(app: FastifyInstance) {
  // 注意：Fastify 的路由里 ":" 会被当成参数标记（例如 "files:write" 会被解析成 "files" + 参数），
  // 因此不能用 ":" 来做 action 分隔，否则会与同前缀的其它路由冲突。
  app.post('/sandboxes/:id/files/write', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })

  app.post('/sandboxes/:id/files/sync', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)
    void params
    return reply.code(501).send({ error: 'Not implemented' })
  })
}

