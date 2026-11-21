import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireRole, ADMIN } from "@/lib/auth/guards";
import { DataTable } from "@/components/data-table";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auditoria" };

export default async function AdminAuditoriaPage() {
  await requireRole(ADMIN, "/admin/auditoria");
  const rows = await db
    .select({ log: auditLogs, user: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  return (
    <div>
      <PageTitle title="Auditoria" description="Operações relevantes com usuário, ação, recurso e data. Senhas e segredos nunca são registrados." />
      <DataTable
        exportName="auditoria"
        pageSize={15}
        columns={[
          { key: "createdAt", label: "Data", type: "datetime" },
          { key: "user", label: "Usuário" },
          { key: "action", label: "Ação" },
          { key: "resource", label: "Recurso" },
          { key: "details", label: "Detalhes" },
          { key: "ip", label: "IP" },
        ]}
        rows={rows.map(({ log, user }) => ({
          id: log.id,
          createdAt: log.createdAt.toISOString(),
          user: user ?? "sistema",
          action: log.action,
          resource: `${log.resource}${log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}`,
          details: log.details ? JSON.stringify(log.details).slice(0, 120) : "—",
          ip: log.ip ?? "—",
        }))}
        emptyTitle="Nenhum registro de auditoria"
      />
    </div>
  );
}