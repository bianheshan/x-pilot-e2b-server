# Dify 与 E2B 管理服务集成指南

## 系统架构概述

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│             │  代码数组  │                  │  场景文件  │                 │
│    Dify     │ ───────> │  E2B 管理服务    │ ───────> │  E2B Sandbox    │
│  (AI生成)   │          │  (转换 + 部署)   │          │ (Remotion预览)  │
└─────────────┘         └──────────────────┘         └─────────────────┘
      ↓                         ↓                            ↓
   生成代码                  1. 代码转换                   实时预览
   JSON数组                  2. 文件生成                   https://3000-{id}.e2b.app
                            3. manifest构建
                            4. 上传到沙箱
```

---

## 一、Dify 的职责

### 输出格式：纯代码数组

Dify **只负责生成代码字符串数组**，格式如下：

```json
{
  "scenes": [
    "import React from \"react\";\nimport { AbsoluteFill } from \"remotion\";\nimport { TitleCard } from \"../components\";\n\nexport default function Scene1Intro() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: \"#0f172a\" }}>\n      <TitleCard title=\"AI 大模型\" subtitle=\"数学的魔法\" />\n    </AbsoluteFill>\n  );\n}",
    "import React from \"react\";\nimport { AbsoluteFill, useCurrentFrame, interpolate } from \"remotion\";\nimport { TitleGradient } from \"../components/narrative-typography/TitleGradient\";\n\nexport default function Scene2Main() {\n  const frame = useCurrentFrame();\n  const opacity = interpolate(frame, [0, 30], [0, 1]);\n  \n  return (\n    <AbsoluteFill style={{ backgroundColor: \"#1a1a2e\" }}>\n      <div style={{ opacity }}>\n        <TitleGradient text=\"概率与统计\" />\n      </div>\n    </AbsoluteFill>\n  );\n}"
  ]
}
```

**简化版示例（实际使用）**：
```json
{
  "scenes": [
    "import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function Scene1() {\n  return <AbsoluteFill style={{ backgroundColor: '#000' }}>Scene 1</AbsoluteFill>;\n}",
    "import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function Scene2() {\n  return <AbsoluteFill style={{ backgroundColor: '#111' }}>Scene 2</AbsoluteFill>;\n}"
  ]
}
```

### 关键字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `scenes` | String[] | ✅ | 代码字符串数组，每个元素是完整的 TSX 代码 | `["code1", "code2"]` |

**⚠️ 重要**：Dify 只负责生成代码数组，**不包含**场景元数据（id、name、duration）。这些元数据需要 E2B 管理服务根据代码内容自动提取或使用默认值。

### Dify 代码生成规范

#### ✅ 必须遵守的规则

1. **每个场景必须有默认导出**
   ```typescript
   export default function SceneName() { ... }
   ```

2. **使用 Remotion 基础组件**
   ```typescript
   import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
   ```

3. **可用的自定义组件**（已在项目中）
   ```typescript
   // 从 ../components 导入
   import { TitleCard } from "../components";
   import { CodeBlock } from "../components";
   
   // 从子目录导入
   import { TitleGradient } from "../components/narrative-typography/TitleGradient";
   import { IndGearMechanism } from "../components/3d-industrial/IndGearMechanism";
   import { MathFormula } from "../components/science-math/MathFormula";
   import { DataFlowChart } from "../components/business-logic/DataFlowChart";
   ```

4. **使用主题系统**（可选）
   ```typescript
   import { useTheme } from "../contexts/ThemeContext";
   
   export default function Scene() {
     const theme = useTheme();
     return (
       <AbsoluteFill style={{ backgroundColor: theme.background }}>
         <h1 style={{ color: theme.primary }}>Hello</h1>
       </AbsoluteFill>
     );
   }
   ```

#### ❌ 禁止的操作

1. ❌ 不要使用外部 npm 包（除了 remotion 和 react）
2. ❌ 不要使用 `require()` 动态导入
3. ❌ 不要访问文件系统或网络
4. ❌ 不要使用浏览器特定 API（localStorage、fetch 等）

---

## 二、E2B 管理服务的职责

### 核心功能流程

```typescript
// 伪代码流程
async function deployScenes(difyScenesData) {
  // 1. 验证数据格式
  validateScenesData(difyScenesData)
  
  // 2. 转换为 TSX 文件
  const tsxFiles = convertToTSXFiles(difyScenesData.scenes)
  
  // 3. 生成 manifest.json
  const manifest = buildManifest(difyScenesData)
  
  // 4. 上传到 E2B 沙箱
  await uploadToSandbox(tsxFiles, manifest)
  
  // 5. 返回预览 URL
  return { success: true, previewUrl: `https://3000-${sandboxId}.e2b.app` }
}
```

### 详细实现步骤

#### 步骤 1: 数据验证和元数据提取

```typescript
interface DifyInput {
  scenes: string[]  // ⚠️ 纯代码字符串数组
}

