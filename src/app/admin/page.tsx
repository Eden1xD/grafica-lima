import Link from "next/link";
import type { Metadata } from "next";
import { and, count, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, ClipboardList, CreditCard, GraduationCap, Plus, Users, Wallet } from "lucide-react";
import { db } from "@/db";
import { classSessions, cohorts, courses, enrollments, installments, payments, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { googleConfigured, mercadopagoConfigured, smtpConfigured } from "@/lib/settings";
import { brl, fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { Card, LinkButton, PageTitle, Stat, StatusBadge } from "@/components/ui";
import { Bars } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel administrativo" };

export default async function AdminDashboard() {
  await requireRole(STAFF, "/admin");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = todayISO();

  const [[activeStudents], [monthEnrollments], [revenueRow], [pendingRow], recent, upcoming, [overdueRow], [pendingEnrollRow]] = await Promise.all([
    db.select({ n: sql<number>`count(distinct ${enrollments.userId})` }).from(enrollments).where(eq(enrollments.status, "ativa")),
    db.select({ n: count() }).from(enrollments).where(gte(enrollments.createdAt, monthStart)),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` }).from(payments).where(and(eq(payments.status, "aprovado"), gte(payments.paidAt, monthStart))),
    db.select({ n: count(), total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` }).from(payments).where(eq(payments.status, "pendente")),
    db
      .select({ e: enrollments, student: users.name, course: courses.name, cohort: cohorts.name })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .orderBy(desc(enrollments.createdAt))
      .limit(6),
    db
      .select({ s: classSessions, cohort: cohorts.name, course: courses.name })
      .from(classSessions)
      .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(eq(classSessions.status, "agendada"), gte(classSessions.date, today)))
      .orderBy(classSessions.date)
      .limit(5),
    db.select({ n: count() }).from(installments).where(and(eq(installments.status, "pendente"), lt(installments.dueDate, today))),
    db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "pendente_pagamento")),
  ]);

  const months: Array<{ label: string; value: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const [r] = await db.select({ n: count() }).from(enrollments).where(and(gte(enrollments.createdAt, start), lt(enrollments.createdAt, end)));
    months.push({ label: start.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", ""), value: Number(r.n) });
  }

  const alerts: Array<{ text: string; href: string; tone: "warn" | "danger" | "info" }> = [];
  if (Number(overdueRow.n) > 0) alerts.push({ text: `${overdueRow.n} mensalidade(s) vencida(s)`, href: "/admin/financeiro", tone: "danger" });
  if (Number(pendingEnrollRow.n) > 0) alerts.push({ text: `${pendingEnrollRow.n} matrícula(s) aguardando pagamento`, href: "/admin/matriculas", tone: "warn" });
  if (!mercadopagoConfigured()) alerts.push({ text: "Gateway de pagamento não configurado — Pix/cartão online desativados", href: "/admin/configuracoes", tone: "info" });
  if (!googleConfigured()) alerts.push({ text: "Login Google não configurado (credenciais OAuth ausentes)", href: "/admin/configuracoes", tone: "info" });
  if (!smtpConfigured()) alerts.push({ text: "SMTP não configurado — e-mails na caixa de saída de desenvolvimento", href: "/admin/configuracoes", tone: "info" });

  return (
    <div>
      <PageTitle
        title="Visão geral"
        description="Indicadores reais da operação — atualizados a cada acesso."
        actions={
          <>
            <LinkButton href="/admin/cursos" size="sm" variant="secondary"><Plus className="h-4 w-4" />Novo curso</LinkButton>
            <LinkButton href="/admin/matriculas" size="sm"><Plus className="h-4 w-4" />Nova matrícula</LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Alunos ativos" value={Number(activeStudents.n)} icon={<Users className="h-5 w-5" />} hint="matrículas ativas" />
        <Stat label="Matrículas no mês" value={Number(monthEnrollments.n)} icon={<ClipboardList className="h-5 w-5" />} tone="info" />
        <Stat label="Receita recebida (mês)" value={brl(Number(revenueRow.total))} icon={<Wallet className="h-5 w-5" />} tone="success" hint="pagamentos aprovados" />
        <Stat label="Pagamentos pendentes" value={brl(Number(pendingRow.total))} icon={<CreditCard className="h-5 w-5" />} tone="warn" hint={`${pendingRow.n} cobrança(s) · valores previstos`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink">Matrículas — últimos 6 meses</h2>
            <Link href="/admin/matriculas" className="text-xs font-semibold text-brand hover:underline">Ver todas →</Link>
          </div>
          <Bars data={months} />
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-ink"><AlertTriangle className="h-4 w-4 text-warn" />Precisa da sua atenção</h2>
          <div className="mt-3 space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted">Tudo em ordem por aqui. 🎉</p>
            ) : (
              alerts.map((a) => (
                <Link key={a.text} href={a.href} className={`block rounded-xl px-3.5 py-2.5 text-xs font-semibold transition hover:opacity-80 ${a.tone === "danger" ? "bg-danger-soft text-danger" : a.tone === "warn" ? "bg-warn-soft text-warn" : "bg-info-soft text-info"}`}>
                  {a.text}
                </Link>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Ações rápidas</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/admin/turmas" variant="soft" size="sm"><Users className="h-3.5 w-3.5" />Turmas</LinkButton>
              <LinkButton href="/admin/comunicados" variant="soft" size="sm"><GraduationCap className="h-3.5 w-3.5" />Comunicado</LinkButton>
              <LinkButton href="/admin/certificados" variant="soft" size="sm"><BookOpen className="h-3.5 w-3.5" />Certificados</LinkButton>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-bold text-ink">Matrículas recentes</h2>
            <Link href="/admin/matriculas" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Gerenciar <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="mt-3 divide-y divide-line">
            {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nenhuma matrícula ainda.</p> : recent.map(({ e, student, course, cohort }) => (
              <Link key={e.id} href={`/admin/matriculas/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-bg/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{student}</p>
                  <p className="truncate text-xs text-muted">{course} · {cohort} · {fmtDateTime(e.createdAt)}</p>
                </div>
                <StatusBadge status={e.status} />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="flex items-center gap-2 font-bold text-ink"><CalendarDays className="h-4 w-4 text-brand" />Próximas aulas</h2>
            <Link href="/admin/calendario" className="text-xs font-semibold text-brand hover:underline">Calendário →</Link>
          </div>
          <div className="mt-3 divide-y divide-line">
            {upcoming.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nenhuma aula agendada.</p> : upcoming.map(({ s, cohort, course }) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{course}</p>
                  <p className="text-xs text-muted">{cohort}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-deep dark:text-brand">{fmtDate(s.date)}</p>
                  <p className="text-xs text-muted">{s.startTime}–{s.endTime}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}