import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestContext } from "../interfaces/request-context.interface";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";

export const CurrentContext = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return request.requestContext as RequestContext | undefined;
});
