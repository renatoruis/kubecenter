export interface ErrorShape {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export class AppError extends Error implements ErrorShape {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown);
  constructor(status: number, code: string, message: string, details?: unknown);
  constructor(
    arg1: string | number,
    arg2: string,
    arg3: string | number,
    arg4?: unknown,
  ) {
    if (typeof arg1 === "number") {
      super(arg3 as string);
      this.code = arg2;
      this.status = arg1;
      this.details = arg4;
    } else {
      super(arg2);
      this.code = arg1;
      this.status = arg3 as number;
      this.details = arg4;
    }
    this.name = "AppError";
  }

  get statusCode(): number {
    return this.status;
  }

  toJSON(): {
    statusCode: number;
    error: string;
    code: string;
    message: string;
    details?: unknown;
  } {
    return {
      statusCode: this.status,
      error: this.status === 404 ? "Not Found" : "Error",
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
