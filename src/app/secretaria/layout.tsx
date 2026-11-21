import type { ReactNode } from "react";
import { requirePermission } from "@/lib/auth/guards";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/secretaria", label: "Visão geral" },
  { href: "/admin/alunos", label: "Alunos" },
  { href: "/admin/matriculas", label: "Matrículas" },
  { href: "/admin/turmas", label: "Turmas" },
  { href: "/admin/professores", label: "Professores" },
  { href: "/admin/comunicados", label: "Comunicados" },
  { href: "/notificacoes", label: "Notificações" },
];

export default async function SecretariaLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission("alunos.ver", "/secretaria");
  return (
    <PortalShell user={user} tabs={TABS} homeHref="/secretaria">
      {children}
    </PortalShell>
  );
}