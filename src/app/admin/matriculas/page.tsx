import type { Metadata } from "next";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, courses, enrollments, userRoles, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { staffCreateEnrollmentAction } from "@/server/actions/admin-people";
import { fmtDate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { Field, LinkButton, PageTitle, Select } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matrículas — administração" };

export default async function AdminMatriculasPage() {
  await requireRole(STAFF, "/admin/matriculas");
  const rows = await db
    .select({ e: enrollments, student: users.name, course: courses.name, cohort: cohorts.name })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(desc(enrollments.createdAt));
  const students = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(or(eq(users.role, "aluno"), inArray(users.id, db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "aluno")))))
    .orderBy(asc(users.name));
  const openCohorts = await db
    .select({ id: cohorts.id, name: cohorts.name, course: courses.name, startDate: cohorts.startDate })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(asc(cohorts.startDate));

  return (
    <div>
      <PageTitle title="Matrículas" description="Criação pela secretaria, pagamentos, trancamento, transferência, conclusão e cancelamento." />
      <div className="mb-5 max-w-2xl">
        <Collapse title="+ Nova matrícula (secretaria)">
          <ActionForm action={staffCreateEnrollmentAction} submitLabel="Criar matrícula" className="grid gap-4">
            <Field label="Aluno">
              <Select name="userId" required defaultValue="">
                <option value="" disabled>Selecione o aluno…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Turma">
              <Select name="cohortId" required defaultValue="">
                <option value="" disabled>Selecione a turma…</option>
                {openCohorts.map((c) => <option key={c.id} value={c.id}>{c.course} — {c.name} (início {fmtDate(c.startDate)})</option>)}
              </Select>
            </Field>
            <Field label="Plano">
              <Select name="plan" defaultValue="integral">
                <option value="integral">Integral</option>
                <option value="mensal">Entrada + mensalidades</option>
              </Select>
            </Field>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">A matrícula é criada como pendente; registre o pagamento na página de gerenciamento para ativá-la. Capacidade verificada com lock — sem overbooking.</p>
        </Collapse>
      </div>
      <DataTable
        exportName="matriculas"
        filterKey="status"
        pageSize={12}
        columns={[
          { key: "student", label: "Aluno" },
          { key: "course", label: "Curso" },
          { key: "cohort", label: "Turma" },
          { key: "plan", label: "Plano", type: "badge", badgeMap: { integral: { label: "Integral", variant: "brand" }, mensal: { label: "Mensalidades", variant: "info" } } },
          { key: "totalCents", label: "Total", type: "money" },
          { key: "status", label: "Status", type: "status" },
          { key: "createdAt", label: "Criada", type: "datetime" },
        ]}
        rows={rows.map(({ e, student, course, cohort }) => ({
          id: e.id,
          student,
          course,
          cohort,
          plan: e.plan,
          totalCents: e.totalCents,
          status: e.status,
          createdAt: e.createdAt.toISOString(),
          _actions: <LinkButton href={`/admin/matriculas/${e.id}`} size="sm" variant="secondary">Gerenciar</LinkButton>,
        }))}
        emptyTitle="Nenhuma matrícula"
        emptyDescription="Matrículas do site e da secretaria aparecem aqui."
      />
    </div>
  );
}