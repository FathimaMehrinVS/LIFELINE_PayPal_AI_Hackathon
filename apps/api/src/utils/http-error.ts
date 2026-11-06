import type { ErrorCode } from "@lifeline/contracts";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  NOT_IMPLEMENTED: 501,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** Throw this from any route or module; the error handler turns it into an ApiError response. */
export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS_BY_CODE[code];
  }
}
