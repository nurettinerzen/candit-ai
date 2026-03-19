export type RequestContext = {
  requestId: string;
  correlationId: string;
  traceId: string;
  startedAt: number;
};
