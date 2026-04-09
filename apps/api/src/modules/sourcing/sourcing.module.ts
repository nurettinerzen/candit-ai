import { Module } from "@nestjs/common";
import { ApplicationsModule } from "../applications/applications.module";
import { CandidatesModule } from "../candidates/candidates.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SourcingController } from "./sourcing.controller";
import { SourcingService } from "./sourcing.service";

@Module({
  imports: [JobsModule, CandidatesModule, ApplicationsModule, NotificationsModule],
  controllers: [SourcingController],
  providers: [SourcingService],
  exports: [SourcingService]
})
export class SourcingModule {}
