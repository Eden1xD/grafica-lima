import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { cohortTeachers, cohorts, teachers, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { createTeacherAction } from "@/server/actions/admin-people";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { AdminTeacherActions } from "@/components/admin-teacher-actions";
import { Field, Input, PageTitle, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Professores — administração" };

export default async function AdminProfessoresPage() {
  const actor = await requireRole(STAFF, "/admin/professores");
  const rows = await db.select({ teacher: teachers, user: users }).from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId)).orderBy(asc(users.name));
  const counts = await db.select({ teacherId: cohorts.teacherId, n: count() }).from(cohorts).groupBy(cohorts.teacherId);
  const extraLinks = await db.select({ teacherId: cohortTeachers.teacherId, cohortId: cohortTeachers.cohortId }).from(cohortTeachers);
  const cohortMap = new Map<string, Set<string>>();
  for (const c of counts) {
    if (c.teacherId) cohortMap.set(c.teacherId, new Set());
  }
  // A consulta de vínculos principais é separada para não contar duas vezes a mesma turma.
  const mainLinks = await db.select({ teacherId: cohorts.teacherId, cohortId: cohorts.id }).from(cohorts);
  for (const link of [...mainLinks, ...extraLinks]) {
    if (!link.teacherId) continue;
    const ids = cohortMap.get(link.teacherId) ?? new Set<string>();
    ids.add(link.cohortId);
    cohortMap.set(link.teacherId, ids);
  }
  const canDelete = actor.roles.includes("admin");

  return (
    <div>
      <PageTitle title="Professores" description="Vincule usuários ao papel de professor e publique a equipe no site." />
      <div className="mb-5 max-w-2xl">
        <Collapse title="+ Cadastrar / vincular professor">
          <ActionForm action={createTeacherAction} submitLabel="Salvar professor" className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo"><Input name="name" required minLength={3} /></Field>
            <Field label="E-mail" hint="Se já existir conta de aluno, o papel será atualizado."><Input name="email" type="email" required /></Field>
            <Field label="Especialidades"><Input name="specialties" placeholder="Ex.: Excel, Design Gráfico" /></Field>
            <Field label="Mini bio (site)"><Textarea name="bio" rows={2} /></Field>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2"><input type="checkbox" name="publicVisible" defaultChecked />Exibir na página inicial e em Sobre</label>
          </ActionForm>
        </Collapse>
      </div>
      <DataTable exportName="professores" columns={[
        { key: "name", label: "Nome" }, { key: "email", label: "E-mail" },
        { key: "specialties", label: "Especialidades" }, { key: "cohorts", label: "Turmas" },
        { key: "public", label: "Visível no site", type: "bool" },
      ]} rows={rows.map(({ teacher, user }) => ({
        id: teacher.id, name: user.name, email: user.email,
        specialties: teacher.specialties || "—", cohorts: cohortMap.get(teacher.id)?.size ?? 0,
        public: teacher.publicVisible,
        _actions: <AdminTeacherActions teacher={{ id: teacher.id, name: user.name, email: user.email,
          specialties: teacher.specialties ?? "", bio: teacher.bio ?? "", publicVisible: teacher.publicVisible }} canDelete={canDelete} />,
      }))} emptyTitle="Nenhum professor cadastrado" emptyDescription="Cadastre acima para atribuir turmas." />
    </div>
  );
}
