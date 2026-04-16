import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InternalAdminController } from "./internal-admin.controller";
import { InternalAdminService } from "./internal-admin.service";

@Module({
  imports: [BillingModule, AuthModule, FeatureFlagsModule, NotificationsModule],
  controllers: [InternalAdminController],
  providers: [InternalAdminService]
})
export class InternalAdminModule {}
