import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { privacyRequests } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { updatePrivacyRequestAction } from "@/server/actions/admin-people";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { Alert, Field, Input, PageTitle, Select } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacidade LGPD — administração" };

const TYPE_LABEL: Record<string, string> = { acesso: "Acesso", correcao: "Correção", eliminacao: "Eliminação", exportacao: "Exportação", informacao: "Informação" };

export default async function AdminPrivacidadePage() {
  await requireRole(["admin", "secretaria"], "/admin/privacidade");
  const rows = await db.select().from(privacyRequests).orderBy(desc(privacyRequests.createdAt)).limit(300);

  return (
    <div>
      <PageTitle title="Solicitações LGPD" description="Canal do titular: acesso, correção, eliminação, exportação e informação. Prazos conforme ANPD." />
      <Alert variant="info" className="mb-5 text-xs">
        Verifique a identidade do titular antes de atender (e-mail cadastrado + documento). Exportações e eliminações devem ser registradas na auditoria. Dados de menores exigem validação do responsável.
      </Alert>
      <DataTable
        exportName="solicitacoes-lgpd"
        filterKey="status"
        columns={[
          { key: "name", label: "Titular" },
          { key: "email", label: "E-mail" },
          { key: "type", label: "Tipo" },
          { key: "message", label: "Detalhes" },
          { key: "status", label: "Status", type: "status" },
          { key: "createdAt", label: "Aberta em", type: "datetime" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          type: TYPE_LABEL[r.type] ?? r.type,
          message: r.message.slice(0, 80) || "—",
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          _actions: (
            <details className="relative inline-block text-left">
              <summary className="cursor-pointer text-xs font-semibold text-brand">Tratar</summary>
              <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-line bg-surface p-3 shadow-lg">
                <ActionForm action={updatePrivacyRequestAction} hidden={{ id: r.id }} submitLabel="Salvar tratamento" submitSize="sm" className="space-y-3">
                  <Field label="Status">
                    <Select name="status" defaultValue={r.status}>
                      <option value="aberta">Aberta</option>
                      <option value="em_analise">Em análise</option>
                      <option value="concluida">Concluída</option>
                    </Select>
                  </Field>
                  <Field label="Resposta ao titular"><Input name="response" defaultValue={r.response ?? ""} placeholder="Resumo do atendimento" /></Field>
                </ActionForm>
              </div>
            </details>
          ),
        }))}
        emptyTitle="Nenhuma solicitação"
        emptyDescription="Solicitações enviadas pela página de privacidade aparecem aqui."
      />
    </div>
  );
}