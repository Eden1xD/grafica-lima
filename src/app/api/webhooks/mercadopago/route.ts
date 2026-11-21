import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, webhookEvents } from "@/db/schema";
import { getProviderPayment, verifyWebhookSignature } from "@/lib/payments/mercadopago";
import { approvePayment, rejectPayment } from "@/lib/payments/core";

export const dynamic = "force-dynamic";

/**
 * Webhook Mercado Pago — autenticado (HMAC x-signature) e idempotente
 * (evento registrado com chave única; reentregas não duplicam efeitos).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const dataId = url.searchParams.get("data.id") ?? (body?.data?.id != null ? String(body.data.id) : null) ?? url.searchParams.get("id");
  const type = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "unknown";

  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return Response.json({ error: "webhook não configurado (MERCADOPAGO_WEBHOOK_SECRET ausente)" }, { status: 503 });
  }
  const valid = verifyWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
  });
  if (!valid || !dataId) return Response.json({ error: "assinatura inválida" }, { status: 401 });

  const eventKey = `${type}:${dataId}`;
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider: "mercadopago", eventKey, payload: { type, dataId } })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) return Response.json({ ok: true, duplicate: true });

  try {
    if (type === "payment" || type === "topic_payment") {
      const remote = await getProviderPayment(dataId);
      const [p] = await db.select().from(payments).where(eq(payments.providerPaymentId, dataId)).limit(1);
      if (p) {
        if (remote.status === "approved") await approvePayment(p.id, "webhook", null);
        else if (remote.status === "rejected" || remote.status === "cancelled") await rejectPayment(p.id, "webhook");
      }
    }
    await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, inserted[0].id));
    return Response.json({ ok: true });
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ error: err instanceof Error ? err.message.slice(0, 400) : "erro" })
      .where(eq(webhookEvents.id, inserted[0].id));
    return Response.json({ error: "falha no processamento — reentrega será tentada" }, { status: 500 });
  }
}