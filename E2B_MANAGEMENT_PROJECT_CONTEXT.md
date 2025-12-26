# X-Pilot E2B Server - 项目上下文与工作流（v2）

## 1. 背景与目标

**X-Pilot AI** 是生成专业级课程类视频的平台。整体架构由三部分协同完成：

- **Dify 代码 Agent 工作流**：根据用户输入生成/迭代 Remotion 场景代码（包含自然语言修改代码的能力）。
- **Remotion**：将 React + TS 场景组合为可预览、可渲染的视频。
- **E2B**：提供容器化沙箱（Sandbox）、云端代码执行、端口暴露、以及执行环境隔离。

本仓库 **`x-pilot-e2b-server`** 的定位：

> 作为 Dify 工作流与 E2B/Remotion 渲染环境之间的“运行与资源管理层”，对外提供稳定的 API：创建/复用沙箱、上传/修改代码与资源、启动项目、返回错误与日志、提供实时预览链接、触发预览渲染并支持下载。

---

## 2. 系统与仓库边界

### 2.1 参与系统

- **X-Pilot AI 后端**：接收用户 Topic/Prompt，驱动 Dify 工作流，编排业务。
- **Dify Agent**：输出“包含所有场景的代码数组”（或增量修改指令），并在节点中调用 `x-pilot-e2b-server`。
- **`x-pilot-e2b-server`（本项目）**：
  - E2B 沙箱生命周期与并发管理
  - 代码/资源上传与增量同步
  - 项目运行与错误回传
  - 实时预览 URL 输出
  - 预览渲染与产物下载
  - 模板构建/版本管理/可视化管理能力（辅助）
- **`x-pilot-video-render`（另一个项目）**：Remotion 视频渲染模板源项目（组件库 + E2B 模板定义）。
- **E2B**：云端 Sandbox 平台。

### 2.2 关键约束

- **多租户隔离**：不同用户/任务应在资源与文件层面隔离（通常通过独立 sandbox 或受控 workspace 路径）。
- **沙箱可复用但必须可“重置”**：同一 sandbox 服务完一个用户/任务后，归还资源池前必须恢复初始状态，否则下一个用户会读到上一个用户的场景代码/资源/依赖变更。
- **并发与配额**：必须考虑同时多个用户发起预览/渲染/上传的压力；需要限流、队列、以及可观测性。
- **文件上传限制**：E2B 可能对单次上传文件数量/体积有限制，需要批次上传与拆分策略。


---

## 3. 端到端工作流（用户视角）

1. **用户输入**：Topic + Prompt（主题与约束）。
2. **X-Pilot AI 后端 → Dify**：启动 Agent 工作流，生成/修改 Remotion 场景代码。
3. **Dify 输出**：
   - `scenes[]`：包含所有场景的代码数组（或增量 patch）。
   - 可能包含资源引用（图片/视频/音频/字体）。
4. **Dify 节点调用 `x-pilot-e2b-server`**：
   - 分配或复用 E2B sandbox（warm pool 优先）。
   - 为本次请求创建独立工作区：`/home/user/workspaces/{jobId}`。
   - 将基线工程复制到工作区（例如：`/opt/remotion-project-base` → 工作区）。
   - 将 `scenes[]` 写入工作区工程目录（必要时做增量同步）。
   - 上传资源到工作区的 `public/assets/...`。
   - 启动/确保 Remotion Studio/Vite 可运行（端口 3000）。

5. **返回结果**：
   - 成功：返回实时预览链接（端口 3000）+ 当前运行状态。
   - 失败：返回结构化错误 + 关键日志片段（可用于 Dify 再次修复）。
6. **预览渲染**：当需要导出预览视频时，`x-pilot-e2b-server` 在 sandbox 内触发渲染，生成产物（如 mp4），并提供下载。

---

## 4. `x-pilot-e2b-server` 的职责清单

### 4.1 核心能力（必须具备）

- **Sandbox 生命周期管理**：创建、复用、销毁、超时回收。
- **多用户并发管理**：
  - 资源池（warm pool）
  - 每用户/每任务并发限制
  - 排队与退避（避免雪崩）
- **代码上传与修改**：
  - 单文件写入
  - 批量写入（自动分批）
  - 增量同步（仅写入变更）
