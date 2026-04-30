-- RLS bootstrap template for PostgreSQL
-- Runtime must set app.tenant_id per request:
--   SET app.tenant_id = '...';

alter table "Tenant" enable row level security;
alter table "Workspace" enable row level security;
alter table "User" enable row level security;
alter table "Job" enable row level security;
alter table "Candidate" enable row level security;
alter table "CandidateApplication" enable row level security;
alter table "InterviewSession" enable row level security;
alter table "Transcript" enable row level security;
alter table "AiReport" enable row level security;
alter table "AuditLog" enable row level security;
alter table "PublicLeadSubmission" enable row level security;

create policy tenant_isolation_workspace on "Workspace"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_user on "User"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_job on "Job"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_candidate on "Candidate"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_application on "CandidateApplication"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_session on "InterviewSession"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_transcript on "Transcript"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_report on "AiReport"
  using ("tenantId" = current_setting('app.tenant_id', true));

create policy tenant_isolation_audit on "AuditLog"
  using ("tenantId" = current_setting('app.tenant_id', true));
