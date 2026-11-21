import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Award } from "lucide-react";
import { db } from "@/db";
import { certificates, cohorts, courses, enrollments, users } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { issueCertificateAction, revokeCertificateAction } from "@/server/actions/academic";
import { fmtScore } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificados — administração" };

export default async function AdminCertificadosPage() {
  const actor = await requireRole(STAFF, "/admin/certificados");
  const rows = await db
    .select({ cert: certificates, student: users.name, course: courses.name })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(desc(certificates.issuedAt));
  const concluded = await db
    .select({ e: enrollments, student: users.name, course: courses.name, enabled: courses.certificateEnabled })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(enrollments.status, "concluida"));
  const pending = concluded.filter((c) => c.enabled && !rows.some((r) => r.cert.enrollmentId === c.e.id));

  return (
    <div>
      <PageTitle title="Certificados" description="Emissão com validação acadêmica, PDF com QR Code e verificação pública. Revogação auditada." />
      {pending.length > 0 ? (
        <Card className="mb-6 p-5">
          <h2 className="flex items-center gap-2 font-bold text-ink"><Award className="h-4 w-4 text-brand" />Aguardando emissão ({pending.length})</h2>
          <div className="mt-3 space-y-2">
            {pending.map((p) => (
              <div key={p.e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{p.student}</p>
                  <p className="text-xs text-muted">{p.course}</p>
                </div>
                <ActionForm action={issueCertificateAction} hidden={{ enrollmentId: p.e.id }} submitLabel="Emitir certificado" submitSize="sm" />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <DataTable
        exportName="certificados"
        filterKey="status"
        columns={[
          { key: "student", label: "Aluno" },
          { key: "course", label: "Curso" },
          { key: "code", label: "Código" },
          { key: "hours", label: "Carga (h)" },
          { key: "grade", label: "Média" },
          { key: "att", label: "Frequência" },
          { key: "issuedAt", label: "Emissão", type: "date" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={rows.map(({ cert, student, course }) => ({
          id: cert.id,
          student,
          course,
          code: cert.code,
          hours: cert.workloadHours,
          grade: fmtScore(cert.finalGradeH),
          att: cert.attendancePct !== null ? `${cert.attendancePct}%` : "—",
          issuedAt: cert.issuedAt.toISOString(),
          status: cert.revokedAt ? "revogado" : "valido",
          _actions: (
            <div className="flex items-center justify-end gap-2">
              <a href={`/api/certificados/${cert.code}/pdf`} className="text-xs font-semibold text-brand hover:underline">PDF</a>
              <a href={`/certificados/verificar/${cert.code}`} className="text-xs font-semibold text-muted hover:text-brand">Verificar</a>
              {!cert.revokedAt && actor.role === "admin" ? (
                <details className="relative inline-block text-left">
                  <summary className="cursor-pointer text-xs font-semibold text-danger">Revogar</summary>
                  <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
                    <ActionForm action={revokeCertificateAction} hidden={{ id: cert.id }} submitLabel="Revogar" submitVariant="danger" submitSize="sm" confirm="Revogar este certificado?">
                      <Field label="Motivo (auditoria)"><Input name="reason" required minLength={5} /></Field>
                    </ActionForm>
                  </div>
                </details>
              ) : null}
            </div>
          ),
        }))}
        emptyTitle="Nenhum certificado emitido"
        emptyDescription="Conclua matrículas para habilitar a emissão."
      />
    </div>
  );
}