"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { authTokens, cohorts, courses, enrollments, installments, leads, payments, privacyRequests, teachers, userRoles, users } from "@/db/schema";
import { assertRole, ADMIN, STAFF } from "@/lib/auth/guards";
import { getUserRoles, revokeUserSessions } from "@/lib/auth/session";
import { primaryRole } from "@/lib/permissions";
import { takenSeats } from "@/lib/payments/core";
import { splitInstallments } from "@/lib/domain";
import { addMonthsISO } from "@/lib/utils";
import { hashToken, randomToken } from "@/lib/crypto";
import { sendEmail, emailTemplate } from "@/lib/email";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/request";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

async function sendSetupEmail(userId: string, email: string): Promise<void> {
  const token = randomToken();
  await db.insert(authTokens).values({ userId, type: "recuperar_senha", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) });
  const url = `${await baseUrl()}/recuperar-senha/${token}`;
  await sendEmail(email, "Defina sua senha — Gráfica Lima", emailTemplate("Sua conta foi criada", "A secretaria da Gráfica Lima criou sua conta na plataforma. Defina sua senha para acessar.", { label: "Definir senha", url }));
}

export async function createStudentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    if (name.length < 3) return fail("Informe o nome completo.");
    if (!z.string().email().safeParse(email).success) return fail("E-mail inválido.");
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (dup) return fail("Este e-mail já possui cadastro.");
    const [user] = await db.insert(users).values({ name, email, role: "aluno" }).returning();
    await db.insert(userRoles).values({ userId: user.id, role: "aluno", assignedBy: actor.id }).onConflictDoNothing();
    await sendSetupEmail(user.id, email);
    await audit(actor.id, "pessoa.aluno_criado", "user", user.id, { email });
    revalidatePath("/admin/alunos");
    return ok("Aluno cadastrado. E-mail de definição de senha enviado.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function createTeacherAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    if (name.length < 3) return fail("Informe o nome completo.");
    if (!z.string().email().safeParse(email).success) return fail("E-mail inválido.");
    let userId: string;
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      userId = existing.id;
      const roles = await getUserRoles(userId, existing.role);
      if (!roles.includes("professor")) {
        // Adiciona o cargo professor SEM remover os cargos existentes
        await db.insert(userRoles).values(roles.map((role) => ({ userId, role }))).onConflictDoNothing();
        await db.insert(userRoles).values({ userId, role: "professor", assignedBy: actor.id }).onConflictDoNothing();
        await db.update(users).set({ role: primaryRole([...roles, "professor"]) }).where(eq(users.id, userId));
        await audit(actor.id, "cargos.alterados", "user", userId, { adicionado: "professor", anteriores: roles });
      }
    } else {
      const [created] = await db.insert(users).values({ name, email, role: "professor" }).returning();
      userId = created.id;
      await db.insert(userRoles).values({ userId, role: "professor", assignedBy: actor.id }).onConflictDoNothing();
      await sendSetupEmail(userId, email);
    }
    await db
      .insert(teachers)
      .values({ userId, bio: str(fd, "bio"), specialties: str(fd, "specialties"), publicVisible: str(fd, "publicVisible") === "on" })
      .onConflictDoUpdate({ target: teachers.userId, set: { bio: str(fd, "bio"), specialties: str(fd, "specialties"), publicVisible: str(fd, "publicVisible") === "on" } });
    await audit(actor.id, "pessoa.professor_salvo", "user", userId);
    revalidatePath("/admin/professores");
    return ok("Professor salvo.");
  } catch (err) {
    return errorToState(err);
  }
}

// setUserRoleAction substituído por setUserRolesAction (múltiplos cargos) em ./roles.ts

export async function toggleUserStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const userId = str(fd, "userId");
    if (userId === actor.id) return fail("Você não pode bloquear a própria conta.");
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("Usuário não encontrado.");
    const status = target.status === "ativo" ? "bloqueado" : "ativo";
    await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
    if (status === "bloqueado") await revokeUserSessions(userId);
    await audit(actor.id, "pessoa.status_alterado", "user", userId, { status });
    revalidatePath("/admin/usuarios");
    return ok(status === "bloqueado" ? "Usuário bloqueado e sessões revogadas." : "Usuário reativado.");
  } catch (err) {
    return errorToState(err);
  }
}

