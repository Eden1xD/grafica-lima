import type { Metadata } from "next";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { CreditCard, Receipt, TrendingUp, Wallet } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, installments, payments, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { brl, fmtDate, todayISO } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { Button, Field, Input, LinkButton, PageTitle, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Financeiro — administração" };

export default async function AdminFinanceiroPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requirePermission("financeiro.ver", "/admin/financeiro");
  const sp = await searchParams;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEndIso = monthEnd.toISOString().slice(0, 10);
  const today = todayISO();

  const payConditions = [];
  if (sp.de && /^\d{4}-\d{2}-\d{2}$/.test(sp.de)) payConditions.push(gte(payments.createdAt, new Date(sp.de + "T00:00:00")));
  if (sp.ate && /^\d{4}-\d{2}-\d{2}$/.test(sp.ate)) payConditions.push(lt(payments.createdAt, new Date(sp.ate + "T23:59:59")));

  const [[received], [pending], [overdue], [forecast], payRows, instRows] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)`, n: sql<number>`count(*)` }).from(payments).where(and(eq(payments.status, "aprovado"), gte(payments.paidAt, monthStart))),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)` }).from(payments).where(eq(payments.status, "pendente")),
    db.select({ total: sql<number>`coalesce(sum(${installments.amountCents}),0)`, n: sql<number>`count(*)` }).from(installments).where(and(eq(installments.status, "pendente"), lt(installments.dueDate, today))),
    db.select({ total: sql<number>`coalesce(sum(${installments.amountCents}),0)` }).from(installments).where(and(eq(installments.status, "pendente"), gte(installments.dueDate, monthStartIso), lt(installments.dueDate, monthEndIso))),
    db
      .select({ p: payments, student: users.name, course: courses.name })
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(payConditions.length ? and(...payConditions) : undefined)
      .orderBy(sql`${payments.createdAt} desc`)
      .limit(500),
    db
      .select({ i: installments, student: users.name, course: courses.name, enrollmentId: enrollments.id })
      .from(installments)
      .innerJoin(enrollments, eq(enrollments.id, installments.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .orderBy(asc(installments.dueDate))
      .limit(500),
  ]);

  return (
    <div>
      <PageTitle title="Financeiro" description="Recebidos × previstos, mensalidades, recibos e reembolsos. Registro de pagamentos presenciais na página de cada matrícula." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Recebido no mês" value={brl(Number(received.total))} hint={`${received.n} pagamento(s) aprovados`} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <Stat label="Previsto no mês" value={brl(Number(forecast.total))} hint="mensalidades com vencimento no mês" icon={<TrendingUp className="h-5 w-5" />} tone="info" />
        <Stat label="Cobranças pendentes" value={brl(Number(pending.total))} hint="inclui reservas aguardando pagamento" icon={<CreditCard className="h-5 w-5" />} tone="warn" />
        <Stat label="Mensalidades vencidas" value={brl(Number(overdue.total))} hint={`${overdue.n} em atraso`} icon={<Receipt className="h-5 w-5" />} tone="danger" />
      </div>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <Field label="De"><Input name="de" type="date" defaultValue={sp.de ?? ""} /></Field>
        <Field label="Até"><Input name="ate" type="date" defaultValue={sp.ate ?? ""} /></Field>
        <Button type="submit" variant="secondary">Filtrar período</Button>
        <LinkButton href="/admin/financeiro" variant="ghost" size="md">Limpar</LinkButton>
      </form>

      <h2 className="mb-3 mt-8 font-bold text-ink">Transações</h2>
      <DataTable
        exportName="transacoes"
        filterKey="status"
        pageSize={12}
        columns={[
          { key: "date", label: "Data", type: "datetime" },
          { key: "student", label: "Aluno" },
          { key: "course", label: "Curso" },
          { key: "kind", label: "Tipo" },
          { key: "method", label: "Meio" },
          { key: "amountCents", label: "Valor", type: "money" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={payRows.map(({ p, student, course }) => ({
          id: p.id,
          date: (p.paidAt ?? p.createdAt).toISOString(),
          student,
          course,
          kind: p.kind === "integral" ? "Integral" : p.kind === "matricula" ? "Entrada" : "Mensalidade",
          method: p.method,
          amountCents: p.amountCents,
          status: p.status,
          _actions: (
            <div className="flex items-center justify-end gap-2">
              {p.status === "aprovado" ? <a href={`/api/recibos/${p.id}/pdf`} className="text-xs font-semibold text-brand hover:underline">Recibo</a> : null}
              <LinkButton href={`/admin/matriculas/${p.enrollmentId}`} variant="secondary" size="sm">Matrícula</LinkButton>
            </div>
          ),
        }))}
        emptyTitle="Nenhuma transação no período"
      />

      <h2 className="mb-3 mt-8 font-bold text-ink">Mensalidades</h2>
      <DataTable
        exportName="mensalidades"
        filterKey="status"
        pageSize={12}
        columns={[
          { key: "student", label: "Aluno" },
          { key: "course", label: "Curso" },
          { key: "number", label: "Parcela" },
          { key: "dueDate", label: "Vencimento", type: "date" },
          { key: "amountCents", label: "Valor", type: "money" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={instRows.map(({ i, student, course, enrollmentId }) => ({
          id: i.id,
          student,
          course,
          number: i.number,
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          status: i.status === "pendente" && i.dueDate < today ? "vencida" : i.status,
          _actions: <LinkButton href={`/admin/matriculas/${enrollmentId}`} variant="secondary" size="sm">Receber</LinkButton>,
        }))}
        emptyTitle="Nenhuma mensalidade"
        emptyDescription="Matrículas no plano mensal geram mensalidades automaticamente."
      />
    </div>
  );
}