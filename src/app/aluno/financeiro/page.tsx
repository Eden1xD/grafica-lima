import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import { Landmark, QrCode, Receipt, Wallet } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, installments, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { requestCancellationAction } from "@/server/actions/enrollment";
import { checkPaymentStatusAction, regeneratePixAction } from "@/server/actions/finance";
import { brl, fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { Badge, Card, EmptyState, Field, Input, PageTitle, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PaymentPoller } from "@/components/payment-poller";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meu financeiro" };

const KIND_LABEL: Record<string, string> = { integral: "Pagamento integral", matricula: "Entrada / matrícula", mensalidade: "Mensalidade" };
const METHOD_LABEL: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", transferencia: "Transferência", outro: "Outro" };

export default async function AlunoFinanceiroPage() {
  const user = await requireUser("/aluno/financeiro");
  const rows = await db
    .select({ e: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(enrollments.userId, user.id))
    .orderBy(desc(enrollments.createdAt));
  const blocks = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      inst: await db.select().from(installments).where(eq(installments.enrollmentId, r.e.id)).orderBy(asc(installments.number)),
      pays: await db.select().from(payments).where(eq(payments.enrollmentId, r.e.id)).orderBy(desc(payments.createdAt)),
    })),
  );
  const today = todayISO();

  return (
    <div>
      <PageTitle title="Financeiro" description="Mensalidades, pagamentos e recibos. Valores previstos e recebidos são separados." />
      {blocks.length === 0 ? (
        <EmptyState icon={<Wallet className="h-8 w-8" />} title="Nenhuma matrícula" description="Seus pagamentos aparecerão aqui após a matrícula." />
      ) : (
        <div className="space-y-10">
          {blocks.map(({ e, cohort, course, inst, pays }) => {
            const initialPending = pays.find((p) => p.status === "pendente" && p.kind !== "mensalidade");
            return (
              <section key={e.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold text-ink">{course.name} <span className="font-normal text-muted">· {cohort.name}</span></h2>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={e.status} />
                    <span className="text-sm font-bold text-ink">{brl(e.totalCents)}</span>
                  </div>
                </div>

                {e.status === "pendente_pagamento" && initialPending ? (
                  <Card className="mb-4 border-warn/40 p-5">
                    {initialPending.pixQrCode ? (
                      <div>
                        <p className="flex items-center gap-2 font-bold text-ink"><QrCode className="h-4 w-4 text-brand" />Pix pendente — {brl(initialPending.amountCents)}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          {initialPending.pixQrBase64 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`data:image/png;base64,${initialPending.pixQrBase64}`} alt="QR Code Pix" className="h-40 w-40 rounded-xl border border-line bg-white p-2" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <input readOnly value={initialPending.pixQrCode} aria-label="Pix copia e cola" className="h-10 w-full truncate rounded-xl border border-line bg-bg px-3 font-mono text-xs" onFocus={(ev) => ev.target.select()} />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ActionForm action={checkPaymentStatusAction} hidden={{ paymentId: initialPending.id }} submitLabel="Já paguei — verificar" submitSize="sm" />
                              <ActionForm action={regeneratePixAction} hidden={{ paymentId: initialPending.id }} submitLabel="Gerar novo Pix" submitVariant="secondary" submitSize="sm" />
                            </div>
                          </div>
                        </div>
                        <PaymentPoller paymentId={initialPending.id} />
                      </div>
                    ) : (
                      <div>
                        <p className="flex items-center gap-2 font-bold text-ink"><Landmark className="h-4 w-4 text-brand" />Pagamento na secretaria — {brl(initialPending.amountCents)}</p>
                        <p className="mt-1 text-sm text-muted">Compareça à unidade para pagar (dinheiro, Pix ou cartão presencial). Sua reserva expira em {e.pendingExpiresAt ? fmtDateTime(e.pendingExpiresAt) : "48h"}.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionForm action={regeneratePixAction} hidden={{ paymentId: initialPending.id }} submitLabel="Tentar Pix online" submitVariant="secondary" submitSize="sm" />
                        </div>
                      </div>
                    )}
                  </Card>
                ) : null}

                {inst.length > 0 ? (
                  <Card className="mb-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                          <th className="px-4 py-3">Mensalidade</th>
                          <th className="px-4 py-3">Vencimento</th>
                          <th className="px-4 py-3">Valor</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inst.map((i) => {
                          const overdue = i.status === "pendente" && i.dueDate < today;
                          return (
                            <tr key={i.id} className="border-b border-line/60 last:border-0">
                              <td className="px-4 py-3 font-semibold text-ink">{i.number}/{inst.length}</td>
                              <td className="px-4 py-3 text-muted">{fmtDate(i.dueDate)}</td>
                              <td className="px-4 py-3 text-ink">{brl(i.amountCents)}</td>
                              <td className="px-4 py-3">{overdue ? <Badge variant="danger">Vencida</Badge> : <StatusBadge status={i.status} />}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                ) : null}

                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Meio</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Recibo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pays.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Nenhum pagamento registrado.</td></tr>
                      ) : (
                        pays.map((p) => (
                          <tr key={p.id} className="border-b border-line/60 last:border-0">
                            <td className="px-4 py-3 text-muted">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                            <td className="px-4 py-3 font-medium text-ink">{KIND_LABEL[p.kind]}</td>
                            <td className="px-4 py-3 text-muted">{METHOD_LABEL[p.method]}</td>
                            <td className="px-4 py-3 text-ink">{brl(p.amountCents)}</td>
                            <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                            <td className="px-4 py-3 text-right">
                              {p.status === "aprovado" ? (
                                <a href={`/api/recibos/${p.id}/pdf`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                                  <Receipt className="h-3.5 w-3.5" /> Nº {String(p.receiptSeq).padStart(5, "0")}
                                </a>
                              ) : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Card>

                {e.status !== "cancelada" && e.status !== "concluida" ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-danger">Solicitar cancelamento desta matrícula</summary>
                    <Card className="mt-2 p-4">
                      <p className="text-xs text-muted">Conforme a política de cancelamento (CDC): até 7 dias da contratação online, reembolso integral. Após o início das aulas, o cálculo considera aulas ministradas.</p>
                      <ActionForm action={requestCancellationAction} hidden={{ enrollmentId: e.id }} submitLabel="Enviar solicitação" submitVariant="danger" submitSize="sm" confirm="Confirmar solicitação de cancelamento?" className="mt-3 flex flex-wrap items-end gap-3">
                        <Field label="Motivo"><Input name="reason" required minLength={5} placeholder="Descreva o motivo" /></Field>
                      </ActionForm>
                    </Card>
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}