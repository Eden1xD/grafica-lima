"use server";

import { and, eq, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classrooms, cohortTeachers, cohorts, courseCategories, courses, teachers, users } from "@/db/schema";
import { assertRole, ADMIN, STAFF } from "@/lib/auth/guards";
import { getUserRoles } from "@/lib/auth/session";
import { ensureCohortSessions } from "@/lib/academic";
import { parseMoneyToCents, parseScoreToHundredths, slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

export async function saveCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const id = strOrNull(fd, "id");
    const name = str(fd, "name");
    if (name.length < 3) return fail("Informe o nome do curso.");
    const priceCents = parseMoneyToCents(str(fd, "price"));
    const entryCents = parseMoneyToCents(str(fd, "entry") || "0");
    if (priceCents === null || priceCents <= 0) return fail("Preço inválido.");
    if (entryCents === null || entryCents >= priceCents) return fail("Entrada deve ser menor que o valor total.");
    const minGradeH = parseScoreToHundredths(str(fd, "minGrade") || "7");
    const values = {
      name,
      categoryId: strOrNull(fd, "categoryId"),
      shortDescription: str(fd, "shortDescription"),
      description: str(fd, "description"),
      imageUrl: strOrNull(fd, "imageUrl"),
      workloadHours: z.coerce.number().int().min(1).max(2000).parse(str(fd, "workloadHours") || "40"),
      durationMonths: z.coerce.number().int().min(1).max(36).parse(str(fd, "durationMonths") || "3"),
      priceCents,
      entryCents,
      maxInstallments: z.coerce.number().int().min(1).max(12).parse(str(fd, "maxInstallments") || "4"),
      minAttendancePct: z.coerce.number().int().min(0).max(100).parse(str(fd, "minAttendancePct") || "75"),
      minGradeH: minGradeH ?? 700,
      prerequisites: str(fd, "prerequisites"),
      syllabus: str(fd, "syllabus"),
      materials: str(fd, "materials"),
      certificateEnabled: str(fd, "certificateEnabled") === "on",
      featured: str(fd, "featured") === "on",
      status: z.enum(["rascunho", "publicado", "arquivado"]).parse(str(fd, "status") || "rascunho"),
      updatedAt: new Date(),
    };
    let courseId: string;
    if (id) {
      await db.update(courses).set(values).where(eq(courses.id, id));
      courseId = id;
    } else {
      let slug = slugify(name);
      const [dup] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1);
      if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const [created] = await db.insert(courses).values({ ...values, slug }).returning();
      courseId = created.id;
    }
    await audit(actor.id, id ? "curso.editado" : "curso.criado", "course", courseId, { name, status: values.status });
    revalidatePath("/cursos");
    revalidatePath("/admin/cursos");
    revalidatePath("/");
    return ok("Curso salvo.", { id: courseId });
  } catch (err) {
    return errorToState(err);
  }
}

export async function createCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const name = str(fd, "name");
    if (name.length < 2) return fail("Nome da categoria inválido.");
    await db.insert(courseCategories).values({ name, slug: slugify(name) }).onConflictDoNothing();
    await audit(actor.id, "curso.categoria_criada", "category", name);
    revalidatePath("/admin/cursos");
    return ok("Categoria criada.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function createClassroomAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const name = str(fd, "name");
    if (name.length < 2) return fail("Nome da sala inválido.");
    const capacity = z.coerce.number().int().min(1).max(200).parse(str(fd, "capacity") || "20");
    await db.insert(classrooms).values({ name, capacity }).onConflictDoNothing();
    await audit(actor.id, "curso.sala_criada", "classroom", name);
    revalidatePath("/admin/turmas");
    return ok("Sala criada.");
  } catch (err) {
    return errorToState(err);
  }
}

