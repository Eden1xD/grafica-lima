"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { btnCls } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/cursos", label: "Cursos" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
  { href: "/faq", label: "Dúvidas" },
];

export function MobileNav({ authed, portalHref }: { authed: boolean; portalHref: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-50 border-b border-line bg-surface shadow-lg animate-fade-up">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Menu principal">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-brand-soft hover:text-brand-deep dark:hover:text-brand">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-line pt-3">
              {authed ? (
                <Link href={portalHref} className={btnCls("primary", "md", "flex-1")} onClick={() => setOpen(false)}>
                  Meu portal
                </Link>
              ) : (
                <>
                  <Link href="/entrar" className={btnCls("secondary", "md", "flex-1")} onClick={() => setOpen(false)}>
                    Entrar
                  </Link>
                  <Link href="/cursos" className={btnCls("primary", "md", "flex-1")} onClick={() => setOpen(false)}>
                    Matricule-se
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

export function MobileBrand() {
  return (
    <Link href="/" aria-label="Página inicial" className="md:hidden">
      <Logo size={34} />
    </Link>
  );
}