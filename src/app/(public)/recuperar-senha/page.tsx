import Link from "next/link";
import type { Metadata } from "next";
import { requestResetAction } from "@/server/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe seu e-mail e enviaremos um link seguro para redefinir a senha."
      footer={<Link href="/entrar" className="font-semibold text-brand hover:underline">Voltar para o login</Link>}
    >
      <ActionForm action={requestResetAction} inline submitLabel="Enviar link de recuperação" className="space-y-4">
        <Field label="E-mail"><Input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" /></Field>
      </ActionForm>
    </AuthShell>
  );
}