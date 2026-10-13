/** 统一错误（docs/api-spec.md §错误格式） */
export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "未登录或会话已过期");
export const forbidden = (msg = "没有执行此操作的权限") => new ApiError(403, "FORBIDDEN", msg);
export const notFound = (code: string, msg: string) => new ApiError(404, code, msg);
