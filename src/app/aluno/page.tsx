import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, lt, ne } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CreditCard,
  GraduationCap,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, installments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { publishedGrades, upcomingSessionsForStudent } from "@/lib/academic";
import { resendVerificationAction } from "@/server/actions/auth";
import {
  brl,
  firstName,
  fmtDate,
  fmtScore,
  todayISO,
  weekdaysLabel,
} from "@/lib/utils";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  LinkButton,
  StatusBadge,
} from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PushOptIn } from "@/components/push-optin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do aluno" };

function QuickCard({
  icon: Icon,
  label,
  value,
  href,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </Link>
  );
}

export default async function AlunoPage() {
  const user = await requireUser("/aluno");

  const myEnrollments = await db
    .select({ e: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(
      and(
        eq(enrollments.userId, user.id),
        ne(enrollments.status, "cancelada"),
      ),
    )
    .orderBy(desc(enrollments.createdAt));

  const upcoming = await upcomingSessionsForStudent(user.id, 5);
  const active =
    myEnrollments.find((m) => m.e.status === "ativa") ?? myEnrollments[0];
  const recentGrades = active
    ? (await publishedGrades(active.e.id)).slice(-3).reverse()
    : [];

  const overdue = await db
    .select({ n: installments.id })
    .from(installments)
    .innerJoin(enrollments, eq(enrollments.id, installments.enrollmentId))
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(installments.status, "pendente"),
        lt(installments.dueDate, todayISO()),
      ),
    );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/15 via-surface to-violet-500/10 p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Área do aluno
            </span>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Olá, {firstName(user.name)}!
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Acompanhe seus cursos, aulas, notas e pagamentos em um só lugar.
            </p>
          </div>

          <LinkButton href="/cursos" variant="primary">
            <span className="inline-flex items-center gap-2">
              Explorar cursos
              <ArrowRight className="h-4 w-4" />
            </span>
          </LinkButton>
        </div>
      </section>

      {!user.emailVerifiedAt ? (
        <Alert
          variant="warn"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span>Confirme seu e-mail para proteger sua conta.</span>
          <ActionForm
            action={resendVerificationAction}
            submitLabel="Reenviar link"
            submitVariant="secondary"
            submitSize="sm"
          />
        </Alert>
      ) : null}

      {overdue.length > 0 ? (
        <Alert
          variant="danger"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Você tem {overdue.length} mensalidade(s) vencida(s).
          </span>
          <LinkButton
            href="/aluno/financeiro"
            variant="secondary"
            size="sm"
          >
            Regularizar
          </LinkButton>
        </Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickCard
          icon={BookOpen}
          label="Meus cursos"
          value={myEnrollments.length}
          href="/aluno"
          color="bg-teal-500/10 text-teal-500"
        />
        <QuickCard
          icon={CalendarDays}
          label="Próximas aulas"
          value={upcoming.length}
          href="/aluno/frequencia"
          color="bg-sky-500/10 text-sky-500"
        />
        <QuickCard
          icon={ChartNoAxesColumnIncreasing}
          label="Notas recentes"
          value={recentGrades.length}
          href="/aluno/notas"
          color="bg-violet-500/10 text-violet-500"
        />
        <QuickCard
          icon={CreditCard}
          label="Financeiro"
          value={overdue.length === 0 ? "Em dia" : `${overdue.length} pendente(s)`}
          href="/aluno/financeiro"
          color={
            overdue.length === 0
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-amber-500/10 text-amber-500"
          }
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-500">
                <BookOpen className="h-4 w-4" />
              </span>
              Meus cursos
            </h2>

            {myEnrollments.length === 0 ? (
              <Card className="border-teal-500/15 bg-gradient-to-br from-teal-500/5 to-surface p-1">
                <EmptyState
                  icon={<GraduationCap className="h-8 w-8 text-teal-500" />}
                  title="Você ainda não está matriculado"
                  description="Escolha um curso presencial e garanta sua vaga na próxima turma."
                  action={
                    <LinkButton href="/cursos">
                      Ver cursos disponíveis
                    </LinkButton>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {myEnrollments.map(({ e, cohort, course }) => (
                  <Card
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-500/5 to-surface p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{course.name}</p>
                      <p className="text-sm text-muted">
                        {cohort.name} · {weekdaysLabel(cohort.daysOfWeek)} ·{" "}
                        {cohort.startTime}–{cohort.endTime}
                      </p>
                      <p className="text-xs text-muted">
                        {fmtDate(cohort.startDate)} a {fmtDate(cohort.endDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={e.status} />

                      {e.status === "ativa" ? (
                        <a
                          href={`/api/calendario/${cohort.id}`}
                          className="text-xs font-semibold text-muted hover:text-brand"
                          title="Exportar aulas para seu calendário"
                        >
                          .ics
                        </a>
                      ) : null}

                      {e.status === "pendente_pagamento" ? (
                        <LinkButton
                          href={`/matricula/confirmacao?enrollment=${e.id}`}
                          size="sm"
                          variant="soft"
                        >
                          Pagar
                        </LinkButton>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <CalendarDays className="h-4 w-4" />
              </span>
              Próximas aulas
            </h2>

            {upcoming.length === 0 ? (
              <Card className="border-sky-500/15 bg-gradient-to-r from-sky-500/5 to-surface p-5 text-sm text-muted">
                Nenhuma aula agendada nos próximos dias.
              </Card>
            ) : (
              <Card className="divide-y divide-line overflow-hidden border-sky-500/15">
                {upcoming.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-sky-500/5 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                        <CalendarDays className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {s.courseName}
                          <span className="font-normal text-muted">
                            {" "}
                            · {s.cohortName}
                          </span>
                        </p>
                        {s.topic ? (
                          <p className="truncate text-xs text-muted">
                            {s.topic}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-xl bg-sky-500/10 px-3 py-2 text-right">
                      <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
                        {fmtDate(s.date)}
                      </p>
                      <p className="text-xs text-muted">
                        {s.startTime}–{s.endTime}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <PushOptIn />

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                <GraduationCap className="h-4 w-4" />
              </span>
              Notas recentes
            </h2>

            {recentGrades.length === 0 ? (
              <Card className="border-violet-500/15 bg-gradient-to-br from-violet-500/5 to-surface p-5 text-sm text-muted">
                Notas publicadas aparecerão aqui.
              </Card>
            ) : (
              <Card className="divide-y divide-line overflow-hidden border-violet-500/15">
                {recentGrades.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {g.title}
                        </p>
                        <p className="text-xs text-muted">
                          {g.subject} · {fmtDate(g.dueDate)}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={
                        g.kind !== "nota"
                          ? "warn"
                          : (g.scoreH ?? 0) >= 700
                            ? "success"
                            : "warn"
                      }
                    >
                      {g.kind === "nota"
                        ? fmtScore(g.scoreH)
                        : g.kind === "ausente"
                          ? "Ausente"
                          : "Não entregue"}
                    </Badge>
                  </div>
                ))}
              </Card>
            )}

            <Link
              href="/aluno/notas"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              Todas as notas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-surface p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Wallet className="h-4 w-4" />
              </span>
              Financeiro
            </h2>

            {active ? (
              <>
                <p className="mt-3 text-sm text-muted">
                  Plano:{" "}
                  {active.e.plan === "integral"
                    ? "integral"
                    : "entrada + mensalidades"}
                </p>
                <p className="text-xl font-black text-ink">
                  {brl(active.e.totalCents)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Sem matrícula ativa.
              </p>
            )}

            <LinkButton
              href="/aluno/financeiro"
              variant="soft"
              size="sm"
              className="mt-4"
            >
              Ver pagamentos
            </LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}