interface SceneMetadata {
  id: string
  name: string
  durationInFrames: number
  code: string
}

/**
 * 从代码中提取函数名（作为 scene id）
 */
function extractFunctionName(code: string): string {
  // 匹配: export default function SceneName() { ... }
  const match = code.match(/export\s+default\s+function\s+(\w+)\s*\(/);
  if (match) {
    return match[1];
  }
  
  // 匹配: export default function() { ... } (匿名函数)
  // 或其他情况，生成默认名称
  return null;
}

/**
 * 从代码注释中提取场景名称和时长
 * 注释格式：
 * // @scene 场景名称
 * // @duration 90
 */
function extractMetadataFromComments(code: string): { name?: string; duration?: number } {
  const nameMatch = code.match(/@scene\s+(.+)/);
  const durationMatch = code.match(/@duration\s+(\d+)/);
  
  return {
    name: nameMatch ? nameMatch[1].trim() : undefined,
    duration: durationMatch ? parseInt(durationMatch[1]) : undefined
  };
}

/**
 * 验证并丰富场景数据
 */
function validateAndEnrichScenes(data: DifyInput): SceneMetadata[] {
  if (!data.scenes || !Array.isArray(data.scenes)) {
    throw new Error('scenes 必须是数组');
  }
  
  if (data.scenes.length === 0) {
    throw new Error('scenes 数组不能为空');
  }
  
  return data.scenes.map((code, index) => {
    // 验证代码格式
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new Error(`scenes[${index}] 必须是非空字符串`);
    }
    
    if (!code.includes('export default')) {
      throw new Error(`scenes[${index}] 必须包含 export default`);
    }
    
    // 提取函数名
    const functionName = extractFunctionName(code);
    if (!functionName) {
      throw new Error(`scenes[${index}] 无法提取函数名，请使用 export default function FunctionName()`);
    }
    
    // 提取注释中的元数据
    const commentMeta = extractMetadataFromComments(code);
    
    // 生成场景 ID（使用函数名转换为 kebab-case）
    const sceneId = functionName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    
    // 生成场景名称（优先使用注释，否则使用函数名）
    const sceneName = commentMeta.name || functionName.replace(/([A-Z])/g, ' $1').trim();
    
    // 持续时长（优先使用注释，否则默认 90 帧 = 3 秒）
    const duration = commentMeta.duration || 90;
    
    return {
      id: sceneId,
      name: sceneName,
      durationInFrames: duration,
      code: code
    };
  });
}
```

**提取示例**：

```typescript
// 输入代码
const code = `
// @scene 引入主题
// @duration 120
import React from 'react';
import { AbsoluteFill } from 'remotion';

export default function Scene1Intro() {
  return <AbsoluteFill>Hello</AbsoluteFill>;
}
`;

// 提取结果
{
  id: "scene1_intro",           // 从函数名 Scene1Intro 转换
  name: "引入主题",              // 从注释 @scene 提取
  durationInFrames: 120,        // 从注释 @duration 提取
  code: "..."                   // 原始代码
}

// 如果没有注释
const codeNoComment = `
export default function MyCustomScene() {
  return <div>Test</div>;
}
`;

// 默认提取结果
{
  id: "my_custom_scene",        // 从函数名转换
  name: "My Custom Scene",      // 从函数名转换
  durationInFrames: 90,         // 默认值
  code: "..."
}
```

#### 步骤 2: 转换为 TSX 文件

```typescript
interface TSXFile {
  path: string      // 文件路径
  content: string   // 文件内容
}

