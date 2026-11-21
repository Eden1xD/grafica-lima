"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser, getUserRoles, postLoginDestination, revokeUserSessions, safeNext } from "@/lib/auth/session";
import { userRoles } from "@/db/schema";
import { limitAuth } from "@/lib/auth/rate-limit";
import { hashToken, randomToken } from "@/lib/crypto";
import { sendEmail, emailTemplate } from "@/lib/email";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/request";
import { type ActionState, errorToState, fail, ok, str } from "./types";

const registerSchema = z.object({
  name: z.string().min(3, "Informe seu nome completo.").max(120),
  email: z.string().email("E-mail inválido.").max(160),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128),
});

async function issueToken(userId: string, type: "verificar_email" | "recuperar_senha", ttlMs: number): Promise<string> {
  const token = randomToken();
  await db.insert(authTokens).values({ userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("register", 5))) return fail("Muitas tentativas. Aguarde alguns minutos.");
    const input = registerSchema.parse({ name: str(fd, "name"), email: str(fd, "email").toLowerCase(), password: str(fd, "password") });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) return fail("Este e-mail já possui cadastro. Entre ou recupere sua senha.");
    const [user] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: "aluno" })
      .returning();
    await db.insert(userRoles).values({ userId: user.id, role: "aluno" }).onConflictDoNothing();
    const token = await issueToken(user.id, "verificar_email", 1000 * 60 * 60 * 24);
    const url = `${await baseUrl()}/verificar-email?token=${token}`;
    await sendEmail(user.email, "Confirme seu e-mail — Gráfica Lima", emailTemplate("Bem-vindo(a)!", "Confirme seu e-mail para concluir seu cadastro na plataforma.", { label: "Confirmar e-mail", url }));
    await createSession(user.id);
    await audit(user.id, "auth.cadastro", "user", user.id);
    redirect(safeNext(str(fd, "next"), "/aluno"));
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    return errorToState(err);
  }
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("login", 10))) return fail("Muitas tentativas de login. Aguarde 10 minutos.");
    const email = str(fd, "email").toLowerCase();
    const password = str(fd, "password");
    if (!email || !password) return fail("Informe e-mail e senha.");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false;
    if (!user || !valid) return fail("E-mail ou senha incorretos.");
    if (user.status !== "ativo") return fail("Conta bloqueada. Fale com a secretaria.");
    await createSession(user.id);
    await audit(user.id, "auth.login", "user", user.id);
    const roles = await getUserRoles(user.id, user.role);
    const destination = await postLoginDestination({ ...user, roles });
    redirect(safeNext(str(fd, "next"), destination));
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    return errorToState(err);
  }
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout", "user", user.id);
  redirect("/");
}

export async function requestResetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("reset", 5))) return fail("Muitas solicitações. Aguarde alguns minutos.");
    const email = str(fd, "email").toLowerCase();
    if (!z.string().email().safeParse(email).success) return fail("E-mail inválido.");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const token = await issueToken(user.id, "recuperar_senha", 1000 * 60 * 60);
      const url = `${await baseUrl()}/recuperar-senha/${token}`;
      await sendEmail(user.email, "Recuperação de senha — Gráfica Lima", emailTemplate("Redefinir senha", "Recebemos uma solicitação para redefinir sua senha. O link expira em 1 hora. Se não foi você, ignore este e-mail.", { label: "Redefinir senha", url }));
      await audit(user.id, "auth.recuperacao_solicitada", "user", user.id);
    }
    return ok("Se este e-mail estiver cadastrado, enviaremos as instruções de recuperação.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await limitAuth("reset-confirm", 10))) return fail("Muitas tentativas. Aguarde alguns minutos.");
    const token = str(fd, "token");
    const password = str(fd, "password");
    if (password.length < 8) return fail("A senha deve ter pelo menos 8 caracteres.");
    const [row] = await db
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "recuperar_senha"), isNull(authTokens.usedAt)))
      .limit(1);
    if (!row || row.expiresAt.getTime() < Date.now()) return fail("Link inválido ou expirado. Solicite novamente.");
    await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, row.userId));
    await revokeUserSessions(row.userId);
    await audit(row.userId, "auth.senha_redefinida", "user", row.userId);
    return ok("Senha redefinida com sucesso. Entre com a nova senha.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function resendVerificationAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Entre na sua conta primeiro.");
    if (user.emailVerifiedAt) return ok("E-mail já verificado.");
    if (!(await limitAuth(`resend:${user.id}`, 3))) return fail("Aguarde antes de reenviar.");
    const token = await issueToken(user.id, "verificar_email", 1000 * 60 * 60 * 24);
    const url = `${await baseUrl()}/verificar-email?token=${token}`;
    await sendEmail(user.email, "Confirme seu e-mail — Gráfica Lima", emailTemplate("Confirme seu e-mail", "Use o botão abaixo para confirmar seu e-mail.", { label: "Confirmar e-mail", url }));
    return ok("Enviamos um novo link de verificação para o seu e-mail.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Sessão expirada.");
    const current = str(fd, "current");
    const next = str(fd, "password");
    if (next.length < 8) return fail("A nova senha deve ter pelo menos 8 caracteres.");
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, current))) return fail("Senha atual incorreta.");
    await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user.id, "auth.senha_alterada", "user", user.id);
    return ok("Senha alterada com sucesso.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function consumeEmailToken(token: string): Promise<{ ok: boolean; message: string }> {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "verificar_email"), isNull(authTokens.usedAt)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, message: "Link inválido ou expirado." };
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  await audit(row.userId, "auth.email_verificado", "user", row.userId);
  return { ok: true, message: "E-mail verificado com sucesso!" };
}