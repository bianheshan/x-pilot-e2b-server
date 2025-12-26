import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Template, waitForPort } from 'e2b'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const WORKDIR = '/app'

// Service directories to create in the container
const serviceDirectories = [
  'output',
  'src/scenes',
  'src/assets/images',
  'src/assets/fonts',
  'src/assets/audio',
  'src/assets/videos',
]

// Root level files to copy
const rootFilesToCopy = [
  'remotion.config.ts',
  'render.js',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'remotion-studio-custom.css',
  'test_push.sh',
]

// src directory files to copy individually
const srcFilesToCopy = [
  'index.ts',
  'Root.tsx',
  'VideoComposition.tsx',
  'styles.css',
]

// src subdirectories to copy
const srcDirectoriesToCopy = [
  'contexts',
  'scenes',
  'utils',
  'types',
  'assets',
]

// src/components subdirectories to copy separately (large directory)
const componentsSubdirectoriesToCopy = [
  '3d-industrial',
  'business-logic',
  'Layouts',
  'narrative-typography',
  'science-math',
  'tech-code-demo',
]

// src/components files to copy
const componentsFilesToCopy = [
  'AISpeaker.tsx',
  'CodeBlock.tsx',
  'index.ts',
  'Subtitle.tsx',
  'TitleCard.tsx',
]

let templateBuilder = Template({
  fileContextPath: projectRoot,
  fileIgnorePatterns: ['x-pilot-remotion-template', 'web-uploader', 'node_modules', 'build', 'examples', 'docs'],
})
  .fromNodeImage('20-slim')
  .aptInstall(['ffmpeg', 'fonts-liberation', 'fonts-dejavu-core'], { noInstallRecommends: true })
  .setWorkdir(WORKDIR)
  // Copy package files and install dependencies
  .copy(['package.json', 'package-lock.json'], `${WORKDIR}/`)
  .runCmd('npm ci --legacy-peer-deps')
  // Copy root level directory
  .copy('public', `${WORKDIR}/public`)

// Copy root level files
for (const file of rootFilesToCopy) {
  templateBuilder = templateBuilder.copy(file, `${WORKDIR}/${file}`)
}

// Create necessary directories
templateBuilder = templateBuilder.runCmd(`mkdir -p ${WORKDIR}/src ${serviceDirectories.map((dir) => `${WORKDIR}/${dir}`).join(' ')}`)

// Copy src files
for (const file of srcFilesToCopy) {
  templateBuilder = templateBuilder.copy(`src/${file}`, `${WORKDIR}/src/${file}`)
}

// Copy src subdirectories
for (const dir of srcDirectoriesToCopy) {
  templateBuilder = templateBuilder.copy(`src/${dir}`, `${WORKDIR}/src/${dir}`)
}

// Create components directory
templateBuilder = templateBuilder.runCmd(`mkdir -p ${WORKDIR}/src/components`)

// Copy components files
for (const file of componentsFilesToCopy) {
  templateBuilder = templateBuilder.copy(`src/components/${file}`, `${WORKDIR}/src/components/${file}`)
}

// Copy components subdirectories
for (const dir of componentsSubdirectoriesToCopy) {
  templateBuilder = templateBuilder.copy(`src/components/${dir}`, `${WORKDIR}/src/components/${dir}`)
}

// Set environment and start command
export const template = templateBuilder
  .setEnvs({
    NODE_ENV: 'production',
    DISPLAY: ':99',
  })
  .setStartCmd(`cd ${WORKDIR} && npm run dev`, waitForPort(3000))