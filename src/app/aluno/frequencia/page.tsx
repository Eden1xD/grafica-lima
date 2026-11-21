import type { Metadata } from "next";
import { and, eq, ne } from "drizzle-orm";
import { CalendarCheck } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { attendanceForEnrollment } from "@/lib/academic";
import { fmtDate } from "@/lib/utils";
import { Card, EmptyState, PageTitle, StatusBadge } from "@/components/ui";
import { Donut } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha frequência" };

export default async function AlunoFrequenciaPage() {
  const user = await requireUser("/aluno/frequencia");
  const myEnrollments = await db
    .select({ e: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, user.id), ne(enrollments.status, "cancelada")));
  const blocks = await Promise.all(myEnrollments.map(async (m) => ({ ...m, att: await attendanceForEnrollment(m.e.id) })));

  return (
    <div>
      <PageTitle title="Minha frequência" description="Presenças registradas pelo professor em cada aula. Faltas justificadas não contam como presença para o certificado." />
      {blocks.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="h-8 w-8" />} title="Nenhuma matrícula" description="Matricule-se para acompanhar sua frequência." />
      ) : (
        <div className="space-y-8">
          {blocks.map(({ e, cohort, course, att }) => (
            <Card key={e.id} className="p-6">
              <div className="flex flex-wrap items-center gap-6">
                <Donut pct={att.stats.pct} label={`Frequência em ${course.name}`} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-ink">{course.name} <span className="font-normal text-muted">· {cohort.name}</span></h2>
                  <p className="mt-1 text-sm text-muted">
                    {att.stats.present} presenças em {att.stats.total} aula(s) registradas · {att.stats.justified} falta(s) justificada(s)
                  </p>
                  <p className="text-xs text-muted">Mínimo exigido para certificado: {course.minAttendancePct}%</p>
                  {att.stats.pct !== null && att.stats.pct < course.minAttendancePct ? (
                    <p className="mt-1 text-xs font-semibold text-warn">Atenção: frequência abaixo do mínimo. Converse com a secretaria.</p>
                  ) : null}
                </div>
              </div>
              {att.records.length > 0 ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="px-3 py-2.5">Aula</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...att.records].reverse().map((r) => (
                        <tr key={r.sessionId} className="border-b border-line/60 last:border-0">
                          <td className="px-3 py-2.5 font-medium text-ink">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-muted">{r.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">Nenhuma chamada registrada ainda.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}