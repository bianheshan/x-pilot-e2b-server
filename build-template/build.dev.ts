import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { Template, defaultBuildLogger } from 'e2b'

import { template } from './template'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../.env'), override: false })

const apiKey = process.env.E2B_API_KEY

if (!apiKey) {
  throw new Error('E2B_API_KEY is required. Please set it in your environment or .env file.')
}

async function main() {
  await Template.build(template, {
    alias: 'x-pilot-remotion-template-dev',
    apiKey,
    onBuildLogs: defaultBuildLogger(),
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})