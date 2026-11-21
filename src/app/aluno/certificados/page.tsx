import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Award, Download, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { certificates, cohorts, courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { attendanceForEnrollment, overallAverageH } from "@/lib/academic";
import { fmtDate, fmtScore } from "@/lib/utils";
import { Badge, Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meus certificados" };

export default async function AlunoCertificadosPage() {
  const user = await requireUser("/aluno/certificados");
  const certs = await db
    .select({ cert: certificates, course: courses, cohort: cohorts })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(enrollments.userId, user.id));
  const concluded = await db
    .select({ e: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(enrollments.userId, user.id));
  const pendingConclusion = concluded.filter((c) => c.e.status === "concluida" && !certs.some((x) => x.cert.enrollmentId === c.e.id));

  return (
    <div>
      <PageTitle title="Meus certificados" description="Certificados digitais com código de autenticidade e verificação pública." />
      {certs.length === 0 && pendingConclusion.length === 0 ? (
        <EmptyState
          icon={<Award className="h-8 w-8" />}
          title="Nenhum certificado ainda"
          description="O certificado é emitido após a conclusão do curso com a frequência mínima e a média exigidas. Acompanhe seu progresso em Notas e Frequência."
          action={<LinkButton href="/aluno/notas" variant="soft">Ver meu progresso</LinkButton>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {certs.map(({ cert, course }) => (
            <Card key={cert.id} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Award className="h-5 w-5" /></span>
                {cert.revokedAt ? <Badge variant="danger">Revogado</Badge> : <Badge variant="success">Válido</Badge>}
              </div>
              <h2 className="mt-3 font-bold text-ink">{course.name}</h2>
              <p className="text-sm text-muted">{cert.workloadHours} horas · emitido em {fmtDate(cert.issuedAt)}</p>
              <p className="mt-2 font-mono text-xs tracking-widest text-muted">{cert.code}</p>
              {!cert.revokedAt ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/certificados/${cert.code}/pdf`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white transition hover:opacity-90">
                    <Download className="h-3.5 w-3.5" /> Baixar PDF
                  </a>
                  <LinkButton href={`/certificados/verificar/${cert.code}`} variant="secondary" size="sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> Página de verificação
                  </LinkButton>
                </div>
              ) : (
                <p className="mt-3 text-xs text-danger">Este certificado foi revogado pela instituição.</p>
              )}
            </Card>
          ))}
          {pendingConclusion.map(({ e, course }) => (
            <PendingCard key={e.id} enrollmentId={e.id} courseName={course.name} minGradeH={course.minGradeH} minAtt={course.minAttendancePct} />
          ))}
        </div>
      )}
    </div>
  );
}

async function PendingCard({ enrollmentId, courseName, minGradeH, minAtt }: { enrollmentId: string; courseName: string; minGradeH: number; minAtt: number }) {
  const avg = await overallAverageH(enrollmentId);
  const att = await attendanceForEnrollment(enrollmentId);
  return (
    <Card className="border-dashed p-6">
      <Badge variant="info">Em análise</Badge>
      <h2 className="mt-3 font-bold text-ink">{courseName}</h2>
      <p className="mt-1 text-sm text-muted">Matrícula concluída — certificado em processamento pela secretaria.</p>
      <div className="mt-3 space-y-1 text-xs text-muted">
        <p>Média final: <strong className="text-ink">{fmtScore(avg)}</strong> (mínimo {fmtScore(minGradeH)})</p>
        <p>Frequência: <strong className="text-ink">{att.stats.pct === null ? "—" : `${att.stats.pct}%`}</strong> (mínimo {minAtt}%)</p>
      </div>
    </Card>
  );
}