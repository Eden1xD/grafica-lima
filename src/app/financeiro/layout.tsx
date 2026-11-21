import type { ReactNode } from "react";
import { requirePermission } from "@/lib/auth/guards";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/financeiro", label: "Visão geral" },
  { href: "/admin/financeiro", label: "Transações e relatórios" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/notificacoes", label: "Notificações" },
];

export default async function FinanceiroLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission("financeiro.ver", "/financeiro");
  return (
    <PortalShell user={user} tabs={TABS} homeHref="/financeiro">
      {children}
    </PortalShell>
  );
}