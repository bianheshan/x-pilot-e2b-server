# x-pilot-e2b-server API（草案 v0.1）

> 目标：让 Dify 能“最短链路”跑通：调用本服务 → 上传/覆盖代码 → 写入 E2B sandbox 工作区 → 启动 Remotion/Vite → 返回预览链接。

## 1. 基本信息

- Base URL（本地开发）：`http://localhost:8080`
- 数据格式：`application/json`
- 鉴权：当前版本**未实现**（建议后续加 `Authorization: Bearer <token>` 或内网白名单）

## 2. 重要约定（方案 A：任务级工作区）

- `WORKSPACES_ROOT`（默认）：`/home/user/workspaces`
- 每次请求 `jobId` 工作区：`/home/user/workspaces/{jobId}`
- 工程目录：`/home/user/workspaces/{jobId}/{PROJECT_NAME}`（默认 `PROJECT_NAME=remotion-project`）
- 基线工程目录（从模板镜像复制）：`BASE_PROJECT_DIR`（默认：`/app`）
- Studio 端口：`STUDIO_PORT`（默认：`3000`）
- 预览 URL：`https://{STUDIO_PORT}-{sandboxId}.e2b.app`（默认端口 3000）

## 3. 通用数据结构

### 3.1 Scene（Dify 传入代码文件）

```json
{
  "filePath": "src/Root.tsx",
  "code": "/* full file content */"
}
```

- `filePath`：相对工程目录的路径（服务端会把 `\\` 归一化为 `/`，并拒绝包含 `..` 的路径）
- `code`：完整文件内容（当前为覆盖写入）

### 3.2 通用错误（建议约定）

当前版本错误直接返回 Fastify 默认错误结构；后续建议统一：

```json
{
  "error": {
    "phase": "upload|install|dev|render",
    "message": "...",
    "command": "...",
    "exitCode": 1,
    "stderrTail": "..."
  }
}
```

## 4. Health

### GET `/health/`
用途：健康检查

**Response 200**
```json
{ "ok": true }
```

## 5. 快速跑通：一键预览（推荐 Dify 先接）

### POST `/api/preview`
用途：

1) 创建/分配 E2B sandbox
2) 生成/使用 `jobId`，创建工作区
3) 从 `BASE_PROJECT_DIR` 复制基线工程到工作区工程目录
4) 写入 `scenes[]` 覆盖代码
5) 启动 dev server（默认 `npm run dev -- --host 0.0.0.0 --port ${STUDIO_PORT}`）
6) 返回 `previewUrl`

**Request Body**
```json
{
  "userId": "u_123",
  "jobId": "optional_job_id",
  "templateId": "optional_template_id",
  "templateName": "optional_template_name",
  "scenes": [
    { "filePath": "src/Root.tsx", "code": "..." }
  ],
  "startDev": true,
  "waitForReady": true
}
```

字段说明：

- `userId`：可选（后续用于配额/追踪）
- `jobId`：可选，不传则服务端生成
- `templateId`：可选，优先级最高
- `templateName`：可选
- `scenes`：必填，至少一个文件
- `startDev`：可选，默认 `true`
- `waitForReady`：可选，默认 `true`；会在 sandbox 内轮询 `http://localhost:${STUDIO_PORT}/`（约 30 秒）

**Response 201**
```json
{
  "sandboxId": "ieinbicy0cs59y022pax3",
  "jobId": "V1StGXR8_Z5jdHi6B-myT",
  "previewUrl": "https://3000-ieinbicy0cs59y022pax3.e2b.app",
  "projectDir": "/home/user/workspaces/V1StGXR8_Z5jdHi6B-myT/remotion-project"
}
```

**curl 示例**
```bash
curl -X POST http://localhost:8080/api/preview \
  -H "Content-Type: application/json" \
  -d "{\"scenes\":[{\"filePath\":\"src/Root.tsx\",\"code\":\"export const Root=()=>null\"}]}"
```

## 6. Sandbox 管理

### POST `/api/sandboxes`
用途：创建/分配 sandbox（当前为直接创建，尚未实现 warm pool）

**Request Body**
```json
{
  "userId": "u_123",
  "templateId": "optional",
  "templateName": "optional"
}
```

**Response 201**
```json
{
  "sandboxId": "xxx",
  "previewUrl": "https://3000-xxx.e2b.app"
}
```

### GET `/api/sandboxes/:id`
用途：查询 sandbox 状态（当前返回占位）

**Response 200**
```json
{ "sandboxId": "xxx", "status": "unknown" }
```

### DELETE `/api/sandboxes/:id`
用途：销毁 sandbox

**Response 204**（无 body）

## 7. 占位/规划接口（当前返回 501）

> 这些路由已注册但尚未实现。

### Code / Files

- `POST /api/sandboxes/:id/files:write`
- `POST /api/sandboxes/:id/files:sync`

### Assets

- `POST /api/sandboxes/:id/assets`

### Run / Preview

- `POST /api/sandboxes/:id/dev:start`
- `GET /api/sandboxes/:id/preview`

### Render

- `POST /api/sandboxes/:id/renders`
- `GET /api/sandboxes/:id/renders/:jobId`
- `GET /api/sandboxes/:id/renders/:jobId/download`

### Logs

- `GET /api/sandboxes/:id/logs?cursor=...`

## 8. 环境变量

> `.env` 放在项目根目录（已在 `.gitignore`）。

```bash
# 必填
E2B_API_KEY=e2b_xxx

# 模板选择（二选一，或用 /api/preview 请求里覆盖）
TEMPLATE_ID=
TEMPLATE_NAME=x-pilot-remotion-template

# Studio
STUDIO_PORT=3000

# 方案 A（工作区）
WORKSPACES_ROOT=/home/user/workspaces
PROJECT_NAME=remotion-project
BASE_PROJECT_DIR=/app

# 服务本地监听
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=info

# 上传限制（multipart 预留）
MAX_UPLOAD_BYTES=104857600
```

## 9. 版本说明

- 本文件对应代码：`v0.1.x`（当前实现重点：`POST /api/preview`）
