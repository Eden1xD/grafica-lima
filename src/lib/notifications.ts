import { generateVAPIDKeys, sendNotification, setVapidDetails } from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, pushSubscriptions, notificationDeliveries, userRoles, users } from "@/db/schema";
import { getSettings, saveSetting } from "@/lib/settings";

/**
 * Notificações reais: central interna persistida + Web Push (VAPID).
 * O push é complementar — se falhar, a central continua funcionando.
 * Conteúdo do push não inclui dados sensíveis (valores, notas, documentos).
 */

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const cfg = await getSettings();
  if (cfg.push?.publicKey && cfg.push?.privateKey) return cfg.push;
  const keys = generateVAPIDKeys();
  await saveSetting("push", keys);
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

type NotifyInput = { type: string; title: string; body?: string; link?: string };

export async function notify(userIds: string | string[], input: NotifyInput): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;
  const rows = await db
    .insert(notifications)
    .values(ids.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body ?? "", link: input.link ?? null })))
    .returning({ id: notifications.id, userId: notifications.userId });
  // envio assíncrono — não bloqueia a operação principal
  void sendPushBatch(rows.map((r) => ({ id: r.id, userId: r.userId })), input).catch((err) =>
    console.error("[push] falha no lote", err),
  );
}

async function sendPushBatch(items: Array<{ id: string; userId: string }>, input: NotifyInput): Promise<void> {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, items.map((i) => i.userId)));
  if (subs.length === 0) return;
  const keys = await getVapidKeys();
  const cfg = await getSettings();
  setVapidDetails(`mailto:${cfg.institution.email || "contato@graficalima.com.br"}`, keys.publicKey, keys.privateKey);
  const payload = JSON.stringify({
    title: input.title,
    body: input.body || "Toque para abrir a plataforma.",
    link: input.link ?? "/notificacoes",
  });
  for (const sub of subs) {
    const item = items.find((i) => i.userId === sub.userId);
    try {
      await sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      );
      await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.id, sub.id));
      await db.insert(notificationDeliveries).values({ notificationId: item?.id ?? null, channel: "push", status: "enviado" });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        await db.insert(notificationDeliveries).values({ notificationId: item?.id ?? null, channel: "push", status: "removido", error: "inscrição expirada" });
      } else {
        await db.insert(notificationDeliveries).values({
          notificationId: item?.id ?? null,
          channel: "push",
          status: "falhou",
          error: err instanceof Error ? err.message.slice(0, 300) : "erro",
        });
      }
    }
  }
}

export async function userIdsByRole(roles: Array<"admin" | "secretaria" | "financeiro" | "professor" | "aluno">): Promise<string[]> {
  const [multi, legacy] = await Promise.all([
    db.select({ id: userRoles.userId }).from(userRoles).where(inArray(userRoles.role, roles)),
    db.select({ id: users.id }).from(users).where(inArray(users.role, roles)),
  ]);
  return [...new Set([...multi.map((r) => r.id), ...legacy.map((r) => r.id)])];
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.userId, userId));
  return rows.filter(() => true).length === 0 ? 0 : countUnread(userId);
}

async function countUnread(userId: string): Promise<number> {
  const { and, isNull } = await import("drizzle-orm");
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.archivedAt)));
  return rows.length;
}