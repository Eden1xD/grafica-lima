import Link from "next/link";
import type { Metadata } from "next";
import { and, eq, gte, lt } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { classSessions, cohorts, courses } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { cn, todayISO, WEEKDAYS_SHORT } from "@/lib/utils";
import { Badge, Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendário acadêmico" };

export default async function AdminCalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireRole(STAFF, "/admin/calendario");
  const sp = await searchParams;
  const today = todayISO();
  const base = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const firstIso = first.toISOString().slice(0, 10);
  const nextIso = next.toISOString().slice(0, 10);

  const rows = await db
    .select({ s: classSessions, cohort: cohorts.name, cohortId: cohorts.id, course: courses.name })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(gte(classSessions.date, firstIso), lt(classSessions.date, nextIso)))
    .orderBy(classSessions.date);
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byDate.get(r.s.date) ?? [];
    list.push(r);
    byDate.set(r.s.date, list);
  }

  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<{ iso: string; day: number } | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ iso: `${base}-${String(i + 1).padStart(2, "0")}`, day: i + 1 })),
  ];
  const monthLabel = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const linkFor = (d: Date) => `/admin/calendario?mes=${d.toISOString().slice(0, 7)}`;

  return (
    <div>
      <PageTitle
        title="Calendário acadêmico"
        description="Aulas de todas as turmas. Cancelamentos e remarcações notificam os alunos."
        actions={
          <div className="flex items-center gap-2">
            <Link href={linkFor(prev)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface hover:text-brand"><ChevronLeft className="h-4 w-4" /></Link>
            <span className="min-w-40 text-center text-sm font-bold capitalize text-ink">{monthLabel}</span>
            <Link href={linkFor(next)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface hover:text-brand"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge variant="info">Agendada</Badge>
        <Badge variant="success">Concluída</Badge>
        <Badge variant="danger">Cancelada</Badge>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
          {WEEKDAYS_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => (
            <div key={i} className={cn("min-h-24 border-b border-r border-line/60 p-1.5", !c && "bg-bg/50", c?.iso === today && "bg-brand-soft/60")}>
              {c ? (
                <>
                  <p className={cn("mb-1 text-right text-xs font-bold", c.iso === today ? "text-brand" : "text-muted")}>{c.day}</p>
                  <div className="space-y-1">
                    {(byDate.get(c.iso) ?? []).slice(0, 3).map((r) => (
                      <Link
                        key={r.s.id}
                        href={`/admin/turmas/${r.cohortId}`}
                        className={cn(
                          "block truncate rounded-md px-1.5 py-1 text-[10px] font-semibold transition hover:opacity-80",
                          r.s.status === "cancelada" ? "bg-danger-soft text-danger line-through" : r.s.status === "concluida" ? "bg-success-soft text-success" : "bg-info-soft text-info",
                        )}
                        title={`${r.course} · ${r.cohort} · ${r.s.startTime}`}
                      >
                        {r.s.startTime} {r.course}
                      </Link>
                    ))}
                    {(byDate.get(c.iso)?.length ?? 0) > 3 ? <p className="text-[10px] text-muted">+{(byDate.get(c.iso)?.length ?? 0) - 3} mais</p> : null}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}