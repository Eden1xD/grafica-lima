import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { createPrivacyRequestAction } from "@/server/actions/public";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacidade e LGPD" };

export default async function PrivacidadePage() {
  const cfg = await getSettings();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Lei nº 13.709/2018 (LGPD) · Controlador: {cfg.institution.name}{cfg.institution.cnpj ? ` · CNPJ ${cfg.institution.cnpj}` : ""}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="text-lg font-bold text-ink">Dados que tratamos e finalidades</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong className="text-ink">Cadastro</strong> (nome, e-mail, senha criptografada): criação e segurança da conta — execução de contrato.</li>
            <li><strong className="text-ink">Dados de matrícula</strong> (CPF, nascimento, telefone, endereço): contratação, contrato e obrigações legais — execução de contrato e obrigação legal.</li>
            <li><strong className="text-ink">Responsável legal</strong> (quando menor de idade): proteção reforçada do menor, conforme art. 14 da LGPD.</li>
            <li><strong className="text-ink">Dados acadêmicos</strong> (notas, frequência, certificados): execução do serviço educacional.</li>
            <li><strong className="text-ink">Pagamentos</strong>: processados por gateway certificado; não armazenamos número completo de cartão nem CVV.</li>
            <li><strong className="text-ink">Contato comercial</strong>: retorno de interesse — consentimento/procedimentos preliminares.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">Cookies</h2>
          <p className="mt-2">Usamos apenas cookies essenciais: sessão de autenticação (HttpOnly, Secure) e preferência de tema. Não utilizamos cookies de rastreamento de terceiros. Notificações push são opcionais e ativadas somente com sua permissão explícita, podendo ser desativadas a qualquer momento no portal.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">Compartilhamento</h2>
          <p className="mt-2">Compartilhamos dados somente com operadores necessários: provedor de pagamento (transação), provedor de e-mail (comunicações) e hospedagem/infraestrutura. Não vendemos dados pessoais.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">Retenção e segurança</h2>
          <p className="mt-2">Dados são mantidos enquanto durar a relação contratual e pelos prazos legais aplicáveis (ex.: registros financeiros e acadêmicos). Aplicamos criptografia de senhas (Argon2id), controle de acesso por perfil, registros de auditoria e backups. Após os prazos, os dados são eliminados ou anonimizados.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-ink">Seus direitos (art. 18)</h2>
          <p className="mt-2">Confirmação, acesso, correção, anonimização, portabilidade, eliminação (quando cabível), informação sobre compartilhamentos e revisão de decisões. Use o formulário abaixo — respondemos nos prazos da ANPD.</p>
        </section>
      </div>

      <Card className="mt-10 p-6">
        <h2 className="font-bold text-ink">Canal do titular — solicitação LGPD</h2>
        <p className="mt-1 text-sm text-muted">Exerça seus direitos sobre seus dados pessoais.</p>
        <ActionForm action={createPrivacyRequestAction} submitLabel="Enviar solicitação" className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo"><Input name="name" required minLength={3} /></Field>
          <Field label="E-mail cadastrado"><Input name="email" type="email" required /></Field>
          <Field label="Tipo de solicitação" className="sm:col-span-2">
            <Select name="type" defaultValue="acesso">
              <option value="acesso">Acesso aos meus dados</option>
              <option value="exportacao">Exportação (portabilidade)</option>
              <option value="correcao">Correção de dados</option>
              <option value="eliminacao">Eliminação de dados</option>
              <option value="informacao">Informação sobre tratamento/compartilhamento</option>
            </Select>
          </Field>
          <Field label="Detalhes (opcional)" className="sm:col-span-2"><Textarea name="message" rows={3} placeholder="Descreva sua solicitação" /></Field>
        </ActionForm>
      </Card>
    </article>
  );
}