import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { inArray, eq } from "drizzle-orm";
import { Award, BookOpen, CalendarDays, CheckCircle2, Clock, FileText, MapPin, Package, ShieldCheck, Users } from "lucide-react";
import { db } from "@/db";
import { teachers, users } from "@/db/schema";
import { getCourseBySlug } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { brl, fmtDate, weekdaysLabel } from "@/lib/utils";
import { Badge, Card, LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCourseBySlug(slug);
  if (!data) return { title: "Curso não encontrado" };
  return { title: data.course.name, description: data.course.shortDescription };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCourseBySlug(slug);
  if (!data) notFound();
  const { course, categoryName, cohorts } = data;
  const cfg = await getSettings();

  const teacherIds = [...new Set(cohorts.map((c) => c.teacherId).filter((x): x is string => !!x))];
  const teacherRows = teacherIds.length
    ? await db.select({ id: teachers.id, name: users.name }).from(teachers).innerJoin(users, eq(users.id, teachers.userId)).where(inArray(teachers.id, teacherIds))
    : [];
  const teacherName = new Map(teacherRows.map((t) => [t.id, t.name]));
  const syllabus = course.syllabus.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted" aria-label="Trilha">
        <Link href="/cursos" className="hover:text-brand">Cursos</Link> <span aria-hidden>/</span> <span className="text-ink">{course.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {categoryName ? <Badge variant="brand">{categoryName}</Badge> : null}
            <Badge variant="neutral"><MapPin className="h-3 w-3" />Presencial</Badge>
            {course.certificateEnabled ? <Badge variant="success"><Award className="h-3 w-3" />Com certificado</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{course.name}</h1>
          <p className="mt-3 text-lg text-muted">{course.shortDescription}</p>

          <div className="mt-6 overflow-hidden rounded-3xl border border-line">
            {course.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.imageUrl} alt={`Imagem do curso ${course.name}`} className="aspect-[16/8] w-full object-cover" />
            ) : (
              <div className="dot-grid flex aspect-[16/8] items-center justify-center bg-brand-soft"><LogoMark size={80} /></div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Card className="flex items-center gap-3 px-5 py-4"><Clock className="h-5 w-5 text-brand" /><div><p className="text-sm font-bold text-ink">{course.workloadHours} horas</p><p className="text-xs text-muted">Carga horária</p></div></Card>
            <Card className="flex items-center gap-3 px-5 py-4"><CalendarDays className="h-5 w-5 text-brand" /><div><p className="text-sm font-bold text-ink">{course.durationMonths} {course.durationMonths === 1 ? "mês" : "meses"}</p><p className="text-xs text-muted">Duração</p></div></Card>
            <Card className="flex items-center gap-3 px-5 py-4"><ShieldCheck className="h-5 w-5 text-brand" /><div><p className="text-sm font-bold text-ink">{course.minAttendancePct}% de frequência</p><p className="text-xs text-muted">Mínimo para certificado</p></div></Card>
          </div>

          {course.description ? (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><BookOpen className="h-5 w-5 text-brand" />Sobre o curso</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
                {course.description.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          ) : null}

          {syllabus.length > 0 ? (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><FileText className="h-5 w-5 text-brand" />Conteúdo programático</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {syllabus.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{s}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {course.prerequisites ? (
              <Card className="p-5">
                <h3 className="font-bold text-ink">Pré-requisitos</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{course.prerequisites}</p>
              </Card>
            ) : null}
            {course.materials ? (
              <Card className="p-5">
                <h3 className="flex items-center gap-2 font-bold text-ink"><Package className="h-4 w-4 text-brand" />Materiais</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{course.materials}</p>
              </Card>
            ) : null}
          </div>

          {course.certificateEnabled ? (
            <Card className="mt-10 flex flex-wrap items-center gap-4 border-sage/60 bg-brand-soft p-5">
              <Award className="h-8 w-8 text-brand" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-brand-deep dark:text-brand">Certificado digital com verificação online</h3>
                <p className="text-sm text-muted">Emitido ao concluir com média mínima de {course.minGradeH / 100} e frequência de {course.minAttendancePct}%. Curso livre — não há declaração de reconhecimento pelo MEC.</p>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Coluna de matrícula */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Investimento</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-brand-deep dark:text-brand">{brl(course.priceCents)}</p>
            <p className="mt-1 text-sm text-muted">
              Pix ou cartão em até {course.maxInstallments}x · ou entrada de {brl(course.entryCents)} + {course.maxInstallments} mensalidades
            </p>
            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Turmas</p>
              {cohorts.length === 0 ? (
                <div className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
                  Sem turmas abertas no momento. <Link href="/contato" className="font-semibold text-brand hover:underline">Entre na lista de interesse</Link>.
                </div>
              ) : (
                cohorts.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-ink">{c.name}</p>
                      {c.status === "aberta" && c.available > 0 ? (
                        <Badge variant={c.available <= 3 ? "warn" : "success"}><Users className="h-3 w-3" />{c.available} {c.available === 1 ? "vaga" : "vagas"}</Badge>
                      ) : (
                        <Badge variant="danger">{c.status !== "aberta" ? "Fechada" : "Lotada"}</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted">
                      <p>{weekdaysLabel(c.daysOfWeek)} · {c.startTime}–{c.endTime}</p>
                      <p>{fmtDate(c.startDate)} a {fmtDate(c.endDate)}</p>
                      {c.teacherId && teacherName.get(c.teacherId) ? <p>Prof. {teacherName.get(c.teacherId)}</p> : null}
                    </div>
                    {c.status === "aberta" && c.available > 0 ? (
                      <LinkButton href={`/checkout/${c.id}`} className="mt-3 w-full">Matricular nesta turma</LinkButton>
                    ) : (
                      <LinkButton href="/contato" variant="secondary" className="mt-3 w-full">Lista de espera</LinkButton>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card className="p-5 text-sm text-muted">
            <p className="flex items-center gap-2 font-semibold text-ink"><MapPin className="h-4 w-4 text-brand" />Local das aulas</p>
            <p className="mt-2">{cfg.institution.address || "Unidade da Gráfica Lima"}{cfg.institution.city ? ` — ${cfg.institution.city}` : ""}</p>
            <p className="mt-1 text-xs">{cfg.institution.hours}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}