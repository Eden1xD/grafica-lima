"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coupons, enrollments, installments, payments } from "@/db/schema";
import { assertRole, assertPermission, FINANCE } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { approvePayment, rejectPayment } from "@/lib/payments/core";
import { createPixPayment, getProviderPayment } from "@/lib/payments/mercadopago";
import { getSettings, mercadopagoConfigured } from "@/lib/settings";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { brl, parseMoneyToCents } from "@/lib/utils";
import { baseUrl } from "@/lib/request";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

/** Registro de pagamento presencial pela secretaria/financeiro. */
export async function recordManualPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission("financeiro.registrar");
    const enrollmentId = str(fd, "enrollmentId");
    const installmentId = strOrNull(fd, "installmentId");
    const method = z.enum(["dinheiro", "transferencia", "pix", "cartao", "outro"]).parse(str(fd, "method"));
    const amountCents = parseMoneyToCents(str(fd, "amount"));
    if (amountCents === null || amountCents <= 0) return fail("Valor inválido.");

    const [e] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
    if (!e) return fail("Matrícula não encontrada.");
    if (e.status === "cancelada") return fail("Matrícula cancelada não recebe pagamentos.");

    let paymentId: string;
    if (installmentId) {
      const [inst] = await db.select().from(installments).where(and(eq(installments.id, installmentId), eq(installments.enrollmentId, enrollmentId))).limit(1);
      if (!inst) return fail("Mensalidade não encontrada.");
      if (inst.status === "paga") return fail("Esta mensalidade já está paga.");
      if (amountCents !== inst.amountCents) return fail(`O valor da mensalidade é ${brl(inst.amountCents)}.`);
      const [p] = await db
        .insert(payments)
        .values({ enrollmentId, installmentId, kind: "mensalidade", method, provider: "manual", amountCents, recordedBy: actor.id })
        .returning();
      paymentId = p.id;
    } else {
      // pagamento inicial: reaproveita cobrança pendente para evitar duplicidade
      const pending = await db
        .select()
        .from(payments)
        .where(and(eq(payments.enrollmentId, enrollmentId), eq(payments.status, "pendente")));
      const initial = pending.find((p) => p.kind === "integral" || p.kind === "matricula");
      if (!initial) return fail("Não há cobrança inicial pendente. Use o registro por mensalidade.");
      if (amountCents !== initial.amountCents) return fail(`O valor da cobrança inicial é ${brl(initial.amountCents)}.`);
      await db.update(payments).set({ method, provider: "manual", recordedBy: actor.id, updatedAt: new Date() }).where(eq(payments.id, initial.id));
      paymentId = initial.id;
    }
    await approvePayment(paymentId, "manual", actor.id);
    await audit(actor.id, "financeiro.pagamento_presencial", "payment", paymentId, { amountCents, method });
    return ok("Pagamento registrado e recibo emitido.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function refundPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "financeiro"]);
    const paymentId = str(fd, "paymentId");
    const reason = str(fd, "reason");
    if (reason.length < 5) return fail("Descreva o motivo do reembolso (auditoria).");
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!p) return fail("Pagamento não encontrado.");
    if (p.status !== "aprovado") return fail("Somente pagamentos aprovados podem ser reembolsados.");
    await db.update(payments).set({ status: "reembolsado", updatedAt: new Date() }).where(eq(payments.id, paymentId));
    if (p.installmentId) await db.update(installments).set({ status: "pendente", paidAt: null }).where(eq(installments.id, p.installmentId));
    const [e] = await db.select({ userId: enrollments.userId }).from(enrollments).where(eq(enrollments.id, p.enrollmentId));
    await audit(actor.id, "financeiro.reembolso", "payment", paymentId, { amountCents: p.amountCents, reason });
    if (e) await notify(e.userId, { type: "pagamento", title: "Reembolso registrado", body: "Um reembolso foi registrado pela instituição. Detalhes no portal.", link: "/aluno/financeiro" });
    if (p.provider === "mercadopago") {
      return ok("Reembolso registrado no sistema. Execute também o estorno no painel do Mercado Pago (estorno via API será habilitado na próxima etapa).");
    }
    return ok("Reembolso registrado.");
  } catch (err) {
    return errorToState(err);
  }
}

