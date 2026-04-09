import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InternalAdminController } from "./internal-admin.controller";
import { InternalAdminService } from "./internal-admin.service";

@Module({
  imports: [BillingModule, AuthModule, NotificationsModule],
  controllers: [InternalAdminController],
  providers: [InternalAdminService]
})
export class InternalAdminModule {}
