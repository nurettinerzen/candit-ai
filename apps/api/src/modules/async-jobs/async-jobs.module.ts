import { Module } from "@nestjs/common";
import { AsyncJobsController } from "./async-jobs.controller";
import { AsyncJobsService } from "./async-jobs.service";

@Module({
  controllers: [AsyncJobsController],
  providers: [AsyncJobsService],
  exports: [AsyncJobsService]
})
export class AsyncJobsModule {}
