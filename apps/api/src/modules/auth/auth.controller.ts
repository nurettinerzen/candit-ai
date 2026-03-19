import { Body, Controller, Get, Post, Req, Res, UnauthorizedException , Inject} from "@nestjs/common";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import type { Request, Response } from "express";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { AuthService } from "./auth.service";

class LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class RefreshRequest {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

class LogoutRequest {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

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

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  @Post("login")
  @Public()
  async login(
    @Body() body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.header("user-agent") ?? undefined
    });

    if (this.runtimeConfig.authTokenTransport === "cookie") {
      this.writeAuthCookies(response, result.accessToken, result.refreshToken);

      return {
        user: result.user,
        session: result.session
      };
    }

    return result;
  }

  @Post("refresh")
  @Public()
  async refresh(
    @Body() body: RefreshRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const cookieJar = parseCookieHeader(request.header("cookie"));
    const refreshToken =
      body.refreshToken?.trim() || cookieJar[this.runtimeConfig.refreshTokenCookieName];

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token bulunamadı.");
    }

    const result = await this.authService.refresh(refreshToken, {
      ipAddress: request.ip,
      userAgent: request.header("user-agent") ?? undefined
    });

    if (this.runtimeConfig.authTokenTransport === "cookie") {
      this.writeAuthCookies(response, result.accessToken, result.refreshToken);

      return {
        session: result.session
      };
    }

    return result;
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: RequestUser,
    @Body() body: LogoutRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const cookieJar = parseCookieHeader(request.header("cookie"));
    const refreshToken =
      body.refreshToken?.trim() || cookieJar[this.runtimeConfig.refreshTokenCookieName];

    await this.authService.logout({
      sessionId: user.sessionId,
      refreshToken,
      reason: "logout"
    });

    if (this.runtimeConfig.authTokenTransport === "cookie") {
      this.clearAuthCookies(response);
    }

    return {
      ok: true
    };
  }

  @Get("session")
  getSession(
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext?: RequestContext
  ) {
    return {
      user: {
        id: user.userId,
        tenantId: user.tenantId,
        roles: user.roles,
        email: user.email ?? null
      },
      session: {
        authMode: user.authMode,
        id: user.sessionId ?? null
      },
      runtime: {
        appMode: this.runtimeConfig.runtimeMode,
        authMode: this.runtimeConfig.authMode,
        authTransport: this.runtimeConfig.authTokenTransport,
        demoShortcutsEnabled: this.runtimeConfig.allowDemoShortcuts
      },
      traceId: requestContext?.traceId
    };
  }

  private writeAuthCookies(response: Response, accessToken: string, refreshToken: string) {
    const secure = this.runtimeConfig.cookieSecure;
    const domain = this.runtimeConfig.cookieDomain;

    response.cookie(this.runtimeConfig.accessTokenCookieName, accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      domain,
      maxAge: this.runtimeConfig.accessTokenTtlMinutes * 60 * 1000
    });

    response.cookie(this.runtimeConfig.refreshTokenCookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      domain,
      maxAge: this.runtimeConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000
    });
  }

  private clearAuthCookies(response: Response) {
    const domain = this.runtimeConfig.cookieDomain;

    response.clearCookie(this.runtimeConfig.accessTokenCookieName, {
      path: "/",
      domain
    });

    response.clearCookie(this.runtimeConfig.refreshTokenCookieName, {
      path: "/",
      domain
    });
  }
}
