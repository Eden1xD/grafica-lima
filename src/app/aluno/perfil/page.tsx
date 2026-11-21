import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { changePasswordAction } from "@/server/actions/auth";
import { saveCheckoutProfileAction, updateStudentNameAction } from "@/server/actions/enrollment";
import { Collapse } from "@/components/action-form";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, LinkButton, PageTitle } from "@/components/ui";
import { PushOptIn } from "@/components/push-optin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meu perfil" };

export default async function AlunoPerfilPage() {
  const user = await requireUser("/aluno/perfil");
  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1);

  return (
    <div className="max-w-3xl">
      <PageTitle title="Meu perfil" description="Gerencie seus dados, senha e preferências de notificação." />
      <div className="space-y-5">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-bold text-ink"><UserRound className="h-4 w-4 text-brand" />Dados da conta</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{user.email}</span>
            {user.emailVerifiedAt ? <Badge variant="success"><ShieldCheck className="h-3 w-3" />E-mail verificado</Badge> : <Badge variant="warn">E-mail não verificado</Badge>}
          </div>
          <ActionForm action={updateStudentNameAction} submitLabel="Salvar nome" submitSize="sm" className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Nome completo" className="min-w-64 flex-1"><Input name="name" defaultValue={user.name} required minLength={3} /></Field>
          </ActionForm>
        </Card>

        <Collapse title="Dados pessoais e endereço (usados na matrícula)">
          <ActionForm action={saveCheckoutProfileAction} submitLabel="Salvar dados" className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF"><Input name="cpf" defaultValue={profile?.cpf ?? ""} required placeholder="000.000.000-00" /></Field>
            <Field label="Data de nascimento"><Input name="birthDate" type="date" defaultValue={profile?.birthDate ?? ""} required /></Field>
            <Field label="Telefone"><Input name="phone" defaultValue={profile?.phone ?? ""} required /></Field>
            <Field label="CEP"><Input name="cep" defaultValue={profile?.cep ?? ""} required /></Field>
            <Field label="Endereço" className="sm:col-span-2"><Input name="street" defaultValue={profile?.street ?? ""} required /></Field>
            <Field label="Número"><Input name="number" defaultValue={profile?.number ?? ""} required /></Field>
            <Field label="Complemento"><Input name="complement" defaultValue={profile?.complement ?? ""} /></Field>
            <Field label="Bairro"><Input name="district" defaultValue={profile?.district ?? ""} required /></Field>
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <Field label="Cidade"><Input name="city" defaultValue={profile?.city ?? ""} required /></Field>
              <Field label="UF"><Input name="state" maxLength={2} defaultValue={profile?.state ?? ""} required /></Field>
            </div>
            <Field label="Responsável legal (se menor)"><Input name="guardianName" defaultValue={profile?.guardianName ?? ""} /></Field>
            <Field label="CPF do responsável"><Input name="guardianCpf" defaultValue={profile?.guardianCpf ?? ""} /></Field>
            <Field label="Telefone do responsável"><Input name="guardianPhone" defaultValue={profile?.guardianPhone ?? ""} /></Field>
          </ActionForm>
        </Collapse>

        <Collapse title="Alterar senha">
          <ActionForm action={changePasswordAction} submitLabel="Alterar senha" className="grid gap-4 sm:grid-cols-2">
            <Field label="Senha atual" hint={user.passwordHash ? undefined : "Conta criada com Google: deixe em branco para definir uma senha."}>
              <Input name="current" type="password" autoComplete="current-password" />
            </Field>
            <Field label="Nova senha" hint="Mínimo de 8 caracteres."><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          </ActionForm>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><KeyRound className="h-3.5 w-3.5" />Senhas são protegidas com Argon2id. Nunca armazenamos sua senha em texto.</p>
        </Collapse>

        <PushOptIn />

        <Card className="p-6">
          <h2 className="font-bold text-ink">Privacidade (LGPD)</h2>
          <p className="mt-1 text-sm text-muted">Solicite acesso, exportação, correção ou eliminação dos seus dados pelo canal do titular.</p>
          <LinkButton href="/privacidade" variant="secondary" size="sm" className="mt-3">Canal de privacidade</LinkButton>
        </Card>
      </div>
    </div>
  );
}