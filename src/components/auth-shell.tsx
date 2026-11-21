import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { googleConfigured } from "@/lib/settings";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="dot-grid flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Voltar ao início"><Logo size={44} /></Link>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-7 shadow-sm animate-fade-up">
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  const configured = googleConfigured();
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const g = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.9 3C3.2 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.1 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l2.7-2.6C16.9 1.9 14.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l3.9 3c1-2.9 3.7-4.9 6.9-4.9z" />
    </svg>
  );
  if (!configured) {
    return (
      <div>
        <button type="button" disabled className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-line bg-bg text-sm font-semibold text-muted opacity-70">
          {g} Continuar com Google
        </button>
        <p className="mt-1.5 text-center text-[11px] text-muted">Login Google indisponível: credenciais OAuth não configuradas neste ambiente.</p>
      </div>
    );
  }
  return (
    <a href={href} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition hover:border-brand/50 hover:bg-bg">
      {g} Continuar com Google
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden>
      <span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" />
    </div>
  );
}