import type { Metadata } from "next";
import { and, count, eq, inArray, lte } from "drizzle-orm";
import { CalendarDays, ClipboardCheck, Users } from "lucide-react";
import { db } from "@/db";
import { classrooms, classSessions, cohorts, courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { teacherByUser, teacherCohortCondition, upcomingSessionsForTeacher } from "@/lib/academic";
import { fmtDate, todayISO, weekdaysLabel } from "@/lib/utils";
import { Badge, Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do professor" };

export default async function ProfessorPage() {
  const user = await requireUser("/professor");
  const teacher = await teacherByUser(user.id);
  if (!teacher) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="Perfil de professor não vinculado"
        description="Peça à secretaria para vincular seu usuário a um cadastro de professor e às suas turmas."
        action={<LinkButton href="/contato" variant="soft">Falar com a secretaria</LinkButton>}
      />
    );
  }
  const myCohorts = await db
    .select({ cohort: cohorts, course: courses, room: classrooms })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .leftJoin(classrooms, eq(classrooms.id, cohorts.roomId))
    .where(teacherCohortCondition(teacher.id))
    .orderBy(cohorts.startDate);
  const upcoming = await upcomingSessionsForTeacher(teacher.id, 6);
  const cohortIds = myCohorts.map((c) => c.cohort.id);
  const counts = cohortIds.length
    ? await db
        .select({ cohortId: enrollments.cohortId, n: count() })
        .from(enrollments)
        .where(and(inArray(enrollments.cohortId, cohortIds), inArray(enrollments.status, ["ativa", "concluida"])))
        .groupBy(enrollments.cohortId)
    : [];
  const pendingCalls = cohortIds.length
    ? await db
        .select({ cohortId: classSessions.cohortId, n: count() })
        .from(classSessions)
        .where(and(inArray(classSessions.cohortId, cohortIds), eq(classSessions.status, "agendada"), lte(classSessions.date, todayISO())))
        .groupBy(classSessions.cohortId)
    : [];
  const countMap = new Map(counts.map((c) => [c.cohortId, Number(c.n)]));
  const pendingMap = new Map(pendingCalls.map((c) => [c.cohortId, Number(c.n)]));

  return (
    <div>
      <PageTitle title="Minhas turmas" description="Chamada digital, atividades e lançamento de notas com publicação controlada." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {myCohorts.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title="Nenhuma turma atribuída" description="A secretaria atribui turmas ao seu perfil de professor." />
          ) : (
            myCohorts.map(({ cohort, course, room }) => (
              <Card key={cohort.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{course.name}</p>
                    <p className="text-sm text-muted">{cohort.name} · {weekdaysLabel(cohort.daysOfWeek)} · {cohort.startTime}–{cohort.endTime}{room ? ` · ${room.name}` : ""}</p>
                    <p className="text-xs text-muted">{fmtDate(cohort.startDate)} a {fmtDate(cohort.endDate)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="neutral"><Users className="h-3 w-3" />{countMap.get(cohort.id) ?? 0} alunos</Badge>
                    {(pendingMap.get(cohort.id) ?? 0) > 0 ? (
                      <Badge variant="warn"><ClipboardCheck className="h-3 w-3" />{pendingMap.get(cohort.id)} chamada(s) pendente(s)</Badge>
                    ) : null}
                  </div>
                </div>
                <LinkButton href={`/professor/turmas/${cohort.id}`} size="sm" className="mt-4">Abrir turma</LinkButton>
              </Card>
            ))
          )}
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><CalendarDays className="h-4 w-4 text-brand" />Próximas aulas</h2>
          {upcoming.length === 0 ? (
            <Card className="p-5 text-sm text-muted">Nenhuma aula agendada.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {upcoming.map((s) => (
                <div key={s.id} className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-ink">{s.courseName}</p>
                  <p className="text-xs text-muted">{s.cohortName}</p>
                  <p className="mt-1 text-xs font-bold text-brand-deep dark:text-brand">{fmtDate(s.date)} · {s.startTime}–{s.endTime}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}