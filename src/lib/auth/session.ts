import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, userRoles, users, type Role, type User } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { primaryRole, ROLE_HOME } from "@/lib/permissions";

const COOKIE = "gl_session";
const ROLE_COOKIE = "gl_active_role";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

export type SessionUser = User & { roles: Role[] };

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const h = await headers();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + MAX_AGE_MS),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  });
}

/** Cargos do usuário. Fallback seguro para users.role durante a migração. */
export async function getUserRoles(userId: string, legacyRole?: Role): Promise<Role[]> {
  const rows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  if (rows.length > 0) return rows.map((r) => r.role);
  if (legacyRole) return [legacyRole];
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u ? [u.role] : ["aluno"];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt, sid: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sid));
    return null;
  }
  if (row.user.status !== "ativo") return null;
  if (row.expiresAt.getTime() - Date.now() < MAX_AGE_MS / 2) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + MAX_AGE_MS) }).where(eq(sessions.id, row.sid));
  }
  const roles = await getUserRoles(row.user.id, row.user.role);
  return { ...row.user, roles };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(COOKIE);
  store.delete(ROLE_COOKIE);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function homeForRole(role: Role): string {
  return ROLE_HOME[role] ?? "/aluno";
}

/** Função ativa (apenas organização da UI — segurança sempre valida todos os cargos no servidor). */
export async function getActiveRole(user: SessionUser): Promise<Role> {
  const store = await cookies();
  const saved = store.get(ROLE_COOKIE)?.value as Role | undefined;
  if (saved && user.roles.includes(saved)) return saved;
  return primaryRole(user.roles);
}

export async function setActiveRoleCookie(role: Role): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Destino pós-login: cargo único → painel; múltiplos → último usado ou seleção de função. */
export async function postLoginDestination(user: SessionUser): Promise<string> {
  if (user.roles.length === 1) {
    await setActiveRoleCookie(user.roles[0]);
    return homeForRole(user.roles[0]);
  }
  const store = await cookies();
  const saved = store.get(ROLE_COOKIE)?.value as Role | undefined;
  if (saved && user.roles.includes(saved)) return homeForRole(saved);
  return "/selecionar-funcao";
}

export async function homeForUser(user: SessionUser): Promise<string> {
  return homeForRole(await getActiveRole(user));
}

export { safeNext } from "@/lib/auth/session-utils";