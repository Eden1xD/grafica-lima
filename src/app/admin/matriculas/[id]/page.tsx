import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { Award, Ban, Landmark, Lock, Receipt, Repeat, Unlock, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { certificates, cohorts, installments, payments, studentProfiles } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { enrollmentContext, takenSeats } from "@/lib/payments/core";
import { recordManualPaymentAction, refundPaymentAction } from "@/server/actions/finance";
import { cancelEnrollmentAction, toggleLockEnrollmentAction, transferEnrollmentAction } from "@/server/actions/admin-people";
import { concludeEnrollmentAction, issueCertificateAction } from "@/server/actions/academic";
import { brl, fmtCpf, fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { Badge, Card, Field, Input, PageTitle, Select, StatusBadge } from "@/components/ui";
import { ActionForm, Collapse } from "@/components/action-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gerenciar matrícula" };

const METHOD_OPTIONS = (
  <>
    <option value="dinheiro">Dinheiro</option>
    <option value="pix">Pix (presencial)</option>
    <option value="cartao">Cartão (presencial)</option>
    <option value="transferencia">Transferência</option>
    <option value="outro">Outro</option>
  </>
);

export default async function AdminMatriculaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole(STAFF, "/admin/matriculas");
  const ctx = await enrollmentContext(id);
  if (!ctx) notFound();
  const { enrollment: e, user: student, cohort, course } = ctx;
  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, student.id)).limit(1);
  const pays = await db.select().from(payments).where(eq(payments.enrollmentId, id)).orderBy(asc(payments.createdAt));
  const inst = await db.select().from(installments).where(eq(installments.enrollmentId, id)).orderBy(asc(installments.number));
  const [cert] = await db.select().from(certificates).where(eq(certificates.enrollmentId, id)).limit(1);
  const initialPending = pays.find((p) => p.status === "pendente" && p.kind !== "mensalidade");
  const transferTargets = await db
    .select({ id: cohorts.id, name: cohorts.name, capacity: cohorts.capacity })
    .from(cohorts)
    .where(and(eq(cohorts.courseId, cohort.courseId), ne(cohorts.id, cohort.id), ne(cohorts.status, "cancelada")));
  const targetsWithSeats = await Promise.all(transferTargets.map(async (t) => ({ ...t, taken: await takenSeats(t.id) })));
  const today = todayISO();
  // Todas as ações abaixo revalidam o papel no servidor (assertRole).
  const canManage = true;
  void actor;

  return (
    <div>
      <Link href="/admin/matriculas" className="mb-3 inline-block text-sm font-semibold text-brand hover:underline">← Matrículas</Link>
      <PageTitle
        title={student.name}
        description={`${course.name} · ${cohort.name} · criada em ${fmtDateTime(e.createdAt)}`}
        actions={<StatusBadge status={e.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {initialPending && e.status === "pendente_pagamento" ? (
            <Card className="border-warn/40 p-5">
              <h2 className="flex items-center gap-2 font-bold text-ink"><Landmark className="h-4 w-4 text-brand" />Registrar pagamento inicial — {brl(initialPending.amountCents)}</h2>
              <p className="mt-1 text-xs text-muted">Confirma a matrícula e emite recibo. O valor é validado contra a cobrança pendente (sem duplicidades).</p>
              <ActionForm action={recordManualPaymentAction} submitLabel="Confirmar recebimento" className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="enrollmentId" value={id} />
                <Field label="Valor (R$)"><Input name="amount" defaultValue={(initialPending.amountCents / 100).toFixed(2).replace(".", ",")} required className="w-36" /></Field>
                <Field label="Meio"><Select name="method" defaultValue="dinheiro" className="w-44">{METHOD_OPTIONS}</Select></Field>
              </ActionForm>
            </Card>
          ) : null}

          {inst.length > 0 ? (
            <Card>
              <h2 className="px-5 pt-5 font-bold text-ink">Mensalidades</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="px-5 py-2.5">#</th>
                      <th className="px-5 py-2.5">Vencimento</th>
                      <th className="px-5 py-2.5">Valor</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Registro presencial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inst.map((i) => {
                      const overdue = i.status === "pendente" && i.dueDate < today;
                      return (
                        <tr key={i.id} className="border-b border-line/60 last:border-0">
                          <td className="px-5 py-3 font-semibold text-ink">{i.number}/{inst.length}</td>
                          <td className="px-5 py-3 text-muted">{fmtDate(i.dueDate)}</td>
                          <td className="px-5 py-3 text-ink">{brl(i.amountCents)}</td>
                          <td className="px-5 py-3">{overdue ? <Badge variant="danger">Vencida</Badge> : <StatusBadge status={i.status} />}</td>
                          <td className="px-5 py-3 text-right">
                            {i.status === "pendente" && e.status !== "cancelada" ? (
                              <ActionForm action={recordManualPaymentAction} submitLabel="Receber" submitSize="sm" className="flex items-center justify-end gap-2">
                                <input type="hidden" name="enrollmentId" value={id} />
                                <input type="hidden" name="installmentId" value={i.id} />
                                <input type="hidden" name="amount" value={(i.amountCents / 100).toFixed(2).replace(".", ",")} />
                                <Select name="method" defaultValue="dinheiro" className="h-8 w-36 text-xs">{METHOD_OPTIONS}</Select>
                              </ActionForm>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="px-5 pt-5 font-bold text-ink">Pagamentos e recibos</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5">Data</th>
                    <th className="px-5 py-2.5">Tipo</th>
                    <th className="px-5 py-2.5">Valor</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Recibo / reembolso</th>
                  </tr>
                </thead>
                <tbody>
                  {pays.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">Nenhum pagamento.</td></tr>
                  ) : pays.map((p) => (
                    <tr key={p.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3 text-muted">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                      <td className="px-5 py-3 text-ink">{p.kind === "integral" ? "Integral" : p.kind === "matricula" ? "Entrada" : "Mensalidade"} · {p.method}</td>
                      <td className="px-5 py-3 font-semibold text-ink">{brl(p.amountCents)}</td>
                      <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-5 py-3 text-right">
                        {p.status === "aprovado" ? (
                          <div className="flex items-center justify-end gap-2">
                            <a href={`/api/recibos/${p.id}/pdf`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Receipt className="h-3.5 w-3.5" />Nº {String(p.receiptSeq).padStart(5, "0")}</a>
                            <details className="relative inline-block text-left">
                              <summary className="cursor-pointer text-xs font-semibold text-danger">Reembolsar</summary>
                              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
                                <ActionForm action={refundPaymentAction} hidden={{ paymentId: p.id }} submitLabel="Confirmar reembolso" submitVariant="danger" submitSize="sm" confirm="Registrar reembolso deste pagamento?">
                                  <Field label="Motivo (auditoria)"><Input name="reason" required minLength={5} /></Field>
                                </ActionForm>
                              </div>
                            </details>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="font-bold text-ink">Dados do aluno</h2>
            <dl className="mt-3 space-y-1.5 text-muted">
              <p>{student.email}</p>
              {profile?.cpf ? <p>CPF: {fmtCpf(profile.cpf)}</p> : null}
              {profile?.phone ? <p>Tel: {profile.phone}</p> : null}
              {profile?.city ? <p>{profile.city}{profile.state ? `/${profile.state}` : ""}</p> : null}
              {profile?.guardianName ? <p className="text-warn">Responsável: {profile.guardianName}</p> : null}
            </dl>
            <div className="mt-3 border-t border-line pt-3">
              <p className="flex justify-between"><span className="text-muted">Total</span><strong className="text-ink">{brl(e.totalCents)}</strong></p>
              {e.discountCents > 0 ? <p className="flex justify-between text-success"><span>Desconto</span><span>−{brl(e.discountCents)}</span></p> : null}
              <p className="flex justify-between text-xs"><span className="text-muted">Plano</span><span className="text-ink">{e.plan === "integral" ? "Integral" : "Entrada + mensalidades"}</span></p>
              {e.contractAcceptedAt ? <p className="mt-1 text-xs text-muted">Contrato aceito em {fmtDateTime(e.contractAcceptedAt)} ({e.contractVersion})</p> : null}
            </div>
          </Card>

          {canManage ? (
            <Card className="space-y-3 p-5">
              <h2 className="font-bold text-ink">Ações da matrícula</h2>
              {(e.status === "ativa" || e.status === "trancada") ? (
                <ActionForm action={toggleLockEnrollmentAction} hidden={{ enrollmentId: id }} submitLabel={e.status === "ativa" ? "Trancar matrícula" : "Reativar matrícula"} submitVariant="secondary" submitSize="sm" className="block" />
              ) : null}
              {(e.status === "ativa" || e.status === "trancada") ? (
                <Collapse title="Concluir matrícula">
                  <ActionForm action={concludeEnrollmentAction} hidden={{ enrollmentId: id }} submitLabel="Concluir" submitSize="sm">
                    <p className="mb-2 text-xs text-muted">Valida média e frequência automaticamente. Override exige justificativa.</p>
                    <label className="mb-2 flex items-center gap-2 text-xs text-ink"><input type="checkbox" name="override" />Concluir sem cumprir requisitos (override)</label>
                    <Field label="Justificativa (override)"><Input name="reason" placeholder="Obrigatória em override" /></Field>
                  </ActionForm>
                </Collapse>
              ) : null}
              {e.status === "concluida" && !cert && course.certificateEnabled ? (
                <ActionForm action={issueCertificateAction} hidden={{ enrollmentId: id }} submitLabel="Emitir certificado" submitSize="sm" className="block" />
              ) : null}
              {cert ? (
                <div className="rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">
                  <Award className="mr-1 inline h-3.5 w-3.5" />Certificado {cert.code} · {cert.revokedAt ? "revogado" : "válido"}
                </div>
              ) : null}
              {e.status !== "cancelada" && e.status !== "concluida" && targetsWithSeats.length > 0 ? (
                <Collapse title="Transferir de turma">
                  <ActionForm action={transferEnrollmentAction} hidden={{ enrollmentId: id }} submitLabel="Transferir" submitSize="sm">
                    <Field label="Turma de destino (mesmo curso)">
                      <Select name="targetCohortId" required defaultValue="">
                        <option value="" disabled>Selecione…</option>
                        {targetsWithSeats.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.taken >= t.capacity}>
                            {t.name} ({t.taken}/{t.capacity}){t.taken >= t.capacity ? " — lotada" : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </ActionForm>
                </Collapse>
              ) : null}
              {e.status !== "cancelada" ? (
                <Collapse title="Cancelar matrícula">
                  <ActionForm action={cancelEnrollmentAction} hidden={{ enrollmentId: id }} submitLabel="Cancelar matrícula" submitVariant="danger" submitSize="sm" confirm="Cancelar esta matrícula? Cobranças pendentes serão baixadas.">
                    <Field label="Motivo (obrigatório)"><Input name="reason" required minLength={5} /></Field>
                    <p className="mt-2 text-xs text-muted"><Ban className="mr-1 inline h-3 w-3" />Reembolsos de valores pagos são registrados separadamente na tabela de pagamentos.</p>
                  </ActionForm>
                </Collapse>
              ) : (
                <p className="text-xs text-muted">Cancelada em {fmtDateTime(e.cancelledAt)} — {e.cancelReason}</p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}