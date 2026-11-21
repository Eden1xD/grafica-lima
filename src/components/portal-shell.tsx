import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, eq, isNull } from "drizzle-orm";
import { Bell, LogOut } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction } from "@/server/actions/auth";
import { getActiveRole, type SessionUser } from "@/lib/auth/session";
import { firstName } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { PortalTabs } from "@/components/portal-tabs";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobilePortalMenu } from "@/components/mobile-portal-menu";

export async function PortalShell({ user, tabs, homeHref, children }: { user: SessionUser; tabs: Array<{ href: string; label: string }>; homeHref: string; children: ReactNode }) {
  const activeRole = await getActiveRole(user);
  let unread = 0;
  try {
    const [r] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), isNull(notifications.archivedAt)));
    unread = Number(r?.n ?? 0);
  } catch {}
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
  <Link href={homeHref} aria-label="Início do portal">
    <Logo size={34} />
  </Link>

  <div className="hidden md:block">
    <PortalTabs tabs={tabs} homeHref={homeHref} />
  </div>

  <div className="flex items-center gap-2">
    <MobilePortalMenu
      tabs={tabs}
      homeHref={homeHref}
      roles={user.roles}
      activeRole={activeRole}
      userName={user.name}
    />

    {/* Mantenha aqui o botão de notificações e o ThemeToggle atuais. */}

    <div className="hidden items-center gap-2 sm:flex">
      <div className="hidden md:block">
        <RoleSwitcher roles={user.roles} active={activeRole} />
      </div>

      <span className="hidden h-9 items-center rounded-lg bg-surface2 px-3 text-xs font-bold text-ink lg:flex">
        {firstName(user.name)}
      </span>

      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Sair da conta"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-danger/40 hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>

    <form action={logoutAction} className="sm:hidden">
      <button
        type="submit"
        aria-label="Sair da conta"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  </div>
</div>
        <div className="md:hidden">
          <PortalTabs tabs={tabs} homeHref={homeHref} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}