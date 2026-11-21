import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { createCouponAction, toggleCouponAction } from "@/server/actions/finance";
import { brl } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { Field, Input, PageTitle, Select } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cupons — administração" };

export default async function AdminCuponsPage() {
  await requireRole(["admin", "financeiro"], "/admin/cupons");
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));

  return (
    <div>
      <PageTitle title="Cupons de desconto" description="Percentual ou valor fixo, com validade, limite de uso e valor mínimo. Aplicação validada no servidor do checkout." />
      <div className="mb-5 max-w-2xl">
        <Collapse title="+ Novo cupom">
          <ActionForm action={createCouponAction} submitLabel="Criar cupom" className="grid gap-4 sm:grid-cols-2">
            <Field label="Código" hint="Maiúsculas, números e hífen. Ex.: PRIMEIRA10"><Input name="code" required minLength={3} placeholder="BEMVINDO10" className="font-mono uppercase" /></Field>
            <Field label="Tipo">
              <Select name="type" defaultValue="percentual">
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </Select>
            </Field>
            <Field label="Desconto" hint="Percentual: 10 = 10% · Fixo: 50,00 = R$ 50"><Input name="value" required placeholder="10" /></Field>
            <Field label="Limite de usos (opcional)"><Input name="maxUses" type="number" min={1} placeholder="Ilimitado" /></Field>
            <Field label="Válido até (opcional)"><Input name="validUntil" type="date" /></Field>
            <Field label="Valor mínimo do curso (R$)"><Input name="minTotal" placeholder="0,00" /></Field>
          </ActionForm>
        </Collapse>
      </div>
      <DataTable
        exportName="cupons"
        columns={[
          { key: "code", label: "Código" },
          { key: "type", label: "Tipo" },
          { key: "value", label: "Desconto" },
          { key: "uses", label: "Usos" },
          { key: "validUntil", label: "Validade", type: "date" },
          { key: "min", label: "Mínimo", type: "money" },
          { key: "active", label: "Ativo", type: "bool" },
        ]}
        rows={rows.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type === "percentual" ? "Percentual" : "Fixo",
          value: c.type === "percentual" ? `${c.value}%` : brl(c.value),
          uses: `${c.usedCount}${c.maxUses ? `/${c.maxUses}` : ""}`,
          validUntil: c.validUntil,
          min: c.minTotalCents,
          active: c.active,
          _actions: <ActionForm action={toggleCouponAction} hidden={{ id: c.id }} submitLabel={c.active ? "Desativar" : "Ativar"} submitVariant="secondary" submitSize="sm" />,
        }))}
        emptyTitle="Nenhum cupom"
        emptyDescription="Crie cupons para campanhas e primeiras matrículas."
      />
    </div>
  );
}