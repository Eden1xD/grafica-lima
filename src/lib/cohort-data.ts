import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, attendanceRecords, classrooms, classSessions, cohorts, courses, grades } from "@/db/schema";
import { attendanceStats } from "@/lib/domain";
import { roster } from "@/lib/academic";
import { weekdaysLabel } from "@/lib/utils";

/** Dados completos de uma turma para a interface de chamada/notas (professor e admin). */
export async function cohortTeachingData(cohortId: string) {
  const [ctx] = await db
    .select({ cohort: cohorts, course: courses, room: classrooms })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .leftJoin(classrooms, eq(classrooms.id, cohorts.roomId))
    .where(eq(cohorts.id, cohortId))
    .limit(1);
  if (!ctx) return null;

  const students = await roster(cohortId);
  const sessionRows = await db.select().from(classSessions).where(eq(classSessions.cohortId, cohortId)).orderBy(asc(classSessions.date));
  const recordRows = await db
    .select({ r: attendanceRecords })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(classSessions.id, attendanceRecords.sessionId))
    .where(eq(classSessions.cohortId, cohortId));
  const activityRows = await db.select().from(activities).where(eq(activities.cohortId, cohortId)).orderBy(asc(activities.dueDate));
  const gradeRows = activityRows.length
    ? await db.select().from(grades).innerJoin(activities, eq(activities.id, grades.activityId)).where(eq(activities.cohortId, cohortId))
    : [];

  const recordsBySession = new Map<string, Record<string, string>>();
  const attByEnrollment = new Map<string, Array<{ status: "presente" | "ausente" | "justificado" }>>();
  for (const { r } of recordRows) {
    const m = recordsBySession.get(r.sessionId) ?? {};
    m[r.enrollmentId] = r.status;
    recordsBySession.set(r.sessionId, m);
    const list = attByEnrollment.get(r.enrollmentId) ?? [];
    list.push({ status: r.status });
    attByEnrollment.set(r.enrollmentId, list);
  }
  const gradesByActivity = new Map<string, Record<string, { scoreH: number | null; kind: string; published: boolean; note: string | null }>>();
  for (const row of gradeRows) {
    const g = row.grades;
    const m = gradesByActivity.get(g.activityId) ?? {};
    m[g.enrollmentId] = { scoreH: g.scoreH, kind: g.kind, published: !!g.publishedAt, note: g.note };
    gradesByActivity.set(g.activityId, m);
  }

  return {
    cohort: {
      id: ctx.cohort.id,
      name: ctx.cohort.name,
      days: weekdaysLabel(ctx.cohort.daysOfWeek),
      time: `${ctx.cohort.startTime}–${ctx.cohort.endTime}`,
      startDate: ctx.cohort.startDate,
      endDate: ctx.cohort.endDate,
      room: ctx.room?.name ?? null,
    },
    course: { name: ctx.course.name, minGradeH: ctx.course.minGradeH, minAttendancePct: ctx.course.minAttendancePct },
    roster: students.map((s) => ({
      enrollmentId: s.enrollmentId,
      name: s.name,
      status: s.status,
      attPct: attendanceStats(attByEnrollment.get(s.enrollmentId) ?? []).pct,
    })),
    sessions: sessionRows.map((s) => ({
      id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, status: s.status, topic: s.topic,
      records: recordsBySession.get(s.id) ?? {},
    })),
    activities: activityRows.map((a) => ({
      id: a.id, title: a.title, type: a.type, subject: a.subject, dueDate: a.dueDate,
      maxScoreH: a.maxScoreH, weightH: a.weightH, status: a.status,
      grades: gradesByActivity.get(a.id) ?? {},
    })),
  };
}