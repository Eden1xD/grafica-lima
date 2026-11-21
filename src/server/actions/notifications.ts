"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications, pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { type ActionState, fail, ok, str } from "./types";

export async function markNotificationReadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail("Sessão expirada.");
  const id = str(fd, "id");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/notificacoes");
  return ok();
}

export async function markAllReadAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/notificacoes");
}

export async function archiveNotificationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail("Sessão expirada.");
  const id = str(fd, "id");
  await db.update(notifications).set({ archivedAt: new Date(), readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/notificacoes");
  return ok();
}

export async function disablePushAction(_prev?: ActionState, _fd?: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail("Sessão expirada.");
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
  return ok("Notificações push desativadas para esta conta.");
}