function convertToTSXFiles(scenes: SceneMetadata[]): TSXFile[] {
  return scenes.map((scene) => {
    // 文件名：{scene.id}.tsx
    const fileName = `${scene.id}.tsx`
    
    // 文件路径：相对于沙箱 /home/user/remotion-project/src/scenes/
    const filePath = `src/scenes/${fileName}`
    
    // 文件内容：直接使用代码（已包含在 SceneMetadata 中）
    const content = scene.code
    
    return {
      path: filePath,
      content: content
    }
  })
}

// 示例输出
/*
输入：validateAndEnrichScenes() 的输出
输出：
[
  {
    path: "src/scenes/scene1_intro.tsx",
    content: "import React from \"react\";\n..."
  },
  {
    path: "src/scenes/scene2_main.tsx",
    content: "import React from \"react\";\n..."
  }
]
*/
```

#### 步骤 3: 构建 manifest.json

这是**最关键的一步**！`manifest.json` 定义了视频的整体结构。

```typescript
interface ManifestScene {
  id: string
  name: string
  durationInFrames: number
  component: string  // ⚠️ 注意：这里是文件名，不是完整路径
}

interface Manifest {
  version: string
  fps: number
  width: number
  height: number
  scenes: ManifestScene[]
  theme: string
}

function buildManifest(scenes: SceneMetadata[]): Manifest {
  return {
    version: "1.0.0",
    fps: 30,        // 固定值
    width: 1920,    // 固定值
    height: 1080,   // 固定值
    theme: "tech",  // 固定值
    scenes: scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      durationInFrames: scene.durationInFrames,
      component: `${scene.id}.tsx`  // ⚠️ 文件名格式
    }))
  }
}

// 示例输出
/*
{
  "version": "1.0.0",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "theme": "tech",
  "scenes": [
    {
      "id": "scene_1_intro",
      "name": "引入主题",
      "durationInFrames": 90,
      "component": "scene_1_intro.tsx"
    },
    {
      "id": "scene_2_main",
      "name": "核心概念",
      "durationInFrames": 120,
      "component": "scene_2_main.tsx"
    }
  ]
}
*/
```

#### 步骤 4: 上传到 E2B 沙箱

```typescript
import { Sandbox } from '@e2b/code-interpreter'

async function uploadToSandbox(
  sandboxId: string,
  tsxFiles: TSXFile[],
  manifest: Manifest
): Promise<void> {
  // 获取沙箱实例（假设已创建）
  const sandbox = await getSandboxById(sandboxId)
  
  const WORKDIR = '/home/user/remotion-project'
  
  // 1. 先清空 scenes 目录（可选，避免旧文件残留）
  await sandbox.commands.run(`rm -f ${WORKDIR}/src/scenes/scene_*.tsx`)
  
  // 2. 批量上传 TSX 文件
  for (const file of tsxFiles) {
    const fullPath = `${WORKDIR}/${file.path}`
    await sandbox.files.write(fullPath, file.content)
    console.log(`✅ 已上传: ${file.path}`)
  }
  
  // 3. 上传 manifest.json
  const manifestPath = `${WORKDIR}/src/scenes/manifest.json`
  await sandbox.files.write(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`✅ 已上传: manifest.json`)
  
  // 4. 等待 Remotion 热更新（Vite 会自动检测文件变化）
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  console.log(`🎬 场景部署完成，共 ${tsxFiles.length} 个场景`)
}
```

#### 步骤 5: 验证部署（可选但推荐）

```typescript
async function verifyDeployment(sandboxId: string): Promise<boolean> {
  const sandbox = await getSandboxById(sandboxId)
  const WORKDIR = '/home/user/remotion-project'
  
  try {
    // 1. 检查 manifest.json 是否存在
    const manifestContent = await sandbox.files.read(
      `${WORKDIR}/src/scenes/manifest.json`
    )
    const manifest = JSON.parse(manifestContent)
    
    // 2. 检查每个场景文件是否存在
    for (const scene of manifest.scenes) {
      const sceneFile = await sandbox.files.read(
        `${WORKDIR}/src/scenes/${scene.component}`
      )
      if (!sceneFile) {
        throw new Error(`场景文件缺失: ${scene.component}`)
      }
    }
    
    // 3. 检查 TypeScript 编译错误
    const typeCheckResult = await sandbox.commands.run(
      `cd ${WORKDIR} && npx tsc --noEmit --project tsconfig.json`
    )
    
    if (typeCheckResult.exitCode !== 0) {
      console.warn('⚠️ TypeScript 类型检查失败:', typeCheckResult.stderr)
      return false
    }
    
    console.log('✅ 部署验证通过')
    return true
    
  } catch (error) {
    console.error('❌ 部署验证失败:', error)
    return false
  }
}
```

---

## 三、完整集成示例代码

### E2B 管理服务完整实现

```typescript
import { Sandbox } from '@e2b/code-interpreter'

