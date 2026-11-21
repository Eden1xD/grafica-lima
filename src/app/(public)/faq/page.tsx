import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Perguntas frequentes" };

export default async function FaqPage() {
  const cfg = await getSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">Dúvidas</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Perguntas frequentes</h1>
      <div className="mt-8 space-y-3">
        {cfg.faq.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-ink">
              {f.q}
              <span className="text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <p className="border-t border-line px-5 py-4 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-line bg-brand-soft p-6 text-center">
        <p className="font-semibold text-brand-deep dark:text-brand">Não encontrou sua resposta?</p>
        <LinkButton href="/contato" className="mt-3">Falar com a equipe</LinkButton>
      </div>
    </div>
  );
}