import { headers } from "next/headers";

/**
 * Rate limiting em memória (instância única). Em produção com múltiplas
 * instâncias, substituir por Redis/Upstash — ponto de extensão isolado.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  return b.count <= max;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function limitAuth(action: string, max = 10, windowMs = 10 * 60 * 1000): Promise<boolean> {
  return rateLimit(`${action}:${await clientIp()}`, max, windowMs);
}

/** CSRF para route handlers: exige Origin do próprio host em mutações. */
export async function sameOriginOk(req: Request): Promise<boolean> {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const h = await headers();
  const host = h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}