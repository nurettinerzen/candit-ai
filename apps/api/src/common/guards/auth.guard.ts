import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";
import { SessionResolverService } from "../../modules/auth/session-resolver.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionResolverService) private readonly sessionResolver: SessionResolverService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    request.user = await this.sessionResolver.resolve(request);
    return true;
  }
}
