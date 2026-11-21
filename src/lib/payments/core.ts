import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, installments, payments, cohorts, users, courses } from "@/db/schema";
import { notify, userIdsByRole } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Vagas ocupadas: ativas, trancadas e pendentes ainda não expiradas. */
export async function takenSeats(cohortId: string, tx: Tx | typeof db = db): Promise<number> {
  const rows = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.cohortId, cohortId),
        or(
          inArray(enrollments.status, ["ativa", "trancada", "concluida"]),
          and(eq(enrollments.status, "pendente_pagamento"), or(isNull(enrollments.pendingExpiresAt), gt(enrollments.pendingExpiresAt, new Date()))),
        ),
      ),
    );
  return rows.length;
}

/** Expira reservas pendentes vencidas (execução oportunista, sem cron). */
export async function expirePendingEnrollments(): Promise<void> {
  await db
    .update(enrollments)
    .set({ status: "cancelada", cancelledAt: new Date(), cancelReason: "Reserva expirada por falta de pagamento." })
    .where(and(eq(enrollments.status, "pendente_pagamento"), sql`${enrollments.pendingExpiresAt} < now()`));
}

/**
 * Aprovação de pagamento — transação com lock, idempotente.
 * Ativa a matrícula somente quando o pagamento inicial exigido é aprovado.
 */
export async function approvePayment(
  paymentId: string,
  source: "webhook" | "consulta" | "manual",
  actorId: string | null,
): Promise<{ activated: boolean; enrollmentId: string; userId: string } | null> {
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p) return null;
    if (p.status === "aprovado") return { activated: false, enrollmentId: p.enrollmentId, userId: "", already: true };
    if (p.status === "reembolsado" || p.status === "cancelado") return null;

    await tx
      .update(payments)
      .set({ status: "aprovado", paidAt: new Date(), updatedAt: new Date(), recordedBy: p.recordedBy ?? actorId })
      .where(eq(payments.id, paymentId));

    if (p.installmentId) {
      await tx.update(installments).set({ status: "paga", paidAt: new Date() }).where(eq(installments.id, p.installmentId));
    }

    const [e] = await tx.select().from(enrollments).where(eq(enrollments.id, p.enrollmentId)).for("update");
    let activated = false;
    if (e && e.status === "pendente_pagamento" && (p.kind === "integral" || p.kind === "matricula")) {
      await tx
        .update(enrollments)
        .set({ status: "ativa", pendingExpiresAt: null })
        .where(eq(enrollments.id, e.id));
      activated = true;
    }
    return { activated, enrollmentId: p.enrollmentId, userId: e?.userId ?? "", already: false, amount: p.amountCents, kind: p.kind };
  });

  if (!result || result.already) return result ? { activated: false, enrollmentId: result.enrollmentId, userId: result.userId } : null;

  await audit(actorId, `pagamento.aprovado.${source}`, "payment", paymentId, {
    enrollmentId: result.enrollmentId,
    amountCents: result.amount,
    kind: result.kind,
  });
  if (result.userId) {
    await notify(result.userId, {
      type: "pagamento",
      title: "Pagamento confirmado",
      body: "Seu pagamento foi confirmado. Confira o recibo no portal.",
      link: "/aluno/financeiro",
    });
    if (result.activated) {
      await notify(result.userId, {
        type: "matricula",
        title: "Matrícula confirmada 🎉",
        body: "Sua matrícula está ativa. Veja sua turma e o calendário de aulas.",
        link: "/aluno",
      });
      const staff = await userIdsByRole(["admin", "secretaria"]);
      await notify(staff, { type: "matricula", title: "Nova matrícula confirmada", link: "/admin/matriculas" });
    }
  }
  return { activated: result.activated, enrollmentId: result.enrollmentId, userId: result.userId };
}

export async function rejectPayment(paymentId: string, source: "webhook" | "consulta"): Promise<void> {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.status !== "pendente") return;
  await db.update(payments).set({ status: "recusado", updatedAt: new Date() }).where(eq(payments.id, paymentId));
  await audit(null, `pagamento.recusado.${source}`, "payment", paymentId);
  const [e] = await db.select({ userId: enrollments.userId }).from(enrollments).where(eq(enrollments.id, p.enrollmentId));
  if (e) {
    await notify(e.userId, {
      type: "pagamento",
      title: "Pagamento não aprovado",
      body: "Seu pagamento não foi aprovado. Você pode tentar novamente pelo portal.",
      link: "/aluno/financeiro",
    });
  }
}

/** Contexto completo de uma matrícula para telas e PDFs. */
export async function enrollmentContext(enrollmentId: string) {
  const rows = await db
    .select({
      enrollment: enrollments,
      user: users,
      cohort: cohorts,
      course: courses,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  return rows[0] ?? null;
}