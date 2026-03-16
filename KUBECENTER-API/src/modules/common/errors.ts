export type ErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN_NAMESPACE"
  | "NOT_FOUND"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface StructuredErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toStructuredError(error: unknown): { status: number; body: StructuredErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected internal error";
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
  };
}
