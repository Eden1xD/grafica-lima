"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cohorts, couponRedemptions, coupons, courses, enrollments, installments, payments, studentProfiles, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { applyCoupon, isMinor, isValidCpf, splitInstallments } from "@/lib/domain";
import { addMonthsISO, onlyDigits, todayISO } from "@/lib/utils";
import { getSettings, mercadopagoConfigured } from "@/lib/settings";
import { createPixPayment, createCardPreference } from "@/lib/payments/mercadopago";
import { takenSeats } from "@/lib/payments/core";
import { notify, userIdsByRole } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/request";
import { limitAuth } from "@/lib/auth/rate-limit";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

const profileSchema = z.object({
  cpf: z.string().refine(isValidCpf, "CPF inválido."),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento."),
  phone: z.string().min(8, "Telefone inválido.").max(20),
  cep: z.string().min(8, "CEP inválido.").max(9),
  street: z.string().min(2, "Informe o endereço.").max(160),
  number: z.string().min(1, "Informe o número.").max(20),
  complement: z.string().max(80).optional(),
  district: z.string().min(2, "Informe o bairro.").max(80),
  city: z.string().min(2, "Informe a cidade.").max(80),
  state: z.string().length(2, "UF inválida."),
  guardianName: z.string().max(120).optional(),
  guardianCpf: z.string().optional(),
  guardianPhone: z.string().max(20).optional(),
});

export async function saveCheckoutProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada. Entre novamente.");
    const input = profileSchema.parse({
      cpf: onlyDigits(str(fd, "cpf")),
      birthDate: str(fd, "birthDate"),
      phone: str(fd, "phone"),
      cep: onlyDigits(str(fd, "cep")),
      street: str(fd, "street"),
      number: str(fd, "number"),
      complement: str(fd, "complement") || undefined,
      district: str(fd, "district"),
      city: str(fd, "city"),
      state: str(fd, "state").toUpperCase(),
      guardianName: str(fd, "guardianName") || undefined,
      guardianCpf: str(fd, "guardianCpf") || undefined,
      guardianPhone: str(fd, "guardianPhone") || undefined,
    });
    if (isMinor(input.birthDate, todayISO())) {
      if (!input.guardianName || input.guardianName.length < 3) return fail("Menores de idade precisam do nome do responsável legal.");
      if (!input.guardianCpf || !isValidCpf(input.guardianCpf)) return fail("CPF do responsável inválido.");
      if (!input.guardianPhone || input.guardianPhone.length < 8) return fail("Telefone do responsável inválido.");
    }
    const values = { ...input, cpf: onlyDigits(input.cpf), guardianCpf: input.guardianCpf ? onlyDigits(input.guardianCpf) : null, updatedAt: new Date() };
    await db.insert(studentProfiles).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: studentProfiles.userId, set: values });
    return ok("Dados salvos.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function couponPreviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Entre para aplicar o cupom.");
    const code = str(fd, "coupon").toUpperCase();
    const cohortId = str(fd, "cohortId");
    if (!code) return fail("Digite um cupom.");
    const [row] = await db
      .select({ price: courses.priceCents })
      .from(cohorts)
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(cohorts.id, cohortId))
      .limit(1);
    if (!row) return fail("Turma não encontrada.");
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (!coupon) return fail("Cupom não encontrado.");
    const result = applyCoupon(row.price, coupon, todayISO());
    if (!result.ok) return fail(result.reason);
    return ok("Cupom válido.", { discountCents: result.discountCents, netCents: row.price - result.discountCents, code });
  } catch (err) {
    return errorToState(err);
  }
}

const enrollSchema = z.object({
  cohortId: z.string().uuid(),
  plan: z.enum(["integral", "mensal"]),
  method: z.enum(["manual", "pix", "cartao"]),
  months: z.coerce.number().int().min(1).max(12),
});

