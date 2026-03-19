import type { WebAuthSession } from "./types";

export type AppPermission =
  | "tenant.manage"
  | "workspace.manage"
  | "user.manage"
  | "job.create"
  | "job.read"
  | "job.update"
  | "candidate.create"
  | "candidate.read"
  | "candidate.move_stage"
  | "screening.template.manage"
  | "screening.run"
  | "interview.template.manage"
  | "interview.schedule"
  | "interview.read"
  | "interview.session.manage"
  | "ai.task.request"
  | "ai.task.read"
  | "ai.report.read"
  | "report.generate"
  | "report.read"
  | "recommendation.read"
  | "ai.config.update"
  | "workflow.manage"
  | "integration.manage"
  | "notification.send"
  | "audit.read";

const ROLE_PERMISSIONS: Record<string, AppPermission[]> = {
  admin: [
    "tenant.manage",
    "workspace.manage",
    "user.manage",
    "job.create",
    "job.read",
    "job.update",
    "candidate.create",
    "candidate.read",
    "candidate.move_stage",
    "screening.template.manage",
    "screening.run",
    "interview.template.manage",
    "interview.schedule",
    "interview.read",
    "interview.session.manage",
    "ai.task.request",
    "ai.task.read",
    "ai.report.read",
    "report.generate",
    "report.read",
    "recommendation.read",
    "ai.config.update",
    "workflow.manage",
    "integration.manage",
    "notification.send",
    "audit.read"
  ],
  recruiter: [
    "job.create",
    "job.read",
    "job.update",
    "candidate.create",
    "candidate.read",
    "candidate.move_stage",
    "screening.run",
    "interview.template.manage",
    "interview.schedule",
    "interview.read",
    "interview.session.manage",
    "ai.task.request",
    "ai.task.read",
    "ai.report.read",
    "report.generate",
    "report.read",
    "recommendation.read",
    "ai.config.update",
    "audit.read"
  ],
  hiring_manager: [
    "job.read",
    "candidate.read",
    "interview.read",
    "ai.task.read",
    "ai.report.read",
    "report.read",
    "recommendation.read"
  ],
  candidate: [],
  agency_recruiter: ["candidate.create", "candidate.read", "job.read", "ai.task.read"]
};

type RoutePolicy = {
  requiredAnyRole?: string[];
  requiredPermissions?: AppPermission[];
};

export const ROUTE_POLICY_MAP: Record<string, RoutePolicy> = {
  "/": { requiredPermissions: ["job.read"] },
  "/applications": { requiredPermissions: ["candidate.read"] },
  "/interviews": { requiredPermissions: ["interview.read"] },
  "/jobs": { requiredPermissions: ["job.read"] },
  "/jobs/new": { requiredPermissions: ["job.create"] },
  "/candidates": { requiredPermissions: ["candidate.read"] },
  "/candidates/new": { requiredPermissions: ["candidate.create"] },
  "/raporlar": { requiredPermissions: ["job.read"] },
  "/ayarlar": { requiredPermissions: ["ai.task.read"] }
};

function parseRoles(session: WebAuthSession | null) {
  if (!session) {
    return [];
  }

  return session.roles
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

export function getGrantedPermissions(session: WebAuthSession | null) {
  const roles = parseRoles(session);
  const permissions = new Set<AppPermission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }

  return permissions;
}

export function canPerformAction(session: WebAuthSession | null, permission: AppPermission) {
  return getGrantedPermissions(session).has(permission);
}

function matchRoutePolicy(pathname: string) {
  const normalized = pathname === "" ? "/" : pathname;
  const matchedKey = Object.keys(ROUTE_POLICY_MAP)
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized === key || normalized.startsWith(`${key}/`));

  return matchedKey ? ROUTE_POLICY_MAP[matchedKey] : null;
}

export function canAccessRoute(session: WebAuthSession | null, pathname: string) {
  const policy = matchRoutePolicy(pathname);
  if (!policy) {
    return true;
  }

  const roles = parseRoles(session);

  if (policy.requiredAnyRole && !policy.requiredAnyRole.some((role) => roles.includes(role))) {
    return false;
  }

  if (policy.requiredPermissions && policy.requiredPermissions.length > 0) {
    const granted = getGrantedPermissions(session);
    return policy.requiredPermissions.every((permission) => granted.has(permission));
  }

  return true;
}
