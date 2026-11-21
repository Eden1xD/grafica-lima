import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { requireRole, ADMIN } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { saveHomeAction, saveFinanceSettingsAction, saveFaqAction, saveFooterAction } from "@/server/actions/admin-site";
import { ActionForm, Collapse } from "@/components/action-form";
import { Alert, Field, Input, LinkButton, PageTitle, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editor do site" };

export default async function AdminSitePage() {
  await requireRole(ADMIN, "/admin/site");
  const cfg = await getSettings();

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Editor do site"
        description="Conteúdo da página inicial, contratos, FAQ e rodapé — sem tocar em código."
        actions={<LinkButton href="/" variant="secondary" size="sm"><Eye className="h-4 w-4" />Pré-visualizar site ↗</LinkButton>}
      />
      <Alert variant="info" className="mb-5 text-xs">As alterações são publicadas imediatamente ao salvar. Revise a pré-visualização após cada mudança. Dados institucionais e integrações ficam em Configurações.</Alert>
      <div className="space-y-4">
        <Collapse title="Página inicial (hero, letreiro e animações)" defaultOpen>
          <ActionForm action={saveHomeAction} submitLabel="Salvar página inicial" className="grid gap-4">
            <Field label="Selo do hero"><Input name="heroBadge" defaultValue={cfg.home.heroBadge} /></Field>
            <Field label="Título principal"><Input name="heroTitle" defaultValue={cfg.home.heroTitle} /></Field>
            <Field label="Subtítulo"><Textarea name="heroSubtitle" rows={3} defaultValue={cfg.home.heroSubtitle} /></Field>
            <Field label="Letreiro rolante (vazio = oculto)"><Input name="marquee" defaultValue={cfg.home.marquee} placeholder="Ex.: Matrículas abertas — turmas com vagas limitadas" /></Field>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="show3d" defaultChecked={cfg.home.show3d} />Ativar elementos 3D e animações do hero (respeita movimento reduzido)</label>
          </ActionForm>
        </Collapse>

        <Collapse title="Contrato e política de cancelamento">
          <ActionForm action={saveFinanceSettingsAction} submitLabel="Salvar textos e regras" className="grid gap-4">
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="allowManual" defaultChecked={cfg.finance.allowManual} />Permitir pagamento na secretaria</label>
              <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="allowPix" defaultChecked={cfg.finance.allowPix} />Permitir Pix online (requer gateway)</label>
              <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="allowCard" defaultChecked={cfg.finance.allowCard} />Permitir cartão online (requer gateway)</label>
            </div>
            <Field label="Texto do contrato (exibido no checkout)"><Textarea name="contractText" rows={8} defaultValue={cfg.finance.contractText} /></Field>
            <Field label="Política de cancelamento"><Textarea name="cancellationText" rows={5} defaultValue={cfg.finance.cancellationText} /></Field>
          </ActionForm>
        </Collapse>

        <Collapse title="Perguntas frequentes (FAQ)">
          <ActionForm action={saveFaqAction} submitLabel="Salvar FAQ" className="grid gap-4">
            <Field label="FAQ em JSON" hint='Formato: [{"q":"Pergunta","a":"Resposta"}]'>
              <Textarea name="faqJson" rows={10} defaultValue={JSON.stringify(cfg.faq, null, 2)} className="font-mono text-xs" />
            </Field>
          </ActionForm>
        </Collapse>

        <Collapse title="Rodapé — texto institucional">
          <ActionForm action={saveFooterAction} submitLabel="Salvar rodapé" className="grid gap-4">
            <Field label="Sobre a instituição (rodapé e página Sobre)"><Textarea name="about" rows={4} defaultValue={cfg.footer.about} /></Field>
          </ActionForm>
        </Collapse>
      </div>
    </div>
  );
}