/** Matrícula criada pela secretaria para um aluno. */
export async function staffCreateEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const userId = str(fd, "userId");
    const cohortId = str(fd, "cohortId");
    const plan = z.enum(["integral", "mensal"]).parse(str(fd, "plan") || "integral");
    const [student] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!student) return fail("Aluno não encontrado.");
    const [ctx] = await db
      .select({ cohort: cohorts, course: courses })
      .from(cohorts)
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(cohorts.id, cohortId))
      .limit(1);
    if (!ctx) return fail("Turma não encontrada.");
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(cohorts).where(eq(cohorts.id, cohortId)).for("update");
      const taken = await takenSeats(cohortId, tx);
      if (taken >= locked.capacity) throw new Error("Turma lotada.");
      const [dup] = await tx.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.cohortId, cohortId), ne(enrollments.status, "cancelada"))).limit(1);
      if (dup) throw new Error("Aluno já matriculado nesta turma.");
      const [e] = await tx
        .insert(enrollments)
        .values({ userId, cohortId, plan, totalCents: ctx.course.priceCents, contractVersion: "presencial", pendingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .returning();
      if (plan === "integral") {
        await tx.insert(payments).values({ enrollmentId: e.id, kind: "integral", method: "dinheiro", provider: "manual", amountCents: ctx.course.priceCents, recordedBy: actor.id });
      } else {
        const split = splitInstallments(ctx.course.priceCents, ctx.course.entryCents, ctx.course.maxInstallments);
        const inst = await tx
          .insert(installments)
          .values(split.installments.map((amount, i) => ({ enrollmentId: e.id, number: i + 1, dueDate: addMonthsISO(ctx.cohort.startDate, i), amountCents: amount })))
          .returning();
        const entryAmount = split.entryCents > 0 ? split.entryCents : inst[0].amountCents;
        await tx.insert(payments).values({ enrollmentId: e.id, kind: "matricula", method: "dinheiro", provider: "manual", amountCents: entryAmount, installmentId: split.entryCents > 0 ? null : inst[0].id, recordedBy: actor.id });
      }
    });
    await audit(actor.id, "matricula.criada_secretaria", "enrollment", cohortId, { userId, plan });
    await notify(userId, { type: "matricula", title: "Matrícula registrada pela secretaria", body: "Sua matrícula foi criada. Regularize o pagamento para ativá-la.", link: "/aluno/financeiro" });
    revalidatePath("/admin/matriculas");
    return ok("Matrícula criada. Registre o pagamento para ativá-la.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function cancelEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const enrollmentId = str(fd, "enrollmentId");
    const reason = str(fd, "reason");
    if (reason.length < 5) return fail("Informe o motivo do cancelamento.");
    const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
    if (!e) return fail("Matrícula não encontrada.");
    if (e.status === "cancelada") return fail("Matrícula já cancelada.");
    await db.update(enrollments).set({ status: "cancelada", cancelledAt: new Date(), cancelReason: reason }).where(eq(enrollments.id, enrollmentId));
    await db.update(payments).set({ status: "cancelado", updatedAt: new Date() }).where(and(eq(payments.enrollmentId, enrollmentId), eq(payments.status, "pendente")));
    await db.update(installments).set({ status: "cancelada" }).where(and(eq(installments.enrollmentId, enrollmentId), eq(installments.status, "pendente")));
    await audit(actor.id, "matricula.cancelada", "enrollment", enrollmentId, { reason });
    await notify(e.userId, { type: "matricula", title: "Matrícula cancelada", body: "Sua matrícula foi cancelada pela secretaria. Dúvidas? Fale conosco.", link: "/aluno/financeiro" });
    revalidatePath("/admin/matriculas");
    return ok("Matrícula cancelada e cobranças pendentes baixadas.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function toggleLockEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const enrollmentId = str(fd, "enrollmentId");
    const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
    if (!e) return fail("Matrícula não encontrada.");
    if (e.status !== "ativa" && e.status !== "trancada") return fail("Somente matrículas ativas podem ser trancadas (e vice-versa).");
    const status = e.status === "ativa" ? "trancada" : "ativa";
    await db.update(enrollments).set({ status }).where(eq(enrollments.id, enrollmentId));
    await audit(actor.id, "matricula.trancamento", "enrollment", enrollmentId, { status });
    await notify(e.userId, { type: "matricula", title: status === "trancada" ? "Matrícula trancada" : "Matrícula reativada", link: "/aluno" });
    revalidatePath("/admin/matriculas");
    return ok(status === "trancada" ? "Matrícula trancada." : "Matrícula reativada.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function transferEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const enrollmentId = str(fd, "enrollmentId");
    const targetCohortId = str(fd, "targetCohortId");
    const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
    if (!e || e.status === "cancelada" || e.status === "concluida") return fail("Matrícula inválida para transferência.");
    const [from] = await db.select().from(cohorts).where(eq(cohorts.id, e.cohortId)).limit(1);
    const [to] = await db.select().from(cohorts).where(eq(cohorts.id, targetCohortId)).limit(1);
    if (!to) return fail("Turma de destino não encontrada.");
    if (from.courseId !== to.courseId) return fail("Transferência permitida apenas entre turmas do mesmo curso.");
    const taken = await takenSeats(targetCohortId);
    if (taken >= to.capacity) return fail("Turma de destino lotada.");
    await db.update(enrollments).set({ cohortId: targetCohortId }).where(eq(enrollments.id, enrollmentId));
    await audit(actor.id, "matricula.transferida", "enrollment", enrollmentId, { de: from.name, para: to.name });
    await notify(e.userId, { type: "matricula", title: "Você foi transferido de turma", body: `Nova turma: ${to.name}. Confira o calendário.`, link: "/aluno" });
    revalidatePath("/admin/matriculas");
    return ok("Transferência realizada.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function updateLeadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(STAFF);
    const id = str(fd, "id");
    const status = z.enum(["novo", "em_contato", "proposta", "convertido", "perdido"]).parse(str(fd, "status"));
    await db.update(leads).set({ status, notes: strOrNull(fd, "notes"), updatedAt: new Date() }).where(eq(leads.id, id));
    await audit(actor.id, "comercial.lead_atualizado", "lead", id, { status });
    revalidatePath("/admin/leads");
    return ok("Lead atualizado.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function updatePrivacyRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "secretaria"]);
    const id = str(fd, "id");
    const status = z.enum(["aberta", "em_analise", "concluida"]).parse(str(fd, "status"));
    await db.update(privacyRequests).set({ status, response: strOrNull(fd, "response"), updatedAt: new Date() }).where(eq(privacyRequests.id, id));
    await audit(actor.id, "lgpd.solicitacao_atualizada", "privacy_request", id, { status });
    revalidatePath("/admin/privacidade");
    return ok("Solicitação atualizada.");
  } catch (err) {
    return errorToState(err);
  }
}