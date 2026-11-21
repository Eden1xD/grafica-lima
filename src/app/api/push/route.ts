import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getVapidPublicKey } from "@/lib/notifications";
import { sameOriginOk } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = await getVapidPublicKey();
  return Response.json({ publicKey });
}

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(300) }),
});

export async function POST(req: Request) {
  if (!(await sameOriginOk(req))) return Response.json({ error: "origem inválida" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "inscrição inválida" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, lastUsedAt: new Date() } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await sameOriginOk(req))) return Response.json({ error: "origem inválida" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) {
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, body.endpoint), eq(pushSubscriptions.userId, user.id)));
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
  }
  return Response.json({ ok: true });
}