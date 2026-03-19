import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { StructuredLoggerService } from "../logging/structured-logger.service";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(StructuredLoggerService) private readonly logger?: StructuredLoggerService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const requestContext = req.requestContext;
    const startedAt = requestContext?.startedAt ?? Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          const user = req.user;

          this.logger?.info("api.request.completed", {
            requestId: requestContext?.requestId,
            correlationId: requestContext?.correlationId,
            traceId: requestContext?.traceId,
            method: req.method,
            path: req.originalUrl,
            statusCode: context.switchToHttp().getResponse<{ statusCode: number }>().statusCode,
            durationMs,
            tenantId: user?.tenantId,
            userId: user?.userId,
            authMode: user?.authMode
          });
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startedAt;
          const user = req.user;

          this.logger?.error("api.request.failed", {
            requestId: requestContext?.requestId,
            correlationId: requestContext?.correlationId,
            traceId: requestContext?.traceId,
            method: req.method,
            path: req.originalUrl,
            statusCode: context.switchToHttp().getResponse<{ statusCode: number }>().statusCode,
            durationMs,
            tenantId: user?.tenantId,
            userId: user?.userId,
            authMode: user?.authMode,
            error: error instanceof Error ? error.message : "unknown_error"
          });
        }
      })
    );
  }
}
