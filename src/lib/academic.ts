import { and, asc, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  attendanceRecords,
  classSessions,
  cohortTeachers,
  cohorts,
  courses,
  enrollments,
  grades,
  users,
  teachers,
  type Cohort,
} from "@/db/schema";

/** Turmas de um professor: vínculos múltiplos + legado (teacher_id principal). */
export function teacherCohortCondition(teacherId: string) {
  return or(
    eq(cohorts.teacherId, teacherId),
    inArray(cohorts.id, db.select({ id: cohortTeachers.cohortId }).from(cohortTeachers).where(eq(cohortTeachers.teacherId, teacherId))),
  );
}
import { attendanceStats, generateSessionDates, weightedAverageH } from "@/lib/domain";
import { todayISO } from "@/lib/utils";

/** Gera as aulas da turma conforme dias/horários (idempotente). */
export async function ensureCohortSessions(cohort: Cohort): Promise<void> {
  const dates = generateSessionDates(cohort.startDate, cohort.endDate, cohort.daysOfWeek);
  if (dates.length === 0) return;
  await db
    .insert(classSessions)
    .values(dates.map((date) => ({ cohortId: cohort.id, date, startTime: cohort.startTime, endTime: cohort.endTime })))
    .onConflictDoNothing();
}

export async function roster(cohortId: string) {
  return db
    .select({ enrollmentId: enrollments.id, status: enrollments.status, userId: users.id, name: users.name, email: users.email })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["ativa", "trancada", "concluida"])))
    .orderBy(asc(users.name));
}

export type SubjectAverage = { subject: string; avgH: number | null; count: number };

/** Médias por disciplina — apenas notas publicadas, normalizadas para escala 0–10. */
export async function subjectAverages(enrollmentId: string): Promise<SubjectAverage[]> {
  const rows = await db
    .select({
      subject: activities.subject,
      scoreH: grades.scoreH,
      maxScoreH: activities.maxScoreH,
      weightH: activities.weightH,
      kind: grades.kind,
    })
    .from(grades)
    .innerJoin(activities, eq(activities.id, grades.activityId))
    .where(and(eq(grades.enrollmentId, enrollmentId), isNotNull(grades.publishedAt)));
  const bySubject = new Map<string, Array<{ scoreH: number; weightH: number }>>();
  for (const r of rows) {
    const list = bySubject.get(r.subject) ?? [];
    const score = r.kind === "nota" && r.scoreH !== null ? Math.round((r.scoreH * 1000) / Math.max(1, r.maxScoreH)) : 0;
    list.push({ scoreH: score, weightH: r.weightH });
    bySubject.set(r.subject, list);
  }
  return [...bySubject.entries()].map(([subject, items]) => ({
    subject,
    avgH: weightedAverageH(items),
    count: items.length,
  }));
}

export async function overallAverageH(enrollmentId: string): Promise<number | null> {
  const subjects = await subjectAverages(enrollmentId);
  const valid = subjects.filter((s) => s.avgH !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((s, x) => s + (x.avgH as number), 0) / valid.length);
}

export async function attendanceForEnrollment(enrollmentId: string) {
  const rows = await db
    .select({ status: attendanceRecords.status, date: classSessions.date, sessionId: classSessions.id, note: attendanceRecords.note })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(classSessions.id, attendanceRecords.sessionId))
    .where(and(eq(attendanceRecords.enrollmentId, enrollmentId), ne(classSessions.status, "cancelada")))
    .orderBy(asc(classSessions.date));
  return { records: rows, stats: attendanceStats(rows) };
}

export async function publishedGrades(enrollmentId: string) {
  return db
    .select({
      id: grades.id,
      scoreH: grades.scoreH,
      kind: grades.kind,
      note: grades.note,
      publishedAt: grades.publishedAt,
      title: activities.title,
      subject: activities.subject,
      type: activities.type,
      dueDate: activities.dueDate,
      maxScoreH: activities.maxScoreH,
      weightH: activities.weightH,
    })
    .from(grades)
    .innerJoin(activities, eq(activities.id, grades.activityId))
    .where(and(eq(grades.enrollmentId, enrollmentId), isNotNull(grades.publishedAt)))
    .orderBy(asc(activities.dueDate));
}

export async function upcomingSessionsForStudent(userId: string, limit = 6) {
  return db
    .select({
      id: classSessions.id,
      date: classSessions.date,
      startTime: classSessions.startTime,
      endTime: classSessions.endTime,
      topic: classSessions.topic,
      cohortName: cohorts.name,
      courseName: courses.name,
    })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .innerJoin(enrollments, eq(enrollments.cohortId, cohorts.id))
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.status, "ativa"),
        eq(classSessions.status, "agendada"),
        gte(classSessions.date, todayISO()),
      ),
    )
    .orderBy(asc(classSessions.date))
    .limit(limit);
}

export async function teacherByUser(userId: string) {
  const [t] = await db.select().from(teachers).where(eq(teachers.userId, userId)).limit(1);
  return t ?? null;
}

export async function upcomingSessionsForTeacher(teacherId: string, limit = 6) {
  return db
    .select({
      id: classSessions.id,
      date: classSessions.date,
      startTime: classSessions.startTime,
      endTime: classSessions.endTime,
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      courseName: courses.name,
      status: classSessions.status,
    })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(teacherCohortCondition(teacherId), eq(classSessions.status, "agendada"), gte(classSessions.date, todayISO())))
    .orderBy(asc(classSessions.date))
    .limit(limit);
}

export async function cohortAttendanceSummary(cohortId: string) {
  const rows = await db
    .select({ enrollmentId: attendanceRecords.enrollmentId, status: attendanceRecords.status })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(classSessions.id, attendanceRecords.sessionId))
    .where(and(eq(classSessions.cohortId, cohortId), ne(classSessions.status, "cancelada")));
  const map = new Map<string, Array<{ status: "presente" | "ausente" | "justificado" }>>();
  for (const r of rows) {
    const list = map.get(r.enrollmentId) ?? [];
    list.push({ status: r.status });
    map.set(r.enrollmentId, list);
  }
  return map;
}

export const sqlNow = sql`now()`;