import Link from "next/link";
import type { Metadata } from "next";
import { loginAction } from "@/server/actions/auth";
import { safeNext } from "@/lib/auth/session";
import { AuthShell, GoogleButton, OrDivider } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { Alert, Field, Input } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  "google-nao-configurado": "Login Google indisponível neste ambiente.",
  "estado-invalido": "Sessão de login expirada. Tente novamente.",
  "conta-google-invalida": "Não foi possível validar sua conta Google.",
  "email-google-nao-verificado": "Seu e-mail Google não está verificado. Use o cadastro com senha.",
  "conta-bloqueada": "Conta bloqueada. Fale com a secretaria.",
  "falha-google": "Falha na autenticação com Google. Tente novamente.",
  "muitas-tentativas": "Muitas tentativas. Aguarde um minuto.",
};

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  return (
    <AuthShell
      title="Entrar na plataforma"
      subtitle="Acesse seu portal de aluno, professor ou administração."
      footer={<>Ainda não tem conta? <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">Cadastre-se</Link></>}
    >
      {sp.erro ? <Alert variant="danger" className="mb-4">{ERRORS[sp.erro] ?? "Não foi possível entrar. Tente novamente."}</Alert> : null}
      <ActionForm action={loginAction} inline submitLabel="Entrar" className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail"><Input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" /></Field>
        <Field label="Senha"><Input name="password" type="password" required autoComplete="current-password" placeholder="Sua senha" /></Field>
        <div className="text-right">
          <Link href="/recuperar-senha" className="text-xs font-semibold text-brand hover:underline">Esqueci minha senha</Link>
        </div>
      </ActionForm>
      <OrDivider />
      <GoogleButton next={next} />
    </AuthShell>
  );
}