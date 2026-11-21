import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Award, Download, ShieldCheck, ShieldX, SearchX } from "lucide-react";
import { db } from "@/db";
import { certificates, cohorts, courses, enrollments, users } from "@/db/schema";
import { fmtDate, fmtScore } from "@/lib/utils";
import { Card, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultado da verificação" };

export default async function VerificarCodigoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const code = codigo.toUpperCase();
  let row: { cert: typeof certificates.$inferSelect; studentName: string; courseName: string } | null = null;
  try {
    const [r] = await db
      .select({ cert: certificates, studentName: users.name, courseName: courses.name })
      .from(certificates)
      .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(eq(certificates.code, code))
      .limit(1);
    row = r ?? null;
  } catch {}

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/certificados/verificar" className="text-sm font-semibold text-brand hover:underline">← Nova verificação</Link>
      {!row ? (
        <Card className="mt-4 p-8 text-center">
          <SearchX className="mx-auto h-10 w-10 text-muted" />
          <h1 className="mt-4 text-xl font-bold text-ink">Certificado não encontrado</h1>
          <p className="mt-2 text-sm text-muted">O código <span className="font-mono font-bold">{code}</span> não corresponde a nenhum certificado emitido. Confira o código ou fale com a secretaria.</p>
        </Card>
      ) : row.cert.revokedAt ? (
        <Card className="mt-4 border-danger/40 p-8 text-center">
          <ShieldX className="mx-auto h-10 w-10 text-danger" />
          <h1 className="mt-4 text-xl font-bold text-danger">Certificado revogado</h1>
          <p className="mt-2 text-sm text-muted">Este certificado foi revogado em {fmtDate(row.cert.revokedAt)} e não é mais válido.</p>
          <p className="mt-3 font-mono text-xs text-muted">{code}</p>
        </Card>
      ) : (
        <Card className="mt-4 border-success/40 p-8">
          <div className="text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-4 text-xl font-bold text-success">Certificado autêntico</h1>
            <p className="mt-1 text-sm text-muted">Emitido pela Gráfica Lima — Produtos e Informática.</p>
          </div>
          <dl className="mt-6 grid gap-3 rounded-2xl bg-bg p-5 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-muted">Aluno(a)</dt><dd className="mt-0.5 font-bold text-ink">{row.studentName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Curso</dt><dd className="mt-0.5 font-bold text-ink">{row.courseName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Carga horária</dt><dd className="mt-0.5 font-semibold text-ink">{row.cert.workloadHours} horas</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted">Emissão</dt><dd className="mt-0.5 font-semibold text-ink">{fmtDate(row.cert.issuedAt)}</dd></div>
            {row.cert.finalGradeH !== null ? <div><dt className="text-xs font-semibold uppercase text-muted">Média final</dt><dd className="mt-0.5 font-semibold text-ink">{fmtScore(row.cert.finalGradeH)}</dd></div> : null}
            {row.cert.attendancePct !== null ? <div><dt className="text-xs font-semibold uppercase text-muted">Frequência</dt><dd className="mt-0.5 font-semibold text-ink">{row.cert.attendancePct}%</dd></div> : null}
          </dl>
          <p className="mt-4 text-center font-mono text-xs tracking-widest text-muted">{code}</p>
          <div className="mt-5 flex justify-center">
            <a href={`/api/certificados/${code}/pdf`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90">
              <Download className="h-4 w-4" /> Baixar PDF
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted"><Award className="h-3.5 w-3.5" />Curso livre de qualificação profissional — certificado próprio da instituição.</p>
        </Card>
      )}
      <div className="mt-6 text-center">
        <LinkButton href="/certificados/verificar" variant="secondary" size="sm">Verificar outro código</LinkButton>
      </div>
    </div>
  );
}