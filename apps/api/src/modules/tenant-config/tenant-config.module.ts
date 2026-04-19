import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantConfigController } from "./tenant-config.controller";
import { TenantConfigService } from "./tenant-config.service";

@Module({
  imports: [FeatureFlagsModule, PrismaModule],
  controllers: [TenantConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService]
})
export class TenantConfigModule {}
