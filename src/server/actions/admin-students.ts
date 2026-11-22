"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { enrollments, studentProfiles, userRoles, users } from "@/db/schema";
import { assertRole, ADMIN, STAFF } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { getUserRoles, revokeUserSessions } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { limitAuth } from "@/lib/auth/rate-limit";
import { type ActionState, errorToState, fail, ok, str } from "./types";

const studentSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().max(30),
  city: z.string().trim().max(120),
});

export async function updateStudentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const parsed = studentSchema.safeParse({
      userId: str(fd, "userId"), name: str(fd, "name"), email: str(fd, "email"),
      phone: str(fd, "phone"), city: str(fd, "city"),
    });
    if (!parsed.success) return fail("Confira os dados do aluno.");
    const { userId, name, email, phone, city } = parsed.data;
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("Aluno não encontrado.");
    const roles = await getUserRoles(target.id, target.role);
    if (!roles.includes("aluno")) return fail("Este usuário não possui o cargo de aluno.");
    const [duplicate] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, email)).limit(1);
    if (duplicate && duplicate.id !== userId) return fail("Este e-mail já está cadastrado.");
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name, email, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.insert(studentProfiles).values({ userId, phone: phone || null, city: city || null })
        .onConflictDoUpdate({ target: studentProfiles.userId, set: { phone: phone || null, city: city || null, updatedAt: new Date() } });
    });
    await audit(actor.id, "pessoa.aluno_editado", "user", userId, { email });
    revalidatePath("/admin/alunos");
    return ok("Dados do aluno atualizados.");
  } catch (error) { return errorToState(error); }
}

export async function deleteStudentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const userId = str(fd, "userId");
    const password = str(fd, "adminPassword");
    if (!z.string().uuid().safeParse(userId).success) return fail("Aluno inválido.");
    if (userId === actor.id) return fail("Não é permitido excluir a própria conta.");
    if (!password) return fail("Digite sua senha administrativa.");
    if (!(await limitAuth(`student-delete:${actor.id}`, 5))) return fail("Muitas tentativas. Aguarde antes de tentar novamente.");
    if (!actor.passwordHash) return fail("Sua conta não possui senha local. Defina uma senha antes de excluir alunos.");
    if (!(await verifyPassword(actor.passwordHash, password))) return fail("Senha administrativa incorreta.");

    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("Aluno não encontrado.");
    const roles = await getUserRoles(target.id, target.role);
    if (!roles.includes("aluno")) return fail("Este usuário não é aluno.");
    if (roles.some((role) => role !== "aluno")) return fail("Esta conta possui outros cargos. Gerencie os cargos em Administração > Usuários.");

    const [enrollment] = await db.select({ id: enrollments.id }).from(enrollments)
      .where(eq(enrollments.userId, userId)).limit(1);
    if (enrollment) {
      await db.update(users).set({ status: "bloqueado", updatedAt: new Date() }).where(eq(users.id, userId));
      await revokeUserSessions(userId);
      await audit(actor.id, "pessoa.aluno_bloqueado_preservando_historico", "user", userId);
      revalidatePath("/admin/alunos");
      return ok("Aluno bloqueado. Matrículas e histórico financeiro foram preservados.");
    }

    // Demais referências podem restringir a exclusão; nunca remover registros acadêmicos/financeiros em cascata intencionalmente.
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch {
      return fail("A conta possui outros vínculos no sistema e não pode ser excluída. Nenhum histórico foi apagado.");
    }
    await audit(actor.id, "pessoa.aluno_excluido", "user", userId, { email: target.email });
    revalidatePath("/admin/alunos");
    return ok("Conta do aluno excluída.");
  } catch (error) { return errorToState(error); }
}
