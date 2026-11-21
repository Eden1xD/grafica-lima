import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/professor", label: "Minhas turmas" },
  { href: "/notificacoes", label: "Notificações" },
];

export default async function ProfessorLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["professor", "admin", "secretaria"], "/professor");
  return (
    <PortalShell user={user} tabs={TABS} homeHref="/professor">
      {children}
    </PortalShell>
  );
}