/**
 * Dify 场景部署服务
 */
export class DifySceneDeployer {
  private sandboxManager: SandboxManager
  
  constructor(sandboxManager: SandboxManager) {
    this.sandboxManager = sandboxManager
  }
  
  /**
   * 主入口：部署 Dify 生成的场景
   */
  async deployScenes(sandboxId: string, difyScenesData: DifyInput) {
    console.log(`🚀 开始部署场景到沙箱: ${sandboxId}`)
    
    try {
      // 1. 验证并提取元数据
      const enrichedScenes = this.validateAndEnrichScenes(difyScenesData)
      console.log(`📝 提取 ${enrichedScenes.length} 个场景元数据`)
      
      // 2. 转换为 TSX 文件
      const tsxFiles = this.convertToTSXFiles(enrichedScenes)
      console.log(`📝 生成 ${tsxFiles.length} 个 TSX 文件`)
      
      // 3. 构建 manifest.json
      const manifest = this.buildManifest(enrichedScenes)
      console.log(`📋 生成 manifest.json`)
      
      // 4. 上传到沙箱
      await this.uploadToSandbox(sandboxId, tsxFiles, manifest)
      
      // 5. 验证部署
      const isValid = await this.verifyDeployment(sandboxId)
      if (!isValid) {
        throw new Error('部署验证失败')
      }
      
      // 6. 返回结果
      const previewUrl = `https://3000-${sandboxId}.e2b.app`
      
      return {
        success: true,
        sandboxId,
        previewUrl,
        scenesCount: tsxFiles.length,
        totalDuration: manifest.scenes.reduce(
          (sum, s) => sum + s.durationInFrames, 0
        ) / manifest.fps,
        scenes: enrichedScenes.map(s => ({
          id: s.id,
          name: s.name,
          duration: s.durationInFrames
        })),
        message: '场景部署成功'
      }
      
    } catch (error: any) {
      console.error('❌ 部署失败:', error)
      return {
        success: false,
        error: error.message,
        sandboxId
      }
    }
  }
  
