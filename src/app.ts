import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'

import { env } from './config/env.js'
import { registerRoutes } from './routes/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  })

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_BYTES,
    },
  })

  await registerRoutes(app)

  return app
}
