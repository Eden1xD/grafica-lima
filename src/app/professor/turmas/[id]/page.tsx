import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, cohortTeachers, teachers } from "@/db/schema";
import { requireUser, userIsStaff } from "@/lib/auth/guards";
import { cohortTeachingData } from "@/lib/cohort-data";
import { TeacherCohortClient } from "@/components/teacher-cohort-client";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Turma — portal do professor" };

export default async function ProfessorTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/professor/turmas/${id}`);
  const data = await cohortTeachingData(id);
  if (!data) notFound();
  // Gestão (admin/secretaria) acessa qualquer turma; professor precisa do cargo E do vínculo
  if (!userIsStaff(user)) {
    if (!user.roles.includes("professor")) {
      return <Alert variant="danger">Você não tem acesso a esta turma.</Alert>;
    }
    const [t] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, user.id)).limit(1);
    const [c] = await db.select({ teacherId: cohorts.teacherId }).from(cohorts).where(eq(cohorts.id, id)).limit(1);
    let owns = !!t && !!c && c.teacherId === t.id;
    if (!owns && t) {
      const [link] = await db
        .select({ id: cohortTeachers.id })
        .from(cohortTeachers)
        .where(and(eq(cohortTeachers.cohortId, id), eq(cohortTeachers.teacherId, t.id)))
        .limit(1);
      owns = !!link;
    }
    if (!owns) return <Alert variant="danger">Você não está vinculado a esta turma.</Alert>;
  }
  return (
    <div>
      <Link href="/professor" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">← Minhas turmas</Link>
      <TeacherCohortClient cohort={data.cohort} course={data.course} roster={data.roster} sessions={data.sessions} activities={data.activities} />
    </div>
  );
}