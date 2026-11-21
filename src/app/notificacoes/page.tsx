import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { Archive, Bell, BookOpen, CalendarDays, CheckCheck, CreditCard, Megaphone, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { homeForUser } from "@/lib/auth/session";
import { markAllReadAction, markNotificationReadAction, archiveNotificationAction } from "@/server/actions/notifications";
import { cn, fmtDateTime } from "@/lib/utils";
import { Button, Card, EmptyState, PageTitle } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PushOptIn } from "@/components/push-optin";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notificações" };

const ICONS: Record<string, typeof Bell> = {
  pagamento: CreditCard, matricula: ShieldCheck, nota: BookOpen, atividade: BookOpen,
  aula: CalendarDays, comunicado: Megaphone, certificado: ShieldCheck, revisao: BookOpen,
};

export default async function NotificacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const user = await requireUser("/notificacoes");
  const sp = await searchParams;
  const filtro = sp.filtro ?? "todas";
  const conditions = [eq(notifications.userId, user.id)];
  if (filtro === "nao_lidas") conditions.push(isNull(notifications.readAt), isNull(notifications.archivedAt));
  else if (filtro === "arquivadas") conditions.push(isNotNull(notifications.archivedAt));
  else conditions.push(isNull(notifications.archivedAt));
  const rows = await db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(100);
  const home = await homeForUser(user);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href={home} aria-label="Voltar ao portal"><Logo size={34} /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href={home} className="text-sm font-semibold text-brand hover:underline">← Voltar ao portal</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <PageTitle
          title="Central de notificações"
          description="Funciona mesmo quando o push não está disponível."
          actions={
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary" size="sm"><CheckCheck className="h-4 w-4" />Marcar todas como lidas</Button>
            </form>
          }
        />
        <PushOptIn />
        <nav className="mt-6 flex gap-1" aria-label="Filtros">
          {[
            { id: "todas", label: "Todas" },
            { id: "nao_lidas", label: "Não lidas" },
            { id: "arquivadas", label: "Arquivadas" },
          ].map((f) => (
            <Link
              key={f.id}
              href={`/notificacoes${f.id === "todas" ? "" : `?filtro=${f.id}`}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", filtro === f.id ? "bg-brand-soft text-brand-deep dark:text-brand" : "text-muted hover:text-brand")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 space-y-2.5">
          {rows.length === 0 ? (
            <EmptyState icon={<Bell className="h-8 w-8" />} title="Nenhuma notificação aqui" description="Avisos de matrícula, pagamentos, notas, aulas e comunicados aparecerão nesta central." />
          ) : (
            rows.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const unread = !n.readAt;
              return (
                <Card key={n.id} className={cn("flex items-start gap-3.5 p-4", unread && "border-brand/40 bg-brand-soft/40")}>
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", unread ? "bg-brand text-white" : "bg-surface2 text-muted")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", unread ? "font-bold text-ink" : "font-medium text-muted")}>{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-xs text-muted">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted">{fmtDateTime(n.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.link ? <Link href={n.link} className="text-xs font-semibold text-brand hover:underline">Abrir →</Link> : null}
                      {unread ? <ActionForm action={markNotificationReadAction} hidden={{ id: n.id }} submitLabel="Marcar lida" submitVariant="ghost" submitSize="sm" /> : null}
                      {!n.archivedAt ? <ActionForm action={archiveNotificationAction} hidden={{ id: n.id }} submitLabel="Arquivar" submitVariant="ghost" submitSize="sm" /> : null}
                    </div>
                  </div>
                  {unread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Não lida" /> : null}
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}