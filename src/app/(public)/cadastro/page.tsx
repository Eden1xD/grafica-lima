import Link from "next/link";
import type { Metadata } from "next";
import { registerAction } from "@/server/actions/auth";
import { safeNext } from "@/lib/auth/session";
import { AuthShell, GoogleButton, OrDivider } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  return (
    <AuthShell
      title="Criar sua conta"
      subtitle="Cadastro rápido: só nome, e-mail e senha. CPF e endereço são pedidos apenas na matrícula."
      footer={<>Já tem conta? <Link href={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">Entrar</Link></>}
    >
      <ActionForm action={registerAction} inline submitLabel="Criar conta" className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Nome completo"><Input name="name" required minLength={3} autoComplete="name" placeholder="Seu nome completo" /></Field>
        <Field label="E-mail"><Input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" /></Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres."><Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Crie uma senha" /></Field>
      </ActionForm>
      <OrDivider />
      <GoogleButton next={next} />
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Ao criar a conta você concorda com os <Link href="/termos" className="text-brand underline">Termos</Link> e a <Link href="/privacidade" className="text-brand underline">Política de Privacidade</Link>.
      </p>
    </AuthShell>
  );
}