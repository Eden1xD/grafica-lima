import { ZodError } from "zod";
import { AuthzError } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/action-state";

export type { ActionState };
export { IDLE } from "@/lib/action-state";

export function ok(message?: string, data?: Record<string, unknown>): ActionState {
  return { status: "ok", message, data };
}

export function fail(message: string): ActionState {
  return { status: "error", message };
}

export function errorToState(err: unknown): ActionState {
  if (err instanceof ZodError) return fail(err.issues[0]?.message ?? "Dados inválidos.");
  if (err instanceof AuthzError) return fail(err.message);
  if (err instanceof Error) {
    if (err.message.includes("duplicate key") || err.message.includes("unique"))
      return fail("Registro duplicado: esta operação já foi realizada.");
    console.error("[action]", err);
    return fail(err.message.slice(0, 200));
  }
  return fail("Erro inesperado. Tente novamente.");
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}