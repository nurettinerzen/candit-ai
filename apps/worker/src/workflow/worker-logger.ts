export class WorkerLogger {
  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log("error", message, context);
  }

  private log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
    const line = JSON.stringify({
      level,
      message,
      ts: new Date().toISOString(),
      ...(context ?? {})
    });

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
