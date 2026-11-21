import Link from "next/link";
import { CalendarDays, Clock, MapPin, Star, Users } from "lucide-react";
import type { CatalogItem } from "@/lib/catalog";
import { brl, fmtDate } from "@/lib/utils";
import { Badge, LinkButton } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export function CourseCard({ item }: { item: CatalogItem }) {
  const { course, categoryName, nextCohort } = item;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/cursos/${course.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-brand-soft" aria-label={course.name}>
        {course.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="dot-grid flex h-full w-full items-center justify-center">
            <LogoMark size={64} className="opacity-80" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {categoryName ? <Badge variant="brand" className="bg-surface/90 backdrop-blur">{categoryName}</Badge> : null}
          {course.featured ? (
            <Badge variant="warn" className="bg-surface/90 backdrop-blur">
              <Star className="h-3 w-3" /> Destaque
            </Badge>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Link href={`/cursos/${course.slug}`} className="text-lg font-bold tracking-tight text-ink transition hover:text-brand">
            {course.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{course.shortDescription}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.workloadHours}h</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{course.durationMonths} {course.durationMonths === 1 ? "mês" : "meses"}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Presencial</span>
        </div>
        {nextCohort ? (
          <div className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-xs">
            <span className="font-medium text-ink">Próxima turma: {fmtDate(nextCohort.startDate)}</span>
            {nextCohort.available > 0 ? (
              <Badge variant={nextCohort.available <= 3 ? "warn" : "success"}>
                <Users className="h-3 w-3" />
                {nextCohort.available} {nextCohort.available === 1 ? "vaga" : "vagas"}
              </Badge>
            ) : (
              <Badge variant="danger">Lotada</Badge>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">Turmas em formação — fale conosco</div>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div>
            <p className="text-lg font-bold text-brand-deep dark:text-brand">{brl(course.priceCents)}</p>
            <p className="text-[11px] text-muted">Pix, cartão ou entrada + mensalidades</p>
          </div>
          <LinkButton href={`/cursos/${course.slug}`} variant="soft" size="sm">
            Ver curso
          </LinkButton>
        </div>
      </div>
    </article>
  );
}