- **资源上传**：视频/图片/音频/字体；支持大文件（分片/断点续传：规划项）。
- **运行项目**：在 sandbox 内启动 Remotion/Vite（通常端口 3000）。
- **错误回传**：运行失败时返回可复现信息（命令、stderr、关键堆栈、文件路径）。
- **实时预览链接**：输出 `https://3000-{sandboxId}.e2b.app`。
- **预览渲染与下载**：触发渲染命令，读取产物并提供下载。

### 4.2 辅助能力（平台运维/效率）

- **模板构建/修改/上传**：对接 `x-pilot-video-render` 的 E2B 模板构建。
- **模板版本管理**：记录 templateId、构建时间、来源 commit、状态（active/deprecated）。
- **可视化管理界面**：沙箱列表、日志、模板版本、资源查看（规划项）。

---

## 5. 数据与产物定义（建议）

### 5.1 Dify → `x-pilot-e2b-server`

- `topic` / `prompt`
- `scenes[]`：每个元素至少包含：`sceneName`、`filePath`、`code`（或 patch）、可选 `imports/assets` 描述
- `assets[]`：`path`（相对 `public/assets`）、`content`（或 URL）
- 运行参数：模板版本、渲染参数（分辨率、时长、fps、codec 等）

### 5.2 `x-pilot-e2b-server` → Dify/后端

- `sandboxId`
- `previewUrl`
- `status`：running/starting/error/idle
- `logs`：可分页/可流式（WebSocket/SSE）
- `renderJob`：任务 id、进度、产物下载地址

---

## 6. Sandbox 内目录与路径约定（方案 A：任务级工作区）

- **工作区根目录**：`/home/user/workspaces`
- **任务工作区**：`/home/user/workspaces/{jobId}`
- **工程目录**（每次请求独立）：`/home/user/workspaces/{jobId}/remotion-project`
- **代码目录**：`/home/user/workspaces/{jobId}/remotion-project/src`
- **静态资源**：`/home/user/workspaces/{jobId}/remotion-project/public/assets/`
  - `videos/`、`images/`、`audio/`、`fonts/`

Remotion Studio 端口：`3000`（建议每个 sandbox 同时仅服务 1 个活跃 job，避免端口冲突）

预览 URL：

- `https://3000-{sandboxId}.e2b.app`


---

## 7. 模板（Template）与版本管理

### 7.1 模板源项目

- 模板源：`x-pilot-video-render`
- 模板定义：`x-pilot-remotion-template/template.ts`
- 模板名称示例：`x-pilot-remotion-base`

### 7.2 构建命令与输出解析

- 构建入口（在模板源项目中执行）：`cd x-pilot-remotion-template && npm run build`
- 预期输出包含模板 ID（形如）：`{template-name}-{hash}`

### 7.3 文件上传限制与拆分策略

由于 E2B 对单次上传文件数可能有限制，模板构建脚本通常需要：

- 将 `src` 目录按子目录 **分批复制/上传**
- 对 `src/components` 这种文件量很大的目录进一步拆分

该策略对 `x-pilot-e2b-server` 的启示：

- 批量上传/同步时应支持 **BATCH_SIZE** 分批写入
- 对“大目录同步”要具备拆分与重试机制

---

## 8. 并发、资源池与回收（运行策略）

建议的运行策略：

- **warm pool**：维持一定数量预热 sandbox（减少冷启动）。
- **空闲回收**：超过 `SANDBOX_TIMEOUT` 无活动则回收。
- **配额**：
  - 每用户最大并发 sandbox 数
  - 每 sandbox 最大同时渲染任务数（建议 1）
- **任务队列**：渲染/大上传可进入队列执行，避免拖垮实例。

### 8.1 沙箱归还与“重置到初始状态”（方案 A 标准化）

为保证多用户隔离，本项目统一采用：**同一 sandbox 内使用“任务级工作区（Workspace）”隔离**。

核心原则：

- 每次请求（job）都使用独立目录：`/home/user/workspaces/{jobId}/remotion-project`
- 所有写入（代码/资源/产物）只发生在该工作区内
- sandbox 归还资源池时，只需要清理该工作区即可，确保“下一个用户看不到上一个用户的任何东西”

建议流程：

