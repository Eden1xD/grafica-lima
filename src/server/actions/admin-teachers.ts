"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cohortTeachers, cohorts, teachers, userRoles, users } from "@/db/schema";
import { assertRole, ADMIN, STAFF } from "@/lib/auth/guards";
import { getUserRoles, revokeUserSessions } from "@/lib/auth/session";
import { primaryRole } from "@/lib/permissions";
import { verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str } from "./types";

const editSchema = z.object({
  teacherId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  specialties: z.string().trim().max(500),
  bio: z.string().trim().max(5000),
  publicVisible: z.boolean(),
});

export async function updateTeacherAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const parsed = editSchema.safeParse({
      teacherId: str(fd, "teacherId"), name: str(fd, "name"), email: str(fd, "email"),
      specialties: str(fd, "specialties"), bio: str(fd, "bio"),
      publicVisible: str(fd, "publicVisible") === "on",
    });
    if (!parsed.success) return fail("Confira os dados do professor.");
    const { teacherId, name, email, specialties, bio, publicVisible } = parsed.data;
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
    if (!teacher) return fail("Professor não encontrado.");
    const [duplicate] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.email, email), ne(users.id, teacher.userId))).limit(1);
    if (duplicate) return fail("Este e-mail já está cadastrado.");
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name, email, updatedAt: new Date() }).where(eq(users.id, teacher.userId));
      await tx.update(teachers).set({ specialties, bio, publicVisible }).where(eq(teachers.id, teacherId));
    });
    await audit(actor.id, "pessoa.professor_editado", "user", teacher.userId, { teacherId, email });
    revalidatePath("/admin/professores");
    revalidatePath("/");
    return ok("Professor atualizado com sucesso.");
  } catch (error) { return errorToState(error); }
}

export async function deleteTeacherAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const teacherId = str(fd, "teacherId");
    const password = str(fd, "adminPassword");
    if (!z.string().uuid().safeParse(teacherId).success) return fail("Professor inválido.");
    if (!password) return fail("Informe sua senha administrativa.");
    if (!actor.passwordHash) return fail("Sua conta não possui senha local. Defina uma senha para confirmar exclusões.");
    if (!(await verifyPassword(actor.passwordHash, password))) return fail("Senha administrativa incorreta.");
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
    if (!teacher) return fail("Professor não encontrado.");
    if (teacher.userId === actor.id) return fail("Não é permitido remover seu próprio cargo de professor nesta tela.");
    const [primary] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.teacherId, teacherId)).limit(1);
    const [extra] = await db.select({ cohortId: cohortTeachers.cohortId }).from(cohortTeachers)
      .where(eq(cohortTeachers.teacherId, teacherId)).limit(1);
    if (primary || extra) return fail("Professor vinculado a turmas. Remova ou transfira os vínculos nas turmas antes de excluí-lo.");
    const [target] = await db.select().from(users).where(eq(users.id, teacher.userId)).limit(1);
    if (!target) return fail("Conta do professor não encontrada.");
    const roles = await getUserRoles(target.id, target.role);
    if (!roles.includes("professor")) return fail("O usuário não possui mais o cargo de professor.");
    const remaining = roles.filter((role) => role !== "professor");
    await db.transaction(async (tx) => {
      await tx.delete(teachers).where(eq(teachers.id, teacherId));
      await tx.delete(userRoles).where(and(eq(userRoles.userId, target.id), eq(userRoles.role, "professor")));
      if (remaining.length > 0) {
        await tx.update(users).set({ role: primaryRole(remaining), updatedAt: new Date() }).where(eq(users.id, target.id));
      } else {
        // Preserva a conta e os dados históricos. Um usuário sem outros cargos mantém papel legado aluno.
        await tx.insert(userRoles).values({ userId: target.id, role: "aluno", assignedBy: actor.id }).onConflictDoNothing();
        await tx.update(users).set({ role: "aluno", updatedAt: new Date() }).where(eq(users.id, target.id));
      }
    });
    await revokeUserSessions(target.id);
    await audit(actor.id, "pessoa.professor_removido", "user", target.id, { teacherId, email: target.email });
    revalidatePath("/admin/professores");
    revalidatePath("/admin/usuarios");
    revalidatePath("/");
    return ok("Cargo e cadastro de professor removidos. A conta do usuário foi preservada.");
  } catch (error) { return errorToState(error); }
}
