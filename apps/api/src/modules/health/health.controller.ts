import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { RuntimeConfigService } from "../../config/runtime-config.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService) {}

  @Get()
  @Public()
  getHealth() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    };
  }

  @Get("providers")
  @Public()
  getProviderHealth() {
    return {
      status: "ok",
      providers: this.runtimeConfig.providerReadiness,
      timestamp: new Date().toISOString()
    };
  }
}
