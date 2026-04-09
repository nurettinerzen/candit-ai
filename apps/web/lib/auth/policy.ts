import { isInternalAdminEmail } from "./runtime";
import type { WebAuthSession } from "./types";

export type AppRole = "owner" | "manager" | "staff";

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

const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  owner: [
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
  manager: [
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
    "workflow.manage",
    "audit.read"
  ],
  staff: [
    "job.create",
    "job.read",
    "job.update",
    "candidate.create",
    "candidate.read",
    "candidate.move_stage",
    "screening.run",
    "interview.schedule",
    "interview.read",
    "interview.session.manage",
    "ai.task.request",
    "ai.task.read",
    "ai.report.read",
    "report.generate",
    "report.read",
    "recommendation.read"
  ]
};

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Hesap Sahibi",
  manager: "Menajer",
  staff: "Uzman / Personel"
};

type RoutePolicy = {
  requiredAnyRole?: AppRole[];
  requiredPermissions?: AppPermission[];
};

export const ROUTE_POLICY_MAP: Record<string, RoutePolicy> = {
  "/dashboard": { requiredPermissions: ["job.read"] },
  "/dashboard/admin": { requiredPermissions: ["tenant.manage"] },
  "/dashboard/subscription": { requiredPermissions: ["tenant.manage"] },
  "/admin": { requiredPermissions: ["tenant.manage"] },
  "/applications": { requiredPermissions: ["candidate.read"] },
  "/ai-support": { requiredPermissions: ["ai.task.read"] },
  "/interviews": { requiredPermissions: ["interview.read"] },
  "/jobs": { requiredPermissions: ["job.read"] },
  "/reports": { requiredPermissions: ["report.read"] },
  "/sourcing": { requiredPermissions: ["job.read"] },
  "/subscription": { requiredPermissions: ["tenant.manage"] },
  "/jobs/new": { requiredPermissions: ["job.create"] },
  "/candidates": { requiredPermissions: ["candidate.read"] },
  "/candidates/new": { requiredPermissions: ["candidate.create"] },
  "/ai-destek": { requiredPermissions: ["ai.task.read"] },
  "/audit-logs": { requiredPermissions: ["audit.read"] },
  "/raporlar": { requiredPermissions: ["report.read"] },
  "/abonelik": { requiredPermissions: ["tenant.manage"] },
  "/yonetim": { requiredPermissions: ["tenant.manage"] },
  "/settings": { requiredPermissions: ["user.manage"] }
};

export function parseRoles(session: WebAuthSession | null): AppRole[] {
  if (!session) {
    return [];
  }

  return session.roles
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is AppRole => role === "owner" || role === "manager" || role === "staff");
}

export function getPrimaryRole(session: WebAuthSession | null): AppRole | null {
  return parseRoles(session)[0] ?? null;
}

export function getRoleLabel(role: string) {
  return ROLE_LABELS[role as AppRole] ?? role;
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

export function isInternalAdminSession(session: WebAuthSession | null) {
  return canPerformAction(session, "tenant.manage") && isInternalAdminEmail(session?.email);
}

export function isInternalOnlyRoute(pathname: string) {
  return (
    pathname === "/sourcing" ||
    pathname.startsWith("/sourcing/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/yonetim" ||
    pathname.startsWith("/yonetim/") ||
    pathname === "/dashboard/admin" ||
    pathname.startsWith("/dashboard/admin/")
  );
}

function matchRoutePolicy(pathname: string) {
  const normalized = pathname === "" ? "/" : pathname;
  const matchedKey = Object.keys(ROUTE_POLICY_MAP)
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized === key || normalized.startsWith(`${key}/`));

  return matchedKey ? ROUTE_POLICY_MAP[matchedKey] : null;
}

export function canAccessRoute(session: WebAuthSession | null, pathname: string) {
  if (isInternalOnlyRoute(pathname)) {
    return isInternalAdminSession(session);
  }

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
