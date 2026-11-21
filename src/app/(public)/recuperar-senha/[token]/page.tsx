import Link from "next/link";
import type { Metadata } from "next";
import { resetPasswordAction } from "@/server/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell
      title="Definir nova senha"
      subtitle="Escolha uma nova senha para sua conta. Todas as sessões anteriores serão encerradas."
      footer={<Link href="/entrar" className="font-semibold text-brand hover:underline">Ir para o login</Link>}
    >
      <ActionForm action={resetPasswordAction} inline submitLabel="Salvar nova senha" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Nova senha" hint="Mínimo de 8 caracteres."><Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Nova senha" /></Field>
      </ActionForm>
    </AuthShell>
  );
}