# E2B 管理系统 - 项目上下文说明

## 项目概述

本文档为新建的 **E2B 管理系统**项目提供上下文信息。该管理系统将负责管理本 Remotion 视频渲染项目在 E2B 平台上的完整生命周期。

---

## 当前项目信息

### 项目名称
`x-pilot-video-render` - Remotion 视频渲染项目（E2B 模板源）

### 项目定位
这是一个 **E2B 模板源项目**，包含：
- Remotion 视频组件库（`src/` 目录，134个文件）
- E2B 模板定义（`x-pilot-remotion-template/` 目录）
- 构建配置和依赖定义

### 技术栈
```json
{
  "前端框架": "React + TypeScript",
  "视频引擎": "Remotion 4.0.239",
  "样式方案": "Tailwind CSS",
  "构建工具": "Vite",
  "容器化": "Docker",
  "云平台": "E2B Sandbox"
}
```

### 核心目录结构
```
x-pilot-video-render/
├── x-pilot-remotion-template/     # E2B 模板定义目录 ⭐
│   ├── template.ts                # 模板构建脚本
│   ├── Dockerfile                 # E2B 镜像定义
│   └── README.md                  # 模板说明
├── src/                           # Remotion 组件源码 ⭐
│   ├── components/                # 视频场景组件（109个 .tsx）
│   ├── VideoComposition.tsx       # 主视频组合
│   └── Root.tsx                   # 入口组件
├── package.json                   # Node.js 依赖
├── remotion.config.ts             # Remotion 配置
├── Dockerfile                     # 本地开发容器
└── README.md                      # 项目文档
```

---

## E2B 模板工作原理

### 1. 模板定义位置
**路径**: `x-pilot-remotion-template/template.ts`

这是 E2B 的核心构建脚本，定义了如何将本项目打包成 E2B 可执行模板。

### 2. 模板构建流程

```typescript
// template.ts 的核心逻辑
const template = new TemplateBuilder('x-pilot-remotion-base')
  .cmd(['/bin/bash'])
  .workdir('/home/user/remotion-project')
  
  // 第一步：复制配置文件
  .copy('package.json', 'package-lock.json', 'tsconfig.json', ...)
  
  // 第二步：分批复制 src 目录（避免 FileUploadError）
  .copy('src/types', 'src/scenes', 'src/constants', ...)
  .copy('src/components/Achievement', 'src/components/Background', ...)
  
  // 第三步：安装依赖
  .run('npm install')
  
  // 第四步：设置启动命令
  .run('npm run dev -- --host 0.0.0.0 --port 3000')
```

### 3. 关键技术细节

#### 文件上传策略
由于 E2B 对单次上传的文件数量有限制，`template.ts` 采用了**分批复制**策略：

```typescript
// ⚠️ 直接复制整个 src 会导致 FileUploadError
// .copy('src', `${WORKDIR}/src`)  // ❌ 失败

// ✅ 正确做法：分别复制子目录
const srcDirectoriesToCopy = [
  'types', 'scenes', 'constants', 'utils', 'hooks', 'lib'
]

for (const dir of srcDirectoriesToCopy) {
  templateBuilder = templateBuilder.copy(`src/${dir}`, `${WORKDIR}/src/${dir}`)
}

// components 目录特殊处理（108个文件，需要再次拆分）
const componentsSubdirectoriesToCopy = [
  'Achievement', 'Background', 'Base', // ... 共36个子目录
]

for (const dir of componentsSubdirectoriesToCopy) {
  templateBuilder = templateBuilder
    .copy(`src/components/${dir}`, `${WORKDIR}/src/components/${dir}`)
}
```

#### 构建命令
```bash
# 在 x-pilot-remotion-template 目录下执行
npm run build

# 该命令会：
# 1. 执行 template.ts
# 2. 上传所有文件到 E2B
# 3. 在云端构建 Docker 镜像
# 4. 生成模板 ID（格式：{template-name}-{hash}）
```

---

## E2B 模板使用方式

### 1. 创建沙箱实例

