"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { deleteCourseSecureAction } from "@/server/actions/admin-course-delete";
import type { ActionState } from "@/server/actions/types";

const initialState: ActionState = { success: false, message: "" };

function ConfirmDelete({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteCourseSecureAction, initialState);
  useEffect(() => { if (state.success) onClose(); }, [state.success, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Excluir curso" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Excluir curso</h2><p className="mt-1 text-sm text-muted">{name}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-bg"><X size={18} /></button>
        </div>
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">Cursos com turmas vinculadas serão arquivados para preservar o histórico. Cursos sem turmas poderão ser excluídos permanentemente.</p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm font-medium">Senha da sua conta administrativa
            <input name="adminPassword" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" />
          </label>
          {state.message && !state.success ? <p role="alert" className="text-sm text-red-500">{state.message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Aguarde..." : "Confirmar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminCourseDelete({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"><Trash2 size={13} />Excluir</button>
    {open ? <ConfirmDelete key={id} id={id} name={name} onClose={() => setOpen(false)} /> : null}
  </>;
}
