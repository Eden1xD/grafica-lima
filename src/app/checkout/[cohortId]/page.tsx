import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { cohorts, courses, enrollments, studentProfiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getSettings, mercadopagoConfigured } from "@/lib/settings";
import { takenSeats } from "@/lib/payments/core";
import { todayISO, weekdaysLabel } from "@/lib/utils";
import { Alert, Card, LinkButton } from "@/components/ui";
import { CheckoutClient } from "@/components/checkout-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matrícula — checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const user = await requireUser(`/checkout/${cohortId}`);
  const [ctx] = await db
    .select({ cohort: cohorts, course: courses })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(cohorts.id, cohortId))
    .limit(1);

  if (!ctx || ctx.course.status !== "publicado") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Alert variant="danger">Turma não encontrada ou curso indisponível.</Alert>
        <LinkButton href="/cursos" variant="secondary" className="mt-4">Voltar ao catálogo</LinkButton>
      </div>
    );
  }
  const [existing] = await db
    .select({ id: enrollments.id, status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), ne(enrollments.status, "cancelada")))
    .limit(1);
  if (existing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Alert variant="info">Você já possui matrícula nesta turma. Acompanhe pelo portal do aluno.</Alert>
        <div className="mt-4 flex gap-3">
          <LinkButton href="/aluno">Ir para o portal</LinkButton>
          <LinkButton href={`/matricula/confirmacao?enrollment=${existing.id}`} variant="secondary">Ver matrícula</LinkButton>
        </div>
      </div>
    );
  }
  const taken = await takenSeats(cohortId);
  if (ctx.cohort.status !== "aberta" || taken >= ctx.cohort.capacity || ctx.cohort.endDate < todayISO()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Alert variant="warn">Esta turma está lotada ou com matrículas encerradas. Fale conosco para entrar na lista de espera.</Alert>
        <div className="mt-4 flex gap-3">
          <LinkButton href={`/cursos/${ctx.course.slug}`} variant="secondary">Voltar ao curso</LinkButton>
          <LinkButton href="/contato">Lista de espera</LinkButton>
        </div>
      </div>
    );
  }

  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1);
  const cfg = await getSettings();
  const mp = mercadopagoConfigured();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted" aria-label="Trilha">
        <Link href={`/cursos/${ctx.course.slug}`} className="hover:text-brand">← {ctx.course.name}</Link>
      </nav>
      <CheckoutClient
        cohortId={cohortId}
        userName={user.name}
        userEmail={user.email}
        emailVerified={!!user.emailVerifiedAt}
        course={{ name: ctx.course.name, priceCents: ctx.course.priceCents, entryCents: ctx.course.entryCents, maxInstallments: ctx.course.maxInstallments }}
        cohort={{ name: ctx.cohort.name, startDate: ctx.cohort.startDate, endDate: ctx.cohort.endDate, days: weekdaysLabel(ctx.cohort.daysOfWeek), time: `${ctx.cohort.startTime}–${ctx.cohort.endTime}`, available: ctx.cohort.capacity - taken }}
        address={[cfg.institution.address, cfg.institution.city].filter(Boolean).join(" — ")}
        profile={profile ? {
          cpf: profile.cpf ?? "", birthDate: profile.birthDate ?? "", phone: profile.phone ?? "",
          cep: profile.cep ?? "", street: profile.street ?? "", number: profile.number ?? "",
          complement: profile.complement ?? "", district: profile.district ?? "", city: profile.city ?? "", state: profile.state ?? "",
          guardianName: profile.guardianName ?? "", guardianCpf: profile.guardianCpf ?? "", guardianPhone: profile.guardianPhone ?? "",
        } : null}
        methods={{ manual: cfg.finance.allowManual, pix: cfg.finance.allowPix && mp, card: cfg.finance.allowCard && mp, gatewayConfigured: mp }}
        contractText={cfg.finance.contractText}
        cancellationText={cfg.finance.cancellationText}
      />
      <Card className="mt-6 p-4 text-xs text-muted">
        <strong className="text-ink">Segurança:</strong> seus dados são validados no servidor, a vaga é reservada com controle de capacidade e o pagamento online é processado pelo gateway — não armazenamos dados de cartão.
      </Card>
    </div>
  );
}