  /**
   * 从代码中提取函数名
   */
  private extractFunctionName(code: string): string | null {
    const match = code.match(/export\s+default\s+function\s+(\w+)\s*\(/);
    return match ? match[1] : null;
  }
  
  /**
   * 从注释中提取元数据
   */
  private extractMetadataFromComments(code: string): { name?: string; duration?: number } {
    const nameMatch = code.match(/@scene\s+(.+)/);
    const durationMatch = code.match(/@duration\s+(\d+)/);
    
    return {
      name: nameMatch ? nameMatch[1].trim() : undefined,
      duration: durationMatch ? parseInt(durationMatch[1]) : undefined
    };
  }
  
  /**
   * 验证并丰富场景数据
   */
  private validateAndEnrichScenes(data: DifyInput): SceneMetadata[] {
    if (!data.scenes || !Array.isArray(data.scenes)) {
      throw new Error('scenes 必须是数组');
    }
    
    if (data.scenes.length === 0) {
      throw new Error('scenes 数组不能为空');
    }
    
    return data.scenes.map((code, index) => {
      if (typeof code !== 'string' || code.trim().length === 0) {
        throw new Error(`scenes[${index}] 必须是非空字符串`);
      }
      
      if (!code.includes('export default')) {
        throw new Error(`scenes[${index}] 必须包含 export default`);
      }
      
      const functionName = this.extractFunctionName(code);
      if (!functionName) {
        throw new Error(`scenes[${index}] 无法提取函数名`);
      }
      
      const commentMeta = this.extractMetadataFromComments(code);
      const sceneId = functionName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      const sceneName = commentMeta.name || functionName.replace(/([A-Z])/g, ' $1').trim();
      const duration = commentMeta.duration || 90;
      
      return {
        id: sceneId,
        name: sceneName,
        durationInFrames: duration,
        code: code
      };
    });
  }
  
  /**
   * 转换为 TSX 文件
   */
  private convertToTSXFiles(scenes: SceneMetadata[]): TSXFile[] {
    return scenes.map((scene) => ({
      path: `src/scenes/${scene.id}.tsx`,
      content: scene.code
    }))
  }
  
  /**
   * 构建 manifest.json
   */
  private buildManifest(scenes: SceneMetadata[]): Manifest {
    return {
      version: "1.0.0",
      fps: 30,
      width: 1920,
      height: 1080,
      theme: "tech",
      scenes: scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        durationInFrames: scene.durationInFrames,
        component: `${scene.id}.tsx`
      }))
    }
  }
  
  /**
   * 上传到沙箱
   */
  private async uploadToSandbox(
    sandboxId: string,
    tsxFiles: TSXFile[],
    manifest: Manifest
  ): Promise<void> {
    const sandbox = await this.sandboxManager.getSandbox(sandboxId)
    const WORKDIR = '/home/user/remotion-project'
    
    // 1. 清空旧场景
    await sandbox.commands.run(`rm -f ${WORKDIR}/src/scenes/scene_*.tsx`)
    
    // 2. 批量上传（分批处理避免超时）
    const BATCH_SIZE = 10
    for (let i = 0; i < tsxFiles.length; i += BATCH_SIZE) {
      const batch = tsxFiles.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(file => 
          sandbox.files.write(`${WORKDIR}/${file.path}`, file.content)
        )
      )
      console.log(`✅ 已上传 ${Math.min(i + BATCH_SIZE, tsxFiles.length)}/${tsxFiles.length} 个场景`)
    }
    
    // 3. 上传 manifest
    await sandbox.files.write(
      `${WORKDIR}/src/scenes/manifest.json`,
      JSON.stringify(manifest, null, 2)
    )
    
    // 4. 等待热更新
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  /**
   * 验证部署
   */
  private async verifyDeployment(sandboxId: string): Promise<boolean> {
    const sandbox = await this.sandboxManager.getSandbox(sandboxId)
    const WORKDIR = '/home/user/remotion-project'
    
    try {
      // 检查 manifest
      const manifestContent = await sandbox.files.read(
        `${WORKDIR}/src/scenes/manifest.json`
      )
      const manifest = JSON.parse(manifestContent)
      
      // 检查场景文件
      for (const scene of manifest.scenes) {
        await sandbox.files.read(`${WORKDIR}/src/scenes/${scene.component}`)
      }
      
      return true
    } catch (error) {
      console.error('验证失败:', error)
      return false
    }
  }
}
```

### API 路由示例

```typescript
import express from 'express'

const app = express()
app.use(express.json({ limit: '10mb' })) // 支持大代码体

// POST /api/scenes/deploy
app.post('/api/scenes/deploy', async (req, res) => {
  const { sandboxId, scenes } = req.body
  
  if (!sandboxId) {
    return res.status(400).json({ error: 'sandboxId 必填' })
  }
  
  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: 'scenes 必须是字符串数组' })
  }
  
  const deployer = new DifySceneDeployer(sandboxManager)
  const result = await deployer.deployScenes(sandboxId, { scenes })
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(500).json(result)
  }
})
```

---

## 四、调用示例

### 从 Dify 调用 E2B 管理服务

```bash
# HTTP 请求示例
POST https://your-e2b-manager.com/api/scenes/deploy
Content-Type: application/json

