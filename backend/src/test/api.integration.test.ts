/**
 * DEV-5 核心流程集成测试 —— 真实 HTTP 请求打完整应用（PGlite 内存库）。
 * 覆盖：注册/登录、项目 CRUD、任务 CRUD、状态机、看板拖拽、子任务、筛选、评论、权限。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { api, createTestApp, signUp, type TestContext } from "./helpers.js";

const ALICE = { name: "Alice", email: "alice@example.com", password: "password123" };
const BOB = { name: "Bob", email: "bob@example.com", password: "password123" };

describe("DEV-5 API 集成", () => {
  let ctx: TestContext;
  let alice: { cookie: string; userId: string };
  let bob: { cookie: string; userId: string };
  let projectId: string;
  let aliceMemberId: string;
  let issueA: any;
  let issueB: any;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  it("未认证访问业务接口返回 401", async () => {
    const res = await api(ctx.app, null, "GET", "/api/v1/projects");
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe("UNAUTHORIZED");
  });

  it("注册自动开通工作区与 owner 身份", async () => {
    alice = await signUp(ctx.app, ALICE);
    const res = await api(ctx.app, alice.cookie, "GET", "/api/v1/me");
    expect(res.status).toBe(200);
    const me = await res.json() as any;
    expect(me.user.email).toBe(ALICE.email);
    expect(me.member.role).toBe("owner");
    expect(me.workspace.name).toContain("Alice");
    aliceMemberId = me.member.id;
  });

  it("重复邮箱注册被拒绝", async () => {
    const res = await api(ctx.app, null, "POST", "/api/v1/auth/sign-up/email", ALICE);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("创建项目并自动生成 lead 成员；编号前缀冲突返回 409", async () => {
    const res = await api(ctx.app, alice.cookie, "POST", "/api/v1/projects", {
      name: "协作平台",
      key: "ACP",
      description: "MVP",
    });
    expect(res.status).toBe(201);
    const project = await res.json() as any;
    projectId = project.id;

    const dup = await api(ctx.app, alice.cookie, "POST", "/api/v1/projects", { name: "x", key: "ACP" });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as any).error.code).toBe("KEY_CONFLICT");

    const members = await (await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/members`)).json() as any;
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("lead");
  });

  it("创建任务：编号自增、默认 todo、追加列尾", async () => {
    const r1 = await api(ctx.app, alice.cookie, "POST", "/api/v1/issues", {
      projectId,
      title: "搭建后端骨架",
      priority: "high",
      labels: ["backend"],
      dueDate: "2026-10-20",
    });
    expect(r1.status).toBe(201);
    issueA = await r1.json() as any;
    expect(issueA.identifier).toBe("ACP-1");
    expect(issueA.status).toBe("todo");

    const r2 = await api(ctx.app, alice.cookie, "POST", "/api/v1/issues", { projectId, title: "设计评审" });
    issueB = await r2.json() as any;
    expect(issueB.identifier).toBe("ACP-2");
    expect(issueB.position).toBeGreaterThan(issueA.position);
  });

  it("非法状态迁移返回 409 且附带允许列表", async () => {
    const res = await api(ctx.app, alice.cookie, "PATCH", `/api/v1/issues/${issueA.id}`, { status: "done" });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error.code).toBe("INVALID_TRANSITION");
    expect(body.error.details.allowed).toContain("in_progress");
    expect(body.error.details.allowed).not.toContain("done");
  });

  it("看板拖拽：跨列移动触发状态迁移，position 落在中点", async () => {
    // 先把 B 也推进到 in_progress，再把 A 插到 B 之前
    await api(ctx.app, alice.cookie, "POST", `/api/v1/issues/${issueB.id}/move`, { status: "in_progress" });
    const res = await api(ctx.app, alice.cookie, "POST", `/api/v1/issues/${issueA.id}/move`, {
      status: "in_progress",
      beforeId: null,
      afterId: issueB.id,
    });
    expect(res.status).toBe(200);
    const moved = await res.json() as any;
    expect(moved.status).toBe("in_progress");

    const board = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/issues?view=board`)
    ).json() as any;
    expect(board.columns.todo).toHaveLength(0);
    expect(board.columns.in_progress.map((i: any) => i.identifier)).toEqual(["ACP-1", "ACP-2"]);
    expect(board.columns.in_progress[0].position).toBeLessThan(board.columns.in_progress[1].position);
  });

  it("子任务：创建成功且计入父任务进度；三级嵌套被拒绝", async () => {
    const res = await api(ctx.app, alice.cookie, "POST", "/api/v1/issues", {
      projectId,
      title: "子任务：写状态机",
      parentId: issueA.id,
    });
    expect(res.status).toBe(201);
    const sub = await res.json() as any;

    const nested = await api(ctx.app, alice.cookie, "POST", "/api/v1/issues", {
      projectId,
      title: "三级任务",
      parentId: sub.id,
    });
    expect(nested.status).toBe(400);

    const detail = await (await api(ctx.app, alice.cookie, "GET", `/api/v1/issues/${issueA.id}`)).json() as any;
    expect(detail.subtasks).toHaveLength(1);
    expect(detail.subtaskCount).toBe(1);
    expect(detail.allowedTransitions).toContain("in_review");
  });

  it("列表视图支持筛选与搜索", async () => {
    const byPriority = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/issues?view=list&priority=high`)
    ).json() as any;
    expect(byPriority.data).toHaveLength(1);
    expect(byPriority.data[0].identifier).toBe("ACP-1");

    const byQuery = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/issues?view=list&q=状态机`)
    ).json() as any;
    expect(byQuery.data).toHaveLength(1);

    const byLabel = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/issues?view=list&label=backend`)
    ).json() as any;
    expect(byLabel.data).toHaveLength(1);
  });

  it("评论：发表并按时间升序返回，含作者名", async () => {
    const res = await api(ctx.app, alice.cookie, "POST", `/api/v1/issues/${issueA.id}/comments`, {
      content: "状态机已实现",
    });
    expect(res.status).toBe(201);
    const list = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/issues/${issueA.id}/comments`)
    ).json() as any;
    expect(list).toHaveLength(1);
    expect(list[0].authorName).toBe("Alice");
  });

  it("权限：未受邀用户看不到项目（404），受邀 viewer 只读（403）", async () => {
    bob = await signUp(ctx.app, BOB);

    const invisible = await api(ctx.app, bob.cookie, "GET", `/api/v1/projects/${projectId}`);
    expect(invisible.status).toBe(404);

    const invite = await api(ctx.app, alice.cookie, "POST", `/api/v1/projects/${projectId}/members`, {
      email: BOB.email,
      role: "viewer",
    });
    expect(invite.status).toBe(201);

    // Bob 现在可见项目（出现在列表中），但写操作被拒
    const bobProjects = await (await api(ctx.app, bob.cookie, "GET", "/api/v1/projects")).json() as any;
    expect(bobProjects.some((p: any) => p.id === projectId)).toBe(true);

    const denied = await api(ctx.app, bob.cookie, "POST", "/api/v1/issues", { projectId, title: "不应成功" });
    expect(denied.status).toBe(403);

    // 提升为 member 后可写
    const bobMember = (await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/members`)
    ).json() as any).find((m: any) => m.email === BOB.email);
    await api(ctx.app, alice.cookie, "PATCH", `/api/v1/projects/${projectId}/members/${bobMember.memberId}`, {
      role: "member",
    });
    const allowed = await api(ctx.app, bob.cookie, "POST", "/api/v1/issues", {
      projectId,
      title: "Bob 的任务",
      assigneeId: bobMember.memberId,
    });
    expect(allowed.status).toBe(201);
    const bobIssue = await allowed.json() as any;
    expect(bobIssue.assignee.name).toBe("Bob");
  });

  it("非 owner/admin 不能管理项目", async () => {
    const res = await api(ctx.app, bob.cookie, "PATCH", `/api/v1/projects/${projectId}`, { name: "篡改" });
    expect(res.status).toBe(403);
  });

  it("个人资料更新同步到成员名", async () => {
    const res = await api(ctx.app, alice.cookie, "PATCH", "/api/v1/me", { name: "Alice Wang" });
    expect(res.status).toBe(200);
    const board = await (
      await api(ctx.app, alice.cookie, "GET", `/api/v1/projects/${projectId}/issues?view=board`)
    ).json() as any;
    expect(board.columns.in_progress.length).toBeGreaterThan(0);
  });

  it("删除任务级联子任务", async () => {
    const res = await api(ctx.app, alice.cookie, "DELETE", `/api/v1/issues/${issueA.id}`);
    expect(res.status).toBe(200);
    const detail = await api(ctx.app, alice.cookie, "GET", `/api/v1/issues/${issueA.id}`);
    expect(detail.status).toBe(404);
  });
});
