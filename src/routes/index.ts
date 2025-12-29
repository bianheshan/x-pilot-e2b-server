import type { FastifyInstance } from 'fastify'

import { healthRoutes } from './health.js'
import { sandboxRoutes } from './sandboxes.js'
import { filesRoutes } from './files.js'
import { assetsRoutes } from './assets.js'
import { devRoutes } from './dev.js'
import { renderRoutes } from './renders.js'
import { logsRoutes } from './logs.js'
import { previewRoutes } from './preview.js'
import { adminRoutes } from './admin.js'
import { localAdminRoutes } from './local-admin.js'
import { localPushRoutes } from './local-push.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: '/health' })

  await app.register(adminRoutes)
  await app.register(localAdminRoutes)

  await app.register(sandboxRoutes, { prefix: '/api/sandboxes' })
  await app.register(filesRoutes, { prefix: '/api' })
  await app.register(assetsRoutes, { prefix: '/api' })
  await app.register(devRoutes, { prefix: '/api' })
  await app.register(renderRoutes, { prefix: '/api' })
  await app.register(logsRoutes, { prefix: '/api' })
  await app.register(previewRoutes, { prefix: '/api' })
  await app.register(localPushRoutes, { prefix: '/api' })
}