{
  "sandboxId": "ieinbicy0cs59y022pax3",
  "scenes": [
    "// @scene 引入主题\n// @duration 90\nimport React from 'react';\nimport { AbsoluteFill } from 'remotion';\nimport { TitleCard } from '../components';\n\nexport default function Scene1Intro() {\n  return (\n    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>\n      <TitleCard title='AI 大模型' subtitle='数学的魔法' />\n    </AbsoluteFill>\n  );\n}",
    "// @scene 核心概念\n// @duration 120\nimport React from 'react';\nimport { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';\n\nexport default function Scene2Main() {\n  const frame = useCurrentFrame();\n  const opacity = interpolate(frame, [0, 30], [0, 1]);\n  \n  return (\n    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>\n      <div style={{ opacity, fontSize: 60, color: 'white' }}>\n        概率与统计\n      </div>\n    </AbsoluteFill>\n  );\n}"
  ]
}
```

**如果 Dify 生成的代码没有注释**，也可以正常工作（使用默认值）：

```json
{
  "sandboxId": "ieinbicy0cs59y022pax3",
  "scenes": [
    "import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function IntroScene() {\n  return <AbsoluteFill>Intro</AbsoluteFill>;\n}",
    "import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport default function MainScene() {\n  return <AbsoluteFill>Main</AbsoluteFill>;\n}"
  ]
}
```

E2B 管理服务会自动提取：
- `id`: `"intro_scene"`, `"main_scene"` （从函数名转换）
- `name`: `"Intro Scene"`, `"Main Scene"` （从函数名转换）
- `durationInFrames`: `90`, `90` （默认值）

### 成功响应示例

```json
{
  "success": true,
  "sandboxId": "ieinbicy0cs59y022pax3",
  "previewUrl": "https://3000-ieinbicy0cs59y022pax3.e2b.app",
  "scenesCount": 2,
  "totalDuration": 7,
  "scenes": [
    {
      "id": "scene1_intro",
      "name": "引入主题",
      "duration": 90
    },
    {
      "id": "scene2_main",
      "name": "核心概念",
      "duration": 120
    }
  ],
  "message": "场景部署成功"
}
```

### 失败响应示例

```json
{
  "success": false,
  "sandboxId": "ieinbicy0cs59y022pax3",
  "error": "scenes[1] 必须包含 export default"
}
```

---

## 五、其他需要处理的事项

### 1. 场景更新（增量部署）

如果只修改部分场景，避免重新上传所有文件：

```typescript
async updateScenes(sandboxId: string, updatedScenes: string[]) {
  // 1. 验证并提取元数据
  const enrichedScenes = this.validateAndEnrichScenes({ scenes: updatedScenes })
  
  // 2. 读取现有 manifest
  const existingManifest = await this.readManifest(sandboxId)
  
  // 3. 只上传变更的场景
  for (const scene of enrichedScenes) {
    await sandbox.files.write(
      `src/scenes/${scene.id}.tsx`,
      scene.code
    )
  }
  
  // 4. 合并并更新 manifest
  const newManifest = this.mergeManifest(existingManifest, enrichedScenes)
  await this.uploadManifest(sandboxId, newManifest)
}
```

### 2. 场景删除

```typescript
async deleteScenes(sandboxId: string, sceneIds: string[]) {
  const sandbox = await this.getSandbox(sandboxId)
  const WORKDIR = '/home/user/remotion-project'
  
  // 1. 删除文件
  for (const id of sceneIds) {
    await sandbox.commands.run(`rm -f ${WORKDIR}/src/scenes/${id}.tsx`)
  }
  
  // 2. 更新 manifest
  const manifest = await this.readManifest(sandboxId)
  manifest.scenes = manifest.scenes.filter(s => !sceneIds.includes(s.id))
  await this.uploadManifest(sandboxId, manifest)
}
```

### 3. 场景排序

```typescript
async reorderScenes(sandboxId: string, sceneOrder: string[]) {
  // sceneOrder: ["scene_2", "scene_1", "scene_3"]
  
  const manifest = await this.readManifest(sandboxId)
  
  // 按新顺序重新排列
  const orderedScenes = sceneOrder.map(id => 
    manifest.scenes.find(s => s.id === id)
  ).filter(Boolean)
  
  manifest.scenes = orderedScenes
  await this.uploadManifest(sandboxId, manifest)
}
```

### 4. 主题切换

```typescript
async changeTheme(sandboxId: string, newTheme: string) {
  const manifest = await this.readManifest(sandboxId)
  manifest.theme = newTheme
  await this.uploadManifest(sandboxId, manifest)
}
```

### 5. 视频参数调整

```typescript
async updateVideoConfig(
  sandboxId: string, 
  config: { fps?: number; width?: number; height?: number }
) {
  const manifest = await this.readManifest(sandboxId)
  
  if (config.fps) manifest.fps = config.fps
  if (config.width) manifest.width = config.width
  if (config.height) manifest.height = config.height
  
  await this.uploadManifest(sandboxId, manifest)
}
```

### 6. 错误处理和日志

```typescript
// 详细的错误类型
class SceneDeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
  }
}

