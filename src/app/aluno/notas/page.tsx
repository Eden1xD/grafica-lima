import type { Metadata } from "next";
import { and, eq, ne } from "drizzle-orm";
import { GraduationCap } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { publishedGrades, subjectAverages } from "@/lib/academic";
import { fmtDate, fmtScore } from "@/lib/utils";
import { Badge, Card, EmptyState, Field, Input, PageTitle } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { requestGradeReviewAction } from "@/server/actions/academic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minhas notas" };

const TYPE_LABEL: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", projeto: "Projeto", pratica: "Prática", atividade: "Atividade", recuperacao: "Recuperação" };

export default async function AlunoNotasPage() {
  const user = await requireUser("/aluno/notas");
  const myEnrollments = await db
    .select({ e: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, user.id), ne(enrollments.status, "cancelada")))
    .orderBy(enrollments.createdAt);

  const blocks = await Promise.all(
    myEnrollments.map(async (m) => ({
      ...m,
      grades: await publishedGrades(m.e.id),
      subjects: await subjectAverages(m.e.id),
    })),
  );

  return (
    <div>
      <PageTitle title="Minhas notas" description="Somente notas publicadas pelo professor aparecem aqui. Correções registram histórico e justificativa." />
      {blocks.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-8 w-8" />} title="Nenhuma matrícula" description="Matricule-se em um curso para acompanhar suas notas." />
      ) : (
        <div className="space-y-8">
          {blocks.map(({ e, cohort, course, grades, subjects }) => (
            <section key={e.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-ink">{course.name} <span className="font-normal text-muted">· {cohort.name}</span></h2>
                <p className="text-xs text-muted">Média mínima do curso: {fmtScore(course.minGradeH)}</p>
              </div>
              {subjects.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-3">
                  {subjects.map((s) => (
                    <Card key={s.subject} className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase text-muted">{s.subject}</p>
                      <p className="text-lg font-bold text-ink">{fmtScore(s.avgH)} <span className="text-xs font-normal text-muted">média · {s.count} avaliação(ões)</span></p>
                    </Card>
                  ))}
                </div>
              ) : null}
              {grades.length === 0 ? (
                <Card className="p-5 text-sm text-muted">Nenhuma nota publicada nesta turma ainda.</Card>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Atividade</th>
                        <th className="px-4 py-3">Disciplina</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Nota</th>
                        <th className="px-4 py-3">Máximo</th>
                        <th className="px-4 py-3">Observações</th>
                        <th className="px-4 py-3 text-right">Revisão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g) => (
                        <tr key={g.id} className="border-b border-line/60 last:border-0">
                          <td className="px-4 py-3 font-semibold text-ink">{g.title}</td>
                          <td className="px-4 py-3 text-muted">{g.subject}</td>
                          <td className="px-4 py-3 text-muted">{TYPE_LABEL[g.type] ?? g.type}</td>
                          <td className="px-4 py-3 text-muted">{fmtDate(g.dueDate)}</td>
                          <td className="px-4 py-3">
                            {g.kind === "nota" ? (
                              <Badge variant={(g.scoreH ?? 0) / g.maxScoreH >= 0.7 ? "success" : "warn"}>{fmtScore(g.scoreH)}</Badge>
                            ) : (
                              <Badge variant="danger">{g.kind === "ausente" ? "Ausente" : "Não entregue"}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted">{fmtScore(g.maxScoreH)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{g.note ?? "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <details className="inline-block text-left">
                              <summary className="cursor-pointer text-xs font-semibold text-brand">Solicitar</summary>
                              <div className="absolute right-4 z-10 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
                                <ActionForm action={requestGradeReviewAction} hidden={{ gradeId: g.id }} submitLabel="Enviar solicitação" submitSize="sm">
                                  <Field label="Motivo da revisão"><Input name="reason" required minLength={5} placeholder="Descreva o motivo" /></Field>
                                </ActionForm>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}