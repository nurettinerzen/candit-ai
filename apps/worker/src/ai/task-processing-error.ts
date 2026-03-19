export class TaskProcessingError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    recoverable = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TaskProcessingError";
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
  }
}
