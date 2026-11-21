import { createHmac, timingSafeEqual } from "crypto";

/**
 * Adaptador Mercado Pago — endpoints oficiais:
 *  POST https://api.mercadopago.com/v1/payments        (Pix, com X-Idempotency-Key)
 *  GET  https://api.mercadopago.com/v1/payments/{id}   (consulta de status)
 *  POST https://api.mercadopago.com/checkout/preferences (Checkout Pro p/ cartão)
 * Webhook: assinatura x-signature (HMAC-SHA256 do manifest id/request-id/ts).
 */

const API = "https://api.mercadopago.com";

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN ausente).");
  return t;
}

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token()}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.message === "string" ? data.message : `HTTP ${res.status}`;
    throw new Error(`Mercado Pago: ${msg}`);
  }
  return data;
}

export type PixResult = { providerPaymentId: string; qrCode: string; qrBase64: string; expiresAt: Date | null };

export async function createPixPayment(input: {
  internalId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  baseUrl: string;
}): Promise<PixResult> {
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  const data = await mpFetch("/v1/payments", {
    method: "POST",
    idempotencyKey: input.internalId,
    body: JSON.stringify({
      transaction_amount: input.amountCents / 100,
      description: input.description.slice(0, 250),
      payment_method_id: "pix",
      external_reference: input.internalId,
      notification_url: `${input.baseUrl}/api/webhooks/mercadopago`,
      date_of_expiration: expires.toISOString().replace("Z", "-00:00"),
      payer: { email: input.payerEmail },
    }),
  });
  const tx = (data.point_of_interaction as Record<string, unknown> | undefined)?.transaction_data as
    | Record<string, unknown>
    | undefined;
  if (!data.id || !tx?.qr_code) throw new Error("Mercado Pago não retornou QR Code Pix.");
  return {
    providerPaymentId: String(data.id),
    qrCode: String(tx.qr_code),
    qrBase64: String(tx.qr_code_base64 ?? ""),
    expiresAt: expires,
  };
}

export async function createCardPreference(input: {
  internalId: string;
  title: string;
  amountCents: number;
  payerEmail: string;
  maxInstallments: number;
  baseUrl: string;
  returnPath: string;
}): Promise<{ preferenceId: string; initPoint: string }> {
  const back = `${input.baseUrl}${input.returnPath}`;
  const data = await mpFetch("/checkout/preferences", {
    method: "POST",
    idempotencyKey: input.internalId,
    body: JSON.stringify({
      items: [{ title: input.title.slice(0, 250), quantity: 1, unit_price: input.amountCents / 100, currency_id: "BRL" }],
      external_reference: input.internalId,
      notification_url: `${input.baseUrl}/api/webhooks/mercadopago`,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: Math.max(1, input.maxInstallments) },
      statement_descriptor: "GRAFICA LIMA",
    }),
  });
  const initPoint = String(data.init_point ?? data.sandbox_init_point ?? "");
  if (!data.id || !initPoint) throw new Error("Mercado Pago não retornou URL de checkout.");
  return { preferenceId: String(data.id), initPoint };
}

export async function getProviderPayment(providerPaymentId: string): Promise<{ status: string; externalReference: string | null }> {
  const data = await mpFetch(`/v1/payments/${providerPaymentId}`);
  return { status: String(data.status ?? ""), externalReference: data.external_reference ? String(data.external_reference) : null };
}

/** Validação oficial da assinatura x-signature dos webhooks. */
export function verifyWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !opts.xSignature || !opts.dataId) return false;
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const idAlnum = opts.dataId.toLowerCase().replace(/[^a-z0-9]/g, "");
  let manifest = `id:${idAlnum};`;
  if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`;
  manifest += `ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
  } catch {
    return false;
  }
}