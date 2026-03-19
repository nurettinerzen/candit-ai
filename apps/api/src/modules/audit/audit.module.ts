import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditWriterService } from "./audit-writer.service";

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditWriterService],
  exports: [AuditWriterService, AuditService]
})
export class AuditModule {}
