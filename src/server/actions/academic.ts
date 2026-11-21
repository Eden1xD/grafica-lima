"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  activities, attendanceRecords, certificates, classSessions, cohortTeachers, cohorts, courses, enrollments,
  gradeHistory, grades, teachers,
} from "@/db/schema";
import { assertRole, AuthzError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { attendanceForEnrollment, overallAverageH, roster } from "@/lib/academic";
import { certificateEligibility } from "@/lib/domain";
import { parseScoreToHundredths } from "@/lib/utils";
import { randomCode } from "@/lib/crypto";
import { notify, userIdsByRole } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str } from "./types";

async function assertCohortAccess(user: SessionUser, cohortId: string) {
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) throw new AuthzError("Turma não encontrada.");
  if (user.roles.includes("admin") || user.roles.includes("secretaria")) return cohort;
  // Professor precisa do cargo ativo E do vínculo com a turma (histórico preservado ao perder o cargo)
  if (user.roles.includes("professor")) {
    const [t] = await db.select().from(teachers).where(eq(teachers.userId, user.id)).limit(1);
    if (t) {
      if (cohort.teacherId === t.id) return cohort;
      const [link] = await db
        .select({ id: cohortTeachers.id })
        .from(cohortTeachers)
        .where(and(eq(cohortTeachers.cohortId, cohortId), eq(cohortTeachers.teacherId, t.id)))
        .limit(1);
      if (link) return cohort;
    }
  }
  throw new AuthzError("Você não tem acesso a esta turma.");
}

export async function createActivityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["admin", "secretaria", "professor"]);
    const cohortId = str(fd, "cohortId");
    await assertCohortAccess(user, cohortId);
    const title = str(fd, "title");
    if (title.length < 3) return fail("Informe o título da atividade.");
    const type = z.enum(["prova", "trabalho", "projeto", "pratica", "atividade", "recuperacao"]).parse(str(fd, "type"));
    const maxScoreH = parseScoreToHundredths(str(fd, "maxScore") || "10");
    const weightH = parseScoreToHundredths(str(fd, "weight") || "1");
    if (!maxScoreH || maxScoreH <= 0 || !weightH || weightH <= 0) return fail("Valor máximo e peso devem ser maiores que zero.");
    const dueDate = str(fd, "dueDate");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fail("Informe a data da atividade.");
    const [a] = await db
      .insert(activities)
      .values({
        cohortId, title, type,
        subject: str(fd, "subject") || "Geral",
        description: str(fd, "description"),
        dueDate, maxScoreH, weightH,
        status: str(fd, "publish") === "on" ? "publicada" : "rascunho",
        createdBy: user.id,
      })
      .returning();
    if (a.status === "publicada") {
      const students = await roster(cohortId);
      await notify(students.map((s) => s.userId), { type: "atividade", title: "Nova atividade publicada", body: `${a.title} — confira prazos no portal.`, link: "/aluno" });
    }
    await audit(user.id, "academico.atividade_criada", "activity", a.id, { title, type, status: a.status });
    revalidatePath(`/professor/turmas/${cohortId}`);
    revalidatePath(`/admin/turmas/${cohortId}`);
    return ok(a.status === "publicada" ? "Atividade criada e publicada." : "Atividade salva como rascunho.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function publishActivityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["admin", "secretaria", "professor"]);
    const id = str(fd, "id");
    const [a] = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
    if (!a) return fail("Atividade não encontrada.");
    await assertCohortAccess(user, a.cohortId);
    if (a.status === "publicada") return ok("Atividade já publicada.");
    await db.update(activities).set({ status: "publicada" }).where(eq(activities.id, id));
    const students = await roster(a.cohortId);
    await notify(students.map((s) => s.userId), { type: "atividade", title: "Nova atividade publicada", body: `${a.title} — confira prazos no portal.`, link: "/aluno" });
    await audit(user.id, "academico.atividade_publicada", "activity", id);
    revalidatePath(`/professor/turmas/${a.cohortId}`);
    return ok("Atividade publicada e alunos notificados.");
  } catch (err) {
    return errorToState(err);
  }
}

