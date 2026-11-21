import { Google, decodeIdToken } from "arctic";
import { googleConfigured } from "@/lib/settings";

export type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss?: string;
  aud?: string;
  exp?: number;
};

export function createGoogleClient(origin: string): Google | null {
  if (!googleConfigured()) return null;
  return new Google(
    process.env.GOOGLE_CLIENT_ID as string,
    process.env.GOOGLE_CLIENT_SECRET as string,
    `${origin}/api/auth/google/callback`,
  );
}

/** id_token obtido diretamente do endpoint de token do Google (TLS) — validamos iss/aud/exp. */
export function parseGoogleIdToken(idToken: string): GoogleClaims | null {
  try {
    const claims = decodeIdToken(idToken) as GoogleClaims;
    if (!claims.sub) return null;
    if (claims.iss && claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
    if (claims.aud && claims.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}