import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException
} from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { RuntimeConfigService } from "../../config/runtime-config.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService) {}

  private buildStartupSnapshot() {
    try {
      return this.runtimeConfig.validateAtStartup();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        warnings: [message],
        providers: {} as Record<string, { ready: boolean; mode: string }>
      };
    }
  }

  @Get()
  @Public()
  getHealth() {
    const startup = this.buildStartupSnapshot();
    return {
      status: startup.healthy ? "ok" : "degraded",
      healthy: startup.healthy,
      service: "api",
      runtimeMode: this.runtimeConfig.runtimeMode,
      auth: {
        sessionMode: this.runtimeConfig.authMode,
        tokenTransport: this.runtimeConfig.authTokenTransport
      },
      warningCount: startup.warnings.length,
      timestamp: new Date().toISOString()
    };
  }

  @Get("providers")
  @Public()
  getProviderHealth() {
    const startup = this.buildStartupSnapshot();
    return {
      status: startup.healthy ? "ok" : "degraded",
      healthy: startup.healthy,
      providers: this.runtimeConfig.providerReadiness,
      warnings: startup.warnings,
      startupValidation: startup,
      timestamp: new Date().toISOString()
    };
  }

  @Get("readiness")
  @Public()
  getReadiness() {
    const startup = this.buildStartupSnapshot();
    const payload = {
      status: startup.healthy ? "ready" : "not_ready",
      healthy: startup.healthy,
      service: "api",
      runtimeMode: this.runtimeConfig.runtimeMode,
      warnings: startup.warnings,
      warningCount: startup.warnings.length,
      providers: startup.providers,
      timestamp: new Date().toISOString()
    };

    if (!startup.healthy) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
