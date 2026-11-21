import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { CheckCircle2, XCircle, Database, Mail } from "lucide-react";
import { db } from "@/db";
import { emailOutbox, webhookEvents } from "@/db/schema";
import { requireRole, ADMIN } from "@/lib/auth/guards";
import { getSettings, googleConfigured, mercadopagoConfigured, smtpConfigured } from "@/lib/settings";
import { saveInstitutionAction } from "@/server/actions/admin-site";
import { getVapidPublicKey } from "@/lib/notifications";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { Badge, Card, Field, Input, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações e integrações" };

function IntegrationRow({ name, ok, envVars, note }: { name: string; ok: boolean; envVars: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{name}</p>
        <p className="text-xs text-muted">{note}</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted">{envVars}</p>
      </div>
      {ok ? <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Configurado</Badge> : <Badge variant="warn"><XCircle className="h-3 w-3" />Não configurado</Badge>}
    </div>
  );
}

export default async function AdminConfiguracoesPage() {
  await requireRole(ADMIN, "/admin/configuracoes");
  const cfg = await getSettings();
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }
  let vapid = "";
  try {
    vapid = (await getVapidPublicKey()).slice(0, 16);
  } catch {}
  const outbox = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(200);
  const hooks = await db.select().from(webhookEvents).orderBy(desc(webhookEvents.createdAt)).limit(100);
  const mpWebhookOk = Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET);

  return (
    <div className="max-w-4xl">
      <PageTitle title="Configurações" description="Dados institucionais, integrações e saúde do sistema." />
      <div className="space-y-5">
        <Collapse title="Dados da instituição (site, contrato e rodapé)" defaultOpen>
          <ActionForm action={saveInstitutionAction} submitLabel="Salvar instituição" className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input name="name" defaultValue={cfg.institution.name} /></Field>
            <Field label="Complemento da marca"><Input name="tagline" defaultValue={cfg.institution.tagline} /></Field>
            <Field label="CNPJ"><Input name="cnpj" defaultValue={cfg.institution.cnpj} placeholder="00.000.000/0001-00" /></Field>
            <Field label="Telefone"><Input name="phone" defaultValue={cfg.institution.phone} /></Field>
            <Field label="WhatsApp (só números, com DDI)" hint="Ex.: 5585999999999"><Input name="whatsapp" defaultValue={cfg.institution.whatsapp} /></Field>
            <Field label="E-mail de contato"><Input name="email" type="email" defaultValue={cfg.institution.email} /></Field>
            <Field label="Endereço da unidade" className="sm:col-span-2"><Input name="address" defaultValue={cfg.institution.address} placeholder="Rua, número, bairro" /></Field>
            <Field label="Cidade / UF"><Input name="city" defaultValue={cfg.institution.city} /></Field>
            <Field label="Horário de funcionamento"><Input name="hours" defaultValue={cfg.institution.hours} /></Field>
            <Field label="Endereço para o mapa (Google Maps)" className="sm:col-span-2" hint="Ex.: Av. Principal 123, Centro, Fortaleza-CE"><Input name="mapsQuery" defaultValue={cfg.institution.mapsQuery} /></Field>
            <Field label="Instagram (URL)"><Input name="instagram" defaultValue={cfg.institution.instagram} /></Field>
            <Field label="Facebook (URL)"><Input name="facebook" defaultValue={cfg.institution.facebook} /></Field>
          </ActionForm>
        </Collapse>

        <Card className="p-5">
          <h2 className="font-bold text-ink">Integrações</h2>
          <p className="mb-3 mt-1 text-xs text-muted">Credenciais são definidas por variáveis de ambiente no servidor (nunca no navegador). Integrações não configuradas são exibidas como indisponíveis para o usuário — nada é simulado.</p>
          <div className="space-y-2.5">
            <IntegrationRow name="Mercado Pago — Pix e Cartão" ok={mercadopagoConfigured()} envVars="MERCADOPAGO_ACCESS_TOKEN" note="Pix via API de pagamentos + cartão via Checkout Pro. Confirmação por webhook e consulta." />
            <IntegrationRow name="Mercado Pago — assinatura de webhook" ok={mpWebhookOk} envVars="MERCADOPAGO_WEBHOOK_SECRET" note="Obrigatório para aceitar webhooks (HMAC x-signature). Configure a URL /api/webhooks/mercadopago no painel do MP." />
            <IntegrationRow name="Login com Google (OIDC)" ok={googleConfigured()} envVars="GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET" note="Redirect: /api/auth/google/callback (autorize no Google Cloud Console)." />
            <IntegrationRow name="E-mail transacional (SMTP)" ok={smtpConfigured()} envVars="SMTP_URL · EMAIL_FROM" note="Sem SMTP, os e-mails ficam na caixa de saída abaixo (modo desenvolvimento)." />
            <IntegrationRow name="Web Push (VAPID)" ok={!!vapid} envVars="gerado automaticamente e persistido" note="Chaves VAPID próprias geradas na primeira execução. Push real em navegadores compatíveis." />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-ink"><Database className="h-4 w-4 text-brand" />Saúde do sistema</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={dbOk ? "success" : "danger"}>Banco de dados: {dbOk ? "online" : "offline"}</Badge>
            <Badge variant={hooks.some((h) => h.error) ? "warn" : "neutral"}>Webhooks recebidos: {hooks.length}{hooks.some((h) => h.error) ? " (com erros)" : ""}</Badge>
            <Badge variant="neutral">Push deliveries registradas por notificação</Badge>
          </div>
          <p className="mt-3 text-xs text-muted">Endpoint de monitoramento: <code className="rounded bg-bg px-1.5 py-0.5">/api/health</code> · Backups: responsabilidade do provedor do banco (Neon/pg_dump) — documentado no checklist de lançamento.</p>
        </Card>

        <div>
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><Mail className="h-4 w-4 text-brand" />Caixa de saída de e-mails {!smtpConfigured() ? "(modo desenvolvimento — SMTP não configurado)" : ""}</h2>
          <DataTable
            pageSize={8}
            columns={[
              { key: "to", label: "Destinatário" },
              { key: "subject", label: "Assunto" },
              { key: "status", label: "Status", type: "badge", badgeMap: { enviado: { label: "Enviado", variant: "success" }, falhou: { label: "Falhou", variant: "danger" }, pendente: { label: "Pendente", variant: "warn" }, dev_caixa_saida: { label: "Dev — não enviado", variant: "info" } } },
              { key: "createdAt", label: "Data", type: "datetime" },
            ]}
            rows={outbox.map((m) => ({ id: m.id, to: m.toEmail, subject: m.subject, status: m.status, createdAt: m.createdAt.toISOString() }))}
            emptyTitle="Nenhum e-mail gerado"
          />
        </div>
      </div>
    </div>
  );
}