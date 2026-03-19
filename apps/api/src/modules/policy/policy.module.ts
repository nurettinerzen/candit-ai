import { Module } from "@nestjs/common";
import { HumanApprovalService } from "./human-approval.service";

@Module({
  providers: [HumanApprovalService],
  exports: [HumanApprovalService]
})
export class PolicyModule {}