// 使用示例
if (!scene.code.includes('export default')) {
  throw new SceneDeploymentError(
    `场景 ${scene.id} 缺少默认导出`,
    'MISSING_EXPORT',
    { sceneId: scene.id, code: scene.code.substring(0, 100) }
  )
}
```

### 7. 性能优化

```typescript
// 使用缓存避免重复上传相同代码
class SceneCache {
  private cache = new Map<string, string>() // sceneId -> code hash
  
  shouldUpload(sceneId: string, code: string): boolean {
    const hash = this.hashCode(code)
    const cachedHash = this.cache.get(sceneId)
    
    if (cachedHash === hash) {
      return false // 代码未变化，跳过上传
    }
    
    this.cache.set(sceneId, hash)
    return true
  }
  
  private hashCode(str: string): string {
    // 简单哈希实现
    return require('crypto').createHash('md5').update(str).digest('hex')
  }
}
```

---

## 六、测试清单

### 单元测试

```typescript
describe('DifySceneDeployer', () => {
  test('验证数据格式 - 缺少 scenes', () => {
    expect(() => deployer.validateScenesData({})).toThrow('scenes 必须是数组')
  })
  
  test('转换 TSX 文件', () => {
    const scenes = [{ id: 'test', name: 'Test', durationInFrames: 90, code: 'export default...' }]
    const files = deployer.convertToTSXFiles(scenes)
    expect(files[0].path).toBe('src/scenes/test.tsx')
  })
  
  test('构建 manifest', () => {
    const manifest = deployer.buildManifest({ scenes: [...] })
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.scenes.length).toBe(2)
  })
})
```

### 集成测试

```bash
# 1. 创建测试沙箱
curl -X POST http://localhost:3000/api/sandboxes

# 2. 部署场景
curl -X POST http://localhost:3000/api/scenes/deploy \
  -H "Content-Type: application/json" \
  -d @test-scenes.json

# 3. 访问预览
open https://3000-{sandbox_id}.e2b.app

# 4. 清理
curl -X DELETE http://localhost:3000/api/sandboxes/{sandbox_id}
```

---

## 七、常见问题 FAQ

### Q1: Dify 生成的代码有语法错误怎么办？

**A**: 在 E2B 管理服务中增加 TypeScript 检查：

```typescript
const typeCheckResult = await sandbox.commands.run(
  'cd /home/user/remotion-project && npx tsc --noEmit'
)

if (typeCheckResult.exitCode !== 0) {
  return {
    success: false,
    error: 'TypeScript 编译错误',
    details: typeCheckResult.stderr
  }
}
```

### Q2: 场景数量很多（50+）怎么优化？

**A**: 使用分批上传和并行处理：

```typescript
const BATCH_SIZE = 20
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(f => uploadFile(f)))
}
```

### Q3: 如何支持场景预览单个场景？

**A**: Remotion Studio 支持按场景预览，URL 格式：

```
https://3000-{sandbox_id}.e2b.app/?compositionName={scene.name}
```

### Q4: 需要支持视频渲染吗？

**A**: 如果需要输出 MP4，在沙箱中执行：

```typescript
await sandbox.commands.run(
  'cd /home/user/remotion-project && npm run render'
)

// 下载视频
const videoBuffer = await sandbox.files.read('/home/user/remotion-project/out/video.mp4')
```

---

## 八、总结

### 关键要点

1. ✅ **Dify 职责**：只生成代码数组（JSON 格式）
2. ✅ **E2B 管理服务职责**：
   - 转换代码数组 → TSX 文件
   - 构建 manifest.json
   - 上传到 E2B 沙箱
   - 验证部署
3. ✅ **文件结构**：
   - 场景文件：`src/scenes/{scene.id}.tsx`
   - 配置文件：`src/scenes/manifest.json`
4. ✅ **核心流程**：验证 → 转换 → 构建 → 上传 → 验证

### 下一步

1. 在 E2B 管理服务中实现 `DifySceneDeployer` 类
2. 创建 API 端点 `/api/scenes/deploy`
3. 对接 Dify 的输出
4. 测试完整流程

---

**文档版本**: 1.0  
**创建日期**: 2025-12-26  
**适用项目**: x-pilot-video-render + E2B 管理服务
