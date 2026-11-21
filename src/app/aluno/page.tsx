import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, lt, ne } from "drizzle-orm";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, GraduationCap, Wallet } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, installments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { publishedGrades, upcomingSessionsForStudent } from "@/lib/academic";
import { resendVerificationAction } from "@/server/actions/auth";
import { brl, firstName, fmtDate, fmtScore, todayISO, weekdaysLabel } from "@/lib/utils";
import { Alert, Badge, Card, EmptyState, LinkButton, PageTitle, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PushOptIn } from "@/components/push-optin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do aluno" };

export default async function AlunoPage() {
  const user = await requireUser("/aluno");
  const myEnrollments = await db
    .select({ e: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, user.id), ne(enrollments.status, "cancelada")))
    .orderBy(desc(enrollments.createdAt));
  const upcoming = await upcomingSessionsForStudent(user.id, 5);
  const active = myEnrollments.find((m) => m.e.status === "ativa") ?? myEnrollments[0];
  const recentGrades = active ? (await publishedGrades(active.e.id)).slice(-3).reverse() : [];
  const overdue = await db
    .select({ n: installments.id })
    .from(installments)
    .innerJoin(enrollments, eq(enrollments.id, installments.enrollmentId))
    .where(and(eq(enrollments.userId, user.id), eq(installments.status, "pendente"), lt(installments.dueDate, todayISO())));

  return (
    <div>
      <PageTitle
        title={`Olá, ${firstName(user.name)}! 👋`}
        description="Acompanhe suas aulas, notas, pagamentos e certificados."
        actions={<LinkButton href="/cursos" variant="secondary" size="sm">Explorar cursos</LinkButton>}
      />

      {!user.emailVerifiedAt ? (
        <Alert variant="warn" className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span>Confirme seu e-mail para proteger sua conta.</span>
          <ActionForm action={resendVerificationAction} submitLabel="Reenviar link" submitVariant="secondary" submitSize="sm" />
        </Alert>
      ) : null}

      {overdue.length > 0 ? (
        <Alert variant="danger" className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Você tem {overdue.length} mensalidade(s) vencida(s).</span>
          <LinkButton href="/aluno/financeiro" variant="secondary" size="sm">Regularizar</LinkButton>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><BookOpen className="h-4 w-4 text-brand" />Meus cursos</h2>
            {myEnrollments.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-8 w-8" />}
                title="Você ainda não está matriculado"
                description="Escolha um curso presencial e garanta sua vaga na próxima turma."
                action={<LinkButton href="/cursos">Ver cursos disponíveis</LinkButton>}
              />
            ) : (
              <div className="space-y-3">
                {myEnrollments.map(({ e, cohort, course }) => (
                  <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{course.name}</p>
                      <p className="text-sm text-muted">{cohort.name} · {weekdaysLabel(cohort.daysOfWeek)} · {cohort.startTime}–{cohort.endTime}</p>
                      <p className="text-xs text-muted">{fmtDate(cohort.startDate)} a {fmtDate(cohort.endDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={e.status} />
                      {e.status === "ativa" ? <a href={`/api/calendario/${cohort.id}`} className="text-xs font-semibold text-muted hover:text-brand" title="Exportar aulas para seu calendário">.ics</a> : null}
                      {e.status === "pendente_pagamento" ? <LinkButton href={`/matricula/confirmacao?enrollment=${e.id}`} size="sm" variant="soft">Pagar</LinkButton> : null}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><CalendarDays className="h-4 w-4 text-brand" />Próximas aulas</h2>
            {upcoming.length === 0 ? (
              <Card className="p-5 text-sm text-muted">Nenhuma aula agendada nos próximos dias.</Card>
            ) : (
              <Card className="divide-y divide-line">
                {upcoming.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.courseName} <span className="font-normal text-muted">· {s.cohortName}</span></p>
                      {s.topic ? <p className="text-xs text-muted">{s.topic}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-deep dark:text-brand">{fmtDate(s.date)}</p>
                      <p className="text-xs text-muted">{s.startTime}–{s.endTime}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <PushOptIn />
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink"><GraduationCap className="h-4 w-4 text-brand" />Notas recentes</h2>
            {recentGrades.length === 0 ? (
              <Card className="p-5 text-sm text-muted">Notas publicadas aparecerão aqui.</Card>
            ) : (
              <Card className="divide-y divide-line">
                {recentGrades.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{g.title}</p>
                      <p className="text-xs text-muted">{g.subject} · {fmtDate(g.dueDate)}</p>
                    </div>
                    <Badge variant={g.kind !== "nota" ? "warn" : (g.scoreH ?? 0) >= 700 ? "success" : "warn"}>
                      {g.kind === "nota" ? fmtScore(g.scoreH) : g.kind === "ausente" ? "Ausente" : "Não entregue"}
                    </Badge>
                  </div>
                ))}
              </Card>
            )}
            <Link href="/aluno/notas" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Todas as notas <ArrowRight className="h-3.5 w-3.5" /></Link>
          </section>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink"><Wallet className="h-4 w-4 text-brand" />Financeiro</h2>
            {active ? (
              <>
                <p className="mt-2 text-sm text-muted">Plano: {active.e.plan === "integral" ? "integral" : "entrada + mensalidades"}</p>
                <p className="text-lg font-bold text-ink">{brl(active.e.totalCents)}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Sem matrícula ativa.</p>
            )}
            <LinkButton href="/aluno/financeiro" variant="soft" size="sm" className="mt-3">Ver pagamentos</LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}