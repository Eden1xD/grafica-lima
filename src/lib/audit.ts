import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { clientIp } from "@/lib/auth/rate-limit";

/** Registro de auditoria — nunca registra senhas/segredos. */
export async function audit(
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  let ip: string | null = null;
  try {
    ip = await clientIp();
  } catch {
    // fora de contexto de requisição (scripts/jobs) — registra sem IP
  }
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      resourceId: resourceId ?? null,
      details: details ?? null,
      ip,
    });
  } catch (err) {
    console.error("[audit] falha ao registrar", action, err);
  }
}