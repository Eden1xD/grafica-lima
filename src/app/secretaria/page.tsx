import type { Metadata } from "next";
import { asc, count, desc, eq, inArray, or } from "drizzle-orm";
import { ClipboardList, GraduationCap, Megaphone, Plus, Users } from "lucide-react";
import { db } from "@/db";
import { cohorts, courses, enrollments, teachers, userRoles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { takenSeats } from "@/lib/payments/core";
import { createStudentAction } from "@/server/actions/admin-people";
import { publishAnnouncementAction } from "@/server/actions/admin-site";
import { fmtDate, fmtDateTime, weekdaysLabel } from "@/lib/utils";
import { ActionForm, Collapse } from "@/components/action-form";
import { Badge, Card, Field, Input, LinkButton, PageTitle, Select, Stat, StatusBadge, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel da Secretaria" };

export default async function SecretariaPage() {
  await requirePermission("alunos.ver", "/secretaria");
  const [[alunoCount], [pendingCount], recent, openCohorts, profRows] = await Promise.all([
    db.select({ n: count() }).from(users).where(or(eq(users.role, "aluno"), inArray(users.id, db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "aluno"))))),
    db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "pendente_pagamento")),
    db
      .select({ e: enrollments, student: users.name, course: courses.name, cohort: cohorts.name })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .orderBy(desc(enrollments.createdAt))
      .limit(6),
    db
      .select({ cohort: cohorts, course: courses.name })
      .from(cohorts)
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(cohorts.status, "aberta"))
      .orderBy(asc(cohorts.startDate))
      .limit(6),
    db.select({ id: teachers.id, name: users.name, specialties: teachers.specialties }).from(teachers).innerJoin(users, eq(users.id, teachers.userId)).orderBy(asc(users.name)).limit(8),
  ]);
  const seats = await Promise.all(openCohorts.map(async (c) => ({ id: c.cohort.id, taken: await takenSeats(c.cohort.id) })));
  const seatMap = new Map(seats.map((s) => [s.id, s.taken]));

  return (
    <div>
      <PageTitle
        title="Secretaria"
        description="Atendimento, matrículas e cadastro — sem acesso a configurações críticas."
        actions={<LinkButton href="/admin/matriculas" size="sm"><Plus className="h-4 w-4" />Nova matrícula</LinkButton>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Alunos cadastrados" value={Number(alunoCount.n)} icon={<GraduationCap className="h-5 w-5" />} />
        <Stat label="Matrículas aguardando pagamento" value={Number(pendingCount.n)} icon={<ClipboardList className="h-5 w-5" />} tone="warn" />
        <Stat label="Turmas com matrículas abertas" value={openCohorts.length} icon={<Users className="h-5 w-5" />} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="font-bold text-ink">Matrículas recentes</h2>
              <LinkButton href="/admin/matriculas" variant="secondary" size="sm">Gerenciar todas</LinkButton>
            </div>
            <div className="mt-3 divide-y divide-line">
              {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nenhuma matrícula ainda.</p> : recent.map(({ e, student, course, cohort }) => (
                <LinkButton key={e.id} href={`/admin/matriculas/${e.id}`} variant="ghost" size="sm" className="!h-auto w-full !justify-between px-5 py-3">
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-semibold text-ink">{student}</span>
                    <span className="block truncate text-xs font-normal text-muted">{course} · {cohort} · {fmtDateTime(e.createdAt)}</span>
                  </span>
                  <StatusBadge status={e.status} />
                </LinkButton>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-ink">Turmas abertas — vagas</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {openCohorts.map(({ cohort, course }) => {
                const taken = seatMap.get(cohort.id) ?? 0;
                const available = Math.max(0, cohort.capacity - taken);
                return (
                  <div key={cohort.id} className="rounded-xl border border-line p-4">
                    <p className="text-sm font-bold text-ink">{course}</p>
                    <p className="text-xs text-muted">{cohort.name} · {weekdaysLabel(cohort.daysOfWeek)} · {cohort.startTime}–{cohort.endTime}</p>
                    <p className="text-xs text-muted">Início: {fmtDate(cohort.startDate)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant={available === 0 ? "danger" : available <= 3 ? "warn" : "success"}>{available} vaga(s)</Badge>
                      <LinkButton href={`/admin/turmas/${cohort.id}`} variant="secondary" size="sm">Abrir</LinkButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Collapse title="+ Cadastrar aluno">
            <ActionForm action={createStudentAction} submitLabel="Cadastrar e enviar e-mail" submitSize="sm" className="grid gap-3">
              <Field label="Nome completo"><Input name="name" required minLength={3} /></Field>
              <Field label="E-mail"><Input name="email" type="email" required /></Field>
            </ActionForm>
          </Collapse>
          <Collapse title="+ Comunicado administrativo">
            <ActionForm action={publishAnnouncementAction} submitLabel="Publicar e notificar" submitSize="sm" className="grid gap-3">
              <Field label="Título"><Input name="title" required minLength={3} /></Field>
              <Field label="Mensagem"><Textarea name="body" required rows={3} /></Field>
              <Field label="Público">
                <Select name="audience" defaultValue="alunos">
                  <option value="alunos">Alunos</option>
                  <option value="todos">Todos</option>
                  <option value="professores">Professores</option>
                </Select>
              </Field>
            </ActionForm>
          </Collapse>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink"><Megaphone className="h-4 w-4 text-brand" />Professores</h2>
            <ul className="mt-3 space-y-2">
              {profRows.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="font-semibold text-ink">{t.name}</p>
                  {t.specialties ? <p className="text-xs text-muted">{t.specialties}</p> : null}
                </li>
              ))}
            </ul>
            <LinkButton href="/admin/professores" variant="soft" size="sm" className="mt-3">Gerenciar professores</LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}