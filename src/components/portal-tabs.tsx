"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PortalTabs({ tabs, homeHref }: { tabs: Array<{ href: string; label: string }>; homeHref: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === homeHref ? pathname === href : pathname.startsWith(href));
  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Menu do portal">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive(t.href) ? "bg-brand-soft font-semibold text-brand-deep dark:text-brand" : "text-muted hover:text-brand",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <nav className="flex gap-1 overflow-x-auto border-t border-line bg-surface px-3 py-2 md:hidden" aria-label="Menu do portal (móvel)">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              isActive(t.href) ? "bg-brand-soft text-brand-deep dark:text-brand" : "text-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}