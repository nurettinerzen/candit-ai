import { Module } from "@nestjs/common";
import { SecurityEventsModule } from "../security-events/security-events.module";
import { PublicIntakeController } from "./public-intake.controller";
import { PublicIntakeService } from "./public-intake.service";

@Module({
  imports: [SecurityEventsModule],
  controllers: [PublicIntakeController],
  providers: [PublicIntakeService],
  exports: [PublicIntakeService]
})
export class PublicIntakeModule {}
