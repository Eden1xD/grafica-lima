import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ---------- Botões ---------- */
export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export function btnCls(variant: BtnVariant = "primary", size: "sm" | "md" | "lg" = "md", extra?: string): string {
  const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" };
  const variants: Record<BtnVariant, string> = {
    primary: "bg-brand text-white hover:opacity-90 shadow-sm",
    secondary: "border border-line bg-surface text-ink hover:border-brand/50 hover:text-brand",
    ghost: "text-muted hover:text-brand hover:bg-brand-soft",
    danger: "bg-danger text-white hover:opacity-90",
    soft: "bg-brand-soft text-brand-deep dark:text-brand hover:bg-sage/40",
  };
  return cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    sizes[size],
    variants[variant],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }) {
  return <button className={btnCls(variant, size, className)} {...props} />;
}

export function LinkButton({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: BtnVariant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={btnCls(variant, size, className)}>
      {children}
    </Link>
  );
}

/* ---------- Formulários ---------- */
const inputCls =
  "w-full h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, "h-auto min-h-24 py-2.5", className)} {...props} />;
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

/* ---------- Superfícies ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-sm", className)}>{children}</div>;
}

export type BadgeVariant = "success" | "warn" | "danger" | "info" | "brand" | "neutral";
const badgeCls: Record<BadgeVariant, string> = {
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-deep dark:text-brand",
  neutral: "bg-surface2 text-muted",
};

export function Badge({ variant = "neutral", children, className }: { variant?: BadgeVariant; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", badgeCls[variant], className)}>{children}</span>;
}

export const STATUS_BADGES: Record<string, { label: string; variant: BadgeVariant }> = {
  ativa: { label: "Ativa", variant: "success" },
  pendente_pagamento: { label: "Aguardando pagamento", variant: "warn" },
  trancada: { label: "Trancada", variant: "neutral" },
  cancelada: { label: "Cancelada", variant: "danger" },
  concluida: { label: "Concluída", variant: "info" },
  pendente: { label: "Pendente", variant: "warn" },
  aprovado: { label: "Aprovado", variant: "success" },
  recusado: { label: "Recusado", variant: "danger" },
  reembolsado: { label: "Reembolsado", variant: "info" },
  cancelado: { label: "Cancelado", variant: "neutral" },
  paga: { label: "Paga", variant: "success" },
  vencida: { label: "Vencida", variant: "danger" },
  aberta: { label: "Aberta", variant: "success" },
  em_andamento: { label: "Em andamento", variant: "info" },
  encerrada: { label: "Encerrada", variant: "neutral" },
  agendada: { label: "Agendada", variant: "info" },
  publicado: { label: "Publicado", variant: "success" },
  publicada: { label: "Publicada", variant: "success" },
  rascunho: { label: "Rascunho", variant: "neutral" },
  arquivado: { label: "Arquivado", variant: "neutral" },
  ativo: { label: "Ativo", variant: "success" },
  bloqueado: { label: "Bloqueado", variant: "danger" },
  novo: { label: "Novo", variant: "info" },
  em_contato: { label: "Em contato", variant: "brand" },
  proposta: { label: "Proposta", variant: "warn" },
  convertido: { label: "Convertido", variant: "success" },
  perdido: { label: "Perdido", variant: "neutral" },
  em_analise: { label: "Em análise", variant: "warn" },
  valido: { label: "Válido", variant: "success" },
  revogado: { label: "Revogado", variant: "danger" },
  presente: { label: "Presente", variant: "success" },
  ausente: { label: "Ausente", variant: "danger" },
  justificado: { label: "Falta justificada", variant: "warn" },
};

export function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGES[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <Badge variant={b.variant}>{b.label}</Badge>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon ? <div className="mb-1 text-muted">{icon}</div> : null}
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Alert({ variant = "info", children, className }: { variant?: BadgeVariant; children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl px-4 py-3 text-sm font-medium", badgeCls[variant], className)}>{children}</div>;
}

export function Stat({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: BadgeVariant }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", badgeCls[tone])}>{icon}</div> : null}
      </div>
    </Card>
  );
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}