```javascript
import { Sandbox } from '@e2b/code-interpreter'

// 方式1：使用最新模板
const sandbox = await Sandbox.create({ template: 'x-pilot-remotion-base' })

// 方式2：使用指定版本
const sandbox = await Sandbox.create({ 
  template: 'x-pilot-remotion-base-abc123xyz' 
})

// 获取沙箱信息
const sandboxId = sandbox.sandboxId  // 格式：ieinbicy0cs59y022pax3
```

### 2. 访问 Remotion Studio

沙箱启动后，Remotion Studio 运行在端口 3000，通过以下 URL 访问：

```
格式：https://3000-{sandbox_id}.e2b.app
示例：https://3000-ieinbicy0cs59y022pax3.e2b.app
```

### 3. 沙箱操作 API

```javascript
// 上传文件
await sandbox.files.write('/home/user/remotion-project/data.json', content)

// 执行命令
const result = await sandbox.commands.run('npm run build')
console.log(result.stdout, result.stderr, result.exitCode)

// 下载文件
const content = await sandbox.files.read('/home/user/remotion-project/out/video.mp4')

// 关闭沙箱
await sandbox.close()
```

---

## 新管理系统需要对接的功能

### 1. 模板构建管理

**需求**：
- 监听本项目代码变更，触发模板重新构建
- 管理模板版本（保留历史版本，支持回滚）
- 构建日志记录和错误追踪

**关键对接点**：
```bash
# 构建命令
cd x-pilot-remotion-template && npm run build

# 获取构建输出的模板 ID
# 输出格式：Template built successfully: x-pilot-remotion-base-abc123xyz
```

**环境变量需求**：
```bash
E2B_API_KEY=e2b_xxxxxxxxxxxxx
```

### 2. 沙箱资源池管理

**需求**：
- 预创建沙箱池（warm pool），减少冷启动时间
- 监控沙箱状态（运行中/空闲/异常）
- 自动回收超时沙箱
- 负载均衡和资源限额

**数据模型建议**：
```typescript
interface SandboxInstance {
  sandboxId: string          // e2b 沙箱 ID
  templateId: string         // 使用的模板版本
  status: 'idle' | 'busy' | 'error'
  createdAt: Date
  lastUsedAt: Date
  accessUrl: string          // https://3000-{id}.e2b.app
  metadata: Record<string, any>  // 自定义元数据
}
```

### 3. 代码上传管理

**需求**：
- 支持上传单个文件到沙箱
- 支持批量上传（自动处理大文件/大批量）
- 增量同步（只上传变更的文件）
- 上传进度追踪

**关键路径**：
```javascript
// 沙箱工作目录
const WORKDIR = '/home/user/remotion-project'

// 重要子目录
const paths = {
  src: `${WORKDIR}/src`,                    // 组件源码
  components: `${WORKDIR}/src/components`,  // 场景组件
  public: `${WORKDIR}/public`,              // 静态资源
  packageJson: `${WORKDIR}/package.json`    // 依赖定义
}
```

**注意事项**：
- 如果修改了 `package.json`，需要在沙箱内执行 `npm install`
- 如果修改了 TypeScript 文件，Vite 会自动热更新（无需重启）

### 4. 资源上传管理

**需求**：
- 上传视频素材、图片、音频到沙箱
- 支持大文件上传（分片/断点续传）
- 资源库管理（CDN 缓存、去重）

**推荐存储路径**：
```bash
/home/user/remotion-project/public/assets/
├── videos/
├── images/
├── audio/
└── fonts/
```

**使用方式**：
```typescript
// 在 Remotion 组件中引用
import videoSrc from '/assets/videos/example.mp4'

<Video src={videoSrc} />
```

### 5. 沙箱生命周期管理

**关键时间点**：

| 阶段 | 耗时 | 说明 |
|------|------|------|
| 创建沙箱 | 5-15秒 | `Sandbox.create()` |
| 启动 Remotion | 5-10秒 | `npm run dev` |
| 首次访问 | 1-3秒 | 浏览器加载 Studio UI |
| **总计** | **15-30秒** | 从冷启动到可用 |

**优化建议**：
- 使用沙箱池预热（提前创建好实例）
- 保持沙箱常驻（避免频繁创建/销毁）
- 超过30分钟无活动才回收

---

## 集成示例代码

### 完整的沙箱管理流程

