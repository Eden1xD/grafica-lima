"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { IDLE } from "@/lib/action-state";
import { btnCls, Spinner, type BtnVariant } from "@/components/ui";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/* ---------- Toasts globais ---------- */
type Toast = { id: number; type: "ok" | "error"; message: string };

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { type: "ok" | "error"; message: string };
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, ...detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }
    window.addEventListener("gl:toast", onToast);
    return () => window.removeEventListener("gl:toast", onToast);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur animate-fade-up",
            t.type === "ok" ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger",
          )}
        >
          {t.type === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button aria-label="Fechar" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function toast(type: "ok" | "error", message: string) {
  window.dispatchEvent(new CustomEvent("gl:toast", { detail: { type, message } }));
}

/* ---------- Botão com estado de envio ---------- */
export function SubmitButton({ label, pendingLabel = "Enviando…", variant = "primary", size = "md", className, icon }: { label: string; pendingLabel?: string; variant?: BtnVariant; size?: "sm" | "md" | "lg"; className?: string; icon?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnCls(variant, size, className)}>
      {pending ? <Spinner /> : icon}
      {pending ? pendingLabel : label}
    </button>
  );
}

/* ---------- Formulário de server action ---------- */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitVariant = "primary",
  submitSize = "md",
  pendingLabel,
  hidden,
  className,
  inline = false,
  confirm,
  onDone,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  submitVariant?: BtnVariant;
  submitSize?: "sm" | "md" | "lg";
  pendingLabel?: string;
  hidden?: Record<string, string>;
  className?: string;
  inline?: boolean;
  confirm?: string;
  onDone?: (state: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const lastRef = useRef<ActionState>(IDLE);
  useEffect(() => {
    if (state === lastRef.current || state.status === "idle") return;
    lastRef.current = state;
    if (state.message && !inline) toast(state.status === "ok" ? "ok" : "error", state.message);
    onDone?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      {children}
      {inline && state.message ? (
        <p role="status" className={cn("mt-2 rounded-lg px-3 py-2 text-sm font-medium", state.status === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {state.message}
        </p>
      ) : null}
      {submitLabel ? <SubmitButton label={submitLabel} pendingLabel={pendingLabel} variant={submitVariant} size={submitSize} /> : null}
    </form>
  );
}

/* ---------- Painel recolhível (sem JS extra) ---------- */
export function Collapse({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-ink transition hover:text-brand">
        {title}
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}