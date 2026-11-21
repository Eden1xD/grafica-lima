import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de cancelamento" };

export default async function CancelamentosPage() {
  const cfg = await getSettings();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Cancelamento e reembolso</h1>
      <p className="mt-2 text-sm text-muted">Em conformidade com o Código de Defesa do Consumidor.</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
        {cfg.finance.cancellationText.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="mt-8 rounded-2xl border border-line bg-brand-soft p-6">
        <h2 className="font-bold text-brand-deep dark:text-brand">Como solicitar</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Alunos: pelo portal, em <strong>Financeiro → Solicitar cancelamento</strong>, ou presencialmente na secretaria.</li>
          <li>Informe o motivo — a solicitação é registrada com protocolo e auditada.</li>
          <li>A secretaria analisa valores pagos, aulas ministradas e o prazo de arrependimento.</li>
          <li>Reembolsos aprovados são registrados no sistema e estornados pelo meio de pagamento original.</li>
        </ol>
        <div className="mt-5 flex gap-3">
          <LinkButton href="/aluno/financeiro" variant="soft">Ir para o portal</LinkButton>
          <LinkButton href="/contato" variant="secondary">Falar com a secretaria</LinkButton>
        </div>
      </div>
    </article>
  );
}