import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { createGoogleClient, parseGoogleIdToken } from "@/lib/auth/google";
import { createSession, getUserRoles, postLoginDestination, safeNext } from "@/lib/auth/session";
import { userRoles } from "@/db/schema";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = await baseUrl();
  const url = new URL(req.url);
  const store = await cookies();
  const state = store.get("gl_oauth_state")?.value;
  const verifier = store.get("gl_oauth_verifier")?.value;
  const next = safeNext(store.get("gl_oauth_next")?.value, "");
  store.delete("gl_oauth_state");
  store.delete("gl_oauth_verifier");
  store.delete("gl_oauth_next");

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const failRedirect = (reason: string) => Response.redirect(`${origin}/entrar?erro=${reason}`, 302);

  if (!code || !returnedState || !state || returnedState !== state || !verifier) return failRedirect("estado-invalido");
  const google = createGoogleClient(origin);
  if (!google) return failRedirect("google-nao-configurado");

  try {
    const tokens = await google.validateAuthorizationCode(code, verifier);
    const claims = parseGoogleIdToken(tokens.idToken());
    if (!claims?.sub || !claims.email) return failRedirect("conta-google-invalida");

    const [existingAccount] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, claims.sub)))
      .limit(1);

    let userId: string;
    if (existingAccount) {
      userId = existingAccount.userId;
    } else {
      const email = claims.email.toLowerCase();
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser) {
        // Vinculação segura: só quando o Google confirma a propriedade do e-mail.
        if (!claims.email_verified) return failRedirect("email-google-nao-verificado");
        userId = existingUser.id;
        if (!existingUser.emailVerifiedAt) {
          await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
        }
      } else {
        const [created] = await db
          .insert(users)
          .values({
            name: claims.name?.slice(0, 120) || email.split("@")[0],
            email,
            role: "aluno", // login Google nunca concede privilégios
            emailVerifiedAt: claims.email_verified ? new Date() : null,
            avatarUrl: claims.picture ?? null,
          })
          .returning();
        userId = created.id;
      }
      await db.insert(accounts).values({ userId, provider: "google", providerAccountId: claims.sub });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.status !== "ativo") return failRedirect("conta-bloqueada");
    await db.insert(userRoles).values({ userId, role: "aluno" }).onConflictDoNothing();
    await createSession(userId);
    await audit(userId, "auth.login.google", "user", userId);
    const roles = await getUserRoles(userId, user.role);
    const destination = await postLoginDestination({ ...user, roles });
    return Response.redirect(`${origin}${next || destination}`, 302);
  } catch (err) {
    console.error("[google-oauth]", err);
    return failRedirect("falha-google");
  }
}