/** Lançamento de notas em lote: rascunho ou publicação, com histórico de correções. */
export async function saveGradesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["admin", "secretaria", "professor"]);
    const activityId = str(fd, "activityId");
    const publish = str(fd, "publish") === "on";
    const reason = str(fd, "reason");
    const [a] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!a) return fail("Atividade não encontrada.");
    await assertCohortAccess(user, a.cohortId);
    const students = await roster(a.cohortId);
    const validIds = new Set(students.map((s) => s.enrollmentId));
    const existing = await db.select().from(grades).where(eq(grades.activityId, activityId));
    const existingMap = new Map(existing.map((g) => [g.enrollmentId, g]));
    const notified: string[] = [];
    let changed = 0;

    for (const s of students) {
      const raw = fd.get(`g:${s.enrollmentId}`);
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      if (!validIds.has(s.enrollmentId)) continue;
      const prev = existingMap.get(s.enrollmentId);
      let scoreH: number | null = null;
      let kind: "nota" | "ausente" | "nao_entregue" = "nota";
      if (value === "ausente") kind = "ausente";
      else if (value === "nao_entregue") kind = "nao_entregue";
      else if (value !== "") {
        scoreH = parseScoreToHundredths(value);
        if (scoreH === null || scoreH > a.maxScoreH) return fail(`Nota inválida para ${s.name} (máximo ${a.maxScoreH / 100}).`);
      } else if (!prev) continue;

      const wasPublished = prev?.publishedAt != null;
      const scoreChanged = prev && (prev.scoreH !== scoreH || prev.kind !== kind);
      if (wasPublished && scoreChanged) {
        if (reason.length < 5) return fail("Correções de notas publicadas exigem justificativa (mín. 5 caracteres).");
        await db.insert(gradeHistory).values({ gradeId: prev.id, oldScoreH: prev.scoreH, newScoreH: scoreH, reason, changedBy: user.id });
      }
      const publishedAt = publish ? new Date() : prev?.publishedAt ?? null;
      if (prev) {
        await db.update(grades).set({ scoreH, kind, publishedAt, note: str(fd, `n:${s.enrollmentId}`) || prev.note, updatedBy: user.id, updatedAt: new Date() }).where(eq(grades.id, prev.id));
      } else {
        await db.insert(grades).values({ activityId, enrollmentId: s.enrollmentId, scoreH, kind, publishedAt, note: str(fd, `n:${s.enrollmentId}`) || null, updatedBy: user.id });
      }
      changed++;
      if (publish && !wasPublished) notified.push(s.userId);
    }
    if (publish && a.status !== "publicada") await db.update(activities).set({ status: "publicada" }).where(eq(activities.id, activityId));
    if (notified.length > 0) {
      await notify(notified, { type: "nota", title: "Nova nota publicada", body: "Suas notas foram atualizadas. Acesse o portal para ver.", link: "/aluno/notas" });
    }
    await audit(user.id, publish ? "academico.notas_publicadas" : "academico.notas_rascunho", "activity", activityId, { changed, reason: reason || undefined });
    revalidatePath(`/professor/turmas/${a.cohortId}`);
    revalidatePath(`/admin/turmas/${a.cohortId}`);
    return ok(publish ? `Notas publicadas (${changed} registros). Alunos notificados.` : `Rascunho salvo (${changed} registros).`);
  } catch (err) {
    return errorToState(err);
  }
}

