"use client";

import { useState } from "react";
import { Check, ChevronDown, Repeat } from "lucide-react";
import type { Role } from "@/db/schema";
import { setActiveRoleAction } from "@/server/actions/roles";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Seletor de função ativa — mostra apenas cargos realmente atribuídos; troca sem logout. */
export function RoleSwitcher({ roles, active, compact = false }: { roles: Role[]; active: Role; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (roles.length <= 1) {
    return (
      <span className="flex h-9 items-center rounded-lg bg-brand-soft px-3 text-xs font-bold text-brand-deep dark:text-brand">
        {ROLE_LABEL[active]}
      </span>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-xs font-bold text-brand-deep transition hover:bg-sage/40 dark:text-brand"
        title="Alternar função (sem sair da conta)"
      >
        <Repeat className="h-3.5 w-3.5" />
        {!compact ? <span className="hidden sm:inline">Função:</span> : null}
        {ROLE_LABEL[active]}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl animate-fade-up">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">Minhas funções</p>
            {roles.map((r) => (
              <form key={r} action={setActiveRoleAction}>
                <input type="hidden" name="role" value={r} />
                <button
                  type="submit"
                  role="menuitem"
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand-soft",
                    r === active && "bg-brand-soft",
                  )}
                >
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", r === active ? "bg-brand" : "bg-line")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{ROLE_LABEL[r]}</span>
                    <span className="block text-[11px] leading-snug text-muted">{ROLE_DESCRIPTION[r]}</span>
                  </span>
                  {r === active ? <Check className="mt-1 h-4 w-4 shrink-0 text-brand" /> : null}
                </button>
              </form>
            ))}
            <p className="border-t border-line px-3 py-2 text-[10px] text-muted">A troca organiza a interface. Permissões são sempre validadas no servidor.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}