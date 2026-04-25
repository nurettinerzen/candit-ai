import { Body, Controller, Get, Inject, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
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

class AcceptInvitationRequest {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}

class SignupRequest {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class ForgotPasswordRequest {
  @IsEmail()
  email!: string;
}

class EmailVerificationRequest {
  @IsEmail()
  email!: string;
}

class ResolveTokenRequest {
  @IsString()
  token!: string;
}

class ResetPasswordRequest {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class ChangePasswordRequest {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class DeleteAccountRequest {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  confirmationText!: string;
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

  @Post("signup")
  @Public()
  async signup(
    @Body() body: SignupRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.signup(body, {
      ipAddress: request.ip,
      userAgent: request.header("user-agent") ?? undefined
    });

    if (
      this.runtimeConfig.authTokenTransport === "cookie" &&
      "accessToken" in result &&
      "refreshToken" in result &&
      result.accessToken &&
      result.refreshToken
    ) {
      this.writeAuthCookies(response, result.accessToken, result.refreshToken);

      return {
        user: result.user,
        session: result.session,
        emailVerification: result.emailVerification
      };
    }

    return {
      ...result,
      session: result.session ?? null
    };
  }

  @Get("providers")
  @Public()
  getProviders() {
    const googleAuth = this.runtimeConfig.googleAuthConfig;

    return {
      google: {
        enabled: Boolean(
          googleAuth.launchEnabled &&
            googleAuth.clientId &&
            googleAuth.clientSecret &&
            googleAuth.redirectUri
        )
      },
      enterpriseSso: {
        enabled: false,
        launchStatus: "unsupported",
        reason: "Enterprise OIDC/SSO V1 kapsamına dahil değil."
      }
    };
  }

  @Post("password/forgot")
  @Public()
  forgotPassword(@Body() body: ForgotPasswordRequest) {
    return this.authService.requestPasswordReset(body);
  }

  @Post("email-verification/request")
  @Public()
  requestEmailVerification(@Body() body: EmailVerificationRequest) {
    return this.authService.requestEmailVerification(body);
  }

  @Get("password/reset/resolve")
  @Public()
  resolvePasswordReset(@Query("token") token: string) {
    return this.authService.resolvePasswordReset(token);
  }

  @Post("password/reset")
  @Public()
  async resetPassword(
    @Body() body: ResetPasswordRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.resetPassword(body, {
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

  @Post("password/change")
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: ChangePasswordRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.changePassword(
      {
        userId: user.userId,
        tenantId: user.tenantId,
        sessionId: user.sessionId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword
      },
      {
        ipAddress: request.ip,
        userAgent: request.header("user-agent") ?? undefined
      }
    );

    if (this.runtimeConfig.authTokenTransport === "cookie") {
      this.writeAuthCookies(response, result.accessToken, result.refreshToken);

      return {
        user: result.user,
        session: result.session
      };
    }

    return result;
  }

  @Post("account/delete")
  async deleteCurrentAccount(
    @CurrentUser() user: RequestUser,
    @Body() body: DeleteAccountRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.deleteCurrentAccount(
      {
        userId: user.userId,
        tenantId: user.tenantId,
        roles: user.roles,
        currentPassword: body.currentPassword,
        confirmationText: body.confirmationText,
        actorEmail: user.email
      },
      {
        ipAddress: request.ip,
        userAgent: request.header("user-agent") ?? undefined
      }
    );

    if (this.runtimeConfig.authTokenTransport === "cookie") {
      this.clearAuthCookies(response);
    }

    return {
      ok: true
    };
  }

  @Post("email-verification/resend")
  resendEmailVerification(@CurrentUser() user: RequestUser) {
    return this.authService.sendEmailVerification({
      userId: user.userId,
      tenantId: user.tenantId
    });
  }

  @Post("email-verification/confirm")
  @Public()
  confirmEmailVerification(@Body() body: ResolveTokenRequest) {
    return this.authService.confirmEmailVerification(body.token);
  }

  @Post("oauth/exchange")
  @Public()
  async exchangeOauthRelay(
    @Body() body: ResolveTokenRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.exchangeOauthRelay(body.token, {
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
        email: user.email ?? null,
        fullName: user.fullName ?? null,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        avatarUrl: user.avatarUrl ?? null
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

  @Get("invitations/resolve")
  @Public()
  resolveInvitation(@Query("token") token: string) {
    return this.authService.resolveInvitation(token);
  }

  @Post("invitations/accept")
  @Public()
  async acceptInvitation(
    @Body() body: AcceptInvitationRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.acceptInvitation(body, {
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
