import fs from 'node:fs'
import path from 'node:path'

import dotenv from 'dotenv'
import { z } from 'zod'

// 支持两种位置：
// 1) 项目根目录 .env（优先）
// 2) build-template/.env（示例文件位置；仅在根目录未提供 E2B_API_KEY 时兜底）
const rootEnvPath = path.join(process.cwd(), '.env')
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
}

if (!process.env.E2B_API_KEY) {
  const fallbackEnvPath = path.join(process.cwd(), 'build-template', '.env')
  if (fs.existsSync(fallbackEnvPath)) {
    dotenv.config({ path: fallbackEnvPath })
  }
}



const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  E2B_API_KEY: z.string().min(1).optional(),
  TEMPLATE_ID: z.string().min(1).optional(),
  // 默认使用本仓库 build-template 构建出来的模板别名
  TEMPLATE_NAME: z.string().min(1).default('x-pilot-remotion-template'),


  SANDBOX_TIMEOUT: z.coerce.number().int().positive().default(1800),
  POOL_SIZE: z.coerce.number().int().nonnegative().default(5),
  MAX_SANDBOX_PER_USER: z.coerce.number().int().positive().default(2),

  STUDIO_PORT: z.coerce.number().int().positive().default(3000),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),

  // Workspace strategy (方案 A)
  WORKSPACES_ROOT: z.string().default('/home/user/workspaces'),
  PROJECT_NAME: z.string().default('remotion-project'),
  BASE_PROJECT_DIR: z.string().default('/app'),
})


export const env = envSchema.parse(process.env)
export type Env = typeof env
