"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cohorts, courses } from "@/db/schema";
import { assertRole, ADMIN } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { limitAuth } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str } from "./types";

export async function deleteCourseSecureAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const id = str(fd, "id");
    const password = str(fd, "adminPassword");
    if (!z.string().uuid().safeParse(id).success) return fail("Curso inválido.");
    if (!password) return fail("Informe sua senha administrativa.");
    if (!(await limitAuth(`course-delete:${actor.id}`, 5))) return fail("Muitas tentativas. Aguarde antes de tentar novamente.");
    if (!actor.passwordHash) return fail("Sua conta não tem senha local. Defina uma senha antes de continuar.");
    if (!(await verifyPassword(actor.passwordHash, password))) return fail("Senha administrativa incorreta.");

    const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) return fail("Curso não encontrado.");
    const [cohort] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.courseId, id)).limit(1);

    if (cohort) {
      if (course.status === "arquivado") return fail("Este curso já está arquivado. Não é possível excluí-lo porque possui turmas vinculadas.");
      await db.update(courses).set({ status: "arquivado", featured: false, updatedAt: new Date() }).where(eq(courses.id, id));
      await audit(actor.id, "curso.arquivado_por_vinculos", "course", id, { name: course.name });
      revalidatePath("/admin/cursos");
      revalidatePath(`/admin/cursos/${id}`);
      revalidatePath("/cursos");
      revalidatePath("/");
      return ok("Curso arquivado. As turmas, matrículas e registros foram preservados.");
    }

    try {
      await db.delete(courses).where(eq(courses.id, id));
    } catch {
      return fail("Este curso possui outros vínculos e não pode ser excluído. Nenhum registro foi removido.");
    }
    await audit(actor.id, "curso.excluido", "course", id, { name: course.name, status: course.status });
    revalidatePath("/admin/cursos");
    revalidatePath("/cursos");
    revalidatePath("/");
    return ok("Curso excluído com sucesso.");
  } catch (error) {
    return errorToState(error);
  }
}
