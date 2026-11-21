import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Award, BookOpen, GraduationCap, ShieldCheck, Wallet } from "lucide-react";
import type { Role } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { homeForRole } from "@/lib/auth/session";
import { setActiveRoleAction } from "@/server/actions/roles";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/permissions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { btnCls } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Selecionar função" };

const ICONS: Record<Role, typeof ShieldCheck> = {
  admin: ShieldCheck,
  secretaria: BookOpen,
  financeiro: Wallet,
  professor: GraduationCap,
  aluno: Award,
};

export default async function SelecionarFuncaoPage() {
  const user = await requireUser("/selecionar-funcao");
  if (user.roles.length === 1) redirect(homeForRole(user.roles[0]));
  return (
    <div className="dot-grid min-h-dvh">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Logo size={36} />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Olá, {user.name.split(" ")[0]}!</h1>
        <p className="mt-2 text-muted">Sua conta possui várias funções. Escolha como quer trabalhar agora — você pode alternar depois pelo cabeçalho, sem sair da conta.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {user.roles.map((r) => {
            const Icon = ICONS[r];
            return (
              <form key={r} action={setActiveRoleAction} className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand/50 hover:shadow-md">
                <input type="hidden" name="role" value={r} />
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                <p className="mt-3 font-bold text-ink">{ROLE_LABEL[r]}</p>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted">{ROLE_DESCRIPTION[r]}</p>
                <button type="submit" className={btnCls("primary", "sm", "mt-4 w-full")}>Entrar como {ROLE_LABEL[r]}</button>
              </form>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-muted">A função selecionada organiza a interface. Todas as permissões continuam sendo validadas no servidor.</p>
      </main>
    </div>
  );
}