export async function saveAttendanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["admin", "secretaria", "professor"]);
    const sessionId = str(fd, "sessionId");
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1);
    if (!session) return fail("Aula não encontrada.");
    await assertCohortAccess(user, session.cohortId);
    const students = await roster(session.cohortId);
    const existing = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sessionId));
    const map = new Map(existing.map((r) => [r.enrollmentId, r]));
    const reason = str(fd, "reason");
    let corrections = 0;
    for (const s of students) {
      const raw = fd.get(`a:${s.enrollmentId}`);
      if (typeof raw !== "string" || !["presente", "ausente", "justificado"].includes(raw)) continue;
      const status = raw as "presente" | "ausente" | "justificado";
      const prev = map.get(s.enrollmentId);
      if (prev) {
        if (prev.status !== status) {
          corrections++;
          if (reason.length < 5) return fail("Correção de chamada exige justificativa (mín. 5 caracteres).");
        }
        await db.update(attendanceRecords).set({ status, recordedBy: user.id, note: reason || prev.note, updatedAt: new Date() }).where(eq(attendanceRecords.id, prev.id));
      } else {
        await db.insert(attendanceRecords).values({ sessionId, enrollmentId: s.enrollmentId, status, recordedBy: user.id, note: reason || null });
      }
    }
    if (str(fd, "conclude") === "on" && session.status === "agendada") {
      await db.update(classSessions).set({ status: "concluida" }).where(eq(classSessions.id, sessionId));
    }
    await audit(user.id, "academico.chamada_registrada", "class_session", sessionId, { corrections, reason: reason || undefined });
    revalidatePath(`/professor/turmas/${session.cohortId}`);
    revalidatePath(`/admin/turmas/${session.cohortId}`);
    return ok("Chamada salva.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function updateSessionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertRole(["admin", "secretaria", "professor"]);
    const sessionId = str(fd, "sessionId");
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1);
    if (!session) return fail("Aula não encontrada.");
    await assertCohortAccess(user, session.cohortId);
    const status = z.enum(["agendada", "concluida", "cancelada"]).parse(str(fd, "status"));
    const date = str(fd, "date") || session.date;
    const startTime = str(fd, "startTime") || session.startTime;
    const endTime = str(fd, "endTime") || session.endTime;
    const rescheduled = date !== session.date || startTime !== session.startTime;
    await db.update(classSessions).set({ status, date, startTime, endTime, topic: str(fd, "topic") || null }).where(eq(classSessions.id, sessionId));
    if (status === "cancelada" || rescheduled) {
      const students = await roster(session.cohortId);
      await notify(students.map((s) => s.userId), {
        type: "aula",
        title: status === "cancelada" ? "Aula cancelada" : "Aula remarcada",
        body: status === "cancelada" ? "Uma aula da sua turma foi cancelada. Veja o calendário." : "Uma aula da sua turma mudou de horário. Veja o calendário.",
        link: "/aluno",
      });
    }
    await audit(user.id, "academico.aula_atualizada", "class_session", sessionId, { status, date, rescheduled });
    revalidatePath(`/professor/turmas/${session.cohortId}`);
    revalidatePath(`/admin/turmas/${session.cohortId}`);
    return ok("Aula atualizada.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function concludeEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "secretaria"]);
    const enrollmentId = str(fd, "enrollmentId");
    const override = str(fd, "override") === "on";
    const reason = str(fd, "reason");
    const [row] = await db
      .select({ e: enrollments, course: courses })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    if (!row) return fail("Matrícula não encontrada.");
    if (row.e.status !== "ativa" && row.e.status !== "trancada") return fail("Somente matrículas ativas/trancadas podem ser concluídas.");
    const avgH = await overallAverageH(enrollmentId);
    const att = await attendanceForEnrollment(enrollmentId);
    const check = certificateEligibility({ concluded: true, avgH, minGradeH: row.course.minGradeH, attendancePct: att.stats.pct, minAttendancePct: row.course.minAttendancePct });
    if (!check.eligible && !override) return fail(`Requisitos não cumpridos: ${check.reasons.join(" ")}`);
    if (!check.eligible && override && reason.length < 5) return fail("Conclusão manual sem requisitos exige justificativa.");
    await db.update(enrollments).set({ status: "concluida", concludedAt: new Date() }).where(eq(enrollments.id, enrollmentId));
    await audit(actor.id, "academico.matricula_concluida", "enrollment", enrollmentId, { override, reason: reason || undefined, avgH, attendancePct: att.stats.pct });
    await notify(row.e.userId, { type: "academico", title: "Curso concluído 🎓", body: "Parabéns! Sua matrícula foi concluída. O certificado será avaliado pela secretaria.", link: "/aluno/certificados" });
    revalidatePath("/admin/matriculas");
    return ok("Matrícula concluída.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function issueCertificateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "secretaria"]);
    const enrollmentId = str(fd, "enrollmentId");
    const [row] = await db
      .select({ e: enrollments, course: courses })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    if (!row) return fail("Matrícula não encontrada.");
    if (!row.course.certificateEnabled) return fail("Este curso não emite certificado.");
    if (row.e.status !== "concluida") return fail("Conclua a matrícula antes de emitir o certificado.");
    const [existing] = await db.select().from(certificates).where(eq(certificates.enrollmentId, enrollmentId)).limit(1);
    if (existing) return fail("Certificado já emitido para esta matrícula.");
    const avgH = await overallAverageH(enrollmentId);
    const att = await attendanceForEnrollment(enrollmentId);
    const code = randomCode(12);
    const [cert] = await db
      .insert(certificates)
      .values({ enrollmentId, code, workloadHours: row.course.workloadHours, finalGradeH: avgH, attendancePct: att.stats.pct, issuedBy: actor.id })
      .returning();
    await audit(actor.id, "academico.certificado_emitido", "certificate", cert.id, { code });
    await notify(row.e.userId, { type: "certificado", title: "Certificado disponível 🎓", body: "Seu certificado digital já pode ser baixado no portal.", link: "/aluno/certificados" });
    revalidatePath("/admin/certificados");
    return ok(`Certificado emitido. Código: ${code}`);
  } catch (err) {
    return errorToState(err);
  }
}

