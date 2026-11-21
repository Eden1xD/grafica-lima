import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  ArrowRight, Award, CalendarDays, CheckCircle2, ClipboardList, CreditCard,
  GraduationCap, MapPin,ClipboardCheck, MessageCircle, MonitorSmartphone, Sparkles, UserCheck, Users, Wallet,
} from "lucide-react";
import { db } from "@/db";
import { teachers, users } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { getCatalog } from "@/lib/catalog";
import { firstName, fmtDate } from "@/lib/utils";
import { CourseCard } from "@/components/course-card";
import { LinkButton, Badge, Card } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: ClipboardList, title: "Escolha o curso", text: "Explore o catálogo e veja conteúdo, horários e valores." },
  { icon: Users, title: "Selecione a turma", text: "Veja as vagas disponíveis em tempo real." },
  { icon: UserCheck, title: "Faça sua matrícula", text: "Cadastro simples: nome, e-mail e senha. Dados completos só no checkout." },
  { icon: CreditCard, title: "Pague como preferir", text: "Pix, cartão, entrada + mensalidades ou na secretaria." },
  { icon: GraduationCap, title: "Comece as aulas", text: "Acompanhe tudo pelo portal do aluno, no celular ou computador." },
];

const DIFFS = [
  { icon: MonitorSmartphone, title: "100% presencial e prático", text: "Aulas em laboratório com equipamento real e prática desde o primeiro dia." },
  { icon: Users, title: "Turmas reduzidas", text: "Capacidade controlada por turma para o professor acompanhar cada aluno." },
  { icon: Award, title: "Certificado verificável", text: "Certificado digital com código de autenticidade e verificação online." },
  { icon: Wallet, title: "Pagamento facilitado", text: "Pix, cartão parcelado, mensalidades ou pagamento presencial na secretaria." },
];

