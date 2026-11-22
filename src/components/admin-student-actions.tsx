"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteStudentAction, updateStudentAction } from "@/server/actions/admin-students";
import type { ActionState } from "@/server/actions/types";

type Student = { id: string; name: string; email: string; phone: string; city: string };
const initialState: ActionState = {
  status: "idle",
  message: "",
};

function StudentForm({ student, mode, onClose }: { student: Student; mode: "edit" | "delete"; onClose: () => void }) {
  const [state, action, pending] = useActionState(mode === "edit" ? updateStudentAction : deleteStudentAction, initialState);
  useEffect(() => {
  if (state.status === "ok") onClose();
}, [state.status, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Editar aluno" : "Excluir aluno"} className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{mode === "edit" ? "Editar aluno" : "Excluir aluno"}</h2><p className="mt-1 text-sm text-muted">{student.name}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-bg"><X size={18} /></button>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={student.id} />
          {mode === "edit" ? (
            <>
              <label className="block text-sm font-medium">Nome completo<input name="name" required minLength={3} maxLength={120} defaultValue={student.name} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">E-mail<input name="email" type="email" required maxLength={160} defaultValue={student.email} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">Telefone<input name="phone" maxLength={30} defaultValue={student.phone} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">Cidade<input name="city" maxLength={120} defaultValue={student.city} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
            </>
          ) : (
            <>
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">Se o aluno possuir matrículas, a conta será bloqueada para preservar notas, certificados e pagamentos. Se não possuir, o sistema tentará excluir a conta.</p>
              <label className="block text-sm font-medium">Senha da sua conta administrativa<input name="adminPassword" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
            </>
          )}
          {state.message && state.status === "error" ? <p role="alert" className="text-sm text-red-500">{state.message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
  <button
    type="button"
    onClick={onClose}
    className="rounded-lg border border-line px-4 py-2 text-sm"
  >
    Cancelar
  </button>

  <button
    type="submit"
    disabled={pending}
    className={
      mode === "delete"
        ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        : "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    }
  >
    {pending
      ? "Aguarde..."
      : mode === "edit"
        ? "Salvar alterações"
        : "Confirmar exclusão"}
  </button>
</div>
        </form>
      </div>
    </div>
  );
}

export function AdminStudentActions({ student, canDelete }: { student: Student; canDelete: boolean }) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  return (
    <>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setMode("edit")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"><Pencil size={13} />Editar</button>
        {canDelete ? <button type="button" onClick={() => setMode("delete")} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"><Trash2 size={13} />Excluir</button> : null}
      </div>
      {mode ? <StudentForm key={`${student.id}-${mode}`} student={student} mode={mode} onClose={() => setMode(null)} /> : null}
    </>
  );
}
