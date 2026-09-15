export type WhiteboardErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "SESSION_EXPIRED"
  | "INVALID_PROJECT"
  | "PATH_ESCAPE"
  | "REVISION_CONFLICT"
  | "STALE_SELECTION"
  | "ASSET_NOT_FOUND"
  | "INVALID_MEDIA"
  | "TASK_RESULT_UNAVAILABLE"
  | "FORBIDDEN_HOST"
  | "INTERNAL";

export class WhiteboardError extends Error {
  constructor(public readonly code: WhiteboardErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "WhiteboardError";
  }
}
