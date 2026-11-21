"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { teachers, userPermissions, userRoles, users, type Role } from "@/db/schema";
import { assertRole, ADMIN } from "@/lib/auth/guards";
import { getSessionUser, getUserRoles, homeForRole, setActiveRoleCookie } from "@/lib/auth/session";
import { canGrantPermission, isCriticalPermission, isValidPermission, primaryRole, ROLE_LABEL } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str } from "./types";

const VALID_ROLES: Role[] = ["admin", "secretaria", "financeiro", "professor", "aluno"];

/** Conta admins ativos pela coluna sincronizada (invariante: users.role = cargo de maior prioridade). */
async function activeAdminCount(excludeUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "ativo"), ...(excludeUserId ? [ne(users.id, excludeUserId)] : [])));
  return rows.length;
}

export async function setUserRolesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const userId = str(fd, "userId");
    if (userId === actor.id) return fail("Você não pode alterar os próprios cargos.");
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("Usuário não encontrado.");
    const before = await getUserRoles(userId, target.role);
    const requested = [...new Set(fd.getAll("roles").map(String).filter((r): r is Role => (VALID_ROLES as string[]).includes(r)))];
    if (requested.length === 0) return fail("Selecione pelo menos um cargo (mínimo: Aluno).");

    // Proteção do último administrador ativo
    if (before.includes("admin") && !requested.includes("admin")) {
      if (target.status === "ativo" && (await activeAdminCount(userId)) === 0) {
        return fail("Não é possível remover o cargo do último administrador ativo.");
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      await tx.insert(userRoles).values(requested.map((role) => ({ userId, role, assignedBy: actor.id })));
      // Compatibilidade: mantém users.role sincronizado com o cargo de maior prioridade
      await tx.update(users).set({ role: primaryRole(requested), updatedAt: new Date() }).where(eq(users.id, userId));
      if (requested.includes("professor")) {
        await tx.insert(teachers).values({ userId }).onConflictDoNothing();
      }
      if (!requested.includes("admin")) {
        // Permissões críticas não sobrevivem sem o cargo admin
        const critical = ["usuarios.gerenciar", "cargos.alterar", "sistema.configurar"];
        const overrides = await tx.select().from(userPermissions).where(eq(userPermissions.userId, userId));
        for (const o of overrides) {
          if (critical.includes(o.permission)) await tx.delete(userPermissions).where(eq(userPermissions.id, o.id));
        }
      }
    });

    await audit(actor.id, "cargos.alterados", "user", userId, {
      antes: before.map((r) => ROLE_LABEL[r]),
      depois: requested.map((r) => ROLE_LABEL[r]),
    });
    revalidatePath("/admin/usuarios");
    return ok(`Cargos de ${target.name} atualizados: ${requested.map((r) => ROLE_LABEL[r]).join(", ")}.`);
  } catch (err) {
    return errorToState(err);
  }
}

export async function setUserPermissionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const userId = str(fd, "userId");
    if (userId === actor.id) return fail("Você não pode alterar as próprias permissões.");
    const permission = str(fd, "permission");
    const effect = z.enum(["grant", "deny", "clear"]).parse(str(fd, "effect"));
    if (!isValidPermission(permission)) return fail("Permissão inválida.");
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("Usuário não encontrado.");
    const targetRoles = await getUserRoles(userId, target.role);

    if (effect === "clear") {
      await db.delete(userPermissions).where(and(eq(userPermissions.userId, userId), eq(userPermissions.permission, permission)));
    } else {
      if (effect === "grant" && !canGrantPermission(targetRoles, permission)) {
        return fail("Permissão crítica do sistema só pode ser concedida a contas com cargo Administrador.");
      }
      if (effect === "deny" && isCriticalPermission(permission) && targetRoles.includes("admin") && (await activeAdminCount(userId)) === 0) {
        return fail("Não é possível restringir permissões críticas do último administrador ativo.");
      }
      await db
        .insert(userPermissions)
        .values({ userId, permission, effect, grantedBy: actor.id })
        .onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { effect, grantedBy: actor.id } });
    }
    await audit(actor.id, "permissoes.alteradas", "user", userId, { permission, effect });
    revalidatePath("/admin/usuarios");
    return ok(effect === "clear" ? "Permissão personalizada removida (volta ao padrão dos cargos)." : effect === "grant" ? "Permissão concedida." : "Permissão restringida.");
  } catch (err) {
    return errorToState(err);
  }
}

/** Troca de função ativa sem logout — apenas cargos realmente atribuídos. */
export async function setActiveRoleAction(fd: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const role = str(fd, "role") as Role;
  if (!user.roles.includes(role)) redirect(homeForRole(primaryRole(user.roles)));
  await setActiveRoleCookie(role);
  redirect(homeForRole(role));
}