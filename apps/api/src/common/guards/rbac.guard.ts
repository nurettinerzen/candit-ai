import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@ai-interviewer/domain";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { ROLE_PERMISSIONS } from "../constants/rbac";
import { REQUIRED_PERMISSIONS } from "../decorators/permissions.decorator";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import type { RequestWithContext } from "../interfaces/request-with-context.interface";

@Injectable()
export class RbacGuard implements CanActivate {
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

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();

    if (this.runtimeConfig.isInternalAdmin(request.user?.email)) {
      return true;
    }

    const roles = request.user?.roles ?? [];

    const grantedPermissions = new Set(
      roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])
    );

    const hasAllPermissions = requiredPermissions.every((permission) =>
      grantedPermissions.has(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException("Bu islem icin gerekli yetki bulunmuyor.");
    }

    return true;
  }
}
