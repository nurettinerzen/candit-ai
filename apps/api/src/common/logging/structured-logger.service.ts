import { Injectable } from "@nestjs/common";

export type LogLevel = "info" | "warn" | "error";

@Injectable()
export class StructuredLoggerService {
  info(message: string, context?: Record<string, unknown>) {
    this.write("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.write("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const event = {
      level,
      message,
      ts: new Date().toISOString(),
      ...(context ?? {})
    };

    const line = JSON.stringify(event);

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
