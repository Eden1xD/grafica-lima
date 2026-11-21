import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPermissions, type Role } from "@/db/schema";
import { getSessionUser, homeForRole, type SessionUser } from "@/lib/auth/session";
import { effectivePermissions, primaryRole, type PermissionKey } from "@/lib/permissions";

export class AuthzError extends Error {
  constructor(message = "Você não tem permissão para executar esta operação.") {
    super(message);
    this.name = "AuthzError";
  }
}

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar");
  return user;
}

export async function requireRole(roles: Role[], nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.roles.some((r) => roles.includes(r))) redirect(homeForRole(primaryRole(user.roles)));
  return user;
}

/** Para server actions e rotas API — lança erro em vez de redirecionar. */
export async function assertRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthzError("Sessão expirada. Entre novamente.");
  if (!user.roles.some((r) => roles.includes(r))) throw new AuthzError();
  return user;
}

export async function getPermissionOverrides(userId: string) {
  const rows = await db
    .select({ permission: userPermissions.permission, effect: userPermissions.effect })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return rows;
}

export async function userPermissionsSet(user: SessionUser): Promise<Set<PermissionKey>> {
  const overrides = await getPermissionOverrides(user.id);
  return effectivePermissions(user.roles, overrides);
}

export async function assertPermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthzError("Sessão expirada. Entre novamente.");
  const perms = await userPermissionsSet(user);
  if (!perms.has(permission)) throw new AuthzError(`Permissão necessária: ${permission}.`);
  return user;
}

export async function requirePermission(permission: PermissionKey, nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  const perms = await userPermissionsSet(user);
  if (!perms.has(permission)) redirect(homeForRole(primaryRole(user.roles)));
  return user;
}

export const STAFF: Role[] = ["admin", "secretaria", "financeiro"];
export const ACADEMIC: Role[] = ["admin", "secretaria", "professor"];
export const FINANCE: Role[] = ["admin", "secretaria", "financeiro"];
export const ADMIN: Role[] = ["admin"];

export function isStaff(role: Role): boolean {
  return STAFF.includes(role);
}

export function userIsStaff(user: { roles: Role[] }): boolean {
  return user.roles.some((r) => STAFF.includes(r));
}