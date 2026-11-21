import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { cohortTeachingData } from "@/lib/cohort-data";
import { TeacherCohortClient } from "@/components/teacher-cohort-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Turma — administração" };

export default async function AdminTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(STAFF, "/admin/turmas");
  const data = await cohortTeachingData(id);
  if (!data) notFound();
  return (
    <div>
      <Link href="/admin/turmas" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">← Turmas</Link>
      <TeacherCohortClient cohort={data.cohort} course={data.course} roster={data.roster} sessions={data.sessions} activities={data.activities} />
    </div>
  );
}