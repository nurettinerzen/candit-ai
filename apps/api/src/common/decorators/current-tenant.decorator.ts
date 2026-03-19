import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return request.user?.tenantId ?? request.header("x-tenant-id");
});