```typescript
import { Sandbox } from '@e2b/code-interpreter'
import fs from 'fs/promises'

class RemotionSandboxManager {
  private templateId: string

  constructor(templateId: string = 'x-pilot-remotion-base') {
    this.templateId = templateId
  }

  /**
   * 创建并启动沙箱
   */
  async createSandbox() {
    console.log('🚀 创建沙箱...')
    const sandbox = await Sandbox.create({ template: this.templateId })

    console.log(`✅ 沙箱创建成功: ${sandbox.sandboxId}`)

    // 等待 Remotion Studio 启动
    console.log('⏳ 等待 Remotion Studio 启动...')
    await this.waitForStudio(sandbox)

    // 生成访问 URL
    const accessUrl = `https://3000-${sandbox.sandboxId}.e2b.app`
    console.log(`📍 访问地址: ${accessUrl}`)

    return {
      sandbox,
      sandboxId: sandbox.sandboxId,
      accessUrl
    }
  }

  /**
   * 等待 Remotion Studio 就绪
   */
  private async waitForStudio(sandbox: Sandbox, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await sandbox.commands.run('curl -s localhost:3000')
        if (result.exitCode === 0) {
          console.log('✅ Remotion Studio 已就绪')
          return true
        }
      } catch (error) {
        // 继续等待
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error('Remotion Studio 启动超时')
  }

  /**
   * 上传场景组件
   */
  async uploadScene(sandbox: Sandbox, sceneCode: string, sceneName: string) {
    const filePath = `/home/user/remotion-project/src/components/${sceneName}.tsx`
    await sandbox.files.write(filePath, sceneCode)
    console.log(`✅ 场景上传成功: ${sceneName}`)
  }

  /**
   * 上传资源文件
   */
  async uploadAsset(sandbox: Sandbox, fileContent: Buffer | string, assetPath: string) {
    const fullPath = `/home/user/remotion-project/public/assets/${assetPath}`
    await sandbox.files.write(fullPath, fileContent)
    console.log(`✅ 资源上传成功: ${assetPath}`)
  }

  /**
   * 批量上传文件（处理大量文件）
   */
  async uploadFiles(sandbox: Sandbox, files: Array<{ path: string; content: Buffer | string }>) {
    const BATCH_SIZE = 50
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(file => 
          sandbox.files.write(`/home/user/remotion-project/${file.path}`, file.content)
        )
      )
      console.log(`✅ 已上传 ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} 个文件`)
    }
  }

  /**
   * 执行命令
   */
  async executeCommand(sandbox: Sandbox, command: string) {
    const result = await sandbox.commands.run(command)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    }
  }

  /**
   * 下载渲染的视频
   */
  async downloadVideo(sandbox: Sandbox, remotePath: string, localPath: string) {
    const content = await sandbox.files.read(remotePath)
    await fs.writeFile(localPath, content)
    console.log(`✅ 视频下载成功: ${localPath}`)
  }

  /**
   * 清理沙箱
   */
  async cleanup(sandbox: Sandbox) {
    await sandbox.close()
    console.log('🗑️ 沙箱已关闭')
  }
}

// 使用示例
async function main() {
  const manager = new RemotionSandboxManager()

  try {
    // 创建沙箱
    const { sandbox, accessUrl } = await manager.createSandbox()

    // 上传自定义场景
    const sceneCode = `
      import React from 'react'
      
      export const MyScene: React.FC = () => {
        return <div style={{ fontSize: 60 }}>Hello E2B!</div>
      }
    `
    await manager.uploadScene(sandbox, sceneCode, 'MyScene')

    // 上传资源
    const videoBuffer = await fs.readFile('./local-video.mp4')
    await manager.uploadAsset(sandbox, videoBuffer, 'videos/demo.mp4')

    // 执行自定义命令
    const result = await manager.executeCommand(sandbox, 'ls -la /home/user/remotion-project/src/components')
    console.log('📁 组件列表:', result.stdout)

    console.log(`\n🌐 在浏览器中访问: ${accessUrl}`)
    console.log('按 Ctrl+C 关闭沙箱...')

    // 保持运行（实际应用中应该由请求生命周期管理）
    await new Promise(() => {}) // 永久等待

  } catch (error) {
    console.error('❌ 错误:', error)
    process.exit(1)
  }
}

