# API 契约（DEV-5 范围）

> 本文档是前后端的唯一接口契约。总则见 docs/design/architecture.md §4.1（REST、`/api/v1` 前缀、统一错误格式、cursor 分页）。
> OpenAPI JSON 由后端代码自动生成：`GET /api/v1/openapi.json`。

## 认证与会话

- 认证方式：邮箱 + 密码（better-auth）。会话通过 **httpOnly Cookie**（`better-auth.session_token`）维持，前端 `fetch` 需带 `credentials: "include"`。
- 注册成功即自动完成：创建用户 → 创建默认工作区（名称为「{name} 的工作区」）→ 用户成为该工作区 `owner`。
- 未认证请求访问 `/api/v1/**`（auth 端点除外）返回 `401 UNAUTHORIZED`。

### Auth 端点（better-auth 标准）

| 方法 | 路径 | Body | 说明 |
|---|---|---|---|
| POST | `/api/v1/auth/sign-up/email` | `{name, email, password}` | 注册（password ≥ 8 位）→ 返回 `{user, session}` |
| POST | `/api/v1/auth/sign-in/email` | `{email, password}` | 登录 → 返回 `{user, session}`，写 cookie |
| POST | `/api/v1/auth/sign-out` | 无 | 登出，清 cookie |
| GET | `/api/v1/auth/get-session` | — | 当前会话 `{user, session}` 或 `null` |

### 当前用户

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/me` | `{user: {id, email, name}, member: {id, role, workspaceId}, workspace: {id, name, slug}}` |
| PATCH | `/api/v1/me` | body `{name?}` 更新显示名（同步 user.name 与 member.name） |

## 项目（Projects）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/projects` | 当前工作区项目列表 `[{id, name, key, description, issueCount, createdAt}]` |
| POST | `/api/v1/projects` | `{name, key, description?}` 创建；`key` 为 2-6 位大写字母（Issue 编号前缀，全库唯一） |
| GET | `/api/v1/projects/:id` | 项目详情 + 成员列表 |
| PATCH | `/api/v1/projects/:id` | `{name?, description?}` （owner/admin） |
| DELETE | `/api/v1/projects/:id` | 删除项目及其任务（owner/admin） |

### 项目成员

成员先存在于工作区（本阶段注册即入工作区），项目成员用于角色控制。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/projects/:id/members` | `[{memberId, name, email, role, userId}]` |
| POST | `/api/v1/projects/:id/members` | `{email, role}` 按邮箱邀请工作区成员加入项目；角色 `lead/member/viewer`（owner/admin 可操作） |
| PATCH | `/api/v1/projects/:id/members/:memberId` | `{role}` 改角色（owner/admin） |
| DELETE | `/api/v1/projects/:id/members/:memberId` | 移除（owner/admin） |

**权限矩阵**：`owner/admin`（工作区角色）= 项目与成员管理；项目角色 `lead/member` = 任务写操作；`viewer` = 只读（写操作返回 `403 FORBIDDEN`）。创建项目者自动成为 `lead`。

## 任务（Issues）

### 数据形态

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "number": 42,
  "identifier": "ACP-42",
  "parentId": null,
  "stage": 0,
  "title": "修复登录页",
  "description": "...",
  "status": "todo | in_progress | in_review | done | blocked | cancelled",
  "priority": "urgent | high | medium | low",
  "labels": ["bug", "frontend"],
  "assigneeType": "member | null",
  "assigneeId": "uuid | null",
  "assignee": {"memberId": "uuid", "name": "张三"} ,
  "position": 1024.5,
  "dueDate": "2026-10-20 | null",
  "subtaskCount": 3,
  "subtaskDoneCount": 1,
  "createdAt": "...", "updatedAt": "..."
}
```

### 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/projects/:id/issues?view=board` | **看板**：`{columns: {todo: Issue[], in_progress: [...], in_review: [...], done: [...], blocked: [...]}}`，列内按 `position` 升序，仅含顶层任务（`parentId = null`），不含 `cancelled` |
| GET | `/api/v1/projects/:id/issues?view=list&status=&priority=&assigneeId=&label=&q=&sort=dueDate|priority|createdAt&order=asc|desc` | **列表**：扁平返回（含子任务），支持筛选/搜索/排序；`{data: Issue[], next_cursor}` |
| POST | `/api/v1/issues` | `{projectId, title, description?, priority?, labels?, dueDate?, assigneeId?, parentId?}` → 201 Issue。`parentId` 存在即子任务（子任务不再允许有子任务） |
| GET | `/api/v1/issues/:id` | Issue 详情 + `subtasks: Issue[]` + `comments` |
| PATCH | `/api/v1/issues/:id` | `{title?, description?, priority?, labels?, dueDate?, assigneeId?, status?}`。`status` 迁移走状态机（§4.3），非法迁移 `409 INVALID_TRANSITION` 且响应带 `allowed` 列表 |
| DELETE | `/api/v1/issues/:id` | 删除（级联子任务与评论） |
| POST | `/api/v1/issues/:id/move` | 看板拖拽 `{status, beforeId?, afterId?}` —— 目标列内前/后卡片的 id，服务端计算新 `position` 并校验状态迁移；返回更新后的 Issue |

### 状态机（architecture.md §4.3）

```
todo → in_progress → in_review → done
  ↓        ↓             ↓
blocked ←─┘        (打回) in_progress
任意 → cancelled（终态）
```

`done` 仅人类角色可写入（Agent 最高 `in_review`）。MVP 前端均为人类操作。

## 评论（Comments）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/issues/:id/comments` | 时间升序 `[{id, authorType, authorId, authorName, content, createdAt}]` |
| POST | `/api/v1/issues/:id/comments` | `{content}` → 201 |

## 错误格式

```json
{"error": {"code": "ISSUE_NOT_FOUND", "message": "...", "request_id": "..."}}
```

| code | HTTP |
|---|---|
| UNAUTHORIZED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND / ISSUE_NOT_FOUND / PROJECT_NOT_FOUND | 404 |
| INVALID_TRANSITION | 409 |
| VALIDATION_ERROR | 400 |
| KEY_CONFLICT（项目 key 重复等） | 409 |

## SSE（本期不实现）

`GET /api/v1/events` 骨架保留；MVP 前端用 TanStack Query 的 `refetchInterval`（聚焦时 15s）兜底实时性。SSE 接入随 DEV-6/7 的队列基础设施一起落地。
