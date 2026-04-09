"use client";

import { JOB_STATUS_LABELS, STAGE_LABELS } from "../lib/constants";
import type { ApplicationStage, JobStatus } from "../lib/types";
import { useUiText } from "./site-language-provider";

export function StageChip({ stage }: { stage: ApplicationStage }) {
  const { t } = useUiText();
  return <span className={`chip stage-${stage.toLowerCase()}`}>{t(STAGE_LABELS[stage])}</span>;
}

export function JobStatusChip({ status }: { status: JobStatus }) {
  const { t } = useUiText();
  return <span className={`chip job-${status.toLowerCase()}`}>{t(JOB_STATUS_LABELS[status])}</span>;
}
