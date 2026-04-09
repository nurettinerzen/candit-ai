import { Module } from "@nestjs/common";
import { PublicIntakeController } from "./public-intake.controller";
import { PublicIntakeService } from "./public-intake.service";

@Module({
  controllers: [PublicIntakeController],
  providers: [PublicIntakeService],
  exports: [PublicIntakeService]
})
export class PublicIntakeModule {}