const cohortSchema = z.object({
  name: z.string().min(2, "Informe o nome da turma.").max(80),
  courseId: z.string().uuid("Curso inválido."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inicial inválido."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário final inválido."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida."),
  capacity: z.coerce.number().int().min(1).max(200),
  status: z.enum(["aberta", "em_andamento", "encerrada", "cancelada"]),
});

export async function saveCohortAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const id = strOrNull(fd, "id");
    const input = cohortSchema.parse({
      name: str(fd, "name"),
      courseId: str(fd, "courseId"),
      startTime: str(fd, "startTime"),
      endTime: str(fd, "endTime"),
      startDate: str(fd, "startDate"),
      endDate: str(fd, "endDate"),
      capacity: str(fd, "capacity") || "15",
      status: str(fd, "status") || "aberta",
    });
    if (input.endTime <= input.startTime) return fail("Horário final deve ser depois do inicial.");
    if (input.endDate <= input.startDate) return fail("Data final deve ser depois da inicial.");
    const daysOfWeek = fd.getAll("days").map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (daysOfWeek.length === 0) return fail("Selecione pelo menos um dia da semana.");
    const teacherIds = [...new Set(fd.getAll("teacherIds").map(String).filter(Boolean))];
    const primaryTeacherId = strOrNull(fd, "primaryTeacherId");
    const roomId = strOrNull(fd, "roomId");
    if (primaryTeacherId && !teacherIds.includes(primaryTeacherId)) return fail("O professor principal deve estar entre os selecionados.");

    // Valida professores: existem e possuem o cargo professor ativo
    const teacherRows = teacherIds.length
      ? await db.select({ id: teachers.id, userId: teachers.userId, name: users.name }).from(teachers).innerJoin(users, eq(users.id, teachers.userId)).where(inArray(teachers.id, teacherIds))
      : [];
    if (teacherRows.length !== teacherIds.length) return fail("Professor inválido na seleção.");
    for (const t of teacherRows) {
      const roles = await getUserRoles(t.userId);
      if (!roles.includes("professor")) return fail(`${t.name} não possui o cargo Professor. Atribua o cargo antes de vincular.`);
    }
    const teacherId = primaryTeacherId ?? teacherIds[0] ?? null;

    // Conflitos de professores e sala: mesma janela de datas + dia comum + horário sobreposto
    const candidates = await db
      .select()
      .from(cohorts)
      .where(and(inArray(cohorts.status, ["aberta", "em_andamento"]), ...(id ? [ne(cohorts.id, id)] : [])));
    const allAssignments = await db.select().from(cohortTeachers);
    const nameOf = new Map(teacherRows.map((t) => [t.id, t.name]));
    for (const c of candidates) {
      const dateOverlap = c.startDate <= input.endDate && input.startDate <= c.endDate;
      const dayOverlap = c.daysOfWeek.some((d) => daysOfWeek.includes(d));
      const timeOverlap = c.startTime < input.endTime && input.startTime < c.endTime;
      if (!(dateOverlap && dayOverlap && timeOverlap)) continue;
      const cTeachers = new Set([c.teacherId, ...allAssignments.filter((a) => a.cohortId === c.id).map((a) => a.teacherId)].filter(Boolean) as string[]);
      const clash = teacherIds.find((t) => cTeachers.has(t));
      if (clash) return fail(`Conflito: ${nameOf.get(clash) ?? "um dos professores"} já tem a turma "${c.name}" nesse horário.`);
      if (roomId && c.roomId === roomId) return fail(`Conflito: a sala já está ocupada pela turma "${c.name}" nesse horário.`);
    }

    const values = { ...input, daysOfWeek, teacherId, roomId };
    let cohortId: string;
    if (id) {
      await db.update(cohorts).set(values).where(eq(cohorts.id, id));
      cohortId = id;
    } else {
      const [created] = await db.insert(cohorts).values(values).returning();
      cohortId = created.id;
    }
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
    await ensureCohortSessions(cohort);
    // Sincroniza vínculos múltiplos mantendo exatamente um principal
    await db.delete(cohortTeachers).where(eq(cohortTeachers.cohortId, cohortId));
    if (teacherIds.length > 0) {
      await db.insert(cohortTeachers).values(teacherIds.map((t) => ({ cohortId, teacherId: t, isPrimary: t === teacherId })));
    }
    await audit(actor.id, id ? "turma.editada" : "turma.criada", "cohort", cohortId, { name: input.name, professores: teacherRows.map((t) => t.name), principal: teacherId });
    revalidatePath("/cursos");
    revalidatePath(`/admin/cursos/${input.courseId}`);
    revalidatePath("/admin/turmas");
    return ok("Turma salva e aulas geradas no calendário.", { id: cohortId });
  } catch (err) {
    return errorToState(err);
  }
}

export async function deleteDraftCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const id = str(fd, "id");
    const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) return fail("Curso não encontrado.");
    if (course.status !== "rascunho") return fail("Somente rascunhos podem ser excluídos. Arquive o curso publicado.");
    const [cohort] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.courseId, id)).limit(1);
    if (cohort) return fail("Este rascunho já possui turmas. Exclua as turmas primeiro.");
    await db.delete(courses).where(eq(courses.id, id));
    await audit(actor.id, "curso.excluido", "course", id, { name: course.name });
    revalidatePath("/admin/cursos");
    return ok("Rascunho excluído.");
  } catch (err) {
    return errorToState(err);
  }
}