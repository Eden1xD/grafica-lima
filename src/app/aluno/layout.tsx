import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/aluno", label: "Visão geral" },
  { href: "/aluno/notas", label: "Notas" },
  { href: "/aluno/frequencia", label: "Frequência" },
  { href: "/aluno/financeiro", label: "Financeiro" },
  { href: "/aluno/certificados", label: "Certificados" },
  { href: "/aluno/perfil", label: "Perfil" },
];

export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/aluno");
  return (
    <PortalShell user={user} tabs={TABS} homeHref="/aluno">
      {children}
    </PortalShell>
  );
}