// 启动
main()
```

---

## 新项目技术栈建议

### 后端框架
```json
{
  "框架": "Express / Fastify / NestJS",
  "优势": [
    "原生异步支持（处理大量沙箱并发）",
    "WebSocket 支持（实时日志推送）",
    "丰富的生态系统"
  ],
  "推荐": "NestJS（企业级项目）或 Fastify（高性能需求）"
}
```

### 核心依赖
```json
{
  "dependencies": {
    "@e2b/code-interpreter": "^0.0.x",
    "express": "^4.18.0",
    "fastify": "^4.0.0",
    "ws": "^8.0.0",
    "ioredis": "^5.0.0",
    "prisma": "^5.0.0",
    "bull": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

**依赖说明**：
- `@e2b/code-interpreter`: E2B Node.js SDK
- `express` / `fastify`: Web 框架
- `ws`: WebSocket 支持（实时日志）
- `ioredis`: Redis 客户端（沙箱池状态缓存）
- `prisma`: ORM（沙箱元数据存储）
- `bull`: 任务队列（异步构建、清理）

### 数据库设计
```sql
-- 模板版本表
CREATE TABLE templates (
    id VARCHAR(50) PRIMARY KEY,
    version VARCHAR(20),
    built_at TIMESTAMP,
    source_commit VARCHAR(40),
    status VARCHAR(20)  -- active/deprecated
);

-- 沙箱实例表
CREATE TABLE sandboxes (
    sandbox_id VARCHAR(50) PRIMARY KEY,
    template_id VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP,
    last_used_at TIMESTAMP,
    access_url VARCHAR(200),
    metadata JSON
);

-- 资源上传记录
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    sandbox_id VARCHAR(50),
    file_path VARCHAR(500),
    file_size BIGINT,
    uploaded_at TIMESTAMP
);
```

### API 端点设计

```typescript
// Express 路由示例
import express from 'express'
import { RemotionSandboxManager } from './services/sandbox-manager'

const app = express()
const manager = new RemotionSandboxManager()

// 模板管理
app.post('/api/templates/build', async (req, res) => {
  // 触发模板构建
})

app.get('/api/templates', async (req, res) => {
  // 获取模板列表
})

app.get('/api/templates/:id', async (req, res) => {
  // 获取模板详情
})

// 沙箱管理
app.post('/api/sandboxes', async (req, res) => {
  const { sandbox, accessUrl } = await manager.createSandbox()
  res.json({ sandboxId: sandbox.sandboxId, accessUrl })
})

app.get('/api/sandboxes', async (req, res) => {
  // 获取沙箱列表
})

app.get('/api/sandboxes/:id', async (req, res) => {
  // 获取沙箱详情
})

app.delete('/api/sandboxes/:id', async (req, res) => {
  // 销毁沙箱
})

// 文件操作
app.post('/api/sandboxes/:id/files', async (req, res) => {
  // 上传文件
})

app.post('/api/sandboxes/:id/assets', async (req, res) => {
  // 上传资源（支持 multipart/form-data）
})

app.post('/api/sandboxes/:id/execute', async (req, res) => {
  // 执行命令
})

// 资源池管理
app.get('/api/pool/status', async (req, res) => {
  // 获取资源池状态
})

app.post('/api/pool/warmup', async (req, res) => {
  // 预热沙箱池
})

app.listen(3000)
```

---

## 重要配置信息

### E2B API 配置
```bash
# .env 文件
E2B_API_KEY=e2b_xxxxxxxxxxxxx
TEMPLATE_NAME=x-pilot-remotion-base
SANDBOX_TIMEOUT=1800  # 30分钟无活动自动回收
POOL_SIZE=5           # 保持5个预热沙箱
```

### 本项目路径
```bash
# 项目根目录
PROJECT_ROOT=/Users/bianheshan/code/x-pilot-video-render

# 模板定义目录
TEMPLATE_DIR=$PROJECT_ROOT/x-pilot-remotion-template

# 构建命令
cd $TEMPLATE_DIR && npm run build
```

### 沙箱内路径
```bash
# 工作目录
WORKDIR=/home/user/remotion-project

# 关键文件
- $WORKDIR/package.json          # 依赖定义
- $WORKDIR/src/VideoComposition.tsx  # 主入口
- $WORKDIR/public/               # 静态资源目录
```

---

## 常见问题和解决方案

### 1. FileUploadError: Too many files
**原因**：一次性上传文件数超过限制（约100-150个）

**解决**：参考 `template.ts` 的分批复制策略

### 2. Remotion Studio 无法访问
**原因**：
- 沙箱未完全启动（需等待20秒）
- URL 格式错误（必须是 `https://3000-{sandbox_id}.e2b.app`）

**解决**：
```typescript
// 启动后等待并检查
async function waitForStudio(sandbox: Sandbox) {
  for (let i = 0; i < 10; i++) {
    const result = await sandbox.commands.run('curl -s localhost:3000')
    if (result.exitCode === 0) {
      console.log("✅ Remotion Studio 已就绪")
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('Studio 启动超时')
}
```

### 3. 沙箱内存溢出
**原因**：处理大型视频文件或复杂渲染

**解决**：
- 升级 E2B 实例类型（如果支持）
- 优化 Remotion 组件（减少并发渲染）
- 分片处理大文件

### 4. 模板构建失败
**原因**：
- 网络问题（npm install 失败）
- 依赖版本冲突
- Dockerfile 配置错误

**解决**：
```bash
# 本地测试 Dockerfile
cd x-pilot-remotion-template
docker build -t test-template .
docker run -it test-template /bin/bash

# 检查依赖安装
npm install --verbose
```

---

## 下一步行动

### 1. 新项目初始化
```bash
# 创建项目
mkdir x-pilot-e2b-manager
cd x-pilot-e2b-manager

# 初始化 Node.js 项目
npm init -y

# 安装依赖
npm install @e2b/code-interpreter express ws ioredis prisma bull
npm install -D typescript @types/node @types/express tsx prisma

# 初始化 TypeScript
npx tsc --init

# 创建基础结构
mkdir -p src/{api,models,services,tasks,config}
touch src/{api,models,services,tasks,config}/index.ts

# 创建入口文件
touch src/index.ts
```

**package.json 配置**：
```json
{
  "name": "x-pilot-e2b-manager",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**tsconfig.json 关键配置**：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "esModuleInterop": true,
    "strict": true
  }
}
```

### 2. 首个功能：模板构建管理
```typescript
// src/services/template-builder.ts
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export class TemplateBuilder {
  private projectRoot: string
  private templateDir: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    this.templateDir = path.join(projectRoot, 'x-pilot-remotion-template')
  }

  /**
   * 构建 E2B 模板
   */
  async build(): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: this.templateDir
      })

      // 解析输出获取模板 ID
      const templateId = this.parseTemplateId(stdout)
      
      return { 
        success: true, 
        templateId 
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      }
    }
  }

  /**
   * 从构建输出中提取模板 ID
   */
  private parseTemplateId(output: string): string {
    // 匹配格式: Template built successfully: x-pilot-remotion-base-abc123xyz
    const match = output.match(/Template built successfully: (.+)/)
    return match ? match[1].trim() : ''
  }
}
```

### 3. 测试对接
- 在新项目中调用本项目的模板构建
- 创建测试沙箱并验证功能
- 实现基础的 CRUD API

---

## 联系方式和资源

### 本项目仓库
- **路径**: `/Users/bianheshan/code/x-pilot-video-render`
- **关键文件**: `x-pilot-remotion-template/template.ts`

### E2B 文档
- 官方文档: https://e2b.dev/docs
- Python SDK: https://github.com/e2b-dev/code-interpreter

### Remotion 文档
- 官方文档: https://www.remotion.dev/docs

---

## 总结

本说明文档提供了：
1. ✅ 当前项目的完整技术架构
2. ✅ E2B 模板的工作原理和构建流程
3. ✅ 新管理系统需要对接的所有功能点
4. ✅ 完整的集成示例代码
5. ✅ 技术栈建议和数据库设计
6. ✅ 常见问题和解决方案

**将此文档作为新项目的上下文，可以让 AI 快速理解系统架构并开始开发。**

---

**文档版本**: 1.0  
**创建日期**: 2025-12-26  
**维护者**: x-pilot-video-render 项目组
