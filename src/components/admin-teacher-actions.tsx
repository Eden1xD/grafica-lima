"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteTeacherAction, updateTeacherAction } from "@/server/actions/admin-teachers";
import type { ActionState } from "@/server/actions/types";

type Teacher = { id: string; name: string; email: string; specialties: string; bio: string; publicVisible: boolean };
const initialState: ActionState = { success: false, message: "" };

function TeacherDialog({ teacher, mode, onClose }: { teacher: Teacher; mode: "edit" | "delete"; onClose: () => void }) {
  const [state, action, pending] = useActionState(mode === "edit" ? updateTeacherAction : deleteTeacherAction, initialState);
  useEffect(() => { if (state.success) onClose(); }, [state.success, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Editar professor" : "Excluir professor"} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{mode === "edit" ? "Editar professor" : "Excluir professor"}</h2><p className="mt-1 text-sm text-muted">{teacher.name}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-bg"><X size={18} /></button>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="teacherId" value={teacher.id} />
          {mode === "edit" ? (
            <>
              <label className="block text-sm font-medium">Nome completo<input name="name" required minLength={3} maxLength={120} defaultValue={teacher.name} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">E-mail<input name="email" type="email" required maxLength={160} defaultValue={teacher.email} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">Especialidades<input name="specialties" maxLength={500} defaultValue={teacher.specialties} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="block text-sm font-medium">Mini bio<textarea name="bio" rows={4} maxLength={5000} defaultValue={teacher.bio} className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicVisible" defaultChecked={teacher.publicVisible} /> Exibir professor no site</label>
            </>
          ) : (
            <>
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">O vínculo e o cargo de professor serão removidos. A conta e os outros cargos serão preservados. Professores associados a turmas não podem ser excluídos.</p>
              <label className="block text-sm font-medium">Senha da sua conta administrativa<input name="adminPassword" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2" /></label>
            </>
          )}
          {state.message && !state.success ? <p role="alert" className="text-sm text-red-500">{state.message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={pending} className={mode === "delete" ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" : "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"}>{pending ? "Aguarde..." : mode === "edit" ? "Salvar alterações" : "Confirmar exclusão"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminTeacherActions({ teacher, canDelete }: { teacher: Teacher; canDelete: boolean }) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  return (
    <>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setMode("edit")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-brand hover:text-brand"><Pencil size={13} />Editar</button>
        {canDelete ? <button type="button" onClick={() => setMode("delete")} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"><Trash2 size={13} />Excluir</button> : null}
      </div>
      {mode ? <TeacherDialog key={`${teacher.id}-${mode}`} teacher={teacher} mode={mode} onClose={() => setMode(null)} /> : null}
    </>
  );
}
