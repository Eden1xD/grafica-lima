"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award, Bell, BookOpen, CalendarDays, ChevronLeft, ClipboardList, GraduationCap, LayoutDashboard,
  LogOut, Megaphone, Menu, Palette, ScrollText, Settings, ShieldCheck, Target, Ticket, UserCog, Users, Wallet, X,
} from "lucide-react";
import type { Role } from "@/db/schema";
import { logoutAction } from "@/server/actions/auth";
import { cn, firstName } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { RoleSwitcher } from "@/components/role-switcher";

type Item = { href: string; label: string; icon: typeof Bell };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Principal",
    items: [
      { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
      { href: "/admin/calendario", label: "Calendário", icon: CalendarDays },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    title: "Acadêmico",
    items: [
      { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
      { href: "/admin/turmas", label: "Turmas", icon: Users },
      { href: "/admin/alunos", label: "Alunos", icon: GraduationCap },
      { href: "/admin/professores", label: "Professores", icon: UserCog },
      { href: "/admin/matriculas", label: "Matrículas", icon: ClipboardList },
      { href: "/admin/certificados", label: "Certificados", icon: Award },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/admin/cupons", label: "Cupons", icon: Ticket },
    ],
  },
  {
    title: "Comercial e comunicação",
    items: [
      { href: "/admin/leads", label: "Interessados", icon: Target },
      { href: "/admin/comunicados", label: "Comunicados", icon: Megaphone },
    ],
  },
  {
    title: "Site",
    items: [{ href: "/admin/site", label: "Editor do site", icon: Palette }],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/usuarios", label: "Usuários e papéis", icon: UserCog },
      { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
      { href: "/admin/privacidade", label: "Privacidade LGPD", icon: ShieldCheck },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const HIDDEN_FOR: Partial<Record<Role, string[]>> = {
  secretaria: ["/admin/usuarios", "/admin/auditoria", "/admin/configuracoes", "/admin/site"],
  financeiro: ["/admin/cursos", "/admin/turmas", "/admin/alunos", "/admin/professores", "/admin/certificados", "/admin/usuarios", "/admin/auditoria", "/admin/configuracoes", "/admin/site", "/admin/comunicados", "/admin/calendario"],
};

function titleFor(pathname: string): string {
  for (const g of GROUPS) for (const i of g.items) if (i.href === pathname) return i.label;
  if (pathname.startsWith("/admin/cursos/")) return "Editar curso";
  if (pathname.startsWith("/admin/turmas/")) return "Turma";
  if (pathname.startsWith("/admin/matriculas/")) return "Matrícula";
  return "Administração";
}

export function AdminShell({ user, unread, children }: { user: { name: string; role: Role; roles: Role[] }; unread: number; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hidden = HIDDEN_FOR[user.role] ?? [];
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !hidden.includes(i.href)) })).filter((g) => g.items.length > 0);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-ink">
      <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-2")}>
        {collapsed ? <LogoMark size={36} /> : <Logo onDark size={36} />}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Menu administrativo">
        {groups.map((g) => (
          <div key={g.title}>
            {!collapsed ? <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sage/80">{g.title}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    title={i.label}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive(i.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition",
                      collapsed && "justify-center",
                      isActive(i.href) ? "bg-sage/20 font-semibold text-white" : "text-sidebar-ink/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <i.icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">{i.label}</span> : null}
                    {!collapsed && i.href === "/notificacoes" && unread > 0 ? (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden items-center justify-center gap-2 border-t border-white/10 py-3 text-xs font-semibold text-sidebar-ink/70 transition hover:text-white lg:flex"
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
        {!collapsed ? "Recolher" : null}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 transition-all lg:block", collapsed ? "w-[72px]" : "w-64")}>{sidebar}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 h-full w-72 shadow-xl">{sidebar}</aside>
          <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="absolute left-[19rem] top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
       <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
  <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Administração
        </p>
        <h1 className="truncate text-sm font-bold text-ink">
          {titleFor(pathname)}
        </h1>
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-1.5">
      <Link
        href="/"
        target="_blank"
        className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-muted transition hover:text-brand sm:block"
      >
        Ver site ↗
      </Link>

      <Link
        href="/notificacoes"
        aria-label={`Notificações (${unread} não lidas)`}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-brand"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>

      <ThemeToggle />

      <div className="hidden sm:block">
        <RoleSwitcher roles={user.roles} active={user.role} compact />
      </div>

      <span className="hidden h-9 items-center rounded-lg bg-surface2 px-3 text-xs font-bold text-ink lg:flex">
        {firstName(user.name)}
      </span>

      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Sair"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:border-danger/40 hover:text-danger"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </div>
  </div>

  <div className="mobile-role-switcher">
  <span>Trocar função</span>
  <RoleSwitcher roles={user.roles} active={user.role} compact />
</div>
</header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}