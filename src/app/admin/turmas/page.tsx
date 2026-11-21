import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, cohorts, cohortTeachers, courses, teachers, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { takenSeats } from "@/lib/payments/core";
import { weekdaysLabel } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { Collapse } from "@/components/action-form";
import { CohortForm, RoomQuickForm } from "@/components/admin-forms";
import { LinkButton, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Turmas — administração" };

export default async function AdminTurmasPage() {
  await requireRole(STAFF, "/admin/turmas");
  const rows = await db
    .select({ cohort: cohorts, course: courses.name, teacher: users.name, room: classrooms.name })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .leftJoin(teachers, eq(teachers.id, cohorts.teacherId))
    .leftJoin(users, eq(users.id, teachers.userId))
    .leftJoin(classrooms, eq(classrooms.id, cohorts.roomId))
    .orderBy(asc(cohorts.startDate));
  const allCourses = await db.select({ id: courses.id, name: courses.name }).from(courses).orderBy(asc(courses.name));
  const teacherRows = await db.select({ id: teachers.id, name: users.name }).from(teachers).innerJoin(users, eq(users.id, teachers.userId)).orderBy(asc(users.name));
  const rooms = await db.select().from(classrooms).orderBy(asc(classrooms.name));
  const seats = await Promise.all(rows.map(async (r) => ({ id: r.cohort.id, taken: await takenSeats(r.cohort.id) })));
  const seatMap = new Map(seats.map((s) => [s.id, s.taken]));
  const links = await db
    .select({ cohortId: cohortTeachers.cohortId, name: users.name, isPrimary: cohortTeachers.isPrimary })
    .from(cohortTeachers)
    .innerJoin(teachers, eq(teachers.id, cohortTeachers.teacherId))
    .innerJoin(users, eq(users.id, teachers.userId));
  const namesByCohort = new Map<string, Set<string>>();
  for (const l of links) {
    const set = namesByCohort.get(l.cohortId) ?? new Set<string>();
    set.add(l.isPrimary ? `${l.name} ★` : l.name);
    namesByCohort.set(l.cohortId, set);
  }

  return (
    <div>
      <PageTitle title="Turmas" description="Capacidade, horários, professores e salas — com verificação de conflitos." />
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Collapse title="+ Nova turma"><CohortForm courses={allCourses} teachers={teacherRows} rooms={rooms} /></Collapse>
        <Collapse title="+ Sala"><RoomQuickForm /></Collapse>
      </div>
      <DataTable
        exportName="turmas"
        filterKey="status"
        columns={[
          { key: "name", label: "Turma" },
          { key: "course", label: "Curso" },
          { key: "teacher", label: "Professor" },
          { key: "room", label: "Sala" },
          { key: "schedule", label: "Dias / horário" },
          { key: "startDate", label: "Início", type: "date" },
          { key: "seats", label: "Ocupação" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={rows.map(({ cohort, course, teacher, room }) => ({
          id: cohort.id,
          name: cohort.name,
          course,
          teacher: (() => {
            const set = namesByCohort.get(cohort.id) ?? new Set<string>();
            if (teacher && ![...set].some((n) => n.replace(" ★", "") === teacher)) set.add(teacher);
            return set.size > 0 ? [...set].join(", ") : "A definir";
          })(),
          room: room ?? "A definir",
          schedule: `${weekdaysLabel(cohort.daysOfWeek)} ${cohort.startTime}–${cohort.endTime}`,
          startDate: cohort.startDate,
          seats: `${seatMap.get(cohort.id) ?? 0}/${cohort.capacity}`,
          status: cohort.status,
          _actions: (
            <div className="flex justify-end gap-2">
              <LinkButton href={`/admin/turmas/${cohort.id}`} size="sm">Abrir</LinkButton>
              <LinkButton href={`/admin/cursos/${cohort.courseId}`} variant="secondary" size="sm">Editar</LinkButton>
            </div>
          ),
        }))}
        emptyTitle="Nenhuma turma"
        emptyDescription="Crie turmas a partir de um curso para liberar matrículas."
      />
    </div>
  );
}