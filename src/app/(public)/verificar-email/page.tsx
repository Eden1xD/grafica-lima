import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { consumeEmailToken, resendVerificationAction } from "@/server/actions/auth";
import { getSessionUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerificarEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const result = sp.token ? await consumeEmailToken(sp.token) : null;
  return (
    <AuthShell title="Verificação de e-mail" subtitle="Confirme seu e-mail para garantir a segurança da sua conta.">
      {result ? (
        <Alert variant={result.ok ? "success" : "danger"} className="flex items-center gap-2">
          {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {result.message}
        </Alert>
      ) : (
        <p className="text-sm text-muted">Enviamos um link de verificação quando você criou a conta. Abra o e-mail e clique no botão para confirmar.</p>
      )}
      {user && !user.emailVerifiedAt ? (
        <ActionForm action={resendVerificationAction} inline submitLabel="Reenviar link de verificação" submitVariant="secondary" className="mt-5" />
      ) : null}
      <div className="mt-6 text-center text-sm">
        <Link href={user ? "/aluno" : "/entrar"} className="font-semibold text-brand hover:underline">
          {user ? "Ir para meu portal" : "Ir para o login"}
        </Link>
      </div>
    </AuthShell>
  );
}