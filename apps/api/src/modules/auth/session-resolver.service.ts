import { Injectable, UnauthorizedException, Inject} from "@nestjs/common";
import type { Role } from "@ai-interviewer/domain";
import type { RequestWithContext } from "../../common/interfaces/request-with-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { AuthService } from "./auth.service";

function parseCookieHeader(raw: string | undefined) {
  if (!raw) {
    return {} as Record<string, string>;
  }

  return raw.split(";").reduce<Record<string, string>>((acc, cookiePair) => {
    const [rawKey, ...rawValueParts] = cookiePair.trim().split("=");
    if (!rawKey || rawValueParts.length === 0) {
      return acc;
    }

    acc[rawKey] = decodeURIComponent(rawValueParts.join("="));
    return acc;
  }, {});
}

@Injectable()
export class SessionResolverService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async resolve(request: RequestWithContext): Promise<RequestUser> {
    const bearerUser = await this.resolveFromBearerToken(request);
    if (bearerUser) {
      return bearerUser;
    }

    const headerUser = this.resolveFromDevHeaders(request);
    if (headerUser) {
      return headerUser;
    }

    throw new UnauthorizedException(this.buildUnauthorizedMessage());
  }

  private async resolveFromBearerToken(request: RequestWithContext) {
    const token = this.extractAccessToken(request);
    if (!token) {
      return null;
    }

    const payload = await this.authService.verifyAccessToken(token);

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      roles: payload.roles,
      email: payload.email,
      fullName: payload.fullName,
      emailVerifiedAt: payload.emailVerifiedAt,
      avatarUrl: payload.avatarUrl,
      authMode: "jwt",
      sessionId: payload.sid
    } satisfies RequestUser;
  }

  private extractAccessToken(request: RequestWithContext) {
    const authorization = request.header("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      if (token) {
        return token;
      }
    }

    if (this.runtimeConfig.authTokenTransport !== "cookie") {
      return null;
    }

    const cookieJar = parseCookieHeader(request.header("cookie"));
    const fromCookie = cookieJar[this.runtimeConfig.accessTokenCookieName];
    return fromCookie?.trim() ? fromCookie.trim() : null;
  }

  private resolveFromDevHeaders(request: RequestWithContext) {
    if (!this.runtimeConfig.allowDevHeaderAuth) {
      return null;
    }

    const userId = request.header("x-user-id")?.trim();
    const tenantId = request.header("x-tenant-id")?.trim();
    const rawRoles = request.header("x-roles") ?? "manager";
    const fullName = request.header("x-user-label")?.trim() || request.header("x-user-name")?.trim();
    const email = request.header("x-user-email")?.trim().toLowerCase();

    if (!userId || !tenantId) {
      return null;
    }

    return {
      userId,
      tenantId,
      roles: rawRoles
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean) as Role[],
      fullName: fullName || undefined,
      email: email || undefined,
      emailVerifiedAt: null,
      avatarUrl: null,
      authMode: "dev_header"
    } satisfies RequestUser;
  }

  private buildUnauthorizedMessage() {
    if (this.runtimeConfig.authMode === "jwt") {
      if (this.runtimeConfig.authTokenTransport === "cookie") {
        return "Kimlik doğrulaması için geçerli oturum çerezleri zorunludur.";
      }

      return "Kimlik doğrulaması için geçerli Bearer token zorunludur.";
    }

    if (this.runtimeConfig.authMode === "dev_header") {
      return "Dev auth için x-user-id ve x-tenant-id header'ları zorunludur.";
    }

    return "Kimlik doğrulaması için Bearer token veya dev header oturumu gereklidir.";
  }
}