export default async function HomePage() {
  const cfg = await getSettings();
  const featured = await getCatalog({ featuredOnly: true, pageSize: 3 });
  const catalog = featured.items.length > 0 ? featured : await getCatalog({ pageSize: 3 });
  let team: Array<{ name: string; bio: string; specialties: string }> = [];
  let nextCohort: { name: string; startDate: string } | null = null;
  try {
    const rows = await db
      .select({ name: users.name, bio: teachers.bio, specialties: teachers.specialties })
      .from(teachers)
      .innerJoin(users, eq(users.id, teachers.userId))
      .where(eq(teachers.publicVisible, true))
      .orderBy(asc(users.name))
      .limit(4);
    team = rows;
    const first = catalog.items.find((i) => i.nextCohort)?.nextCohort;
    if (first) nextCohort = { name: first.name, startDate: first.startDate };
  } catch {}

  return (
    <div>
      {cfg.home.marquee ? (
        <div className="overflow-hidden bg-brand-deep py-2 text-xs font-semibold tracking-wide text-sage" role="marquee" aria-label={cfg.home.marquee}>
          <div className="marquee-track flex w-max gap-12 whitespace-nowrap">
            {[0, 1].map((i) => (
              <span key={i} className="flex gap-12">
                {Array.from({ length: 4 }).map((_, j) => (
                  <span key={j} aria-hidden={i === 1}>{cfg.home.marquee}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-sage/25 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-sage/60 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand-deep dark:text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              {cfg.home.heroBadge}
            </span>
            <h1 className="animate-fade-up-1 mt-5 text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              {cfg.home.heroTitle}
            </h1>
            <p className="animate-fade-up-2 mt-5 max-w-xl text-lg leading-relaxed text-muted">{cfg.home.heroSubtitle}</p>
            <div className="animate-fade-up-3 mt-8 flex flex-wrap gap-3">
              <LinkButton href="/cursos" size="lg">
                Explorar cursos <ArrowRight className="h-4 w-4" />
              </LinkButton>
              {cfg.institution.whatsapp ? (
                <a href={`https://wa.me/${cfg.institution.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-6 text-base font-semibold text-ink transition hover:border-brand/50 hover:text-brand">
                  <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                </a>
              ) : (
                <LinkButton href="/contato" variant="secondary" size="lg">Falar com a gente</LinkButton>
              )}
            </div>
            <div className="animate-fade-up-3 mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />Certificado de conclusão</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />Turmas reduzidas</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />Aulas presenciais</span>
            </div>
          </div>

          <div className={cfg.home.show3d ? "hero-3d relative" : "relative"}>
            <div className="overflow-hidden rounded-3xl border border-line shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/hero.jpeg" alt="Laboratório de informática da Gráfica Lima" className="aspect-[4/3] w-full object-cover" />
            </div>
            {cfg.home.show3d ? (
              <>
                <div className="card-3d-a absolute -right-3 -top-6 hidden rounded-2xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur sm:block" aria-hidden>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Award className="h-5 w-5" /></span>
                    <div>
                      <p className="text-sm font-bold text-ink">Certificado digital</p>
                      <p className="text-xs text-muted">Verificação online</p>
                    </div>
                  </div>
                </div>
                <div className="card-3d-b absolute -bottom-6 -left-3 hidden rounded-2xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur sm:block" aria-hidden>
                  <div className="flex items-center gap-3">
                    
                     <div className="flex items-center gap-3">
  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
    <ClipboardCheck className="h-5 w-5" />
  </span>

  <div>
    <p className="text-sm font-bold text-ink">
      {nextCohort ? "Matrículas abertas" : "Turmas presenciais"}
    </p>
    <p className="text-xs text-muted">
      {nextCohort ? "Garanta sua vaga" : "Consulte as próximas datas"}
    </p>
  </div>
</div>
                  </div>
                </div>
              </>
            ) : null}
            <Badge variant="brand" className="absolute left-4 top-4 bg-surface/90 backdrop-blur">
              <MapPin className="h-3 w-3" /> 100% presencial
            </Badge>
          </div>
        </div>
      </section>

      {/* CURSOS EM DESTAQUE */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Catálogo</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Cursos em destaque</h2>
          </div>
          <Link href="/cursos" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {catalog.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.items.map((item) => (
              <CourseCard key={item.course.id} item={item} />
            ))}
          </div>
        ) : (
          <Card className="p-10 text-center">
            <LogoMark size={56} className="mx-auto mb-4" />
            <p className="font-semibold text-ink">Novos cursos em preparação</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Estamos montando as próximas turmas. Fale conosco para receber novidades.</p>
            <LinkButton href="/contato" variant="soft" className="mt-5">Quero ser avisado</LinkButton>
          </Card>
        )}
      </section>

      {/* DIFERENCIAIS */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Por que estudar na {cfg.institution.name}?</h2>
          <div className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFS.map((d) => (
              <div key={d.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><d.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold text-ink">{d.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Matrícula online</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Como funciona</h2>
        <ol className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <s.icon className="h-5 w-5 text-brand" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* PROFESSORES */}
      {team.length > 0 ? (
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Quem ensina</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((t) => (
                <Card key={t.name} className="p-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-deep text-lg font-bold text-sage">{firstName(t.name)[0]?.toUpperCase()}</span>
                  <p className="mt-3 font-bold text-ink">{t.name}</p>
                  {t.specialties ? <p className="text-xs font-semibold text-brand">{t.specialties}</p> : null}
                  {t.bio ? <p className="mt-2 line-clamp-3 text-sm text-muted">{t.bio}</p> : null}
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
<section className="mx-auto w-full max-w-6xl px-4 py-20">
  <div className="w-full">
    <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
      Dúvidas frequentes
    </h2>

    <div className="mt-8 space-y-4">
      {cfg.faq.slice(0, 4).map((f) => (
        <details
          key={f.q}
          className="group rounded-2xl border border-line bg-surface"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 text-base font-semibold text-ink md:text-lg">
            {f.q}
            <span className="ml-4 text-xl text-muted transition group-open:rotate-180">
              ▾
            </span>
          </summary>

          <p className="border-t border-line px-6 py-5 text-base leading-relaxed text-muted">
            {f.a}
          </p>
        </details>
      ))}
    </div>

    <Link
      href="/faq"
      className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-brand hover:underline"
    >
      Todas as perguntas <ArrowRight className="h-5 w-5" />
    </Link>
  </div>
</section>  

     
    </div>
  );
}