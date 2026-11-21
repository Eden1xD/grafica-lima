import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { createGoogleClient } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/session";
import { baseUrl } from "@/lib/request";
import { rateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = await baseUrl();
  const google = createGoogleClient(origin);
  if (!google) return Response.redirect(`${origin}/entrar?erro=google-nao-configurado`, 302);
  if (!rateLimit(`google-start:${url.searchParams.get("ip") ?? "x"}`, 30, 60_000)) {
    return Response.redirect(`${origin}/entrar?erro=muitas-tentativas`, 302);
  }
  const state = generateState();
  const verifier = generateCodeVerifier();
  const authUrl = google.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  const store = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  store.set("gl_oauth_state", state, opts);
  store.set("gl_oauth_verifier", verifier, opts);
  store.set("gl_oauth_next", safeNext(url.searchParams.get("next"), ""), opts);
  return Response.redirect(authUrl.toString(), 302);
}