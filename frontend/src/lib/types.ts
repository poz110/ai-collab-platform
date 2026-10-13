/**
 * API 契约类型 —— 与 docs/api-spec.md 严格一一对应。
 * 后端字段如有出入，以 api-spec.md 为准并在此文件标注偏差。
 */

// ===== 认证 =====
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  user: AuthUser;
  session: { id: string; expiresAt?: string } & Record<string, unknown>;
}

// ===== 当前用户 /me =====
export type WorkspaceRole = "owner" | "admin" | "member";

export interface MeResponse {
  user: { id: string; email: string; name: string };
  member: { id: string; role: WorkspaceRole; workspaceId: string };
  workspace: { id: string; name: string; slug: string };
}

// ===== 项目 =====
export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  issueCount: number;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  members?: ProjectMember[];
}

export type ProjectRole = "lead" | "member" | "viewer";

export interface ProjectMember {
  memberId: string;
  name: string;
  email: string;
  role: ProjectRole;
  userId: string;
}

// ===== 任务 =====
export type IssueStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low";

export interface IssueAssignee {
  memberId: string;
  name: string;
}

export interface Issue {
  id: string;
  projectId: string;
  number: number;
  identifier: string;
  parentId: string | null;
  stage: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  assigneeType: "member" | null;
  assigneeId: string | null;
  assignee: IssueAssignee | null;
  position: number;
  dueDate: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumns {
  todo: Issue[];
  in_progress: Issue[];
  in_review: Issue[];
  done: Issue[];
  blocked: Issue[];
}

export interface BoardResponse {
  columns: BoardColumns;
}

export interface ListResponse {
  data: Issue[];
  next_cursor: string | null;
}

export interface IssueComment {
  id: string;
  authorType: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface IssueDetail extends Issue {
  subtasks: Issue[];
  comments: IssueComment[];
}

// ===== 错误 =====
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id?: string;
    /** 409 INVALID_TRANSITION 时附带允许的目标状态 */
    allowed?: IssueStatus[];
  };
}