/** Consulta de status no provedor (fonte da verdade) — usada pelo aluno e pelo polling do checkout. */
export async function checkPaymentStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const paymentId = str(fd, "paymentId");
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!p) return fail("Pagamento não encontrado.");
    const [e] = await db.select({ userId: enrollments.userId }).from(enrollments).where(eq(enrollments.id, p.enrollmentId));
    const isStaff = ["admin", "secretaria", "financeiro"].includes(user.role);
    if (!isStaff && e?.userId !== user.id) return fail("Acesso negado.");
    if (p.status !== "pendente") return ok("Status atualizado.", { status: p.status });
    if (p.provider !== "mercadopago" || !p.providerPaymentId) return ok("Aguardando pagamento na secretaria.", { status: "pendente" });
    const remote = await getProviderPayment(p.providerPaymentId);
    if (remote.status === "approved") {
      await approvePayment(p.id, "consulta", isStaff ? user.id : null);
      return ok("Pagamento confirmado!", { status: "aprovado" });
    }
    if (remote.status === "rejected" || remote.status === "cancelled") {
      await rejectPayment(p.id, "consulta");
      return ok("Pagamento não aprovado.", { status: "recusado" });
    }
    return ok("Ainda aguardando confirmação do provedor.", { status: "pendente" });
  } catch (err) {
    return errorToState(err);
  }
}

export async function regeneratePixAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const cfg = await getSettings();
    if (!mercadopagoConfigured() || !cfg.finance.allowPix) return fail("Pix online indisponível.");
    const paymentId = str(fd, "paymentId");
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!p || p.method !== "pix") return fail("Cobrança Pix não encontrada.");
    const [e] = await db.select().from(enrollments).where(eq(enrollments.id, p.enrollmentId)).limit(1);
    if (!e || e.userId !== user.id) return fail("Acesso negado.");
    if (e.status !== "pendente_pagamento" || p.status !== "pendente") return fail("Esta cobrança não está mais pendente.");
    await db.update(payments).set({ status: "cancelado", updatedAt: new Date() }).where(eq(payments.id, p.id));
    const [np] = await db
      .insert(payments)
      .values({ enrollmentId: e.id, installmentId: p.installmentId, kind: p.kind, method: "pix", provider: "mercadopago", amountCents: p.amountCents })
      .returning();
    const pix = await createPixPayment({ internalId: np.id, amountCents: np.amountCents, description: "Gráfica Lima — curso presencial", payerEmail: user.email, baseUrl: await baseUrl() });
    await db.update(payments).set({ providerPaymentId: pix.providerPaymentId, pixQrCode: pix.qrCode, pixQrBase64: pix.qrBase64, pixExpiresAt: pix.expiresAt }).where(eq(payments.id, np.id));
    await audit(user.id, "financeiro.pix_gerado", "payment", np.id);
    return ok("Novo Pix gerado.", { paymentId: np.id, qrCode: pix.qrCode, qrBase64: pix.qrBase64 });
  } catch (err) {
    return errorToState(err);
  }
}

const couponSchema = z.object({
  code: z.string().min(3, "Código muito curto.").max(24).regex(/^[A-Z0-9-]+$/, "Use letras maiúsculas, números e hífen."),
  type: z.enum(["percentual", "fixo"]),
  maxUses: z.coerce.number().int().positive().optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "financeiro"]);
    const input = couponSchema.parse({
      code: str(fd, "code").toUpperCase(),
      type: str(fd, "type"),
      maxUses: str(fd, "maxUses") || undefined,
      validUntil: str(fd, "validUntil") || undefined,
    });
    const rawValue = str(fd, "value");
    const value = input.type === "percentual" ? Number(rawValue) : parseMoneyToCents(rawValue);
    if (value === null || value <= 0 || (input.type === "percentual" && value > 100)) return fail("Valor de desconto inválido.");
    const minTotal = parseMoneyToCents(str(fd, "minTotal") || "0") ?? 0;
    await db.insert(coupons).values({ code: input.code, type: input.type, value, maxUses: input.maxUses ?? null, validUntil: input.validUntil ?? null, minTotalCents: minTotal });
    await audit(actor.id, "financeiro.cupom_criado", "coupon", input.code, { type: input.type, value });
    return ok("Cupom criado.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function toggleCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "financeiro"]);
    const id = str(fd, "id");
    const [c] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!c) return fail("Cupom não encontrado.");
    await db.update(coupons).set({ active: !c.active }).where(eq(coupons.id, id));
    await audit(actor.id, "financeiro.cupom_alternado", "coupon", id, { active: !c.active });
    return ok(c.active ? "Cupom desativado." : "Cupom ativado.");
  } catch (err) {
    return errorToState(err);
  }
}