export async function requestGradeReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { getSessionUser } = await import("@/lib/auth/session");
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const gradeId = str(fd, "gradeId");
    const reason = str(fd, "reason");
    if (reason.length < 5) return fail("Descreva o motivo da revisão.");
    const [row] = await db
      .select({ g: grades, e: enrollments, a: activities, cohort: cohorts })
      .from(grades)
      .innerJoin(enrollments, eq(enrollments.id, grades.enrollmentId))
      .innerJoin(activities, eq(activities.id, grades.activityId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .where(eq(grades.id, gradeId))
      .limit(1);
    if (!row || row.e.userId !== user.id || !row.g.publishedAt) return fail("Nota não encontrada.");
    const targets: string[] = [];
    if (row.cohort.teacherId) {
      const [t] = await db.select({ userId: teachers.userId }).from(teachers).where(eq(teachers.id, row.cohort.teacherId)).limit(1);
      if (t) targets.push(t.userId);
    }
    targets.push(...(await userIdsByRole(["admin", "secretaria"])));
    await notify([...new Set(targets)], { type: "revisao", title: "Solicitação de revisão de nota", body: `${row.a.title} — aluno solicitou revisão.`, link: `/professor/turmas/${row.cohort.id}` });
    await audit(user.id, "academico.revisao_solicitada", "grade", gradeId, { reason });
    return ok("Solicitação de revisão enviada ao professor.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function revokeCertificateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin"]);
    const id = str(fd, "id");
    const reason = str(fd, "reason");
    if (reason.length < 5) return fail("Informe o motivo da revogação.");
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
    if (!cert) return fail("Certificado não encontrado.");
    if (cert.revokedAt) return fail("Certificado já revogado.");
    await db.update(certificates).set({ revokedAt: new Date(), revokeReason: reason }).where(eq(certificates.id, id));
    await audit(actor.id, "academico.certificado_revogado", "certificate", id, { reason });
    revalidatePath("/admin/certificados");
    return ok("Certificado revogado.");
  } catch (err) {
    return errorToState(err);
  }
}