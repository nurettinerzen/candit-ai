import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [AuthModule, NotificationsModule, BillingModule],
  controllers: [MembersController],
  providers: [MembersService]
})
export class MembersModule {}
