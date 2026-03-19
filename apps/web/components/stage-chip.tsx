import { JOB_STATUS_LABELS, STAGE_LABELS } from "../lib/constants";
import type { ApplicationStage, JobStatus } from "../lib/types";

export function StageChip({ stage }: { stage: ApplicationStage }) {
  return <span className={`chip stage-${stage.toLowerCase()}`}>{STAGE_LABELS[stage]}</span>;
}

export function JobStatusChip({ status }: { status: JobStatus }) {
  return <span className={`chip job-${status.toLowerCase()}`}>{JOB_STATUS_LABELS[status]}</span>;
}
