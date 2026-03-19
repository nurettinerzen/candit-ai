import type { Request } from "express";
import type { RequestUser } from "./request-user.interface";
import type { RequestContext } from "./request-context.interface";

export interface RequestWithContext extends Request {
  user?: RequestUser;
  requestContext?: RequestContext;
}