export async function createEnrollmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Entre na sua conta para se matricular.");
    if (!(await limitAuth(`enroll:${user.id}`, 8, 10 * 60 * 1000))) return fail("Muitas tentativas. Aguarde alguns minutos.");
    if (str(fd, "accept") !== "on") return fail("Você precisa aceitar o contrato para concluir a matrícula.");
    const input = enrollSchema.parse({ cohortId: str(fd, "cohortId"), plan: str(fd, "plan"), method: str(fd, "method"), months: str(fd, "months") || "4" });
    const couponCode = str(fd, "coupon").toUpperCase();

    const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1);
    if (!profile?.cpf || !profile.birthDate || !profile.phone || !profile.cep || !profile.street || !profile.city)
      return fail("Complete seus dados pessoais na etapa 1 antes de continuar.");
    if (isMinor(profile.birthDate, todayISO()) && (!profile.guardianName || !profile.guardianCpf))
      return fail("Informe os dados do responsável legal na etapa 1.");

    const [ctx] = await db
      .select({ cohort: cohorts, course: courses })
      .from(cohorts)
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(cohorts.id, input.cohortId))
      .limit(1);
    if (!ctx || ctx.course.status !== "publicado") return fail("Curso indisponível.");
    if (ctx.cohort.status !== "aberta") return fail("Esta turma não está com matrículas abertas.");
    if (ctx.cohort.endDate < todayISO()) return fail("Esta turma já foi encerrada.");

    const cfg = await getSettings();
    if (input.method === "manual" && !cfg.finance.allowManual) return fail("Pagamento na secretaria desativado.");
    if (input.method === "pix" && (!cfg.finance.allowPix || !mercadopagoConfigured())) return fail("Pix online indisponível no momento. Use pagamento na secretaria.");
    if (input.method === "cartao" && (!cfg.finance.allowCard || !mercadopagoConfigured())) return fail("Cartão online indisponível no momento. Use pagamento na secretaria.");

    const months = Math.min(input.months, Math.max(1, ctx.course.maxInstallments));
    const method = input.method === "manual" ? "dinheiro" : input.method === "pix" ? "pix" : "cartao";
    const provider = input.method === "manual" ? "manual" : "mercadopago";

    const created = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(cohorts).where(eq(cohorts.id, input.cohortId)).for("update");
      const taken = await takenSeats(input.cohortId, tx);
      if (taken >= locked.capacity) throw new Error("Turma lotada. Entre na lista de espera pelo contato.");
      const [dup] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, input.cohortId)))
        .limit(1);
      if (dup) throw new Error("Você já possui matrícula nesta turma. Acompanhe pelo portal do aluno.");

      let discountCents = 0;
      let couponId: string | null = null;
      if (couponCode) {
        const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, couponCode)).for("update");
        if (!coupon) throw new Error("Cupom não encontrado.");
        const r = applyCoupon(ctx.course.priceCents, coupon, todayISO());
        if (!r.ok) throw new Error(r.reason);
        discountCents = r.discountCents;
        couponId = coupon.id;
        await tx.update(coupons).set({ usedCount: coupon.usedCount + 1 }).where(eq(coupons.id, coupon.id));
      }
      const netTotal = ctx.course.priceCents - discountCents;
      const [enrollment] = await tx
        .insert(enrollments)
        .values({
          userId: user.id,
          cohortId: input.cohortId,
          plan: input.plan,
          totalCents: netTotal,
          discountCents,
          couponId,
          contractAcceptedAt: new Date(),
          contractVersion: "v1",
          pendingExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        })
        .returning();
      if (couponId) await tx.insert(couponRedemptions).values({ couponId, enrollmentId: enrollment.id, userId: user.id });

      let initialPayment;
      if (input.plan === "integral") {
        [initialPayment] = await tx
          .insert(payments)
          .values({ enrollmentId: enrollment.id, kind: "integral", method, provider, amountCents: netTotal })
          .returning();
      } else {
        const split = splitInstallments(netTotal, ctx.course.entryCents, months);
        const instRows = await tx
          .insert(installments)
          .values(split.installments.map((amount, i) => ({ enrollmentId: enrollment.id, number: i + 1, dueDate: addMonthsISO(ctx.cohort.startDate, i), amountCents: amount })))
          .returning();
        const entryAmount = split.entryCents > 0 ? split.entryCents : instRows[0].amountCents;
        [initialPayment] = await tx
          .insert(payments)
          .values({
            enrollmentId: enrollment.id,
            kind: "matricula",
            method,
            provider,
            amountCents: entryAmount,
            installmentId: split.entryCents > 0 ? null : instRows[0].id,
          })
          .returning();
      }
      return { enrollmentId: enrollment.id, paymentId: initialPayment.id, amountCents: initialPayment.amountCents };
    });

    await audit(user.id, "matricula.criada", "enrollment", created.enrollmentId, { plan: input.plan, method: input.method });

    if (input.method === "manual") {
      const staff = await userIdsByRole(["admin", "secretaria", "financeiro"]);
      await notify(staff, { type: "matricula", title: "Matrícula aguardando pagamento presencial", link: "/admin/matriculas" });
      return ok("Matrícula reservada por 48h.", { ...created, mode: "manual" });
    }
    const origin = await baseUrl();
    if (input.method === "pix") {
      try {
        const pix = await createPixPayment({
          internalId: created.paymentId,
          amountCents: created.amountCents,
          description: `${ctx.course.name} — ${ctx.cohort.name}`,
          payerEmail: user.email,
          baseUrl: origin,
        });
        await db
          .update(payments)
          .set({ providerPaymentId: pix.providerPaymentId, pixQrCode: pix.qrCode, pixQrBase64: pix.qrBase64, pixExpiresAt: pix.expiresAt, updatedAt: new Date() })
          .where(eq(payments.id, created.paymentId));
        return ok("Pix gerado.", { ...created, mode: "pix", qrCode: pix.qrCode, qrBase64: pix.qrBase64 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "falha no gateway";
        return ok("Matrícula reservada, mas o Pix não pôde ser gerado agora.", { ...created, mode: "manual", notice: `${msg} — pague na secretaria ou gere um novo Pix pelo portal.` });
      }
    }
    try {
      const pref = await createCardPreference({
        internalId: created.paymentId,
        title: `${ctx.course.name} — ${ctx.cohort.name}`,
        amountCents: created.amountCents,
        payerEmail: user.email,
        maxInstallments: ctx.course.maxInstallments,
        baseUrl: origin,
        returnPath: `/matricula/confirmacao?enrollment=${created.enrollmentId}`,
      });
      await db.update(payments).set({ providerPreferenceId: pref.preferenceId, updatedAt: new Date() }).where(eq(payments.id, created.paymentId));
      return ok("Redirecionando para o checkout seguro…", { ...created, mode: "card", url: pref.initPoint });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "falha no gateway";
      return ok("Matrícula reservada, mas o checkout de cartão não pôde ser aberto.", { ...created, mode: "manual", notice: `${msg} — pague na secretaria ou tente novamente pelo portal.` });
    }
  } catch (err) {
    return errorToState(err);
  }
}

export async function requestCancellationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const enrollmentId = str(fd, "enrollmentId");
    const reason = str(fd, "reason") || "Não informado";
    const [e] = await db.select().from(enrollments).where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, user.id))).limit(1);
    if (!e) return fail("Matrícula não encontrada.");
    if (e.status === "cancelada") return fail("Matrícula já cancelada.");
    const staff = await userIdsByRole(["admin", "secretaria", "financeiro"]);
    await notify(staff, { type: "cancelamento", title: "Solicitação de cancelamento de matrícula", body: `Motivo: ${reason.slice(0, 120)}`, link: "/admin/matriculas" });
    await audit(user.id, "matricula.cancelamento_solicitado", "enrollment", enrollmentId, { reason });
    return ok("Solicitação registrada. A secretaria responderá em até 10 dias úteis, conforme a política de cancelamento.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function updateStudentNameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const name = str(fd, "name");
    if (name.length < 3) return fail("Informe seu nome completo.");
    await db.update(users).set({ name: name.slice(0, 120), updatedAt: new Date() }).where(eq(users.id, user.id));
    return ok("Nome atualizado.");
  } catch (err) {
    return errorToState(err);
  }
}