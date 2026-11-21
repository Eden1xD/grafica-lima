import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, cohorts, courses, enrollments, users } from "@/db/schema";
import { certificatePdf, pdfResponse } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";
import { baseUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [row] = await db
    .select({
  cert: certificates,
  student: users.name,
  courseName: courses.name,
  syllabus: courses.syllabus,
})
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(certificates.code, code.toUpperCase()))
    .limit(1);
  if (!row) return Response.json({ error: "Certificado não encontrado" }, { status: 404 });
  if (row.cert.revokedAt) return Response.json({ error: "Certificado revogado" }, { status: 410 });
  const cfg = await getSettings();
  const verifyUrl = `${await baseUrl()}/certificados/verificar/${row.cert.code}`;
  const bytes = await certificatePdf({
    studentName: row.student,
    courseName: row.courseName,
syllabus: row.syllabus,
    workloadHours: row.cert.workloadHours,
    issuedAt: row.cert.issuedAt,
    code: row.cert.code,
    verifyUrl,
    institutionName: `${cfg.institution.name} — ${cfg.institution.tagline}`,
  });
  return pdfResponse(bytes, `certificado-${row.cert.code}.pdf`);
}