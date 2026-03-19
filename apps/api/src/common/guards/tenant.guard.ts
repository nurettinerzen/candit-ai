import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";
import { RuntimeConfigService } from "../../config/runtime-config.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const tenantFromHeader = request.header("x-tenant-id");
    const tenantFromUser = request.user?.tenantId;

    if (!tenantFromUser) {
      throw new ForbiddenException("Tenant baglami dogrulanamadi.");
    }

    if (this.runtimeConfig.requireTenantHeader && !tenantFromHeader) {
      throw new ForbiddenException("Tenant header zorunlu.");
    }

    if (tenantFromHeader && tenantFromHeader !== tenantFromUser) {
      throw new ForbiddenException("Tenant baglami dogrulanamadi.");
    }

    return true;
  }
}
