import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, cohorts, courseCategories, courses, teachers, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { takenSeats } from "@/lib/payments/core";
import { fmtDate, weekdaysLabel } from "@/lib/utils";
import { Badge, Card, LinkButton, PageTitle, StatusBadge } from "@/components/ui";
import { Collapse } from "@/components/action-form";
import { CourseForm, CohortForm } from "@/components/admin-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar curso" };

export default async function AdminCursoEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(STAFF, "/admin/cursos");
  const isNew = id === "novo";
  const course = isNew ? null : (await db.select().from(courses).where(eq(courses.id, id)).limit(1))[0];
  if (!isNew && !course) notFound();

  const categories = await db.select().from(courseCategories).orderBy(asc(courseCategories.name));
  const allCourses = await db.select({ id: courses.id, name: courses.name }).from(courses).orderBy(asc(courses.name));
  const teacherRows = await db
    .select({ id: teachers.id, name: users.name })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .orderBy(asc(users.name));
  const rooms = await db.select().from(classrooms).orderBy(asc(classrooms.name));
  const courseCohorts = course
    ? await db.select().from(cohorts).where(eq(cohorts.courseId, course.id)).orderBy(asc(cohorts.startDate))
    : [];
  const { cohortTeachers } = await import("@/db/schema");
  const teacherLinks = courseCohorts.length
    ? await db.select().from(cohortTeachers).where(inArray(cohortTeachers.cohortId, courseCohorts.map((c) => c.id)))
    : [];
  const extraByCohort = new Map<string, string[]>();
  for (const l of teacherLinks) {
    const list = extraByCohort.get(l.cohortId) ?? [];
    list.push(l.teacherId);
    extraByCohort.set(l.cohortId, list);
  }
  const seats = await Promise.all(courseCohorts.map(async (c) => ({ id: c.id, taken: await takenSeats(c.id) })));
  const seatMap = new Map(seats.map((s) => [s.id, s.taken]));

  return (
    <div>
      <Link href="/admin/cursos" className="mb-3 inline-block text-sm font-semibold text-brand hover:underline">← Cursos</Link>
      <PageTitle
        title={isNew ? "Novo curso" : course!.name}
        description={isNew ? "Preencha os dados e publique quando estiver pronto." : "Edite o curso e gerencie suas turmas."}
        actions={course?.status === "publicado" ? <LinkButton href={`/cursos/${course.slug}`} variant="secondary" size="sm">Ver página pública ↗</LinkButton> : undefined}
      />
      <Card className="p-6">
        <CourseForm course={course ?? undefined} categories={categories} />
      </Card>

      {course ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-ink">Turmas deste curso</h2>
          <div className="mb-4">
            <Collapse title="+ Nova turma (gera as aulas no calendário)">
              <CohortForm courses={allCourses} teachers={teacherRows} rooms={rooms} defaultCourseId={course.id} />
            </Collapse>
          </div>
          {courseCohorts.length === 0 ? (
            <Card className="p-6 text-sm text-muted">Nenhuma turma criada. Crie a primeira acima para liberar matrículas.</Card>
          ) : (
            <div className="space-y-3">
              {courseCohorts.map((c) => {
                const taken = seatMap.get(c.id) ?? 0;
                return (
                  <Card key={c.id} className="p-5" >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink">{c.name}</p>
                        <p className="text-xs text-muted">{weekdaysLabel(c.daysOfWeek)} · {c.startTime}–{c.endTime} · {fmtDate(c.startDate)} a {fmtDate(c.endDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={taken >= c.capacity ? "danger" : "success"}>{taken}/{c.capacity} vagas</Badge>
                        <StatusBadge status={c.status} />
                        <LinkButton href={`/admin/turmas/${c.id}`} variant="secondary" size="sm">Abrir turma</LinkButton>
                      </div>
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-brand">Editar turma</summary>
                      <div className="mt-3">
                        <CohortForm cohort={{ ...c, extraTeacherIds: extraByCohort.get(c.id) ?? [] }} courses={allCourses} teachers={teacherRows} rooms={rooms} />
                      </div>
                    </details>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}