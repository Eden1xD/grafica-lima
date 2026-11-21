import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, leads } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { updateLeadAction } from "@/server/actions/admin-people";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { Field, Input, PageTitle, Select } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Interessados — administração" };

export default async function AdminLeadsPage() {
  await requireRole(STAFF, "/admin/leads");
  const rows = await db
    .select({ lead: leads, course: courses.name })
    .from(leads)
    .leftJoin(courses, eq(courses.id, leads.courseId))
    .orderBy(desc(leads.createdAt))
    .limit(300);

  return (
    <div>
      <PageTitle title="Interessados (CRM inicial)" description="Mensagens do site viram leads com funil de atendimento. Pipeline Kanban completo chega na próxima etapa." />
      <DataTable
        exportName="leads"
        filterKey="status"
        pageSize={12}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "phone", label: "Telefone" },
          { key: "course", label: "Interesse" },
          { key: "message", label: "Mensagem" },
          { key: "status", label: "Status", type: "status" },
          { key: "createdAt", label: "Recebido", type: "datetime" },
        ]}
        rows={rows.map(({ lead, course }) => ({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone ?? "—",
          course: course ?? "Geral",
          message: lead.message.slice(0, 80),
          status: lead.status,
          createdAt: lead.createdAt.toISOString(),
          _actions: (
            <details className="relative inline-block text-left">
              <summary className="cursor-pointer text-xs font-semibold text-brand">Atualizar</summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
                <p className="mb-2 text-xs text-muted">{lead.message}</p>
                <ActionForm action={updateLeadAction} hidden={{ id: lead.id }} submitLabel="Salvar" submitSize="sm" className="space-y-3">
                  <Field label="Status">
                    <Select name="status" defaultValue={lead.status}>
                      <option value="novo">Novo</option>
                      <option value="em_contato">Em contato</option>
                      <option value="proposta">Proposta enviada</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </Select>
                  </Field>
                  <Field label="Anotações"><Input name="notes" defaultValue={lead.notes ?? ""} /></Field>
                </ActionForm>
              </div>
            </details>
          ),
        }))}
        emptyTitle="Nenhum interessado ainda"
        emptyDescription="As mensagens do formulário de contato aparecem aqui automaticamente."
      />
    </div>
  );
}