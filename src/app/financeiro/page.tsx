import type { Metadata } from "next";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { AlertTriangle, CreditCard, Receipt, Wallet } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, installments, payments, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { recordManualPaymentAction } from "@/server/actions/finance";
import { brl, fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, LinkButton, PageTitle, Select, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel Financeiro" };

export default async function FinanceiroPage() {
  await requirePermission("financeiro.ver", "/financeiro");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = todayISO();

  const [[received], [pendingTotal], [overdue], pendingInitials, overdueInst, recentPays] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)` }).from(payments).where(and(eq(payments.status, "aprovado"), gte(payments.paidAt, monthStart))),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)` }).from(payments).where(eq(payments.status, "pendente")),
    db.select({ total: sql<number>`coalesce(sum(${installments.amountCents}),0)`, n: sql<number>`count(*)` }).from(installments).where(and(eq(installments.status, "pendente"), lt(installments.dueDate, today))),
    db
      .select({ p: payments, e: enrollments, student: users.name, course: courses.name })
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(eq(payments.status, "pendente"), sql`${payments.kind} <> 'mensalidade'`))
      .orderBy(asc(payments.createdAt))
      .limit(10),
    db
      .select({ i: installments, e: enrollments, student: users.name, course: courses.name })
      .from(installments)
      .innerJoin(enrollments, eq(enrollments.id, installments.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(eq(installments.status, "pendente"), lt(installments.dueDate, today)))
      .orderBy(asc(installments.dueDate))
      .limit(10),
    db
      .select({ p: payments, student: users.name })
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(eq(payments.status, "aprovado"))
      .orderBy(sql`${payments.paidAt} desc`)
      .limit(6),
  ]);

  const methodSelect = (
    <Select name="method" defaultValue="dinheiro" className="h-8 w-36 text-xs">
      <option value="dinheiro">Dinheiro</option>
      <option value="pix">Pix (presencial)</option>
      <option value="cartao">Cartão (presencial)</option>
      <option value="transferencia">Transferência</option>
      <option value="outro">Outro</option>
    </Select>
  );

  return (
    <div>
      <PageTitle
        title="Financeiro"
        description="Recebimentos presenciais, cobranças e vencidos — com auditoria em cada operação."
        actions={<LinkButton href="/admin/financeiro" variant="secondary" size="sm">Relatórios completos</LinkButton>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Recebido no mês" value={brl(Number(received.total))} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <Stat label="Cobranças pendentes" value={brl(Number(pendingTotal.total))} icon={<CreditCard className="h-5 w-5" />} tone="warn" />
        <Stat label="Mensalidades vencidas" value={brl(Number(overdue.total))} hint={`${overdue.n} em atraso`} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <Stat label="Recibos" value="PDF numerado" hint="emitido a cada recebimento" icon={<Receipt className="h-5 w-5" />} tone="info" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-ink">Matrículas aguardando pagamento inicial</h2>
          <div className="mt-3 space-y-3">
            {pendingInitials.length === 0 ? <p className="text-sm text-muted">Nenhuma cobrança inicial pendente. 🎉</p> : pendingInitials.map(({ p, e, student, course }) => (
              <div key={p.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{student}</p>
                    <p className="text-xs text-muted">{course} · reserva até {e.pendingExpiresAt ? fmtDateTime(e.pendingExpiresAt) : "—"}</p>
                  </div>
                  <Badge variant="warn">{brl(p.amountCents)}</Badge>
                </div>
                <ActionForm action={recordManualPaymentAction} submitLabel="Receber" submitSize="sm" className="mt-3 flex items-center justify-end gap-2">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <input type="hidden" name="amount" value={(p.amountCents / 100).toFixed(2).replace(".", ",")} />
                  {methodSelect}
                </ActionForm>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-ink">Mensalidades vencidas</h2>
          <div className="mt-3 space-y-3">
            {overdueInst.length === 0 ? <p className="text-sm text-muted">Nenhuma mensalidade vencida. 🎉</p> : overdueInst.map(({ i, e, student, course }) => (
              <div key={i.id} className="rounded-xl border border-danger/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{student}</p>
                    <p className="text-xs text-muted">{course} · parcela {i.number} · venceu {fmtDate(i.dueDate)}</p>
                  </div>
                  <Badge variant="danger">{brl(i.amountCents)}</Badge>
                </div>
                <ActionForm action={recordManualPaymentAction} submitLabel="Receber" submitSize="sm" className="mt-3 flex items-center justify-end gap-2">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <input type="hidden" name="installmentId" value={i.id} />
                  <input type="hidden" name="amount" value={(i.amountCents / 100).toFixed(2).replace(".", ",")} />
                  {methodSelect}
                </ActionForm>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-bold text-ink">Últimos recebimentos</h2>
        <div className="mt-3 divide-y divide-line">
          {recentPays.length === 0 ? <p className="text-sm text-muted">Nenhum pagamento aprovado ainda.</p> : recentPays.map(({ p, student }) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="font-semibold text-ink">{student}</span>
              <span className="text-xs text-muted">{fmtDateTime(p.paidAt ?? p.createdAt)}</span>
              <span className="flex items-center gap-3">
                <strong className="text-ink">{brl(p.amountCents)}</strong>
                <a href={`/api/recibos/${p.id}/pdf`} className="text-xs font-semibold text-brand hover:underline">Recibo</a>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}