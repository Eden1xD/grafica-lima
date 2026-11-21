import type { Metadata } from "next";
import { asc, count, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, studentProfiles, userRoles, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { createStudentAction } from "@/server/actions/admin-people";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { Field, Input, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alunos — administração" };

export default async function AdminAlunosPage() {
  await requireRole(STAFF, "/admin/alunos");
  const rows = await db
    .select({ user: users, profile: studentProfiles })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(or(eq(users.role, "aluno"), inArray(users.id, db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "aluno")))))
    .orderBy(asc(users.name));
  const counts = await db.select({ userId: enrollments.userId, n: count() }).from(enrollments).groupBy(enrollments.userId);
  const countMap = new Map(counts.map((c) => [c.userId, Number(c.n)]));

  return (
    <div>
      <PageTitle title="Alunos" description="Cadastro pela secretaria com envio de e-mail para definição de senha." />
      <div className="mb-5 max-w-xl">
        <Collapse title="+ Cadastrar aluno">
          <ActionForm action={createStudentAction} submitLabel="Cadastrar e enviar e-mail" className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo"><Input name="name" required minLength={3} /></Field>
            <Field label="E-mail"><Input name="email" type="email" required /></Field>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">O aluno recebe um link seguro para definir a senha. Dados completos são preenchidos no checkout ou no perfil.</p>
        </Collapse>
      </div>
      <DataTable
        exportName="alunos"
        filterKey="status"
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "verified", label: "E-mail verificado", type: "bool" },
          { key: "phone", label: "Telefone" },
          { key: "city", label: "Cidade" },
          { key: "enrollments", label: "Matrículas" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={rows.map(({ user, profile }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          verified: !!user.emailVerifiedAt,
          phone: profile?.phone ?? "—",
          city: profile?.city ?? "—",
          enrollments: countMap.get(user.id) ?? 0,
          status: user.status,
        }))}
        emptyTitle="Nenhum aluno cadastrado"
        emptyDescription="Cadastre acima ou aguarde os cadastros pelo site."
      />
    </div>
  );
}