import { Module } from "@nestjs/common";
import { InterviewsModule } from "../interviews/interviews.module";
import { ElevenLabsController } from "./elevenlabs.controller";
import { ElevenLabsService } from "./elevenlabs.service";

@Module({
  imports: [InterviewsModule],
  controllers: [ElevenLabsController],
  providers: [ElevenLabsService],
  exports: [ElevenLabsService]
})
export class ElevenLabsModule {}
