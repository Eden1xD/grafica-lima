import Link from "next/link";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Landmark, QrCode, XCircle } from "lucide-react";
import { db } from "@/db";
import { enrollments, payments } from "@/db/schema";
import { requireUser, userIsStaff } from "@/lib/auth/guards";
import { enrollmentContext } from "@/lib/payments/core";
import { brl, fmtDate, weekdaysLabel } from "@/lib/utils";
import { Alert, Badge, Card, LinkButton, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { checkPaymentStatusAction } from "@/server/actions/finance";
import { PaymentPoller } from "@/components/payment-poller";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmação da matrícula" };

export default async function ConfirmacaoPage({ searchParams }: { searchParams: Promise<{ enrollment?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/aluno");
  if (!sp.enrollment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted">Matrícula não informada.</p>
        <LinkButton href="/aluno" className="mt-4">Ir para o portal</LinkButton>
      </div>
    );
  }
  const ctx = await enrollmentContext(sp.enrollment);
  if (!ctx || (ctx.enrollment.userId !== user.id && !userIsStaff(user))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Alert variant="danger">Matrícula não encontrada.</Alert>
        <LinkButton href="/aluno" variant="secondary" className="mt-4">Ir para o portal</LinkButton>
      </div>
    );
  }
  const { enrollment, cohort, course } = ctx;
  const pending = await db
    .select()
    .from(payments)
    .where(and(eq(payments.enrollmentId, enrollment.id), eq(payments.status, "pendente")));
  const initialPending = pending.find((p) => p.kind !== "mensalidade");
  const pixPayment = initialPending?.pixQrCode ? initialPending : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {enrollment.status === "ativa" || enrollment.status === "concluida" ? (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-8 w-8" /></span>
          <h1 className="mt-5 text-2xl font-bold text-ink">Matrícula confirmada!</h1>
          <p className="mt-2 text-muted">Bem-vindo(a) à turma <strong className="text-ink">{cohort.name}</strong> de <strong className="text-ink">{course.name}</strong>.</p>
        </div>
      ) : enrollment.status === "cancelada" ? (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger"><XCircle className="h-8 w-8" /></span>
          <h1 className="mt-5 text-2xl font-bold text-ink">Matrícula cancelada</h1>
          <p className="mt-2 text-sm text-muted">{enrollment.cancelReason ?? "Reserva expirada ou cancelada."}</p>
        </div>
      ) : (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warn-soft text-warn"><Clock className="h-8 w-8" /></span>
          <h1 className="mt-5 text-2xl font-bold text-ink">Matrícula reservada — aguardando pagamento</h1>
          <p className="mt-2 text-sm text-muted">Sua vaga está garantida até {enrollment.pendingExpiresAt ? fmtDate(enrollment.pendingExpiresAt) : "o prazo da reserva"}. A matrícula é ativada assim que o pagamento for confirmado.</p>
        </div>
      )}

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold text-ink">{course.name}</p>
            <p className="text-sm text-muted">{cohort.name} · {weekdaysLabel(cohort.daysOfWeek)} · {cohort.startTime}–{cohort.endTime}</p>
            <p className="text-xs text-muted">{fmtDate(cohort.startDate)} a {fmtDate(cohort.endDate)}</p>
          </div>
          <StatusBadge status={enrollment.status} />
        </div>
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">Total ({enrollment.plan === "integral" ? "integral" : "entrada + mensalidades"})</span>
          <span className="font-bold text-ink">{brl(enrollment.totalCents)}</span>
        </div>
        {enrollment.discountCents > 0 ? <p className="mt-1 text-right text-xs text-success">Desconto aplicado: −{brl(enrollment.discountCents)}</p> : null}
      </Card>

      {enrollment.status === "pendente_pagamento" && initialPending ? (
        <Card className="mt-4 p-6">
          {pixPayment ? (
            <div className="text-center">
              <p className="flex items-center justify-center gap-2 font-bold text-ink"><QrCode className="h-4 w-4 text-brand" /> Pix pendente</p>
              {pixPayment.pixQrBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${pixPayment.pixQrBase64}`} alt="QR Code Pix" className="mx-auto mt-4 h-48 w-48 rounded-xl border border-line bg-white p-2" />
              ) : null}
              <input readOnly value={pixPayment.pixQrCode ?? ""} aria-label="Pix copia e cola" className="mt-3 h-10 w-full truncate rounded-xl border border-line bg-bg px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <PaymentPoller paymentId={pixPayment.id} />
              <p className="mt-2 text-xs text-muted">Verificamos automaticamente com o provedor. A confirmação também chega por webhook.</p>
            </div>
          ) : (
            <div>
              <p className="flex items-center gap-2 font-bold text-ink"><Landmark className="h-4 w-4 text-brand" /> Pagamento na secretaria</p>
              <p className="mt-2 text-sm text-muted">Compareça à unidade e informe seu nome. Valor da cobrança inicial: <strong className="text-ink">{brl(initialPending.amountCents)}</strong>. Aceitamos dinheiro, Pix e cartão presencial.</p>
            </div>
          )}
          <ActionForm action={checkPaymentStatusAction} hidden={{ paymentId: initialPending.id }} submitLabel="Verificar pagamento agora" submitVariant="secondary" className="mt-4" />
        </Card>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/aluno">Ir para o portal do aluno</LinkButton>
        <LinkButton href="/aluno/financeiro" variant="secondary">Ver financeiro</LinkButton>
        <Link href="/cursos" className="self-center text-sm font-semibold text-muted hover:text-brand">Explorar outros cursos</Link>
      </div>
      <p className="mt-6 text-center text-xs text-muted">Você receberá notificações de confirmação, aulas e notas pelo portal e, se ativadas, por push no celular.</p>
    </div>
  );
}