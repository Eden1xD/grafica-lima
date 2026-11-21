import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classSessions, cohorts, courses, enrollments, teachers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { userIsStaff } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

function icsDate(dateIso: string, time: string): string {
  const d = new Date(`${dateIso}T${time}:00-03:00`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const [ctx] = await db
    .select({ cohort: cohorts, course: courses.name })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(cohorts.id, cohortId))
    .limit(1);
  if (!ctx) return Response.json({ error: "turma não encontrada" }, { status: 404 });

  let allowed = userIsStaff(user);
  if (!allowed) {
    const [enr] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId))).limit(1);
    allowed = !!enr;
  }
  if (!allowed && user.roles.includes("professor")) {
    const [t] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, user.id)).limit(1);
    allowed = !!t && ctx.cohort.teacherId === t.id;
  }
  if (!allowed) return Response.json({ error: "acesso negado" }, { status: 403 });

  const sessions = await db.select().from(classSessions).where(eq(classSessions.cohortId, cohortId)).orderBy(asc(classSessions.date));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grafica Lima//Cursos//PT-BR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${ctx.course} — ${ctx.cohort.name}`,
    ...sessions.flatMap((s) => [
      "BEGIN:VEVENT",
      `UID:${s.id}@graficalima`,
      `DTSTAMP:${icsDate(s.date, s.startTime)}`,
      `DTSTART:${icsDate(s.date, s.startTime)}`,
      `DTEND:${icsDate(s.date, s.endTime)}`,
      `SUMMARY:${ctx.course} — ${ctx.cohort.name}${s.topic ? ` (${s.topic.replace(/[,;]/g, " ")})` : ""}`,
      `STATUS:${s.status === "cancelada" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="turma-${cohortId.slice(0, 8)}.ics"` },
  });
}