1. **分配 sandbox**：从 warm pool 取一个空闲 sandbox（建议每个 sandbox 同时只服务 1 个活跃 job）。
2. **准备工作区**：创建目录 `/home/user/workspaces/{jobId}`。
3. **还原基线工程**：将镜像内基线工程复制到工作区（例如：`/opt/remotion-project-base` → `/home/user/workspaces/{jobId}/remotion-project`）。
4. **写入场景与资源**：把 `scenes[]`、`public/assets/*` 写入工作区工程目录。
5. **启动与预览**：在工作区工程目录启动 dev server（端口 3000），返回 `previewUrl`。
6. **渲染与下载**：渲染产物输出到工作区内（例如 `out/`），下载完成后可立即清理。
7. **归还与重置**：停止相关进程（如 dev server/渲染进程），然后执行 `rm -rf /home/user/workspaces/{jobId}`。

> 只要“基线工程”不被修改且每次 job 都从基线复制到独立工作区，就能在复用 sandbox 的前提下实现稳定隔离与快速重置。



---

## 9. 错误回传与可观测性（对 Dify 友好）

当运行/构建/渲染失败时，应返回：

- 失败阶段：`upload | install | dev | render`
- 命令与退出码
- `stderr` 关键片段
- 可能的修复建议（可选，但要可操作）

日志建议：

- 支持按 `sandboxId` + `requestId/jobId` 关联
- 支持实时推送（WebSocket/SSE）与存储（便于追踪）

---

## 10. 环境变量（建议约定）

```bash
# 必填
E2B_API_KEY=e2b_xxxxxxxxxxxxx

# 模板与运行
TEMPLATE_NAME=x-pilot-remotion-base
TEMPLATE_ID=                # 可选：固定某个版本

# 生命周期/并发
SANDBOX_TIMEOUT=1800        # 秒，默认 30min
POOL_SIZE=5                 # warm pool 数量
MAX_SANDBOX_PER_USER=2      # 示例

# 运行端口（如可配置）
STUDIO_PORT=3000
```

---

## 11. 对外 API（建议分组）

> 说明：以下为“对 Dify/后端友好”的建议 API 形态，便于后续实现与对接。

- **Sandboxes**
  - `POST /api/sandboxes`：创建/分配 sandbox（可带 templateId）
  - `GET /api/sandboxes/:id`：查询状态
  - `DELETE /api/sandboxes/:id`：销毁

- **Code / Files**
  - `POST /api/sandboxes/:id/files:write`：单/批写入（支持分批）
  - `POST /api/sandboxes/:id/files:sync`：增量同步（传 hash/mtime）

- **Assets**
  - `POST /api/sandboxes/:id/assets`：上传资源（multipart 或 URL 拉取）

- **Run / Preview**
  - `POST /api/sandboxes/:id/dev:start`：启动/确保 dev server
  - `GET /api/sandboxes/:id/preview`：获取 `previewUrl`

- **Render**
  - `POST /api/sandboxes/:id/renders`：创建渲染任务
  - `GET /api/sandboxes/:id/renders/:jobId`：进度/状态
  - `GET /api/sandboxes/:id/renders/:jobId/download`：下载产物

- **Logs**
  - `GET /api/sandboxes/:id/logs?cursor=...`：拉取日志
  - `WS /api/sandboxes/:id/logs:stream`：实时日志（规划项）

---

## 12. 常见问题（Troubleshooting）

### 12.1 `FileUploadError: Too many files`

- 现象：一次性上传过多文件失败。
- 处理：批量写入分批；大目录拆分；失败重试。

### 12.2 Remotion Studio 无法访问

- 可能原因：dev server 未完全启动 / URL 格式错误。
- 处理：健康检查 `localhost:3000`；确保返回 `https://3000-{sandboxId}.e2b.app`。

### 12.3 依赖安装失败（`npm install`）

- 可能原因：网络抖动、lockfile 冲突。
- 处理：缓存策略、重试、输出可读日志给 Dify 进行修复。

---

## 13. 术语表

- **Scene**：Remotion 场景组件（React 组件），由 Dify 生成/修改。
- **Studio**：Remotion Studio（通常运行在 3000 端口，用于预览）。
- **Template**：E2B 模板（预构建镜像/环境），用于快速创建 sandbox。
- **Sandbox**：E2B 运行实例，承载代码执行与渲染。

---

**文档版本**：2.0  
**更新日期**：2025-12-26  
**维护者**：X-Pilot AI / x-pilot-e2b-server 项目组
