"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { History, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import type { Role } from "@/db/schema";
import { IDLE } from "@/lib/action-state";
import { setUserRolesAction, setUserPermissionAction } from "@/server/actions/roles";
import { PERMISSIONS, ROLE_DESCRIPTION, ROLE_LABEL, isCriticalPermission } from "@/lib/permissions";
import { btnCls, Badge, Field, Select, Spinner } from "@/components/ui";
import { ActionForm, toast } from "@/components/action-form";
import { cn, fmtDateTime } from "@/lib/utils";

const ALL_ROLES: Role[] = ["admin", "secretaria", "financeiro", "professor", "aluno"];

type Props = {
  user: { id: string; name: string; email: string; status: string };
  roles: Role[];
  overrides: Array<{ permission: string; effect: "grant" | "deny" }>;
  history: Array<{ id: string; action: string; actor: string; details: string; createdAt: string }>;
  cohorts: string[];
};

export function RoleModal({ user, roles, overrides, history, cohorts }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Role[]>(roles);
  const [state, formAction, pending] = useActionState(setUserRolesAction, IDLE);
  const last = useRef(IDLE);

  useEffect(() => {
    if (state === last.current || state.status === "idle") return;
    last.current = state;
    if (state.message) toast(state.status === "ok" ? "ok" : "error", state.message);
    if (state.status === "ok") setOpen(false);
  }, [state]);

  useEffect(() => {
    if (open) setChecked(roles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const removesAdmin = roles.includes("admin") && !checked.includes("admin");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnCls("secondary", "sm")}>
        <ShieldCheck className="h-3.5 w-3.5" /> Gerenciar cargos
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Cargos de ${user.name}`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl animate-fade-up">
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {roles.map((r) => <Badge key={r} variant={r === "admin" ? "danger" : "brand"}>{ROLE_LABEL[r]}</Badge>)}
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form
                action={formAction}
                id={`roles-form-${user.id}`}
                onSubmit={(e) => {
                  if (removesAdmin && !window.confirm("Atenção: você está removendo o cargo ADMINISTRADOR desta conta. Confirmar?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="userId" value={user.id} />
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Cargos (múltiplos permitidos)</p>
                <div className="space-y-1.5">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition", checked.includes(r) ? "border-brand/50 bg-brand-soft" : "border-line hover:border-brand/30")}>
                      <input
                        type="checkbox"
                        name="roles"
                        value={r}
                        checked={checked.includes(r)}
                        onChange={() => setChecked((c) => (c.includes(r) ? c.filter((x) => x !== r) : [...c, r]))}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{ROLE_LABEL[r]}</span>
                        <span className="block text-[11px] text-muted">{ROLE_DESCRIPTION[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {removesAdmin ? <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-[11px] font-semibold text-warn">Remoção de Administrador: o servidor impedirá se for o último admin ativo.</p> : null}
              </form>

              {/* Permissões personalizadas */}
              <div className="mt-5 border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><SlidersHorizontal className="h-3.5 w-3.5" />Permissões personalizadas</p>
                <p className="mt-1 text-[11px] text-muted">Concessões/restrições além dos cargos. Restrição sempre vence. Críticas exigem cargo Administrador.</p>
                {overrides.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {overrides.map((o) => (
                      <li key={o.permission} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-xs">
                        <span className="font-semibold text-ink">{PERMISSIONS.find((p) => p.key === o.permission)?.label ?? o.permission}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant={o.effect === "grant" ? "success" : "danger"}>{o.effect === "grant" ? "Concedida" : "Restrita"}</Badge>
                          <ActionForm action={setUserPermissionAction} hidden={{ userId: user.id, permission: o.permission, effect: "clear" }} submitLabel="Remover" submitVariant="ghost" submitSize="sm" />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ActionForm action={setUserPermissionAction} hidden={{ userId: user.id }} submitLabel="Aplicar" submitSize="sm" submitVariant="secondary" className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Permissão" className="min-w-44 flex-1">
                    <Select name="permission" defaultValue="financeiro.ver">
                      {PERMISSIONS.map((p) => (
                        <option key={p.key} value={p.key} disabled={isCriticalPermission(p.key) && !checked.includes("admin")}>
                          {p.module} · {p.label}{isCriticalPermission(p.key) ? " (crítica)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Efeito">
                    <Select name="effect" defaultValue="grant" className="w-32">
                      <option value="grant">Conceder</option>
                      <option value="deny">Restringir</option>
                    </Select>
                  </Field>
                </ActionForm>
              </div>

              {/* Turmas vinculadas */}
              {cohorts.length > 0 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Turmas vinculadas (professor)</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{cohorts.map((c) => <Badge key={c} variant="info">{c}</Badge>)}</div>
                </div>
              ) : null}

              {/* Histórico */}
              {history.length > 0 ? (
                <details className="mt-5 border-t border-line pt-4">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><History className="h-3.5 w-3.5" />Histórico de alterações ({history.length})</summary>
                  <ul className="mt-2 space-y-1.5">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-lg bg-bg px-3 py-2 text-[11px] text-muted">
                        <span className="font-semibold text-ink">{h.action}</span> · por {h.actor} · {fmtDateTime(h.createdAt)}
                        {h.details !== "—" ? <span className="block truncate">{h.details}</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className={btnCls("ghost", "md")}>Cancelar</button>
              <button type="submit" form={`roles-form-${user.id}`} disabled={pending || checked.length === 0} className={btnCls("primary", "md")}>
                {pending ? <Spinner /> : null} Salvar alterações
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}