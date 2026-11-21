"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import type { Role } from "@/db/schema";
import { ROLE_LABEL } from "@/lib/permissions";
import { firstName } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { RoleSwitcher } from "@/components/role-switcher";

type PortalTab = {
  href: string;
  label: string;
};

type MobilePortalMenuProps = {
  tabs: PortalTab[];
  homeHref: string;
  roles: Role[];
  activeRole: Role;
  userName: string;
};

export function MobilePortalMenu({
  tabs,
  homeHref,
  roles,
  activeRole,
  userName,
}: MobilePortalMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function isCurrent(href: string) {
    if (href === homeHref) {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const drawer =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[9998] bg-black/60"
            />

            <aside
  aria-label="Menu do portal"
  className="fixed inset-y-0 left-0 z-[9999] flex w-[85vw] max-w-[21rem] flex-col border-r border-line bg-surface shadow-2xl"
>
              <div className="flex items-center justify-between border-b border-line px-4 py-4">
                <Link
                  href={homeHref}
                  onClick={() => setOpen(false)}
                  aria-label="Início do portal"
                >
                  <Logo size={34} />
                </Link>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-line px-4 py-4">
                <p className="mb-3 text-sm font-bold text-ink">
                  Olá, {firstName(userName)}
                </p>

                <p className="mb-2 text-xs text-muted">Trocar função</p>

                <RoleSwitcher
                  roles={roles}
                  active={activeRole}
                  compact
                />

                <p className="mt-2 text-xs text-muted">
                  Função atual: {ROLE_LABEL[activeRole]}
                </p>
              </div>

              <nav className="flex-1 overflow-y-auto p-3">
                <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted">
                  Menu
                </p>

                <ul className="space-y-1">
                  {tabs.map((tab) => {
                    const current = isCurrent(tab.href);

                    return (
                      <li key={tab.href}>
                        <Link
                          href={tab.href}
                          onClick={() => setOpen(false)}
                          aria-current={current ? "page" : undefined}
                          className={`flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                            current
                              ? "bg-brand-soft text-brand-deep dark:text-brand"
                              : "text-ink hover:bg-surface2"
                          }`}
                        >
                          {tab.label}
                          <ChevronRight className="h-4 w-4 opacity-60" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu do portal"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {drawer}
    </>
  );
}