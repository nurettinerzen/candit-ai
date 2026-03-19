import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { NextFunction, Response } from "express";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";
const TRACE_ID_HEADER = "x-trace-id";

function pickHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const requestId = pickHeaderValue(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();
    const correlationId =
      pickHeaderValue(req.headers[CORRELATION_ID_HEADER]) ??
      pickHeaderValue(req.headers[TRACE_ID_HEADER]) ??
      requestId;
    const traceId = pickHeaderValue(req.headers[TRACE_ID_HEADER]) ?? correlationId;

    req.requestContext = {
      requestId,
      correlationId,
      traceId,
      startedAt: Date.now()
    };

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    res.setHeader(TRACE_ID_HEADER, traceId);

    next();
  }
}
