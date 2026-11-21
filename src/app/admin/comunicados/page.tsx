import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, cohorts, courses } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { publishAnnouncementAction } from "@/server/actions/admin-site";
import { DataTable } from "@/components/data-table";
import { ActionForm, Collapse } from "@/components/action-form";
import { Field, Input, PageTitle, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comunicados — administração" };

const AUDIENCE_LABEL: Record<string, string> = { todos: "Todos", alunos: "Alunos", professores: "Professores", turma: "Turma específica" };

export default async function AdminComunicadosPage() {
  await requireRole(STAFF, "/admin/comunicados");
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(200);
  const cohortRows = await db
    .select({ id: cohorts.id, name: cohorts.name, course: courses.name })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(asc(cohorts.startDate));

  return (
    <div>
      <PageTitle title="Comunicados" description="Publicação segmentada com notificação real (central + push + contador)." />
      <div className="mb-5 max-w-2xl">
        <Collapse title="+ Publicar comunicado" defaultOpen>
          <ActionForm action={publishAnnouncementAction} submitLabel="Publicar e notificar" className="grid gap-4">
            <Field label="Título"><Input name="title" required minLength={3} placeholder="Ex.: Aula inaugural da turma A" /></Field>
            <Field label="Mensagem"><Textarea name="body" required minLength={3} rows={4} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Público">
                <Select name="audience" defaultValue="alunos">
                  {Object.entries(AUDIENCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Turma (se público = turma)">
                <Select name="cohortId" defaultValue="">
                  <option value="">—</option>
                  {cohortRows.map((c) => <option key={c.id} value={c.id}>{c.course} — {c.name}</option>)}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="important" />Marcar como importante</label>
          </ActionForm>
        </Collapse>
      </div>
      <DataTable
        exportName="comunicados"
        columns={[
          { key: "title", label: "Título" },
          { key: "audience", label: "Público" },
          { key: "important", label: "Importante", type: "bool" },
          { key: "publishedAt", label: "Publicado", type: "datetime" },
        ]}
        rows={rows.map((a) => ({
          id: a.id,
          title: a.title,
          audience: AUDIENCE_LABEL[a.audience] ?? a.audience,
          important: a.important,
          publishedAt: a.publishedAt?.toISOString() ?? null,
        }))}
        emptyTitle="Nenhum comunicado publicado"
      />
    </div>
  );
}